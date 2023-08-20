# Change Log

All notable changes to the "gitflow" extension will be documented in this file.

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
