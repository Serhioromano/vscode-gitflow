# Git FLow Support for VS Code [PREVIEW]

GitFlow support for VS Code based on [Git Flow AVH](https://github.com/petervanderdoes/gitflow-avh). That is right, this is the one you was looking for! 

> **If you like this extension, please do not forget to rate it, so your colleagues could also discover this fine piece of work.**
## How to use

> We suggest [Git Graph](https://marketplace.visualstudio.com/items?itemName=mhutchie.git-graph) to complements this extension.

When You install it, in standard SCM side bar, 2 new views will appear, GITFLOW and VERSIONS. Versions are simple tags.

![ext](https://raw.githubusercontent.com/Serhioromano/vscode-gitflow/main/resources/media/ss.png)

## Features

All basic operations you need to do in a single place.

### Gitflow

- Init git flow
- Feature (Start, Finish, Checkout, Delete, Rebase, Publish, Track)
- Bugfix (Start, Finish, Checkout, Delete, Rebase, Publish, Track)
- Release (Start, Finish, Publish, Track, Delete, Rebase)
- Hotfix (Start, Finish, Publish, Rebase, Delete)

### Additional

- Checkout root branches
- Sync all root branches
- Fetch from origin
- Push all versions (tags)
- Push local version (tag)

## Roadmap

< 30 February 2022

- Multiple folder workspace
- Status bar button to finish current branch

## How to setup:

### Work locally

1. VS Code should open folder not file
2. Git have to be installed.
2. Root folder have to be a git repository. If not run `git init` command in terminal.
3. [Git Flow](https://github.com/petervanderdoes/gitflow-avh/wiki/Installation) have to be installed.
4. You have to initialize git flow in the root of your repository with `git flow init` command.

### Work remotely

In order to push branches to or delete branches from remote repository like GitHub, user have to be authenticated. For github there are 2 main ways to work with repositories over SSH protocol or over HTTPS. Those 2 different protocols usually refer to repository with different URL. Here is example of SSH and HTTPS urls of this extension.

```
https://github.com/Serhioromano/vscode-gitflow.git
git@github.com:Serhioromano/vscode-gitflow.git
```
You can clone repository with either url.

#### SSH (recommended)

First ensure your repository configured to work over SSH.

```
git remote remove origin
git remote add origin git@github.com:user/repository.git
```

Or simple edit `your_repository/.git/config` and make sure repository URL there has a SSH link.

Read [this article](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/adding-a-new-ssh-key-to-your-github-account) how to authorize your PC with SSH key.

Basically what you have to do is to generate key with 

```
ssh-keygen -t rsa -b 4096 -C "your_email@example.com"
```

Then go to `~/.ssh` folder and look for `id_rsa.pub` file and copy it's content. Last go to https://github.com/settings/keys and add SSH Key there.

#### HTTPS

First ensure your repository configured to work over SSH.

```
git remote remove origin
git remote add origin https://github.com/user/repository.git
```

Or simple edit `your_repository/.git/config` and make sure repository URL there has a HTTP link.

Now you need to [cache your credential](https://docs.github.com/en/get-started/getting-started-with-git/caching-your-github-credentials-in-git). Use GitHub CLI

GitHub CLI will automatically store your Git credentials for you when you choose HTTPS as your preferred protocol for Git operations and answer "yes" to the prompt asking if you would like to authenticate to Git with your GitHub credentials.

- [Install GitHub CLI](https://cli.github.com/manual/installation) on macOS, Windows, or Linux.
- In the command line, enter `gh auth login`, then follow the prompts.

## Changelog

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
