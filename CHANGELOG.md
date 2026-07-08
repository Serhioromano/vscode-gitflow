# Change Log

All notable changes to the "gitflow" extension will be documented in this file.

## [Unreleased] 07/08/2026

- fix: refresh tags view now re-fetches remote tags so published tags no longer stuck showing as "local" after refresh (#98)

## [1.6.5] 07/08/2026

- change: upgrade TypeScript to 6.0.3, switch `moduleResolution` to `bundler`, add `skipLibCheck`
- fix: move `git flow init` command into `GitFlowImplementation.initCommand()` so AVH keeps `-f` and git-flow-next omits it — fixes "unknown shorthand flag: 'f'" error for Next users (#97)

## [1.6.0] 07/07/2026

- fix: `--showcommands` flag no longer leaked to git-flow-next operations — `_simpleGitFlowOp` now delegates to `GitFlowImplementation.showCommands()` instead of reading config directly (#80)
- change: Docker `gitflow-next` image now installs git-flow-next v1.1.0 (Go binary from gittower/git-flow-next) instead of nvie/gitflow, fixing `config list` support
- enhance: extract git-flow operations into abstract `GitFlowImplementation` with `GitFlowAVH` backend — enables future `git-flow-next` support without touching core routing (#78)
- add: `gitflow.variant` setting (`auto`/`avh`/`next`) to control which git-flow implementation is used (#78)
- add: `GitFlowNext` implementation with Next-compatible flags (`--fetch` instead of `-F`, `--messagefile` instead of `-f`, `update --rebase` instead of `rebase`, hides unsupported flags) — completes git-flow-next support (#78)

## [1.5.1] 07/06/2026

- fix: robust `git flow config list` parser — handles both human-readable and git-config-style output formats, preventing "Cannot read properties of undefined (reading 'trim')" crash (#56)
- fix: register `gitflow.switchRepo` command before tree view creation — prevents "command not found" error when activation fails during tree loading (#56)
- fix: wrap tree initialization in try-catch — prevents extension activation crash from malformed git-flow config (#56)
- fix: sanitize remote branch list — add .trim() and .filter() to prevent undefined entries (#56)

## [1.5.0] 07/06/2026

- enhance: defer tree-view loading from activation to first expansion — eliminates 12 sync git commands (including 3 network calls) blocking extension host startup (#23)
- enhance: deduplicate `git flow config list` call in branch tree provider, cache `check()` result across both views (#23)
- enhance: defer `git ls-remote --tags origin` from tree expansion to background — Tags view renders instantly with local tags, remote fetch runs asynchronously, push buttons hidden until remote data arrives (#23)

## [1.4.2] 07/05/2026

- fix: GitHub release body empty — add [1.5.0] fallback to publish workflow changelog extraction

## [1.4.1] 07/05/2026

- feat: add multi-language localization support (Russian, German, Spanish, French, Japanese, Chinese Simplified)
- add: `vscode.l10n.t()` API for all user-facing strings in source code
- add: `package.nls.json` system for command titles, view names, and configuration descriptions
- add: `l10n/bundle.l10n.{locale}.json` translation bundles for 6 languages
- bump `engines.vscode` to `^1.73.0` (required by `vscode.l10n` API)
- fix: add `moduleResolution: "node"` and `types: ["node"]` to tsconfig to resolve `@types/node` globals (child_process, setTimeout, etc.)
- fix: align `@typescript-eslint/eslint-plugin` to v8 to resolve peer dependency conflict with `@typescript-eslint/parser@8` during `npm ci`

## [1.4.0] 07/05/2025

- fix - Properly render deeply nested branch folders in tree view (#84)
- fix - Properly handle Escape key cancellation in finish and deleteSupport commands (#86)
- feat - Add PowerShell support on Windows for UNC paths (#83)
- docs - Add usePowerShell to Options section in README

## [1.3.28] 03/17/2025

- add - Setting to disable gitflow check on repository open. It also adds button to disable check on warning.

## [1.3.23] 07/20/2023

- add - Extension parameter to turn notification off

## [1.3.18] 06/12/2022

- add - publish to OVSX.
- enhance - Branch name creation now is checked through `git check-ref-format --branch ***` with allows create any qualified branch name.

## [1.3.10] 05/25/2022

- add - Option to automatically bump version on release or not.

## [1.3.9] 05/18/2022

- add - replace spaces in branch name with `_`
- fix - tmp dir for message files on release and hotfix
- add - parameter `gitflow.path` to manually set gitflow executable.
- fix - Changelog automatic update month is 1 less.

## [1.3.4] 05/10/2022

- fix - Month updated in changelog one month less.
- fix - Some words in command message `-m"Something"` caused command failed. Fixed by using file.

## [1.3.0] 03/27/2022

- add - use `git.path` settings.
- enhance - better find git executable path on windows.

## [1.2.9] 03/07/2022

- security - fix string sanitization

## [1.2.8] 03/07/2022

- fix - stop command on ESC.
- fix - run version bump only when released or hotfix is started
- enhance - `CHANGELOG.md` update conditions

## [1.2.7] 03/04/2022

- fix -  changelog update `mm` not to be replaced in a word like co**mm**and.
- fix - release message is undefined

## [1.2.0] 03/04/2022

- change - Now version bump happens on hotfix or release start rather than finish
- add - update changelog automatically
- enhance - Allow change finish message when finish hotfix or release

## [1.1.0] 02/21/2022

- optimize - performance improvement using memoization technique.

## [1.0.1] 02/07/2022

Finlay I have all features I planned in this extension. This is still preview but final extension.

- add - Parameter to show all internal git commands run in `git flow` in output window
- add - Output logger named Git Flow
- fix - Readme was not visible in marketplace.
- optimize - code refactor.

## [0.5.11] 02/05/2022

- add - Status bar button to call Quick Pick menu
- add - Groups in Quick Pick (require VS Code >=1.64.0)

## [0.5.9] 02/04/2022

- add - Checkout support branch
- add - Publish support branch
- fix - Checkout release branch
- add - Delete tags local and remote
- fix - Release checkout

## [0.5.6] 02/03/2022

- fix - If error tags shows error as tags
- fix - important to update. Fix some release issues.

## [0.5.2] 02/03/2022

- change - use different bundler for extension
- add - Quick Pick popup
- optimize - Code was refactored and optimized. 1800 lines to 580.

## [0.4.3] 02/02/2022

- add - Support for multiple folder workspaces
- fix - Progress notification not resolving

## [0.3.0] 02/02/2022

- add - Support (Start, Checkout, Rebase, Delete)
- add - Release checkout
- add - Hotfix checkout

## [0.2.14] 01/31/2022

- enhance - Order and group context menu elements.
- enhance -  use VS Code theme icons instead of SVG. This will apply Product icons theme to this extension too.
- enhance - not related to features of this extension, but CI flow was created for fast delivery of new versions.
- enhance - README overview updated with new features and new picture.

## [0.2.11] 01/30/2022

- fix - take name of flow branches from configuration
- fix - ui buttons

## [0.2.9] 01/28/2022

- add - single command to sync all root branches (develop and master ot main)
- add - command to checkout root branches
- enhance - better icons

## [0.2.5] - 01/27/2022

- fix - Git authenticated commands to remote
- add - icons to menu elements
- add - bugfix support
- delete - configurations
- add - progress notification during process
- Update `README.md` with important instructions

## [0.1.5] - 01/26/2022

- Initial release
