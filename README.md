# Git FLow Support for VS Code

> **Attention!!!**. From version 0.5.11 it requires latest VS Code `>=1.64.0`.

GitFlow support for VS Code based on [Git Flow AVH](https://github.com/petervanderdoes/gitflow-avh).

## Known Issues

1. When VS Code open windows directory while on remote WSL, sometimes might cause problems. But who is gonna do that, right?

2. When authentication is not configured, commands that make `push` to remote commands may fail. (see: How to setup)

## How to use

When installed, you will find 2 new views in SCM side bar, GITFLOW and VERSIONS. Also in status bar you will find **Git Flow** button to launch Quick Pick menu or use `Shift`+`Alt`+`D` short key.

To see list of all commands use `F1` or `Ctrl`+`Shift`+`P` and type gitflow.

![ext](https://raw.githubusercontent.com/Serhioromano/vscode-gitflow/main/resources/media/ss.png)

> We suggest [Git Graph](https://marketplace.visualstudio.com/items?itemName=mhutchie.git-graph) to complements this extension.

## Features

All basic operations you need to do in a single place.

### Gitflow

- Init git flow
- Feature (Start, Finish, Checkout, Delete, Rebase, Publish, Track)
- Bugfix (Start, Finish, Checkout, Delete, Rebase, Publish, Track)
- Release (Start, Finish, Checkout, Delete, Rebase, Publish, Track,  )
- Hotfix (Start, Finish, Checkout, Delete, Rebase, Publish)
- Support (Start, Checkout, Rebase, Publish, Delete) (See: How to work with support)

### Additional

- Checkout root branches
- Sync all root branches
- Fetch from origin
- Push all tags
- Push local tag
- Delete tag locally and\or remotely
- Multiple folder workspace support
- Quick Pick menu (use `Shift`+`Alt`+`D`)

#### Multiple Folder Workspace

Multiple folder workspace was long waited feature of VS Code by many people. It would be a shame not to support it.

![Gitflow multiple folder workspace](https://raw.githubusercontent.com/Serhioromano/vscode-gitflow/main/resources/media/mfw.png)

#### Quick Pick

Quick Pick is a popup with essential Git Flow commands, like create new flow branch or apply actions to currently selected flow brunch. You can call it with `Shift`+`Alt`+`d` short key. Note this command is available only if extension was initialized successfully.

![Git flow quick pik](https://raw.githubusercontent.com/Serhioromano/vscode-gitflow/main/resources/media/qp.png)

## Roadmap

< 30 February 2022

- Multiple folder workspace [done]
- Flow "support" [done]
- Quick Pick [done]
- Status bar button to finish current branch

## How to work with Support

### What is Git Flow Support

Support branches are similar to LTS version of Linux distros.

In the git-flow model, your **latest released** version actually maps to the `master` or `main`, while your "preview release" maps to a git-flow release branch. It is forked from develop and finally merged into `main` when the actual release happens. Then this will become your **latest release** and you will usually fix only bugs for that release, using git-flow hotfix branches. In this way, your master always represents the most stable state of your latest released version.


Say you had a project, and you were happily releasing new versions.
Maybe your current production version was 8.x. But you had some Really
Important Customers who refused to upgrade to anything after 6.0. Now,
if someone found a security flaw in the 6.0 version of your project,
it would be a bad idea to hang all those Really Important Customers
out to dry. So you release a new hotfix against `support/6.0`, even though all
their problems would be solved if they just upgraded to the new 8.x
release.

For this to happen you have to create `support/6.0` at some point of time. Basically you can create support branch on all major version change.

### Workflow

First create your support branch. When you create you can select tag version to start from. Use latest version in major set.

Now if you checkout any support branch, no matter what you start hotfix, release, bugfix or feature, you will be prompted to confirm to start it based on currently active support branch. And if you started it based on support branch, when you finish you hotfix, release, bugfix or feature, it will be finished against that support branch and not to `master` or `develop` branches.

Thus you `master` or `main` branch contain most recent version of your product and support branches have major LTS versions.

## How to setup

### Work locally

1. VS Code should open folder not file
2. Git have to be installed.
3. Root folder have to be a git repository. If not run `git init` command in terminal.
4. [Git Flow](https://github.com/petervanderdoes/gitflow-avh/wiki/Installation) have to be installed.
5. You have to initialize git flow in the root of your repository with `git flow init` command.

### Work remotely

In order to push branches to or delete branches from remote repository like GitHub, user have to be authenticated. For github there are 2 main ways to work with repositories over SSH protocol or over HTTPS. Those 2 different protocols usually refer to repository with different URL. Here is example of SSH and HTTPS urls of this extension.

    https://github.com/Serhioromano/vscode-gitflow.git
    git@github.com:Serhioromano/vscode-gitflow.git

You can clone repository with either url.

#### SSH (recommended)

First ensure your repository configured to work over SSH.

```bash
git remote remove origin
git remote add origin git@github.com:user/repository.git
```

Or simple edit `your_repository/.git/config` and make sure repository URL there has a SSH link.

Read [this article](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/adding-a-new-ssh-key-to-your-github-account) how to authorize your PC with SSH key.

Basically what you have to do is to generate key with

```bash
ssh-keygen -t rsa -b 4096 -C "your_email@example.com"
```

Then go to `~/.ssh` folder and look for `id_rsa.pub` file and copy it's content. Last go to https://github.com/settings/keys and add SSH Key there.

#### HTTPS

First ensure your repository configured to work over SSH.

```bash
git remote remove origin
git remote add origin https://github.com/user/repository.git
```

Or simple edit `your_repository/.git/config` and make sure repository URL there has a HTTP link.

Now you need to [cache your credential](https://docs.github.com/en/get-started/getting-started-with-git/caching-your-github-credentials-in-git). Use GitHub CLI

GitHub CLI will automatically store your Git credentials for you when you choose HTTPS as your preferred protocol for Git operations and answer "yes" to the prompt asking if you would like to authenticate to Git with your GitHub credentials.

- [Install GitHub CLI](https://cli.github.com/manual/installation) on macOS, Windows, or Linux.
- In the command line, enter `gh auth login`, then follow the prompts.

## Changelog

- 0.5.11
  - add - Status bar button to call Quick Pick menu
  - add -  Groups in Quick Pick (require VS Code >=1.64.0)
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
