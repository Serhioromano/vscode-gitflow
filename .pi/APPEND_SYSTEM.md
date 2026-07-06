After every change to TypeScript source files in `src/`:

## Changelog

Append entry under `[Unreleased]` in `CHANGELOG.md`.

- Format: `- <tag>: <description> (#<PR number>)`
- Allowed tags: `fix`, `feat`, `enhance`, `docs`, `add`, `change`
- Update the `[Unreleased]` heading date to today in `MM/DD/YYYY` format
  (e.g., `## [Unreleased] 07/05/2026`).
- Do not create a new version heading (e.g., `[1.4.1]`).
- Do not change the version in `package.json`.
- Version bumps and release tag creation are handled by separate automation.
  Entries must remain under `[Unreleased]` until then.

## README

If the change introduces a new setting, behavior, or user-facing difference,
document it in the relevant section of `README.md`.

## Localization

Whenever user-facing text is added or changed:

- **Source code:** wrap all user-visible strings in `vscode.l10n.t()`. Use
  `{0}`, `{1}` placeholders for variables; never string concatenation.
- **Regenerate base bundle:** run `npx @vscode/l10n-dev export -o l10n src`.
- **Update all 6 language bundles** with translations for new or changed keys:
  - `l10n/bundle.l10n.ru.json` (Russian)
  - `l10n/bundle.l10n.zh-cn.json` (Chinese Simplified)
  - `l10n/bundle.l10n.ja.json` (Japanese)
  - `l10n/bundle.l10n.de.json` (German)
  - `l10n/bundle.l10n.fr.json` (French)
  - `l10n/bundle.l10n.es.json` (Spanish)
- **If the change is in `package.json`** (command titles, category, view
  names, config descriptions), update `package.nls.json` and all
  `package.nls.{locale}.json` files.
- Technical Git Flow terms (Feature, Bugfix, Hotfix, Release, Support) may
  stay untranslated where community convention prefers English.

## Commit summary

After every change, output a short summary suitable for a commit message
(what changed, why). Never commit changes — the user commits manually.

## GitHub CLI

Use `gh` CLI for all GitHub interactions (issues, pull requests, labels,
milestones). Never use web APIs or browser-based workflows for GitHub
operations.
