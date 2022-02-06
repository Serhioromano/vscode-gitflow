# Git FLow Support for VS Code

> **Attention!!!**. From version 0.5.11 it requires latest VS Code `>=1.64.0`.

## Known Issues

1. When VS Code open windows directory while on remote WSL, sometimes might cause problems. But who is gonna do that, right?

2. When authentication is not configured, commands that make `push` to remote commands may fail. (see: [How to setup](#how-to-setup))

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
- Support (Start, Checkout, Rebase, Publish, Delete) (See: [How to work with support](#how-to-work-with-support))

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
