# Activation Performance Optimization

## Problem (Issue #23)

The extension blocks VS Code's startup for 3-18 seconds when opening a Git repository. Multiple users have reported this since 2022. The root cause is **blocking synchronous `execSync` calls to network-dependent git commands during activation**, executed sequentially and eagerly for both tree views.

### Measured impact
- User reports: 7s → 14s activation (SCM loads 2x slower with extension enabled)
- `git ls-remote --tags origin` is the single worst offender (network round-trip to remote)
- `git branch -r` is the second worst (fetches remote branches)
- Effect amplified on slow connections (VPN, large repos, many tags/branches)
- On Windows, `git flow init` operations also reported 6-minute delays (separate but related: synchronous shell execution)

## Root Cause Analysis

### Activation chain (`src/extension.ts:8-38`)

```
activate()
  ├─ new Util()                    → resolves git path, no I/O
  ├─ new TreeViewBranches(util)
  ├─ createTreeView("gitflowExplorer")
  ├─ viewBranches.getChildren()    ← BLOCKS: 4-6 sync git commands, including 2 network calls
  ├─ new TreeViewVersions(util)
  ├─ createTreeView("gitflowTags")
  └─ viewVersions.getChildren()    ← BLOCKS: 2-3 sync git commands, including 1 network call
```

### Commands executed on startup (worst-case, with origin remote)

| # | Command | Where | Network? | Typical cost |
|---|---------|-------|----------|-------------|
| 1 | `git version` | `Util.check()` → ViewBranches | No | <10ms |
| 2 | `git status` | `Util.check()` → ViewBranches | No | <50ms |
| 3 | `git flow version` | `Util.check()` → ViewBranches | No | <50ms |
| 4 | `git version` | `Util.check()` → ViewVersions | No | <10ms (dup!) |
| 5 | `git status` | `Util.check()` → ViewVersions | No | <50ms (dup!) |
| 6 | `git flow version` | `Util.check()` → ViewVersions | No | <50ms (dup!) |
| 7 | `git flow config list` | ViewBranches | No | <100ms (called twice!) |
| 8 | `git rev-parse --abbrev-ref HEAD` | ViewBranches | No | <10ms |
| 9 | `git flow config list` | ViewBranches | No | <100ms (dup of #7!) |
| 10 | `git branch` | ViewBranches | No | <50ms |
| 11 | `git branch -r` | ViewBranches | **Yes** | 500ms-5s |
| 12 | `git remote` | ViewVersions | No | <50ms |
| 13 | `git ls-remote --tags origin` | ViewVersions | **Yes** | 1-15s |
| 14 | `git tag --sort=-v:refname` | ViewVersions | No | <50ms |

**Total: 12-14 sync, sequential commands. 10+ unique commands. 3 network calls. 2 dupes.**

### Design flaws

1. **Eager `getChildren()` calls**: `extension.ts:33` and `:38` manually invoke `getChildren()` during activation. VS Code's tree views already request children when they become visible — there's no need to pre-fetch.

2. **Synchronous blocking**: All git commands use `execSync` — they block the extension host. Network calls (`git ls-remote`, `git branch -r`) compound this dramatically.

3. **Duplicate `check()` calls**: Both `ViewBranches` and `ViewVersions` each have a module-level `let checked = false` variable. Both call `this.util.check()` independently, running `git version`, `git status`, and `git flow version` **twice** (6 commands total).

4. **Duplicate `git flow config list`**: Called twice in `ViewBranches.getChildren()` — once to check "not a gitflow-enabled repo yet", once to parse the config. Same output, wasted call.

5. **`@MemoizeExpiring(1000)` too short**: The memoization on `execSync` expires after 1 second — useless for commands whose output doesn't change within a session (git version, git path, branch config names).

6. **No lazy-loading for Tags view**: `git ls-remote --tags origin` runs even if the user never opens the Tags panel.

7. **No caching of check() result**: The `check()` method validates git/gitflow installation. Its result won't change mid-session — should be cached and shared.

## Solution Design

### Principle: Move work off the critical path

VS Code's tree views request data **on-demand** when they become visible. The extension should not eagerly fetch data during activation. Network calls should be async, cancellable, and only triggered by user interaction (expanding the tree).

### Phase 1: Eliminate eager loading (low risk, high impact)

**Remove the explicit `getChildren()` calls from `activate()`.**

```ts
// extension.ts — REMOVE these two lines:
viewBranches.getChildren();   // line 33
viewVersions.getChildren();   // line 38
```

VS Code automatically calls `getChildren()` when the tree view needs to render. This alone removes the entire startup chain.

**Impact**: Activation time drops to ~0ms (only `new Util()` constructor runs). Tree views populate when the user first clicks on them, which is the standard VS Code pattern.

### Phase 2: Eliminate duplicate `check()` (low risk)

Replace the module-level `let checked` in both views with a **single cached check** on the `Util` instance.

```ts
// Util.ts — add:
private _checked: boolean = false;

public isReady(): boolean {
    if (this._checked) return true;
    this._checked = this.check();
    return this._checked;
}
```

Both `getChildren()` methods call `this.util.isReady()` instead of their own `check()`.

**Impact**: Saves 3 duplicate git commands on first tree expansion.

### Phase 3: Eliminate duplicate `git flow config list` (low risk)

Cache the parsed config in `TreeViewBranches`:

```ts
// ViewBranches.ts — parse once, store result
private _configList: string | null = null;

private getFlowConfig(): string {
    if (this._configList === null) {
        this._configList = this.util.execSync(`${this.util.flowPath} config list`);
    }
    return this._configList;
}
```

**Impact**: Saves 1 duplicate git command.

### Phase 4: Lazy-load Tags remote data (medium risk)

Move `git ls-remote --tags origin` out of `getChildren()` and into a separate lazy fetch triggered only when the Tags view is expanded. The local `git tag --sort=-v:refname` is fast and sufficient for the default collapsed view.

```ts
// ViewVersions.ts
getChildren(element?: Tag): Thenable<Tag[]> {
    // Only show local tags on initial load
    // Remote tags fetched on-demand via separate method or expand action
}
```

Fetch remote tags only when the user explicitly triggers it (e.g., "Fetch Remote Tags" tree action or expand).

**Impact**: Saves the most expensive network call (`git ls-remote --tags origin`) from every activation.

### Phase 5: Async network commands (medium risk)

Convert `git branch -r` and `git ls-remote --tags origin` to use async `exec` (already exists in Util) instead of `execSync`. Show a loading indicator in the tree view while fetching.

**Impact**: UI remains responsive during network fetches. Tree populates incrementally.

### Phase 6: Smarter memoization (low risk)

Increase `@MemoizeExpiring` duration or switch to `@Memoize` (no expiry) for commands whose output is session-stable:
- `git version` → never changes
- `git flow version` → never changes
- `git flow config list` → changes only on `git flow init` (rare)
- `git remote` → changes only on `git remote add/remove` (rare)

Add explicit cache invalidation on known mutation events rather than time-based expiry.

### Phase 7: Background pre-fetch (optional, nice-to-have)

After the initial render, fire an async background fetch of remote branches and tags so the data is ready when the user expands the tree. Use `setTimeout(0)` or `vscode.window.onDidChangeVisibleTextEditors` to defer until the UI is idle.

## Implementation Order

| Phase | Description | Risk | Impact |
|-------|-------------|------|--------|
| 1 | Remove eager `getChildren()` calls | Low | **High**: eliminates all startup blocking |
| 2 | Single shared `isReady()` cache | Low | Medium: saves 3 dupes on first expand |
| 3 | Deduplicate `git flow config list` | Low | Small: saves 1 call |
| 4 | Lazy-load Tags remote data | Medium | **High**: saves worst network call |
| 5 | Async network commands | Medium | Medium: non-blocking UI |
| 6 | Smarter memoization | Low | Small: fewer redundant calls |
| 7 | Background pre-fetch | Low | Nice-to-have: perceived speed |

Phases 1-3 can be done in a single PR. Phase 4-5 are the next priority. Phase 6-7 are optimizations.

## Verification

1. **Activation time**: With the extension active, open a Git repo in VS Code. Run `Developer: Show Running Extensions` — the extension activation time should be < 50ms (down from seconds).

2. **Tree view still works**: Expand "Git Flow" and "Tags" views — they should populate correctly, just on first expansion rather than during activation.

3. **No regression on `git flow config list`**: The second call should not re-execute the git command — verify in Output → Git Flow channel.

4. **Tags view shows local tags**: Without network access, the Tags tree should still show locally available tags.

5. **Remote data fetched on expand**: Expanding/collapsing the Tags view should trigger the remote fetch if needed.

## Related: Windows `git flow init` performance

Separate from activation, issue #23 also reports `git flow init` taking 6 minutes on Windows. This is likely the `flowPath` shell execution path: the extension uses `shell: this.shell` which on Windows with `usePowerShell` uses PowerShell. The `git flow` command itself may be slow through PowerShell. This should be investigated separately — possibly by switching to direct `spawn` without a shell, or using WSL detection to route through `wsl git flow`.
