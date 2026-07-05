# GitHub Authentication via VS Code

## Problem

The extension runs all Git commands through `child_process.execSync/exec` in `src/lib/Util.ts`. This means every `git push`, `git pull`, `git fetch` spawns a child process that uses the **system's Git credential setup** (SSH agent, git credential manager, `.netrc`, etc.). Users who rely on VS Code's built-in GitHub sign-in (Accounts menu → Turn on GitHub Auth) get no benefit from it — their token is only available to the VS Code process, not to child processes.

## Goal

Let users authenticate to GitHub through VS Code's UI (or silently reuse an existing session) so that `git push`/`pull`/`fetch` to GitHub remotes in this extension **just works** without separately configuring SSH keys or HTTPS credentials in the terminal.

## User Experience Workflow

### Happy path: user already signed into GitHub in VS Code

```
1. User opens VS Code
2. Extension activates
3. GitHubAuth.initialize({ silent: true }) — checks for existing GitHub session
   → VS Code has a cached token from a previous login (Accounts menu)
4. getSession('github', ['repo'], { silent: true }) returns the session immediately
5. Askpass script written to extension storage with the token
6. GIT_ASKPASS env var set up — invisible to user
7. User opens a GitHub repo, uses Git Flow features (start feature, push, etc.)
   → git operations use the token from askpass — just works
```

> **User sees:** nothing special. Status bar shows the git flow icon normally.
> Everything works as it always did, except now HTTPS repos work too.

### First-time: user NOT signed into GitHub

```
1. User opens VS Code with a GitHub repo
2. Extension activates
3. GitHubAuth.initialize({ silent: true }) — checks for existing GitHub session
   → No session found
4. isGitHubRemote(cwd) checks repo's origin remote
   → https://github.com/user/repo.git  ✓ this is GitHub
5. vscode.window.showInformationMessage(
     "Sign in to GitHub so Git Flow can push and pull without manual credentials.",
     "Yes, Login Now"
   )
6. [User clicks "Yes, Login Now"]
   → getSession('github', ['repo'], { createIfNone: true })
   → VS Code's built-in GitHub OAuth browser window opens
   → User authorizes the app, browser redirects back to VS Code
   → Session obtained, token stored
   → Askpass script written, GIT_ASKPASS active

   [User dismisses the popup]
   → No GIT_ASKPASS set up
   → Git operations fall through to system credential helpers (as before)
   → Popup does not appear again this session
   → User can still sign in later via:
       - Command Palette: "Git Flow: Sign in to GitHub"
       - VS Code Accounts menu → Turn on GitHub Auth
       - Clicking the status bar item (if configured)
```

> **User sees:** a single info popup on first open. One click to sign in,
> or dismiss and forget. No nagging.

### Already signed in, reopen VS Code next day

```
1. User opens VS Code
2. Extension activates
3. GitHubAuth.initialize({ silent: true })
   → VS Code returns the cached session from keychain immediately
   → No browser window, no popups
4. Askpass script recreated (deleted on previous deactivation)
5. Everything works
```

### User signs in via VS Code Accounts menu mid-session

```
1. User clicks the Accounts icon in VS Code activity bar
2. "Turn on GitHub Auth" → browser OAuth flow completes
3. vscode.authentication.onDidChangeSessions fires
4. GitHubAuth hears the event, detects a new 'github' session
5. Refreshes: gets the new token, rewrites askpass script
6. GIT_ASKPASS active — future git operations use the new token
```

### User signs out mid-session

```
1. User clicks Accounts → signs out of GitHub
2. onDidChangeSessions fires with removed session
3. GitHubAuth deletes the askpass script
4. GIT_ASKPASS deactivated
5. Subsequent git push/pull will fail with auth error (as before)
6. User sees the one-time info popup again asking to sign in
```

### Non-GitHub remote (GitLab, Bitbucket, local-only)

```
1. User opens a repo with origin → gitlab.com or no remote
2. Extension activates
3. isGitHubRemote(cwd) checks origin
   → Returns false (not GitHub)
4. No GIT_ASKPASS injected. No auth popup shown.
5. Everything works as before — system credential helpers handle auth
```

> **User sees:** nothing different. The extension doesn't bother them about
> GitHub auth because their repo isn't on GitHub.

### Token expires mid-operation

```
1. User runs a Git Flow command that pushes to GitHub
2. Git calls the askpass script, gets an expired token
3. GitHub returns 401, git push fails
4. User sees the error message (same as before)
5. GitHubAuth.reauthenticate() can be called to force a new session
   → getSession('github', ['repo'], { forceNewSession: { detail: '...' } })
   → VS Code prompts user to re-authorize
6. New token obtained, askpass script updated
```

## Research: How other VS Code extensions handle GitHub auth

### VS Code Authentication API (`vscode.authentication`)

Built-in auth providers: `'github'`, `'microsoft'`, `'github-enterprise'`, `'microsoft-sovereign-cloud'`.

```ts
// Get a session (prompts user to sign in if needed)
const session = await vscode.authentication.getSession('github', ['repo'], {
  createIfNone: true   // show sign-in dialog if not authenticated
});
console.log(session.accessToken);  // GitHub OAuth token
console.log(session.account.label); // "@username"

// Silent check (no UI)
const existing = await vscode.authentication.getSession('github', ['repo'], {
  silent: true
});  // returns undefined if not signed in

// Re-auth when token expires
const fresh = await vscode.authentication.getSession('github', ['repo'], {
  forceNewSession: { detail: 'Your session expired. Please sign in again.' }
});

// Listen for session changes (user signs in/out in VS Code Accounts menu)
vscode.authentication.onDidChangeSessions(async (e) => {
  if (e.provider.id === 'github') {
    // added, removed, changed arrays
  }
});
```

### GitHub Pull Requests extension (`vscode-pull-request-github`)

- Uses `vscode.authentication.getSession()` for auth
- Scopes: `['repo', 'workflow', 'user:email', 'read:user']`
- Uses token for **GitHub API** calls (Octokit), **not** raw git operations
- Handles expired tokens via `forceNewSession`
- Also checks `process.env.GITHUB_OAUTH_TOKEN` as fallback

### VS Code built-in Git extension (`extensions/git/src/`)

- Has `askpass-main.ts` and `askpass.ts` for interactive credential prompts
- Uses IPC-based GIT_ASKPASS: when git needs credentials, it calls back into the extension host
- Much more complex — handles interactive username/password prompts, SSH passphrases, etc.
- **We don't need this complexity** — we just need to pass a static token

## Approach

Use `vscode.authentication.getSession('github', ['repo'])` to obtain an OAuth token, then inject it into Git child processes via `GIT_ASKPASS` + a temporary shell script.

### Why this approach (and not alternatives)

| Alternative | Why rejected |
|---|---|
| `registerCredentialsProvider` on VS Code Git API | Extension calls `child_process.execSync`, not `vscode.git` API. CredentialsProvider only feeds VS Code Git extension's own operations. |
| Modify remote URLs in-place (`https://TOKEN@github.com/...`) | Mutates user's `.git/config`, leaks token into config file, breaks when token expires. |
| `git config credential.helper` pointing to a persistent script | Leaves a permanent credential helper configured in the user's repo. |
| VS Code Git extension's IPC askpass approach | Overkill — we only need a static token, not interactive prompts. |
| **`GIT_ASKPASS` with simple echo script** (chosen) | Passed as env var per-call, temporary script exists only while extension is active, no repo mutation. Same pattern VS Code Git extension uses (just simpler — no IPC). |

## Implementation Steps

### 1. New module: `src/lib/GitHubAuth.ts`

New file responsible for:

- Requesting a GitHub session on extension activation (silent first, then with UI prompt)
- Listening for session changes (user signs in/out via VS Code Accounts menu)
- Generating a temporary `git-askpass` helper script
- Exposing the token as an env-patch object
- Detecting whether the repo's remote is GitHub (skip for non-GitHub remotes)

```ts
export class GitHubAuth {
  private _session: vscode.AuthenticationSession | null = null;
  private _askpassPath: string | null = null;
  private _disposables: vscode.Disposable[] = [];

  constructor(private context: vscode.ExtensionContext) {}

  /** Call once on activation. Tries silent auth first, falls back to UI prompt. */
  async initialize(silent: boolean = true): Promise<void>;

  /**
   * Environment variables to inject into child processes.
   * Returns null if not authenticated or remote is not GitHub.
   */
  get envPatch(): NodeJS.ProcessEnv | null;

  /** Current session (or null if not signed in) */
  get session(): vscode.AuthenticationSession | null;

  /** UI label: "Signed in as @username" or "Not signed in — click to sign in" */
  get statusLabel(): string;

  /** Force re-authentication (for expired tokens) */
  async reauthenticate(detail: string): Promise<void>;

  /** Check if the current repo's origin remote points to GitHub */
  isGitHubRemote(cwd: string): boolean;

  /** Write/rewrite the temporary askpass script */
  private writeAskpassScript(token: string): void;

  /** Clean up askpass script on deactivation */
  dispose(): void;
}
```

### 2. Patch `src/lib/Util.ts` — inject env into child processes

Modify `execSync()` and `execCb()` / `exec()` to accept and forward an optional `env` override:

```ts
// Before
let out = execSync(preparedCmd, { cwd: this.workspaceRoot, shell: this.shell }).toString();

// After
let out = execSync(preparedCmd, {
  cwd: this.workspaceRoot,
  shell: this.shell,
  env: { ...process.env, ...(this.envPatch ?? {}) }
}).toString();
```

`this.envPatch` would be provided by `GitHubAuth` and set on the `Util` instance by `extension.ts` after initialization.

Key env vars:
- `GIT_ASKPASS` — path to the helper script
- `GIT_TERMINAL_PROMPT=0` — prevent git from falling back to interactive prompt
- `GITHUB_TOKEN` — passed for the script to read (optional; script path is enough since script embeds token)

### 3. The askpass script

Created at `context.globalStorageUri/git-askpass.sh` (Unix) / `.cmd` (Windows).

```sh
#!/bin/sh
# Echo the GitHub token — git calls this when it needs credentials.
# The token is baked in at write time for simplicity.
echo "___TOKEN___"
```

On deactivation, the script file is deleted (housekeeping). On next activation, `initialize({ silent: true })` retrieves VS Code's cached session — no re-authentication needed. On session change (user signs in/out), script is rewritten with the new token.

### 4. Integration in `src/extension.ts`

```ts
// After creating Util, instantiate GitHubAuth
const gitHubAuth = new GitHubAuth(context);
await gitHubAuth.initialize(/* silent = */ true);
util.setEnvPatch(gitHubAuth.envPatch);

// If silent auth failed AND the repo's remote is GitHub, show a one-time popup.
// Skip for non-GitHub remotes (GitLab, Bitbucket, local-only, etc.).
if (!gitHubAuth.session && gitHubAuth.isGitHubRemote(this.workspaceRoot)) {
  const loginNow = 'Yes, Login Now';
  const result = await vscode.window.showInformationMessage(
    'Sign in to GitHub so Git Flow can push and pull to your repositories without manually configuring credentials.',
    loginNow
  );
  if (result === loginNow) {
    await vscode.commands.executeCommand('gitflow.githubSignIn');
    util.setEnvPatch(gitHubAuth.envPatch);
  }
}

// Listen for auth changes (user signs in/out in VS Code Accounts menu)
context.subscriptions.push(
  vscode.authentication.onDidChangeSessions(async (e) => {
    if (e.provider.id === 'github') {
      await gitHubAuth.refresh();
      util.setEnvPatch(gitHubAuth.envPatch);
    }
  })
);

// Add command to trigger sign-in from UI
cm.rc("gitflow.githubSignIn", async () => {
  await gitHubAuth.initialize(/* silent = */ false);
  util.setEnvPatch(gitHubAuth.envPatch);
});
```

### 5. Authentication prompt on silent failure

When `initialize({ silent: true })` returns without a session AND the repo's origin remote points to GitHub (`isGitHubRemote()` returns true), the extension shows a one-time info popup:

> **Sign in to GitHub so Git Flow can push and pull to your repositories without manually configuring credentials.**
>
> [Yes, Login Now]

**Why gate on `isGitHubRemote()`?**
- Non-GitHub remotes (GitLab, Bitbucket, self-hosted) never need this token — showing the popup would be noise.
- Local-only repos with no remote don't need auth at all.
- Public GitHub repos that only do read operations (clone/pull/fetch) don't require auth. The popup still shows once, but is harmless — `GIT_ASKPASS` will be called on the first push attempt, which is the only operation that needs the token.

Clicking **Yes, Login Now** fires the `gitflow.githubSignIn` command, which opens VS Code's built-in GitHub OAuth dialog. After signing in, `GIT_ASKPASS` is activated automatically.

This popup only appears once per activation — if the user dismisses it, they can still sign in later via:
- The status bar item
- The `gitflow.githubSignIn` command in the command palette
- Signing in through VS Code's Accounts menu (triggers `onDidChangeSessions`)

### 6. New VS Code command and UI

**Command** (`package.json`):
```json
{
  "command": "gitflow.githubSignIn",
  "title": "Sign in to GitHub",
  "category": "Git-Flow",
  "icon": "$(github)"
}
```

**Status bar integration**: The existing Git Flow status bar button already shows the "Select Action" dialog on click. Instead of changing its behavior, just vary the icon subtly to indicate auth state:
- Authenticated: `$(account)` — standard VS Code signed-in user icon (or `$(pass-filled)` / custom checkmark variant)
- Not authenticated: `$(account)` with a small cross overlay, or `$(circle-slash)` — users familiar with VS Code will understand they can sign in via the Accounts menu

No extra text, no tooltip noise — the icon alone is enough. Users who want to sign in already know how (VS Code Accounts menu → Turn on GitHub Auth). The extension doesn't need to teach them.

### 7. Scopes

Request scopes: `['repo']` — the minimum needed for push/pull to private repos.

Comparison with other extensions:
| Extension | Scopes |
|---|---|
| GitHub PR extension | `['repo', 'workflow', 'user:email', 'read:user']` |
| **Our extension** | `['repo']` — only what's needed for git push/pull |

`user:email` and `read:user` are for API calls (displaying user info, committing), not needed for raw git operations. `workflow` is for GitHub Actions, not needed.

### 8. Security considerations

- [ ] Askpass script lives in extension global storage (no world-readable `/tmp`)
- [ ] Script is deleted on extension deactivation
- [ ] Script is rewritten (not appended) on session change — no stale tokens
- [ ] Token never logged (add filter to `Logger`)
- [ ] Token never written to `.git/config` or any repo file
- [ ] User can revoke via VS Code Accounts menu at any time

## Files to create

| File | Purpose |
|---|---|
| `src/lib/GitHubAuth.ts` | Session management, askpass script, env-patch generation |

## Files to modify

| File | Change |
|---|---|
| `src/lib/Util.ts` | Accept `envPatch`, merge into `execSync`/`execCb` options |
| `src/extension.ts` | Instantiate `GitHubAuth`, await `initialize()`, pass env to `Util` |
| `package.json` | Add `gitflow.githubSignIn` command, optionally add to menus |

## Edge cases

| Scenario | Behavior |
|---|---|
| User hasn't signed into GitHub in VS Code | Silent `getSession({ silent: true })` returns `undefined`. Status bar shows "Sign in". No GIT_ASKPASS injected — git falls through to system credential helpers. |
| User clicks "Sign in" | `getSession({ createIfNone: true })` shows VS Code's built-in GitHub OAuth dialog. Token obtained. GIT_ASKPASS activated. |
| User reopens VS Code next day (already signed in) | `getSession({ silent: true })` returns cached session automatically — no UI prompt. Askpass script recreated. User sees no difference. |
| User signs in via VS Code Accounts menu | `onDidChangeSessions` fires → refresh `GitHubAuth` → GIT_ASKPASS activated automatically. |
| User signs out | `onDidChangeSessions` fires → delete askpass script → GIT_ASKPASS deactivated. |
| Remote is not GitHub (GitLab, Bitbucket, self-hosted) | `isGitHubRemote()` returns false → no GIT_ASKPASS injected. Git uses system credential helpers as before. Non-GitHub remotes never see the GitHub token. |
| Token expires mid-session | Git push/pull fails with auth error. Extension calls `reauthenticate()` → `getSession({ forceNewSession: { detail } })` → new token. |
| Windows | `.cmd` askpass script (echo %TOKEN%). Cross-platform newline handling. |
| Multi-repo workspace | `execSync/exec` runs with `cwd` set to repo root. `isGitHubRemote()` checks that repo's remote. Per-repo behavior possible. |
| HTTPS vs SSH remotes | SSH remotes (`git@github.com:...`) don't use HTTP credentials. `isGitHubRemote()` should still detect GitHub, but GIT_ASKPASS won't interfere with SSH agent. Harmless. |
| Token in logging | Token value must be filtered from `Logger` output. Add filter in `GitHubAuth` or `Util` to mask token in log messages. |

## Out of scope (future)

- GitLab, Bitbucket, Azure DevOps auth providers
- Using `gh` CLI under the hood instead of raw git
- Credential caching beyond the session lifetime
