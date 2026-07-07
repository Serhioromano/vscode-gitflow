# Git Flow Next Support — Implementation Plan

**Issue**: [#78](https://github.com/Serhioromano/vscode-gitflow/issues/78)
**Date**: 2026-07-07
**Status**: Research complete — ready for implementation

---

## Research Summary

Tested against git-flow AVH `1.12.3` and git-flow-next `v1.1.0` in Docker (Linux amd64).

---

## Architecture: ORM-like Abstraction Layer

The current `ViewBranches.ts` has a monolithic `general()` method that handles all operations (start, finish, delete, rebase) with a giant `switch` statement. Instead of adding `if (variant === next)` branches throughout, we create an abstract interface with two implementations:

```
GitFlowImplementation (abstract class)
    ├── GitFlowAVH    — current logic, EXTRACTED but UNCHANGED
    └── GitFlowNext   — new implementation
```

Each implementation owns:
- **Full operation methods** — `startFeature()`, `finishFeature(node?)`, `deleteFeature(node?)`, `rebaseFeature(node?)` etc. Each method handles its own `showQuickPick` dialogs, command building, and execution end-to-end.
- **Output parsing** — how to interpret `config list` and error messages

`ViewBranches.ts` becomes a thin shell: each method like `startFeature()` just calls `this.impl.startFeature(ctx)`. No `if (variant)` branches, no `general()` switch.

### Why This Design

| Concern | Without ORM | With ORM |
|---------|-------------|----------|
| AVH logic safety | Risk of breaking working code | AVH logic extracted verbatim, never touched again |
| Flag differences | Scattered `if (next)` checks everywhere | Each impl owns its flag dialogs end-to-end |
| New variant in future | More `if/else` branches | New class, no changes to main code |
| Testing | Impossible to unit test | Each impl testable in isolation |

---

## 1. Interface Definition

Only operations that differ between variants go through the interface.
`publish`, `track`, and `checkout` are identical in both — they stay in ViewBranches.

```typescript
// src/lib/GitFlowImplementation.ts

import * as vscode from 'vscode';
import { Util } from './Util';
import { Flow } from '../ViewBranches';

export interface BranchConfig {
    master: string;
    develop: string;
    feature: string;
    bugfix: string;
    release: string;
    hotfix: string;
    support: string;
}

/**
 * Context passed to every operation method.
 * Gives the impl read-only access to ViewBranches state without
 * coupling to ViewBranches internals.
 */
export interface OperationContext {
    listBranches: string[];
    listRemoteBranches: string[];
    curBranch: string;
    branches: BranchConfig;
    hasOrigin: boolean;
    workspaceRoot: string;
    /** Call after the operation completes to refresh the tree view */
    onComplete: () => void;
}

export abstract class GitFlowImplementation {
    constructor(
        protected util: Util,
        protected logger: Logger
    ) {}

    abstract get variant(): 'avh' | 'next';

    abstract get variant(): 'avh' | 'next';

    // ── Config / detection ───────────────────────────────
    abstract parseConfigList(output: string): BranchConfig;
    abstract isNotInitialized(output: string): boolean;

    // ── Feature ──────────────────────────────────────────
    abstract startFeature(ctx: OperationContext): Promise<void>;
    abstract finishFeature(node: Flow | undefined, ctx: OperationContext): Promise<void>;
    abstract deleteFeature(node: Flow | undefined, ctx: OperationContext): Promise<void>;
    abstract rebaseFeature(node: Flow | undefined, ctx: OperationContext): Promise<void>;

    // ── Release ──────────────────────────────────────────
    abstract startRelease(ctx: OperationContext): Promise<void>;
    abstract finishRelease(node: Flow | undefined, ctx: OperationContext): Promise<void>;
    abstract deleteRelease(node: Flow | undefined, ctx: OperationContext): Promise<void>;
    abstract rebaseRelease(node: Flow | undefined, ctx: OperationContext): Promise<void>;

    // ── Hotfix ───────────────────────────────────────────
    abstract startHotfix(ctx: OperationContext): Promise<void>;
    abstract finishHotfix(node: Flow | undefined, ctx: OperationContext): Promise<void>;
    abstract deleteHotfix(node: Flow | undefined, ctx: OperationContext): Promise<void>;
    abstract rebaseHotfix(node: Flow | undefined, ctx: OperationContext): Promise<void>;

    // ── Bugfix ───────────────────────────────────────────
    abstract startBugfix(ctx: OperationContext): Promise<void>;
    abstract finishBugfix(node: Flow | undefined, ctx: OperationContext): Promise<void>;
    abstract deleteBugfix(node: Flow | undefined, ctx: OperationContext): Promise<void>;
    abstract rebaseBugfix(node: Flow | undefined, ctx: OperationContext): Promise<void>;

    // ── Support ──────────────────────────────────────────
    abstract startSupport(ctx: OperationContext): Promise<void>;
    abstract deleteSupport(node: Flow | undefined, ctx: OperationContext): Promise<void>;
    abstract rebaseSupport(node: Flow | undefined, ctx: OperationContext): Promise<void>;
}
```

---

## 2. AVH Implementation

The `general()` method from `ViewBranches.ts` is extracted into dedicated methods.
Each method contains the **verbatim** dialog + command logic from the corresponding
`case` in the current `switch (what)` block.

```typescript
// src/lib/GitFlowAVH.ts

export class GitFlowAVH extends GitFlowImplementation {
    get variant() { return 'avh' as const; }

    // ── Config ───────────────────────────────────────────
    parseConfigList(output: string): BranchConfig { /* current ViewBranches lines ~183-215 */ }
    isNotInitialized(output: string): boolean {
        return output.toLowerCase().includes('not a gitflow-enabled repo yet');
    }

    // ── Feature ──────────────────────────────────────────
    async startFeature(ctx: OperationContext): Promise<void> {
        this.logger.log(`Starting feature branch...`, `git flow feature start`, LogLevels.info);
        // Current "start" case in general() — verbatim:
        //   1. showInputBox for branch name
        //   2. check-ref-format validation
        //   3. build: ${flowPath} feature start ${name}
        //   4. util.exec + ctx.onComplete()
        //   5. logger.log(`Branch created: ${name}`, cmd, LogLevels.info);
    }

    async finishFeature(node: Flow | undefined, ctx: OperationContext): Promise<void> {
        // Current "finish" case + _getFinishOptions('feature') — verbatim:
        //   1. Pick branch (use node or showQuickPick)
        //   2. showQuickPick with AVH finish flags: [-F], [-r], [-p], [-k],
        //      [--keepremote], [--keeplocal], [-D], [-S], [--no-ff], [--push]
        //   3. build: ${flowPath} feature finish${showcommands}${flags} ${name}
        //   4. util.exec + ctx.onComplete()
    }

    async deleteFeature(node: Flow | undefined, ctx: OperationContext): Promise<void> {
        // Current "delete" case — verbatim:
        //   1. Pick branch
        //   2. showQuickPick: [-f] Force, [-r] Delete remote (if has remote)
        //   3. build: ${flowPath} feature delete ${flags} ${name}
        //   4. util.exec + ctx.onComplete()
    }

    async rebaseFeature(node: Flow | undefined, ctx: OperationContext): Promise<void> {
        // Current "rebase" case — verbatim:
        //   1. Pick branch
        //   2. showQuickPick: [-i] Interactive, [-p] Preserve merges
        //   3. showQuickPick for base branch
        //   4. build: ${flowPath} feature rebase ${flags} ${name} ${base}
        //   5. util.exec + ctx.onComplete()
    }

    // ── Release ──────────────────────────────────────────
    async startRelease(ctx: OperationContext): Promise<void> {
        // Same as startFeature but also:
        //   - Pre-fills name with package.json version
        //   - Auto-bumps version in package.json
        //   - Asks "Start release based on <current>?" if on support branch
    }

    async finishRelease(node: Flow | undefined, ctx: OperationContext): Promise<void> {
        // Same as finishFeature but also:
        //   - _getFinishOptions('release') — different flag set
        //   - Tag message input + temp file
        //   - CHANGELOG update
        //   - Flags include: --pushproduction, --pushdevelop, --pushtag,
        //     --ff-master, --nodevelopmerge, -n, -b, -p
        //   - Triggers gitflow.refreshT after completion
    }

    async deleteRelease(node: Flow | undefined, ctx: OperationContext): Promise<void> { /* same pattern */ }
    async rebaseRelease(node: Flow | undefined, ctx: OperationContext): Promise<void> { /* same pattern */ }

    // ── Hotfix ───────────────────────────────────────────
    async startHotfix(ctx: OperationContext): Promise<void> { /* same as startRelease */ }
    async finishHotfix(node: Flow | undefined, ctx: OperationContext): Promise<void> { /* same as finishRelease */ }
    async deleteHotfix(node: Flow | undefined, ctx: OperationContext): Promise<void> { /* same pattern */ }
    async rebaseHotfix(node: Flow | undefined, ctx: OperationContext): Promise<void> { /* same pattern */ }

    // ── Bugfix ───────────────────────────────────────────
    async startBugfix(ctx: OperationContext): Promise<void> { /* same as startFeature */ }
    async finishBugfix(node: Flow | undefined, ctx: OperationContext): Promise<void> {
        // _getFinishOptions('bugfix') — different flag set:
        //   [-F], [-r], [-p], [-k], [--keepremote], [--keeplocal], [-D], [-S], [--no-ff]
        //   (no --push, no tag-related flags)
    }
    async deleteBugfix(node: Flow | undefined, ctx: OperationContext): Promise<void> { /* same pattern */ }
    async rebaseBugfix(node: Flow | undefined, ctx: OperationContext): Promise<void> { /* same pattern */ }

    // ── Support ──────────────────────────────────────────
    async startSupport(ctx: OperationContext): Promise<void> {
        // Current support start logic:
        //   1. showQuickPick for tag (base selection)
        //   2. build: ${flowPath} support start ${name} ${tag}
    }
    async deleteSupport(node: Flow | undefined, ctx: OperationContext): Promise<void> {
        // Current ViewBranches.deleteSupport() — uses git branch -d/-D, not git flow
        // (Support branches don't have git flow delete in AVH)
    }
    async rebaseSupport(node: Flow | undefined, ctx: OperationContext): Promise<void> {
        // Current support rebase: picks base from root branches + tags
    }
}
```

---

## 3. Next Implementation

Each method mirrors the AVH structure but with Next-specific flag dialogs and commands.

```typescript
// src/lib/GitFlowNext.ts

export class GitFlowNext extends GitFlowImplementation {
    get variant() { return 'next' as const; }

    // ── Config ───────────────────────────────────────────
    parseConfigList(output: string): BranchConfig {
        // Parse hierarchical format:
        //   Base branches: → extract main/master + develop names
        //   Topic branch types: → extract Prefix: for each type
    }

    isNotInitialized(output: string): boolean {
        return output.toLowerCase().includes('git-flow is not initialized');
    }

    // ── Feature ──────────────────────────────────────────
    async startFeature(ctx: OperationContext): Promise<void> {
        // Same as AVH — start has no variant-specific flags
        //   1. showInputBox for name
        //   2. check-ref-format
        //   3. ${flowPath} feature start ${name}
        //   4. util.exec + ctx.onComplete()
    }

    async finishFeature(node: Flow | undefined, ctx: OperationContext): Promise<void> {
        //   1. Pick branch
        //   2. showQuickPick with NEXT finish flags ONLY:
        //      [--fetch], [-r], [-p], [-k], [--keepremote], [--keeplocal],
        //      [-D], [--no-ff]
        //      OMITTED: [-S], [--push]
        //   3. Map flags: if user picked "Fetch", use --fetch (not -F)
        //   4. build: ${flowPath} feature finish ${flags} ${name}
        //      (no --showcommands)
        //   5. util.exec + ctx.onComplete()
    }

    async deleteFeature(node: Flow | undefined, ctx: OperationContext): Promise<void> {
        // Same as AVH — delete flags (-f, -r) are identical
    }

    async rebaseFeature(node: Flow | undefined, ctx: OperationContext): Promise<void> {
        //   1. Pick branch
        //   2. showQuickPick with NEXT rebase options:
        //      [--rebase] Force rebase strategy
        //      (no -i or -p — not supported in Next)
        //   3. Pick base branch
        //   4. build: ${flowPath} feature update --rebase ${name}
        //      NOT: ${flowPath} feature rebase
        //   5. util.exec + ctx.onComplete()
    }

    // ── Release ──────────────────────────────────────────
    async startRelease(ctx: OperationContext): Promise<void> { /* same pattern */ }

    async finishRelease(node: Flow | undefined, ctx: OperationContext): Promise<void> {
        //   1. Pick branch
        //   2. showQuickPick with NEXT finish flags ONLY:
        //      [--fetch], [-r], [-p], [-k], [--keepremote], [--keeplocal],
        //      [-D], [--no-ff], [-n]
        //      OMITTED: [-S], [--push], [-b], [--pushproduction],
        //               [--pushdevelop], [--pushtag], [--ff-master],
        //               [--nodevelopmerge]
        //   3. Tag message input → --messagefile <tmpfile>
        //      (NOT -f <tmpfile> — different meaning in Next)
        //   4. CHANGELOG update
        //   5. build: ${flowPath} release finish ${flags} ${name}
        //   6. ctx.onComplete() + gitflow.refreshT
    }

    // ── Hotfix, Bugfix, Support: same patterns ───────────
    async startHotfix(ctx: OperationContext): Promise<void> { /* same as startRelease */ }
    async finishHotfix(node: Flow | undefined, ctx: OperationContext): Promise<void> {
        // Same as finishRelease but _getFinishOptions('hotfix') — Next version
    }
    async deleteHotfix(node: Flow | undefined, ctx: OperationContext): Promise<void> { /* same pattern */ }
    async rebaseHotfix(node: Flow | undefined, ctx: OperationContext): Promise<void> {
        // Same as rebaseFeature: update --rebase
    }

    async startBugfix(ctx: OperationContext): Promise<void> { /* same as startFeature */ }
    async finishBugfix(node: Flow | undefined, ctx: OperationContext): Promise<void> {
        // Same as finishFeature — hide -S and --push
    }
    async deleteBugfix(node: Flow | undefined, ctx: OperationContext): Promise<void> { /* same pattern */ }
    async rebaseBugfix(node: Flow | undefined, ctx: OperationContext): Promise<void> {
        // Same as rebaseFeature: update --rebase
    }

    async startSupport(ctx: OperationContext): Promise<void> { /* same as AVH */ }
    async deleteSupport(node: Flow | undefined, ctx: OperationContext): Promise<void> {
        // Next supports `git flow support delete` natively!
        // Use: git flow support delete ${name} [-f] [-r]
    }
    async rebaseSupport(node: Flow | undefined, ctx: OperationContext): Promise<void> {
        // Same as rebaseFeature: update --rebase
    }
}
```

---

## 4. ViewBranches.ts Changes

Each ViewBranches method becomes a one-liner delegating to the impl.
The `general()` method and `_getFinishOptions()` are removed entirely.
`publish`, `track`, and `checkout` stay in ViewBranches — they have no variant differences.

```typescript
// ViewBranches.ts — after refactor

export class TreeViewBranches implements vscode.TreeDataProvider<Flow | FolderNode> {
    // ... existing fields unchanged ...

    private get impl(): GitFlowImplementation {
        return this.util.gitFlowImpl;
    }

    private _ctx(): OperationContext {
        return {
            listBranches: this.listBranches,
            listRemoteBranches: this.listRemoteBranches,
            curBranch: this.curBranch,
            branches: this.branches,
            hasOrigin: this.hasOrigin,
            workspaceRoot: this.util.workspaceRoot,
            onComplete: () => this._onDidChangeTreeData.fire(),
        };
    }

    // ── Feature ──────────────────────────────────────────
    async startFeature()              { await this.impl.startFeature(this._ctx()); }
    async finishFeature(node?: Flow)  { await this.impl.finishFeature(node, this._ctx()); }
    async deleteFeature(node?: Flow)  { await this.impl.deleteFeature(node, this._ctx()); }
    async rebaseFeature(node?: Flow)  { await this.impl.rebaseFeature(node, this._ctx()); }

    // ── Release ──────────────────────────────────────────
    async startRelease()              { await this.impl.startRelease(this._ctx()); }
    async finishRelease(node?: Flow)  { await this.impl.finishRelease(node, this._ctx()); }
    async deleteRelease(node?: Flow)  { await this.impl.deleteRelease(node, this._ctx()); }
    async rebaseRelease(node?: Flow)  { await this.impl.rebaseRelease(node, this._ctx()); }

    // ── Hotfix ───────────────────────────────────────────
    async startHotfix()               { await this.impl.startHotfix(this._ctx()); }
    async finishHotfix(node?: Flow)   { await this.impl.finishHotfix(node, this._ctx()); }
    async deleteHotfix(node?: Flow)   { await this.impl.deleteHotfix(node, this._ctx()); }
    async rebaseHotfix(node?: Flow)   { await this.impl.rebaseHotfix(node, this._ctx()); }

    // ── Bugfix ───────────────────────────────────────────
    async startBugfix()               { await this.impl.startBugfix(this._ctx()); }
    async finishBugfix(node?: Flow)   { await this.impl.finishBugfix(node, this._ctx()); }
    async deleteBugfix(node?: Flow)   { await this.impl.deleteBugfix(node, this._ctx()); }
    async rebaseBugfix(node?: Flow)   { await this.impl.rebaseBugfix(node, this._ctx()); }

    // ── Support ──────────────────────────────────────────
    async startSupport()              { await this.impl.startSupport(this._ctx()); }
    async deleteSupport(node?: Flow)  { await this.impl.deleteSupport(node, this._ctx()); }
    async rebaseSupport(node?: Flow)  { await this.impl.rebaseSupport(node, this._ctx()); }

    // ── Publish, Track, Checkout — unchanged, stay in ViewBranches ──
    async publishFeature(node?: Flow) { /* existing code — no variant differences */ }
    async trackFeature(node?: Flow)   { /* existing code */ }
    async checkoutFeature(node?: Flow){ /* existing code */ }
    // ... same for release, hotfix, bugfix, support ...

    // ── REMOVED ──────────────────────────────────────────
    // async general(what, branch, search) — DELETED
    // async _getFinishOptions(what) — DELETED (moved into impls)
}
```

---

## 5. File Changes Summary

| File | Change |
|------|--------|
| `src/lib/GitFlowImplementation.ts` | **NEW** — abstract class + `OperationContext` interface |
| `src/lib/GitFlowAVH.ts` | **NEW** — current `general()` + `_getFinishOptions()` logic extracted into dedicated methods |
| `src/lib/GitFlowNext.ts` | **NEW** — Next-specific dialogs + command builders |
| `src/lib/Util.ts` | Add `gitFlowImpl` getter with variant detection |
| `src/ViewBranches.ts` | Delete `general()` and `_getFinishOptions()`. Replace with thin delegation to `this.impl` |
| `package.json` | Add `gitflow.variant` setting |

### Existing Code Safety

- **`GitFlowAVH.ts`**: Each method is a verbatim copy of the corresponding `case` block from `general()` + `_getFinishOptions()`. Same `showQuickPick` calls, same flag strings, same command construction. Zero behavioral change for AVH users.
- **`ViewBranches.ts`**: Only the `general()` method (lines ~412-622) and `_getFinishOptions()` (lines ~624-702) are removed. Tree building, branch display, root-level config parsing, init, sync, `fetchAllBranches`, `checkoutBranch`, publish/track/checkout methods — all untouched.
- **`Util.ts`**: Only `check()` is updated to recognize Next as valid. All `exec`/`execSync` methods unchanged.

---

## 6. Variant Detection

| Tool | `git flow version` output |
|------|--------------------------|
| AVH  | `1.12.3 (AVH Edition)`   |
| Next | `git-flow-next version 1.1.0` |

```typescript
// In Util.ts constructor (or lazy getter):
get gitFlowImpl(): GitFlowImplementation {
    const manual = vscode.workspace.getConfiguration('gitflow').get<string>('variant', 'auto');
    if (manual === 'avh')  return new GitFlowAVH(this);
    if (manual === 'next') return new GitFlowNext(this);

    // auto-detect
    const ver = this.execSync(`${this.flowPath} version`).toLowerCase();
    return ver.includes('next') ? new GitFlowNext(this) : new GitFlowAVH(this);
}
```

### VS Code Setting

```json
"gitflow.variant": {
    "type": "string",
    "enum": ["auto", "avh", "next"],
    "default": "auto",
    "description": "%gitflow.variant.description%"
}
```

---

## 7. Flag Differences — Authoritative Table

From `--help` output of both tools (Docker-tested):

### Finish Flags

| AVH Flag | Purpose | Next Support | Action |
|----------|---------|-------------|--------|
| `-k` | Keep branch | ✅ `-k, --keep` | Same flag |
| `-D` | Force delete branch | ✅ `-D, --force-delete` | Same flag |
| `--keepremote` | Keep remote branch | ✅ `--keepremote` | Same flag |
| `--keeplocal` | Keep local branch | ✅ `--keeplocal` | Same flag |
| `-r` | Rebase before merge | ✅ `-r, --rebase` | Same flag |
| `-p` | Preserve merges | ✅ `-p, --preserve-merges` | Same flag |
| `--no-ff` | No fast-forward | ✅ `--no-ff` | Same flag |
| `-n` | No tag | ✅ `-n, --notag` | Same flag |
| `-F` | Fetch before finish | ⚠️ `--fetch` only | Next impl maps `-F` → `--fetch` |
| `-S` | Squash | ❌ Not in Next | **Hidden** from Next QuickPick |
| `--push` | Push after finish | ❌ Not in Next | **Hidden** |
| `-b` | No back-merge | ❌ Not in Next | **Hidden** |
| `--pushproduction` | Push production | ❌ Not in Next | **Hidden** |
| `--pushdevelop` | Push develop | ❌ Not in Next | **Hidden** |
| `--pushtag` | Push tag | ❌ Not in Next | **Hidden** |
| `--ff-master` | Fast-forward master | ❌ Not in Next | **Hidden** |
| `--nodevelopmerge` | No develop merge | ❌ Not in Next | **Hidden** |
| `--showcommands` | Show git commands | ❌ Not in Next | Skipped for Next |
| `-f <file>` | Tag message file | ⚠️ `--messagefile <file>` | Next impl maps |

### Delete Flags — Identical in Both

| AVH | Next | Purpose |
|-----|------|---------|
| `-f` | `-f, --force` | Force delete |
| `-r` | `-r, --remote` | Delete remote |

### Rebase → Update

| AVH | Next | Notes |
|-----|------|-------|
| `git flow <type> rebase <name> -i -p` | `git flow <type> update --rebase` | `-i` and `-p` not supported in Next |
| | `git flow rebase` (shorthand) | Also available |

---

## 8. Logging Strategy

Every operation method logs to the "Git Flow" output channel using the existing `Logger` class.

### What gets logged

| Point | Content | Level |
|-------|---------|-------|
| Method entry | `[avh|next] Starting feature finish for "my-branch"...` | `INFO` |
| Command built | `[avh|next] CMD: git flow feature finish -k my-feature` | `INFO` |
| Command output | (already logged by `Util.exec` / `Util.execSync`) | `INFO` |
| Command error | (already logged by `Util.exec` on error) | `ERROR` |
| Method complete | `[avh|next] Feature finish completed` | `INFO` |
| User cancelled | `[avh|next] Feature finish cancelled by user` | `INFO` |

### Variant prefix

Each log line includes `[avh]` or `[next]` so the output channel makes it immediately clear which implementation is active:

```
INFO: (12ms) [avh] Starting feature finish for "login-fix"...
INFO: (15ms) [avh] CMD: /usr/bin/git-flow feature finish -k login-fix
INFO: (120ms) [/usr/bin/git-flow feature finish -k login-fix] Switched to branch 'develop'
...
INFO: (350ms) [avh] Feature finish completed
```

### Implementation

```typescript
// In each GitFlowAVH / GitFlowNext method:

async finishFeature(node: Flow | undefined, ctx: OperationContext): Promise<void> {
    const prefix = `[${this.variant}]`;
    const name = /* resolve branch name */;

    this.logger.log(
        `${prefix} Starting feature finish for "${name}"...`,
        `git flow feature finish`,
        LogLevels.info
    );

    // ... show dialogs, build command ...

    if (!flags) {
        this.logger.log(`${prefix} Feature finish cancelled by user`, '', LogLevels.info);
        return;
    }

    const cmd = `${this.util.flowPath} feature finish ${flags} ${name}`;
    this.logger.log(`${prefix} CMD: ${cmd}`, `git flow feature finish`, LogLevels.info);

    this.util.exec(cmd, progress, () => {
        this.logger.log(`${prefix} Feature finish completed`, '', LogLevels.info);
        ctx.onComplete();
    });
}
```

This is additive — the existing `Util.exec`/`Util.execSync` logging of raw command output continues unchanged.

---

## 9. Implementation Order

### Phase 1 — Interface + AVH Extraction + Detection
1. Create `GitFlowImplementation.ts` — abstract class + `OperationContext`
2. Create `GitFlowAVH.ts` — extract each `case` from `general()` + `_getFinishOptions()` into dedicated methods
3. Add `gitFlowImpl` getter to `Util.ts` with variant detection
4. Add `gitflow.variant` setting to `package.json`
5. Replace ViewBranches `general()` + `_getFinishOptions()` with thin delegation calls
6. **Verify**: All existing AVH functionality works exactly as before

### Phase 2 — Next Implementation
1. Create `GitFlowNext.ts` with:
   - Config list parser (hierarchical format)
   - `isNotInitialized()` check
   - Dedicated start/finish/delete/rebase methods with Next-compatible flags only
   - `--fetch` instead of `-F`, `--messagefile` instead of `-f`, `update --rebase` instead of `rebase`
   - Hide `-S`, `--push`, `-b`, `--pushproduction`, etc. from QuickPick dialogs
2. **Verify**: All operations work with git-flow-next

### Phase 3 — Polish
1. Update `README.md`
2. Add `CHANGELOG.md` entries
3. Localization for new setting description
