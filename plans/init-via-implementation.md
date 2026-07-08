# Plan: Delegate `init()` to GitFlowImplementation

**Date:** 2026-07-08  
**Issue:** #97 — `git flow init -f` fails for git-flow-next (no `-f` flag), but `-f` is valid for AVH.  
**Status:** planned

## Problem

Currently `TreeViewBranches.init()` hard-codes a single shell command:

```ts
init() {
    this._runTerminal("git flow init");  // was "git flow init -f" before #97 fix
}
```

This is a one-size-fits-all approach. git-flow-next does not support `-f`, while
git-flow AVH does (it forces non-interactive init). The variant is known at
runtime via `this.impl` (`GitFlowAVH` or `GitFlowNext`), so the init command
should be variant-aware.

## Solution

Add an abstract `initCommand(): string` method to `GitFlowImplementation`.
Each subclass returns the correct terminal command string for its variant.

### Files to change

#### 1. `src/lib/GitFlowImplementation.ts`

Add abstract method in the abstract class, under the "Config / detection" section:

```ts
/** Returns the shell command string to run `git flow init` in a terminal. */
abstract initCommand(): string;
```

#### 2. `src/lib/GitFlowAVH.ts`

Add concrete implementation:

```ts
initCommand(): string {
    return "git flow init -f";
}
```

The `-f` flag on AVH means "force" — skips interactive prompts and uses current
branch names from git config. This is the desired behavior for the "Init" button.

#### 3. `src/lib/GitFlowNext.ts`

Add concrete implementation:

```ts
initCommand(): string {
    return "git flow init";
}
```

git-flow-next does not support `-f`. `git flow init` alone launches the
interactive setup.

#### 4. `src/ViewBranches.ts`

Change `init()` to delegate:

```ts
init() {
    this._runTerminal(this.impl.initCommand());
}
```

### Verification

- `npm run compile` — zero TypeScript errors (abstract method must be implemented
  in both `GitFlowAVH` and `GitFlowNext`)
- `npm run lint` — zero new warnings
- Manual test: click "Init" with AVH variant → terminal runs `git flow init -f`
- Manual test: click "Init" with Next variant → terminal runs `git flow init`

### No UI/user-facing changes

The `init()` method signature and behavior from the user's perspective are
unchanged — the command still opens the "GitFlow" terminal and runs `git flow
init`. Only the presence/absence of `-f` changes based on the configured variant.
