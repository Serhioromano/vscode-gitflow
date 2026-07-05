After every change to TypeScript source files in `src/` (fix, feature, refactor, config):

1. **CHANGELOG.md** — append entry under the existing `[Unreleased]` heading only.
   - Format: `- <tag>: <description> (#<PR number>)`
   - Allowed tags: `fix`, `feat`, `enhance`, `docs`, `add`, `change`
   - **Do NOT create a new version heading** (e.g., `[1.4.1]`).
   - **Do NOT change the version in `package.json`.**
   - Version bumps and release tag creation are handled by a separate
     automation — entries must remain under `[Unreleased]` until then.
2. **README.md** — if the change introduces a new setting, behavior, or
   user-facing difference, document it in the relevant section.
3. **Localization** — whenever user-facing text is added or changed:
   - **Source code:** wrap all user-visible strings in `vscode.l10n.t()`.
     Use `{0}`, `{1}` placeholders for variables; never string concatenation.
   - **After changes:** run `npx @vscode/l10n-dev export -o l10n src` to
     regenerate the master `l10n/bundle.l10n.json`.
   - **Then update all 6 language bundles** with translations for the new
     or changed keys:
     - `l10n/bundle.l10n.ru.json` (Russian)
     - `l10n/bundle.l10n.zh-cn.json` (Chinese Simplified)
     - `l10n/bundle.l10n.ja.json` (Japanese)
     - `l10n/bundle.l10n.de.json` (German)
     - `l10n/bundle.l10n.fr.json` (French)
     - `l10n/bundle.l10n.es.json` (Spanish)
   - **If the change is in `package.json`** (command titles, category, view
     names, config descriptions), update `package.nls.json` (English base)
     and all `package.nls.{locale}.json` files with the matching key.
   - Technical Git Flow terms (Feature, Bugfix, Hotfix, Release, Support)
     may remain untranslated where community convention prefers English.
