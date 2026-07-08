# vscode-gitflow — AI Coding Guide

VS Code extension that adds Git Flow branching workflow commands as sidebar UI
actions. Supports both **git-flow (AVH edition)** and **git-flow-next** via a
variant-aware implementation layer.

- **Language:** TypeScript ^6.0.3 → compiled to `out/extension.js`
- **Bundle:** esbuild (single `out/extension.js`), external: `vscode`
- **VS Code engine:** `>=1.64.0`
- **Target:** Node 14.x
- **Repo:** `https://github.com/Serhioromano/vscode-gitflow`

## Source tree

```
src/
├── extension.ts                  # Activation entry point
├── ViewBranches.ts               # Tree view: branches + all git-flow operations
├── ViewVersions.ts               # Tree view: tags
└── lib/
    ├── GitFlowImplementation.ts  # Abstract base class — variant contract
    ├── GitFlowAVH.ts             # git-flow AVH implementation
    ├── GitFlowNext.ts            # git-flow-next implementation
    ├── Util.ts                   # Shell execution, variant detection, config
    ├── cm.ts                     # CommandManager — registers all VS Code commands
    ├── logger.ts                 # Simple file logger
    ├── decorators.ts             # TypeScript decorators
    ├── disposables.ts            # Base disposable class
    ├── git.d.ts, git-base.d.ts   # Ambient type declarations
l10n/
├── bundle.l10n.json              # Base English strings (auto-generated)
├── bundle.l10n.{de,es,fr,ja,ru,zh-cn}.json  # Translations
package.nls.json                  # package.json localization (English)
package.nls.{de,es,fr,ja,ru,zh-cn}.json      # Translations
plans/                            # Planning documents (not compiled)
```

## Architecture: variant-aware implementation

The extension supports two git-flow CLI variants: **AVH** (classic) and
**Next** (Git Tower's Go rewrite). They differ in flags, command names, and
config output format.

### GitFlowImplementation (abstract)

Defines the contract in `src/lib/GitFlowImplementation.ts`:

```
abstract get variant(): 'avh' | 'next'
abstract parseConfigList(output: string): BranchConfig
abstract isNotInitialized(output: string): boolean
abstract showCommands(): string
abstract initCommand(): string
abstract startFeature/finishFeature/deleteFeature/rebaseFeature(ctx)
abstract startRelease/finishRelease/deleteRelease/rebaseRelease(ctx)
abstract startHotfix/finishHotfix/deleteHotfix/rebaseHotfix(ctx)
abstract startBugfix/finishBugfix/deleteBugfix/rebaseBugfix(ctx)
abstract startSupport/deleteSupport/rebaseSupport(ctx)
```

### GitFlowAVH (classic)

- `showCommands()` → `' --showcommands '` (when `gitflow.showAllCommands` is on)
- `initCommand()` → `'git flow init -f'` (force/non-interactive)
- Finish uses `-f <tmpMsgFile>` for tag messages
- Flags: `-F` (fetch), `-i` (interactive rebase), `-p` (preserve merges)

### GitFlowNext (Tower)

- `showCommands()` → `' '` (always, Next doesn't support `--showcommands`)
- `initCommand()` → `'git flow init'` (no `-f` flag)
- Uses `update --rebase` instead of `rebase`
- Flags: `--fetch` (not `-F`), `--messagefile` (not `-f`)
- Parses hierarchical config format instead of `key=value`

### Variant resolution (Util.gitFlowImpl)

In `src/lib/Util.ts` — lazy-initialized getter:

1. Read `gitflow.variant` setting: `'auto'` | `'avh'` | `'next'`
2. If `'avh'` → `new GitFlowAVH()`
3. If `'next'` → `new GitFlowNext()`
4. If `'auto'` → check `git flow version` output for `'next'` keyword, default to AVH

### How ViewBranches delegates

```ts
// ViewBranches.ts
private get impl(): GitFlowImplementation { return this.util.gitFlowImpl; }

// Simple operations (publish, track, checkout) use _simpleGitFlowOp
// which builds a command string with impl.showCommands():
async publishFeature(node) { await this._simpleGitFlowOp('publish', node, this.branches.feature); }

// Complex operations delegate fully:
async startFeature()   { await this.impl.startFeature(this._ctx()); }
async finishFeature(n) { await this.impl.finishFeature(n, this._ctx()); }

// Init delegates to implementation:
init() { this._runTerminal(this.impl.initCommand()); }
```

## Key classes

### TreeViewBranches (`src/ViewBranches.ts`)

Implements `vscode.TreeDataProvider<Flow | FolderNode>`.

- `getChildren()` — builds the tree: reads `git flow config list`, parses with
  `impl.parseConfigList()`, then groups branches into feature/bugfix/release/
  hotfix/support folders (local + remote). Handles nested branch paths via
  `FolderNode`.
- `impl` getter → `this.util.gitFlowImpl`
- `_ctx()` → builds `OperationContext` with branch lists, config, workspace root
- All feature/bugfix/release/hotfix/support operations delegate to `this.impl.*`
- `init()` → `_runTerminal(this.impl.initCommand())`
- `generalOp(what, branch)` — dispatches finish/delete/rebase/publish by
  detecting branch prefix type
- `_runTerminal(cmd)` — sends command to a "GitFlow" VS Code terminal
- `checkoutBranch()` — `git checkout` with multiple-slash branch name support

### TreeViewVersions (`src/ViewVersions.ts`)

Implements `vscode.TreeDataProvider<Tag>`. Shows git tags. Operations:
`deleteTag`, `pushTag`, `pushTags`. Lazily fetches remote tags.

### Util (`src/lib/Util.ts`)

- `exec(cmd, progress, cb)` — async shell execution
- `execSync(cmd)` — synchronous shell execution
- `path` — resolves to `git` executable path
- `flowPath` — `${gitPath} flow` (or custom `gitflow.path` config)
- `gitFlowImpl` getter — lazy variant detection (see Variant resolution above)
- `check()` — verifies git-flow is installed
- `isReady()`, `resetReady()` — readiness state for tree loading

### CommandManager (`src/lib/cm.ts`)

Registers all VS Code commands (`this.rc("gitflow.xxx", ...)`). Commands:
quickPick, init, refresh, fetchAllBranches, syncAll, checkoutBranch,
newFeature/Bugfix/Release/Hotfix/Support — plus publish/finish/delete/rebase/
track/checkout for each branch type. Tag operations: refreshT, pushTag,
pushTags, deleteTag.

## Localization

All user-facing strings use `vscode.l10n.t()` with `{0}`, `{1}` placeholders:

```ts
vscode.l10n.t('Not a gitflow-enabled repo yet. Please, open a terminal and run `git flow init` command.')
vscode.l10n.t('Finish {0}: {1}', typeName, branchName)
```

**Base bundle:** `l10n/bundle.l10n.json` (auto-generated via
`npx @vscode/l10n-dev export -o l10n src`).

**Translation bundles:** `l10n/bundle.l10n.{de,es,fr,ja,ru,zh-cn}.json` —
6 languages. Update all when adding/changing user-facing strings.

**package.json strings:** `package.nls.json` (base) + `package.nls.{locale}.json`
for command titles, config descriptions, view names.

## Config settings (gitflow.*)

| Setting | Type | Default | Description |
|---|---|---|---|
| `showNotification` | bool | `true` | Show "not initialized" warning |
| `showAllCommands` | bool | `false` | Pass `--showcommands` to git-flow (AVH only) |
| `disableOnRepo` | bool | `false` | Suppress init warning per-workspace |
| `replaceSymbol` | string | `-` | Branch name separator |
| `path` | string | `""` | Custom git-flow executable path |
| `variant` | `auto`/`avh`/`next` | `auto` | Which git-flow implementation to use |
| `autoBumpVersion` | bool | `false` | Auto-bump version on release/hotfix finish |

## Known lint exceptions

These pre-existing issues appear in every lint run — ignore:
- `@typescript-eslint/semi` rule-not-found across all files (eslint version mismatch)
- `curly` warnings at lines 134-135 of `ViewBranches.ts` and line 339 of `GitFlowAVH.ts`


