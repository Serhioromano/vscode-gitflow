[![License: MIT](https://img.shields.io/badge/License-MIT-brightgreen.svg)](https://opensource.org/licenses/MIT) ![workflow](https://github.com/Serhioromano/vscode-gitflow/actions/workflows/publish.yml/badge.svg) [![Version](https://vsmarketplacebadge.apphb.com/version-short/serhioromano.vscode-gitflow.svg)](https://marketplace.visualstudio.com/items?itemName=serhioromano.vscode-gitflow) [![Installs](https://vsmarketplacebadge.apphb.com/installs-short/serhioromano.vscode-gitflow.svg)](https://marketplace.visualstudio.com/items?itemName=serhioromano.vscode-gitflow) [![Ratings](https://vsmarketplacebadge.apphb.com/rating-short/serhioromano.vscode-gitflow.svg)](https://marketplace.visualstudio.com/items?itemName=serhioromano.vscode-gitflow)

# Git FLow Support for VS Code

> **Attention!!!**. From version 0.5.11 it requires latest VS Code `>=1.64.0`.


> Looking for an artist to contribute the extension icon.

## Known Issues

1. On MAC you might need to configure `gitflow.path` parameter to `/usr/local/bin/git-flow`.
2. If you name your branch folders with capital letters like `Feature` instead of `feature`, things break due to a bug in the `git-flow` extension of git CLI command. Please make sure you name your branch folders with lower-case names.
3. When VS Code opens a Windows directory while on a remote WSL, sometimes this might cause problems. But who is gonna do that, right?
4. When authentication is not configured, commands that make `push` to remote commands may fail. (see: [How to setup](#how-to-setup))

## What is Git Flow

Git Flow is an abstract idea of a Git workflow. It helps with continuous software development and implementing DevOps practices. The Git Flow Workflow defines a strict branching model designed around the project release. This provides a robust framework for managing larger projects.

Git Flow is ideally suited for projects that have a scheduled release cycle and for the DevOps best practice of continuous delivery. It assigns very specific roles to different branches and defines how and when they should interact. It uses individual branches for preparing, maintaining, and recording releases.

[Read more](https://blog.knoldus.com/introduction-to-git-flow/).

## How to use

When installed, you will find 2 new views in SCM side bar, GITFLOW and VERSIONS. Also in status bar you will find **Git Flow** button to launch Quick Pick menu, or you can use `Shift`+`Alt`+`D` short key.

To see list of all commands use `F1` or `Ctrl`+`Shift`+`P` and type gitflow.

![ext](https://raw.githubusercontent.com/Serhioromano/vscode-gitflow/main/resources/media/ss.png)

> We suggest [Git Graph](https://marketplace.visualstudio.com/items?itemName=mhutchie.git-graph) to complement this extension.

## Features

All basic operations you need to do in a single place.

### Gitflow

- Init git flow
- Feature (Start, Finish, Checkout, Delete, Rebase, Publish, Track)
- Bugfix (Start, Finish, Checkout, Delete, Rebase, Publish, Track)
- Release (Start, Finish, Checkout, Delete, Rebase, Publish, Track)
- Hotfix (Start, Finish, Checkout, Delete, Rebase, Publish)
- Support (Start, Checkout, Rebase, Publish, Delete) (See: [How to work with support](#how-to-work-with-support))

### Additional

- Checkout root branches
- Sync all root branches
- Fetch from origin
- Push all tags
- Push local tag
- Delete tag locally and\or remotely
- Automatic version update in `package.json`
- Automatic update `CHANGELOG.md`
- Multiple folder workspace support
- Quick Pick menu (use `Shift`+`Alt`+`D`)
- All commands results are outputted in output window named `Git Flow`. There is a parameter that also allow to show all internal `git` commands run inside `git flow`.

### Options

- `gitflow.showAllCommands` - This option allows to see in GitFlow output window underground git commands run by git-flow.
- `gitflow.path` - Allow manually set path for Git Flow executable including `flow`. For instance `/usr/bit/git flow`.
- `gitflow.autoBumpVersion` - Either it should automatically bump a version in `package.json` file on `feature` or `hotfix` creation, and commit it to git.

## Feature Details

### Multiple Folder Workspace

Multiple folder workspace was long awaited feature of VS Code for many people. It would be a shame not to support it.

![Gitflow multiple folder workspace](https://raw.githubusercontent.com/Serhioromano/vscode-gitflow/main/resources/media/mfw.png)

### Quick Pick

Quick Pick is a popup with essential Git Flow commands, like creating a new flow branch or appling actions to the currently selected flow brunch. You can call it with `Shift`+`Alt`+`d` short key. Note this command is available only if extension was initialized successfully.

![Git flow quick pik](https://raw.githubusercontent.com/Serhioromano/vscode-gitflow/main/resources/media/qp.png)

### Automatic version bump

This extension can automatically update your `package.json` file on creating a new tag - but only on `release` and `hotfix` branches. When you create one, as a name use version standard. For example create a `1.0.1` release which will result in a `release/1.0.1` branch. The `version` property of `package.json` will be updated to `1.0.1` and automatically committed to git.

### Automatic changelog update

This extension can automatically update your `CHANGELOG.md`. If you have there something like

```md
## [Unreleased] - yyyy-mm-dd

or

### [UNRELEASED] (DD-MM-YYYY)
```

Or any combination of `[Unreleased]`, `[unreleased]`, `[UNRELEASED]`, `yyyy`, `mm` or `dd` and all uppercase variations, these will be replaced with the relevent info.

### How to work with Support branch

#### What is Git Flow Support branch for?

Support branches are similar to LTS version of Linux distros.

In the git-flow model, your **latest released** version actually maps to the `master` or `main`, while your "preview release" maps to a git-flow release branch. It is forked from develop and finally merged into `main` when the actual release happens. Then this will become your **latest release** and you will usually fix only bugs for that release, using git-flow hotfix branches. In this way, your `main` always represents the most stable state of your latest released version.

Say you had a project, and you were happily releasing new versions. Maybe your current production version was 8.x. But you had some Really Important Customers who refused to upgrade to anything after 6.0. Now, if someone found a security flaw in the 6.0 version of your project, it would be a bad idea to hang all those Really Important Customers out to dry. So you release a new hotfix against `support/6.0`, even though all their problems would be solved if they just upgraded to the new 8.x release.

For this to happen you have to create `support/6.0` at some point of time. Basically you can create support branch on all major version change.

#### Workflow

First create your support branch. When you create you can select the tag version to start from. Use the latest version in major set.

Now if you checkout any support branch, no matter what you start - hotfix, release, bugfix or feature - you will be prompted to confirm to start it based on currently active support branch. And if you started it based on support branch, when you finish your hotfix, release, bugfix or feature, it will be finished against that support branch and not to `main` or `develop` branches.

Thus your `master` or `main` branch contain most recent version of your product and support branches have major LTS versions.

## How to setup

### Working locally

1. VS Code should be open on a folder not file
2. Git must be installed.
3. Root folder must be a git repository. If not run `git init` command in the terminal.
4. [Git Flow](https://github.com/petervanderdoes/gitflow-avh/wiki/Installation) must be installed.
5. You have to initialize git flow in the root of your repository with `git flow init` command.

### Working remotely

In order to push branches to or delete branches from a remote repository like GitHub, you must be authenticated. For github there are 2 main ways to work with repositories - over SSH protocol or over HTTPS. Those 2 different protocols usually refer to repository with different URL. Here is example of the SSH and HTTPS urls for this extension.

```text
https://github.com/Serhioromano/vscode-gitflow.git
git@github.com:Serhioromano/vscode-gitflow.git
```

You can clone a repository with either url.

#### SSH (recommended)

First ensure your repository is configured to work over SSH.

```bash
git remote remove origin
git remote add origin git@github.com:user/repository.git
```

Or simply edit `your_repository/.git/config` and make sure repository URL there has a SSH link.

Read [this article](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/adding-a-new-ssh-key-to-your-github-account) for how to authorize your PC with SSH key.

Basically what you have to do is to generate key with

```bash
ssh-keygen -t rsa -b 4096 -C "your_email@example.com"
```

Then go to `~/.ssh` folder and look for `id_rsa.pub` file and copy it's content. Lastly go to `https://github.com/settings/keys` and add SSH Key there.

#### HTTPS

First ensure your repository is configured to work over SSH.

```bash
git remote remove origin
git remote add origin https://github.com/user/repository.git
```

Or simple edit `your_repository/.git/config` and make sure the repository URL there has a HTTP link.

Now you need to [cache your credential](https://docs.github.com/en/get-started/getting-started-with-git/caching-your-github-credentials-in-git). Use the GitHub CLI.

GitHub CLI will automatically store your Git credentials for you when you choose HTTPS as your preferred protocol for Git operations and answer "yes" to the prompt asking if you would like to authenticate to Git with your GitHub credentials.

- [Install GitHub CLI](https://cli.github.com/manual/installation) on macOS, Windows, or Linux.
- In the command line, enter `gh auth login`, then follow the prompts.

## Changelog

- 1.3.18
  - add - publish to OVSX.
  - enhance - Branch name creation now is checked through `git check-ref-format --branch ***` with allows create any qualified branch name.
  - add - Option to automatically bump version on release or not.
  - add - replace spaces in branch name with `_`
  - fix - tmp dir for message files on release and hotfix
  - add - parameter `gitflow.path` to manually set gitflow executable.
  - fix - Month updated in changelog one month less.
  - fix - Some words in command message `-m"Something"` caused command failed. Fixed by using file.
  - add - use `git.path` settings.
  - enhance - better find git executable path on windows.
- 1.2.9
  - security - fix string sanitization
  - fix - stop command on ESC.
  - fix - run version bump only when released or hotfix is started
  - enhance - `CHANGELOG.md` update conditions
  - fix -  changelog update `mm` not to be replaced in a word like co**mm**and.
  - fix - release message is undefined
  - change - Now version bump happens on hotfix or release start rather than finish
  - add - update changelog automatically
  - enhance - Allow change finish message when finish hotfix or release
- 1.1.0
  - optimize - performance improvement using memoization technique.
- 1.0.0
  - add - Parameter to show all internal git commands run in `git flow` in output window
  - add - Output logger named Git Flow
  - fix - Readme was not visible in marketplace.
  - optimize - code refactor.
- 0.5.11
  - add - Status bar button to call Quick Pick menu
  - add -  Groups in Quick Pick (require VS Code ^1.64.0)
- 0.5.9
  - add - Delete tags local and remote
  - fix - Release checkout
- 0.5.2
  - add - Quick Pick popup
  - optimize - Code was refactored and optimized. 1800 lines to 580.
- 0.4.3
  - add - Multiple folder workspaces
  - fix - Progress notification not resolving
- 0.3.1
  - add - Support (Start, Checkout, Rebase, Delete)
  - add - Release checkout
  - add - Hotfix checkout
- 0.2.14
  - enhance - Order and group context menu elements.
  - enhance - use VS Code theme icons instead of SVG.
  - enhance - CI flow was created for fast delivery of new versions.
- 0.2.11
  - fix - take name of flow branches from configuration
  - fix - ui buttons
- 0.2.9
  - add - single command to sync all root branches (develop and master ot main)
  - add - command to checkout root branches
  - enhance - better icons
- 0.2.2
  - add - progress bas during process
  - add - icons to menu elements
  - add - bugfix support
  - delete - configurations
  - fix - git commands with remote
  - update - README
- 0.1.0 - Initial release of ...
