# Git FLow Support for VS Code [PREVIEW]

GitFlow support for VS Code based on [Git Flow AVH](https://github.com/petervanderdoes/gitflow-avh).


## How to setup:

1. VS Code should open folder not file
2. Git have to be installed.
2. Root folder have to be a git repository. If not run `git init` command in terminal.
3. [Git Flow](https://github.com/petervanderdoes/gitflow-avh/wiki/Installation) have to be installed.
4. You have to initialize git flow in the root of your repository with `git flow init` command.
5. In order to push branches to or delete branches from remote repository like GitHub, user have to be authenticated.

   #### SSH
   
   Best way to do it with SSH. For that you have to clone your repo using SSH URL. If you already cloned it with HTTPS URL, you can edit `your_repository/.git/config` and change URL there from HTTPS to SSH. 

   Then you need to add SSH key. Read [this article](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent).

   basicaly what you have to do is to generate key with 

   ```
   ssh-keygen -t rsa -b 4096 -C "your_email@example.com"
   ```

   Then go to `~/.ssh` folder and look for `id_rsa.pub` file and copy it's content. Last go to https://github.com/settings/keys and add SSH Key there.

   This should autenticate all `git` commands to your repository.

   #### HTTPS

   If you want git over HTTPS, you need setup [credentials caching](https://docs.github.com/en/get-started/getting-started-with-git/caching-your-github-credentials-in-git).

   Basicaly you need to install GitHub CLI

   GitHub CLI will automatically store your Git credentials for you when you choose HTTPS as your preferred protocol for Git operations and answer "yes" to the prompt asking if you would like to authenticate to Git with your GitHub credentials.

   - Install GitHub CLI on macOS, Windows, or Linux.
   - In the command line, enter `gh auth login`, then follow the prompts.



![ext](https://raw.githubusercontent.com/Serhioromano/vscode-gitflow/main/resources/media/ss.png)

> [Git Graph](https://marketplace.visualstudio.com/items?itemName=mhutchie.git-graph) complements this extension.

When You install it, in standard SCM side bar, 2 new views will appear, GITFLOW and VERSIONS. Versions are simple tags.

## Features

- Feature (Start, Finish, Checkout, Delete, Rebase, Track)
- Release (Start, Finish, Publish, Track, Delete, Rebase)
- Hotfix (Start, Finish, Publish, Rebase, Delete)

### Changelog

- 0.2.0
  - add - progress bas during process
  - fix - git commands with remote
  - update - README    
- 0.1.0 - Initial release of ...
