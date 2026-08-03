# GitHub Authentication — Implementation Plan

## Problem

All Git commands run through `child_process.execSync/exec` in `src/lib/Util.ts`.
Child processes use the system's Git credential setup (SSH agent, credential
manager, `.netrc`). Users who signed into GitHub through VS Code's Accounts menu
get no benefit — their token is only available to the VS Code process, not to
child processes.

## Goal

Let Git Flow commands push/pull to GitHub HTTPS remotes using VS Code's built-in
GitHub auth — without requiring separate SSH keys or credential helpers.

## User Experience

### Happy path (already signed in)

1. User opens VS Code → extension activates
2. `GitHubAuth.initialize({ silent: true })` gets cached GitHub session
3. Askpass script written to extension storage with token
4. `GIT_ASKPASS` env var set — invisible to user
5. All Git Flow operations just work for HTTPS GitHub remotes

### First-time (not signed in)

1. Extension activates → silent auth returns `undefined`
2. `isGitHubRemote()` confirms origin is `https://github.com/...`
3. One-time info popup: *"Sign in to GitHub so Git Flow can push and pull
   without manual credentials."*  → [Yes, Login Now]
4. **User clicks:** VS Code GitHub OAuth opens → token obtained →
   askpass script written → everything works
5. **User dismisses:** no GIT_ASKPASS → git falls through to system
   credential helpers (as before). Can sign in later via Accounts menu or
   "Git Flow: Sign in to GitHub" command.

### Signed in, reopen next day

- `getSession({ silent: true })` returns cached session from keychain
  immediately. No browser window, no popups. Askpass recreated.

### Signs in/out mid-session via Accounts menu

- `onDidChangeSessions` fires → `GitHubAuth` refreshes token →
  askpass rewritten (or deleted on sign-out)

### Non-GitHub remote

- `isGitHubRemote()` returns `false` → no GIT_ASKPASS injected, no popup

## Approach

Use `vscode.authentication.getSession('github', ['repo'])` to obtain an OAuth
token, then inject it into Git child processes via `GIT_ASKPASS` + a temporary
shell script.

### Why this approach

| Alternative | Rejected because |
|---|---|
| `registerCredentialsProvider` on VS Code Git API | Extension uses `child_process.execSync`, not `vscode.git` API |
| `https://TOKEN@github.com/...` in remote URL | Mutates `.git/config`, leaks token, breaks on expiry |
| `git config credential.helper` pointing to persistent script | Leaves permanent config in user's repo |
| VS Code Git's IPC askpass | Overkill — we only need a static token, not interactive prompts |
| **`GIT_ASKPASS` with simple echo script** (chosen) | Per-call env var, temporary script, no repo mutation |

## Implementation Steps

### 1. New file: `src/lib/GitHubAuth.ts`

```ts
export class GitHubAuth {
    private _session: vscode.AuthenticationSession | null = null;
    private _askpassPath: string | null = null;
    private _disposables: vscode.Disposable[] = [];

    constructor(private context: vscode.ExtensionContext) {}

    /** Silent (default) or with UI prompt. */
    async initialize(silent: boolean = true): Promise<void>;

    /** Regenerate askpass from current session, or delete if no session. */
    async refresh(): Promise<void>;

    /**
     * Environment variables to merge into child processes.
     * Returns null when not authenticated OR remote is not GitHub.
     */
    get envPatch(): NodeJS.ProcessEnv | null;

    get session(): vscode.AuthenticationSession | null;

    /** "Signed in as @username" or "Not signed in" */
    get statusLabel(): string;

    /** Force re-auth when token expires. */
    async reauthenticate(detail: string): Promise<void>;

    /** Check if origin remote points to GitHub. */
    isGitHubRemote(cwd: string): boolean;

    /** Write/rewrite the askpass script with the given token. */
    private writeAskpassScript(token: string): void;

    /** Delete askpass script, clear state. */
    dispose(): void;
}
```

Key details:

- `initialize(silent)` → calls `getSession('github', ['repo'], { silent })`
  - If `silent: true` and no session → returns (does nothing more)
  - If `silent: false` → `createIfNone: true` → VS Code OAuth dialog
- `refresh()` → gets current session silently, calls `writeAskpassScript`
  or deletes script if no session
- `envPatch` getter → returns `null` if `_session` is null, otherwise
  `{ GIT_ASKPASS: askpassPath, GIT_TERMINAL_PROMPT: '0' }`
- `writeAskpassScript(token)` → writes to `context.globalStorageUri/git-askpass.sh`
  (Unix) or `.cmd` (Windows). Script echoes the embedded token.
  Sets `_askpassPath`.
- `dispose()` → deletes askpass script file

### 2. Patch `src/lib/Util.ts` — inject env vars

Add a private field and public setter:

```ts
private _envPatch: NodeJS.ProcessEnv | null = null;

public setEnvPatch(patch: NodeJS.ProcessEnv | null): void {
    this._envPatch = patch;
}
```

Modify `execSync()` — add `env` to options:

```ts
// Before:
let out = execSync(preparedCmd, { cwd: this.workspaceRoot, shell: this.shell }).toString();

// After:
let out = execSync(preparedCmd, {
    cwd: this.workspaceRoot,
    shell: this.shell,
    env: { ...process.env, ...(this._envPatch ?? {}) }
}).toString();
```

Modify `execCb()` — same change:

```ts
// Before:
exec(preparedCmd, { cwd: this.workspaceRoot, shell: this.shell }, (err, stdout, stderr) => {

// After:
exec(preparedCmd, {
    cwd: this.workspaceRoot,
    shell: this.shell,
    env: { ...process.env, ...(this._envPatch ?? {}) }
}, (err, stdout, stderr) => {
```

The `@MemoizeExpiring(1000)` decorator caches by command string — adding env
vars to options does not affect the cache key, and env vars don't change git
output, so this is safe.

### 3. The askpass script

Created at `context.globalStorageUri/git-askpass.sh` (Unix) / `.cmd` (Windows).

**Unix:**
```sh
#!/bin/sh
echo "___TOKEN___"
```

**Windows:**
```cmd
@echo ___TOKEN___
```

Written by `writeAskpassScript()` with `fs.writeFileSync` + `chmod 0o700`.
Deleted on deactivation (`dispose()`). Rewritten (not appended) on session
change — no stale tokens.

### 4. Integration in `src/extension.ts`

Change `activate` to `async`:

```ts
export async function activate(context: vscode.ExtensionContext) {
```

After creating `util`, instantiate and initialize `GitHubAuth`:

```ts
const util = new Util(rootPath, logger, statBar);

// ── GitHub Auth ──────────────────────────────────────────
const gitHubAuth = new GitHubAuth(context);
await gitHubAuth.initialize(/* silent = */ true);
util.setEnvPatch(gitHubAuth.envPatch);

// If silent auth failed AND remote is GitHub, show one-time popup
if (!gitHubAuth.session && gitHubAuth.isGitHubRemote(rootPath)) {
    const loginNow = vscode.l10n.t('Yes, Login Now');
    const result = await vscode.window.showInformationMessage(
        vscode.l10n.t('Sign in to GitHub so Git Flow can push and pull without manual credentials.'),
        loginNow
    );
    if (result === loginNow) {
        await vscode.commands.executeCommand('gitflow.githubSignIn');
        util.setEnvPatch(gitHubAuth.envPatch);
    }
}

// Listen for session changes
context.subscriptions.push(
    vscode.authentication.onDidChangeSessions(async (e) => {
        if (e.provider.id === 'github') {
            await gitHubAuth.refresh();
            util.setEnvPatch(gitHubAuth.envPatch);
        }
    })
);
```

Register the sign-in command (before or after `CommandManager` creation):

```ts
const cm: CommandManager = new CommandManager(context, logger, viewBranches, viewVersions);

cm.rc("gitflow.githubSignIn", async () => {
    await gitHubAuth.initialize(/* silent = */ false);
    util.setEnvPatch(gitHubAuth.envPatch);
});
```

### 5. Authentication prompt logic

The one-time popup shows only when **all** of these are true:
- `gitHubAuth.session` is null (not signed in)
- `gitHubAuth.isGitHubRemote(rootPath)` returns true (remote is GitHub)
- User hasn't dismissed it yet this session (handled by `showInformationMessage`
  returning `undefined` on dismiss — no further action, popup won't reappear
  until next activation)

If user signs in via Accounts menu later, `onDidChangeSessions` fires and
`GIT_ASKPASS` activates automatically — no popup needed.

### 6. Commands and `package.json`

**New command:**
```json
{
    "command": "gitflow.githubSignIn",
    "title": "Sign in to GitHub",
    "category": "Git-Flow"
}
```

**No `authentication` contribution needed** — the extension consumes VS Code's
built-in `github` auth provider; only auth *providers* declare contributions.

### 7. Token filtering in Logger

Add a method to `GitHubAuth` that returns a regex or replacement function, and
apply it in `Logger.log()` before writing. Or, simpler: pass the token to
`Logger` and let it filter all log calls:

```ts
// In Util, before logging:
const sanitizedCmd = this._envPatch?.GITHUB_TOKEN
    ? cmd.replace(new RegExp(this._envPatch.GITHUB_TOKEN, 'g'), '***')
    : cmd;
```

Since the token is in the askpass script (not in command strings), the main
risk is git error messages echoing the token. Add a filter in `Util.execSync`
and `Util.execCb`:

```ts
private sanitizeOutput(text: string): string {
    // Token is never in _envPatch directly (it's in the askpass file),
    // but git error messages could leak it. Filter just in case.
    return text;
}
```

If `GitHubAuth` stores the token, expose a sanitizer method. Otherwise, the
token is only in the askpass file (world-readable only by owner, `chmod 0o700`),
and git error messages don't echo credentials — so this is a low-risk item.

## Files to create

| File | Purpose |
|---|---|
| `src/lib/GitHubAuth.ts` | Session management, askpass script, env-patch generation |

## Files to modify

| File | Change |
|---|---|
| `src/lib/Util.ts` | Add `_envPatch` field, `setEnvPatch()` setter, merge env into `execSync`/`execCb` |
| `src/extension.ts` | `async activate`, instantiate `GitHubAuth`, register `githubSignIn` command, session listener |
| `package.json` | Add `gitflow.githubSignIn` command |
| `package.nls.json` | Add localized strings for the command and popup |
| `l10n/bundle.l10n.json` | Run `npx @vscode/l10n-dev export` to regenerate |
| `l10n/bundle.l10n.{de,es,fr,ja,ru,zh-cn}.json` | Add translations for new strings |

## Edge cases

| Scenario | Behavior |
|---|---|
| User not signed into GitHub | Silent auth returns `undefined`. No `GIT_ASKPASS`. Git falls through to system credential helpers. One popup if remote is GitHub. |
| User clicks "Yes, Login Now" | `createIfNone: true` → OAuth dialog → token obtained. `GIT_ASKPASS` activated. |
| Reopen VS Code next day (already signed in) | `getSession({ silent: true })` returns cached session. No UI. Askpass recreated. |
| Signs in via Accounts menu mid-session | `onDidChangeSessions` fires → `refresh()` → `GIT_ASKPASS` activated. |
| Signs out mid-session | `onDidChangeSessions` fires → askpass deleted → `GIT_ASKPASS` deactivated. |
| Remote is not GitHub | `isGitHubRemote()` returns `false` → no `GIT_ASKPASS`, no popup. |
| Token expires mid-session | Git push fails with 401. User calls `reauthenticate()` → `forceNewSession` → new token. |
| Windows | `.cmd` script (`@echo %TOKEN%` or embedded token). `platform()` check. |
| Multi-repo workspace | `execSync`/`exec` use `cwd: this.workspaceRoot`. `isGitHubRemote` checks that repo's remote. `switchRepo` updates `workspaceRoot` — `isGitHubRemote` re-evaluates on next call. |
| HTTPS vs SSH remotes | SSH remotes don't use HTTP credentials. `isGitHubRemote()` detects GitHub regardless. `GIT_ASKPASS` won't interfere with SSH agent. Harmless. |
| Token leaked in logs | Token filtered from `Logger` output. Token never in command strings — only in askpass file. |
| `gitflow.variant` setting changes | No impact. Auth layer is independent of variant. |

## Scope

`['repo']` — minimum needed for push/pull to private repos. No `workflow`,
`user:email`, or `read:user` — those are for GitHub API calls, not raw git.

## Out of scope

- GitLab, Bitbucket, Azure DevOps auth providers
- Using `gh` CLI instead of raw git
- Credential caching beyond session lifetime
- Status bar auth indicator (can be added later without architectural changes)
