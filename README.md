# Git FLow Support for VS Code

> **Attention!!!**. From version 0.5.11 it requires latest VS Code `>=1.64.0`.

## Known Issues

1. When VS Code open windows directory while on remote WSL, sometimes might cause problems. But who is gonna do that, right?

2. When authentication is not configured, commands that make `push` to remote commands may fail. (see: How to setup)

## How to use

When installed, you will find 2 new views in SCM side bar, GITFLOW and VERSIONS. Also in status bar you will find **Git Flow** button to launch Quick Pick menu or use `Shift`+`Alt`+`D` short key.

To see list of all commands use `F1` or `Ctrl`+`Shift`+`P` and type gitflow.

![ext](https://raw.githubusercontent.com/Serhioromano/vscode-gitflow/main/resources/media/ss.png)

> We suggest [Git Graph](https://marketplace.visualstudio.com/items?itemName=mhutchie.git-graph) to complements this extension.
