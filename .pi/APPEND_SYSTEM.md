After every change to TypeScript source files in `src/`:

1. **CHANGELOG.md** — append entry under `[Unreleased]`.
   - Format: `- <tag>: <description> (#<PR number>)`
   - Allowed tags: `fix`, `feat`, `enhance`, `docs`, `add`, `change`
   - The `[Unreleased]` heading must carry the current date in `MM/DD/YYYY`
     format (e.g., `## [Unreleased] 07/05/2026`). Update it to today's date
     whenever a new entry is appended.
   - Do not create a new version heading (e.g., `[1.4.1]`).
   - Do not change the version in `package.json`.
   - Version bumps and release tag creation are handled by a separate
     automation — entries must remain under `[Unreleased]` until then.
2. **README.md** — if the change introduces a new setting, behavior, or
   user-facing difference, document it in the relevant section.
3. **Localization** — whenever user-facing text is added or changed:
   - **Source code:** wrap all user-visible strings in `vscode.l10n.t()`.
     Use `{0}`, `{1}` placeholders for variables; never string concatenation.
   - **After changes:** run `npx @vscode/l10n-dev export -o l10n src` to
     regenerate `l10n/bundle.l10n.json`.
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
   - Technical Git Flow terms (Feature, Bugfix, Hotfix, Release, Support)
     may stay untranslated where community convention prefers English.
