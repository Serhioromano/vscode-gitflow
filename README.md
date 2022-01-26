# Git FLow Support for VS Code [PREVIEW]

GitFlow support for VS Code based on [Git Flow AVH](https://github.com/petervanderdoes/gitflow-avh).

[Git Graph](https://marketplace.visualstudio.com/items?itemName=mhutchie.git-graph) complements this extension.

> There are some temporary problems with `exec` inside VS Code, and some commands are transfered to terminal. If so, you have to update GITFLOW view after command finish executing in terminal.

![ext](https://raw.githubusercontent.com/Serhioromano/vscode-gitflow/main/media/ss.png)

When You install it, in standard SCM side bar, 2 new views will appear, GITFLOW and VERSIONS. Versions are simple tags.

For this extension to work checklist:

1. VS Code should open folder not file
2. Root folder have to be a git repository
3. [Git Flow](https://github.com/petervanderdoes/gitflow-avh/wiki/Installation) have to be installed
4. You have to initialize git flow in the root of your repository with `git flow init` command.


## Features

- Feature (Start, Finish, Checkout, Delete, Rebase, Track)
- Release (Start, Finish, Publish, Track, Delete, Rebase)
- Hotfix (Start, Finish, Publish, Rebase, Delete)

### 0.1.0-beta

Initial release of ...
