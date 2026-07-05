# Localization Plan for vscode-gitflow

**Target:** Translate the extension to 6 languages: Russian (`ru`), Chinese Simplified (`zh-cn`), Japanese (`ja`), German (`de`), French (`fr`), Spanish (`es`).

---

## 1. VS Code Localization Architecture

VS Code extensions have two localization surfaces, each with its own mechanism:

### 1.1 Source Code Strings (`vscode.l10n.t`)

- Strings in TypeScript code use the `vscode.l10n.t()` API.
- An extraction tool (`@vscode/l10n-dev`) scans source files and generates `l10n/bundle.l10n.json` — a master file keyed by English strings.
- Per-locale translation files are `l10n/bundle.l10n.<locale>.json` (e.g., `bundle.l10n.ru.json`).
- The `package.json` must declare `"l10n": "./l10n"`.
- VS Code automatically loads the bundle matching `vscode.env.language` at runtime.
- `vscode.l10n.t('Hello {0}', name)` supports templated placeholders `{0}`, `{1}`, etc.

### 1.2 Package Manifest Strings (`package.nls.json`)

- Strings in `package.json` itself (command `title`, `description`, configuration `description`, view `name`) use a separate `package.nls.json` / `package.nls.<locale>.json` system.
- These are resolved at packaging time (not runtime), so the `.vsix` bundles all locales.
- VS Code picks the correct one based on its display language.

### 1.3 `@vscode/l10n-dev` Tooling

| Command | Purpose |
|---|---|
| `npx @vscode/l10n-dev export -o l10n src` | Extract all `vscode.l10n.t()` calls into `l10n/bundle.l10n.json` |
| `npx @vscode/l10n-dev generate-pseudo -o l10n l10n/bundle.l10n.json` | Generate pseudo-localized bundle for testing |

---

## 2. String Inventory

### 2.1 Source Code Strings (to be wrapped in `vscode.l10n.t()`)

These ~60 strings live in `src/extension.ts`, `src/ViewBranches.ts`, `src/ViewVersions.ts`, `src/lib/Util.ts`, `src/lib/cm.ts`.

| # | Current Hardcoded String | File | Context |
|---|---|---|---|
| 1 | `"Git Flow"` | extension.ts | Status bar text |
| 2 | `"Git Flow in progress..."` | Util.ts | Status bar text (running) |
| 3 | `"Git Flow Quick Pick menu"` | extension.ts | Status bar tooltip |
| 4 | `"Current repo: "` | extension.ts | Tree view message prefix |
| 5 | `"Not a multi folder vscode.workspace"` | extension.ts | Info message |
| 6 | `"Select active repository"` | extension.ts | QuickPick title |
| 7 | `"No ORIGIN remote has been found!"` | ViewBranches.ts | Warning (×4) |
| 8 | `"Sync all root branches"` | ViewBranches.ts | Progress title |
| 9 | `"Looks like view was not yet initialized"` | cm.ts | Warning |
| 10 | `"Start new branch"` | cm.ts | QuickPick separator |
| 11 | `"Current branch"` | cm.ts | QuickPick separator |
| 12 | `"Select an action"` | cm.ts | QuickPick title |
| 13 | `"Select branch"` | ViewBranches.ts | QuickPick title |
| 14 | `"Not a gitflow-enabled repo yet. Please, open a terminal and run \`git flow init\` command."` | ViewBranches.ts | Warning message |
| 15 | `"Init"` | ViewBranches.ts | Button label |
| 16 | `"Disable"` | ViewBranches.ts | Button label |
| 17 | `"Releases"` | ViewBranches.ts | Tree item label |
| 18 | `"Features"` | ViewBranches.ts | Tree item label |
| 19 | `"BugFixes"` | ViewBranches.ts | Tree item label |
| 20 | `"HotFixes"` | ViewBranches.ts | Tree item label |
| 21 | `"Support"` | ViewBranches.ts | Tree item label |
| 22 | `"Current"` | ViewBranches.ts | Flow.description |
| 23 | `"local"` | ViewVersions.ts | Tag.description |
| 24 | `"Enter a valid Feature git branch name"` (and Bugfix/Release/Hotfix/Support variants) | ViewBranches.ts | InputBox title (×5) |
| 25-29 | Feature/Bugfix/Release/Hotfix/Support input titles | ViewBranches.ts | 5 separate strings |
| 30 | `"Start support branch based on a tag"` | ViewBranches.ts | QuickPick title |
| 31 | `"Start release based on {0}?"` | ViewBranches.ts | QuickPick title (templated) |
| 32 | `"Select options"` | ViewBranches.ts | QuickPick title |
| 33 | `"Delete local"` | ViewVersions.ts | QuickPick item |
| 34 | `"Delete Remote"` | ViewVersions.ts | QuickPick item |
| 35 | `"Where to delete from?"` | ViewVersions.ts | QuickPick title |
| 36 | `"Select delete options"` | ViewBranches.ts | QuickPick title |
| 37 | `"Select base branch"` | ViewBranches.ts | QuickPick title |
| 38 | `"Error creating a branch: {0}"` | ViewBranches.ts | Error message (templated) |
| 39 | `"Error executing: {0} : {1}"` | Util.ts | Error message (templated, ×2) |
| 40 | `"No folder opened"` | Util.ts | Error message |
| 41 | `"Looks like git CLI is not installed."` | Util.ts | Warning |
| 42 | `"This project is not a Git repository."` | Util.ts | Warning |
| 43 | `"To use Git Flow extension please install Git flow (AVH)."` | Util.ts | Warning |
| 44 | `"Install"` | Util.ts | Button label |
| 45 | `"Git is not found"` | Util.ts | Warning |
| 46 | `"Message"` | ViewBranches.ts | InputBox title |
| 47 | `"Select support branch"` / bugfix / release (variants) | ViewBranches.ts | QuickPick title (×4) |
| 48-52 | Finish options strings (~40 unique option descriptions) | ViewBranches.ts | QuickPick items |
| 53 | `"Could not find any {0}"` | ViewBranches.ts | Warning (templated) |
| 54 | `"Yes"` / `"No"` | ViewBranches.ts | QuickPick items |
| 55 | `"Select bugfix"` / `"Select release branch"` | ViewBranches.ts | QuickPick titles |
| 56 | `"publish"` (QuickPick action) | cm.ts | QuickPick item prefix |
| 57 | `"delete"` / `"finish"` / `"rebase"` | cm.ts | QuickPick item prefixes |

### 2.2 Package.json Strings (to move to `package.nls.json`)

These live in `package.json` and need the NLS system:

| # | Path in package.json | String |
|---|---|---|
| P1 | `contributes.configuration.title` | `"GitFlow"` |
| P2-P8 | `contributes.configuration.properties.*.description` | 7 config descriptions |
| P9 | `contributes.views.scm[0].name` | `"Gitflow"` |
| P10 | `contributes.views.scm[1].name` | `"Versions"` |
| P11-P53 | `contributes.commands[].title` | 43 command titles |
| P54 | `contributes.commands[].category` | `"Git-Flow"` |

---

## 3. Implementation Plan

### Phase 1: Infrastructure Setup (1 PR)

**Goal:** Add tooling, refactor all source strings to use `vscode.l10n.t()`, set up `package.nls.json`.

#### Step 1.1 — Add `l10n` field to `package.json`

```json
"l10n": "./l10n"
```

#### Step 1.2 — Install `@vscode/l10n-dev`

```bash
npm install --save-dev @vscode/l10n-dev
```

#### Step 1.3 — Create `package.nls.json`

Move all user-facing `package.json` strings into `package.nls.json` using `%key%` substitution. Example:

```jsonc
// package.json (after)
"title": "%gitflow.switchRepo.title%"

// package.nls.json
{
  "gitflow.switchRepo.title": "Switch active repository",
  "gitflow.checkoutBranch.title": "Checkout",
  // ...
}
```

#### Step 1.4 — Refactor source code with `vscode.l10n.t()`

All `src/*.ts` files: replace hardcoded user-facing strings with `vscode.l10n.t()` calls.

**Before:**
```ts
vscode.window.showWarningMessage("No ORIGIN remote has been found!");
```

**After:**
```ts
vscode.window.showWarningMessage(vscode.l10n.t("No ORIGIN remote has been found!"));
```

**Variable interpolation:**
```ts
// Before:
`Error creating a branch: ${checked}`

// After:
vscode.l10n.t("Error creating a branch: {0}", checked)
```

**Status bar text:**
```ts
// Before:
statBar.text = "$(list-flat) Git Flow";

// After:
statBar.text = `$(list-flat) ${vscode.l10n.t("Git Flow")}`;
```

#### Step 1.5 — Generate master `bundle.l10n.json`

```bash
npx @vscode/l10n-dev export -o l10n src
```

This creates `l10n/bundle.l10n.json` with all extracted strings.

### Phase 2: Translations (1 PR per language, can be parallel)

Each language needs two files:

| File | Content |
|---|---|
| `l10n/bundle.l10n.{locale}.json` | Source code strings |
| `package.nls.{locale}.json` | Package manifest strings |

**Target locales:**

| Locale | Language | ISO code |
|---|---|---|
| Russian | Русский | `ru` |
| Chinese (Simplified) | 简体中文 | `zh-cn` |
| Japanese | 日本語 | `ja` |
| German | Deutsch | `de` |
| French | Français | `fr` |
| Spanish | Español | `es` |

#### Phase 2.1 — Russian translation
- `l10n/bundle.l10n.ru.json`
- `package.nls.ru.json`

#### Phase 2.2 — Chinese (Simplified)
- `l10n/bundle.l10n.zh-cn.json`
- `package.nls.zh-cn.json`

#### Phase 2.3 — Japanese
- `l10n/bundle.l10n.ja.json`
- `package.nls.ja.json`

#### Phase 2.4 — German
- `l10n/bundle.l10n.de.json`
- `package.nls.de.json`

#### Phase 2.5 — French
- `l10n/bundle.l10n.fr.json`
- `package.nls.fr.json`

#### Phase 2.6 — Spanish
- `l10n/bundle.l10n.es.json`
- `package.nls.es.json`

### Phase 3: Validation & Polish

- Test each locale by switching VS Code display language.
- Verify all tree view labels, command titles, QuickPick dialogs, and notifications.
- Verify templated strings with arguments work correctly in all locales.
- Add `.vscodeignore` entry for `l10n/` source files (only bundle files are needed at runtime, not `bundle.l10n.json` itself for extraction tooling).

### Phase 4: CI Automation (Optional future)

Add a GitHub Action that:
1. Runs `@vscode/l10n-dev export` to check for missing `vscode.l10n.t()` calls.
2. Validates that all locale bundles have entries for every key in `bundle.l10n.json`.

---

## 4. Key Design Decisions & Risks

### Decision: `vscode.l10n.t` vs `vscode-nls`

| API | Pros | Cons |
|---|---|---|
| `vscode.l10n.t` (new) | First-class VS Code API, no npm dependency, simpler, auto-loaded from `/l10n` | Requires VS Code ≥1.73 (extension targets 1.64 but `vscode.l10n.t` is polyfillable) |
| `vscode-nls` (legacy) | Works with older VS Code | Requires npm dependency, more complex setup, deprecated |

**Decision:** Use modern `vscode.l10n.t`. The extension already targets `^1.64.0` — `vscode.l10n.t` was added in 1.73 but the [`@vscode/l10n`](https://www.npmjs.com/package/@vscode/l10n) shim can be used for compatibility. However, since the extension already bundles via esbuild and the VS Code engine is `^1.64.0` which dates to early 2022, we should bump the engine to `^1.73.0` (October 2022) or use the `@vscode/l10n` polyfill.

**Updated decision:** Bump `engines.vscode` to `^1.73.0` — this is a minor bump that won't break any existing users (anyone using a 2022+ VS Code will have it). The current minimum of 1.64 is from February 2022; 1.73 is from November 2022.

### Decision: `package.nls.json` vs inline translation keys

The NLS file approach is standard for VS Code `package.json` localization. Since manifest strings are resolved at pack time, this is the only mechanism. Command `title` and `category`, view `name`, and configuration `description` MUST use `%key%` substitution.

### Risk: Git Flow terminology

Terms like "Feature", "Bugfix", "Hotfix", "Release", "Support" are technical Git Flow terms. In many languages, they should remain in English (or use widely accepted translations). The plan should treat these as technical terms that may stay untranslated per community convention, but translators should be free to translate them where natural.

### Risk: Templated strings and word order

Languages like Russian and Japanese have different word order than English. All templated strings MUST use `{0}`, `{1}` placeholders (not string concatenation) so translators can reorder arguments. Current code has a few concatenations that need refactoring:

```ts
// BAD — cannot be reordered in translation:
"Current repo: " + rootPath.split("/").reverse()[0]

// GOOD — translators can reorder:
vscode.l10n.t("Current repo: {0}", rootPath.split("/").reverse()[0])
```

---

## 5. File Structure After Completion

```
vscode-gitflow/
├── l10n/
│   ├── bundle.l10n.json          # Master extraction (English keys)
│   ├── bundle.l10n.ru.json       # Russian translations
│   ├── bundle.l10n.zh-cn.json    # Chinese (Simplified)
│   ├── bundle.l10n.ja.json       # Japanese
│   ├── bundle.l10n.de.json       # German
│   ├── bundle.l10n.fr.json       # French
│   └── bundle.l10n.es.json       # Spanish
├── package.json                  # With `"l10n": "./l10n"` and %key% references
├── package.nls.json              # English package strings
├── package.nls.ru.json           # Russian package strings
├── package.nls.zh-cn.json        # Chinese package strings
├── package.nls.ja.json           # Japanese package strings
├── package.nls.de.json           # German package strings
├── package.nls.fr.json           # French package strings
├── package.nls.es.json           # Spanish package strings
└── src/
    └── *.ts                       # All strings wrapped in vscode.l10n.t()
```

---

## 6. Timeline Estimate

| Phase | Work | Effort |
|---|---|---|
| Phase 1 | Infrastructure + refactor all strings | ~4-6 hours |
| Phase 2.1 | Russian translation | ~1 hour |
| Phase 2.2 | Chinese (Simplified) | ~1 hour |
| Phase 2.3 | Japanese | ~1 hour |
| Phase 2.4 | German | ~1 hour |
| Phase 2.5 | French | ~1 hour |
| Phase 2.6 | Spanish | ~1 hour |
| Phase 3 | Validation & polish | ~2 hours |

**Total:** ~12-14 hours
