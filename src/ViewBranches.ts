import * as vscode from 'vscode';
import { Util } from './Util';

export class TreeViewBranches implements vscode.TreeDataProvider<Flow> {
    private _onDidChangeTreeData: vscode.EventEmitter<Flow | undefined | null | void> = new vscode.EventEmitter<Flow | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<Flow | undefined | null | void> = this._onDidChangeTreeData.event;
    private curBranch: string = '';
    private listBranches: string[] = [];
    private listRemotes: string[] = [];
    private util;

    constructor(private workspaceRoot: string) {
        this.util = new Util(workspaceRoot);
    }

    getTreeItem(element: Flow): vscode.TreeItem {
        return element;
    }

    getChildren(element?: Flow): Thenable<Flow[]> {
        if (!this.util.check()) {
            return Promise.resolve([]);
        }
        let tree: Flow[] = [];

        if (element === undefined) {
            let list = this.util.exec("git flow config list");
            if (list.toLowerCase().search('not a gitflow-enabled repo yet') > 0) {
                let initLink = 'Init';
                vscode.window
                    .showWarningMessage('Not a gitflow-enabled repo yet. Please, open a terminal and run `git flow init` command.', initLink)
                    .then(selection => {
                        if (selection === initLink) {
                            vscode.commands.executeCommand('gitflow.init');
                        }
                    });
                return Promise.resolve([]);
            }

            this.curBranch = this.util.exec("git rev-parse --abbrev-ref HEAD");
            this.listBranches = this.util.exec("git branch")
                .split("\n")
                .map(el => el.trim().replace("* ", ""))
                .filter(el => el !== '');

            this.listRemotes = this.util.exec("git branch -r")
                .split("\n")
                .map(el => {
                    let a = el.split("/");
                    a.shift();
                    return a.join("/");
                })
                .filter(el => {
                    return (
                        el.split("/").length > 1
                        && el.search("HEAD") === -1
                        && !this.listBranches.includes(el)
                    );
                });

            this.listBranches
                .filter(el => el.split("/").length < 2)
                .forEach(el => {
                    tree.push(new Flow(el,
                        el, 'git-branch', vscode.TreeItemCollapsibleState.None,
                        this._isCurrent(el)
                    ));
                    return;
                });

            tree.push(new Flow('feature', 'Features', 'test-view-icon', vscode.TreeItemCollapsibleState.Expanded, false, 'f'));
            tree.push(new Flow('release', 'Releases', 'tag', vscode.TreeItemCollapsibleState.Expanded, false, 'r'));
            tree.push(new Flow('hotfix', 'HotFixes', 'callstack-view-session', vscode.TreeItemCollapsibleState.Expanded, false, 'h'));
            return Promise.resolve(tree);
        }

        this.listBranches
            .filter(el => el.split("/")[0] === element.full)
            .forEach(el => {
                tree.push(new Flow(el, el.split("/")[1], 'git-branch', vscode.TreeItemCollapsibleState.None,
                    this._isCurrent(el), element.full
                ));
            });


        this.listRemotes
            .filter(el => el.split("/")[0] === element.full)
            .forEach(el => {
                tree.push(new Flow(el, 'ORIGIN/' + el.split("/")[1], 'git-branch', vscode.TreeItemCollapsibleState.None,
                    false, 'origin_' + element.full
                ));
            });
        return Promise.resolve(tree);
    }

    fetchAllBranches() {
        this.util.execCb("git fetch --all", s => {
            this._onDidChangeTreeData.fire();
        });
    }

    //#region Features
    async startFeature() {
        let name = await vscode.window.showInputBox({ title: "Enter feature name [a-zA-Z0-9-]*" });
        if (name?.length === 0) { return; }
        if (name?.match(/^([a-zA-Z0-9\-]*)$/) === null) {
            vscode.window.showErrorMessage("Feature name have to match [a-zA-Z0-9\\-]*");
            return;
        }

        if (name === undefined) {
            return;
        }

        let cmd = `git flow feature start -F ${name}`;

        this.util.execCb(cmd, s => {
            vscode.window.showInformationMessage(`Feature ${name} have been created successfuly!`);
            this._onDidChangeTreeData.fire();
        });
    }
    async finishFeature(node: Flow | undefined) {
        let name = node?.full;
        if (name === undefined) {
            name = await vscode.window.showQuickPick(
                this.listBranches.filter(el => el.search('feature/') !== -1),
                { title: "Select feature" }
            );
        }

        let options = await vscode.window.showQuickPick(
            [
                "[-F] Fetch from origin before performing finish",
                "[-r] Rebase before merging",
                "[-p] Preserve merges while rebasing",
                "[--push] Push to origin after performing finish",
                "[-k] Keep branch after performing finish",
                "[--keepremote] Keep the remote branch",
                "[--keeplocal] Keep the local branch",
                "[-D] Force delete feature branch after finish",
                "[-S] Squash feature during merge",
                "[--no-ff] Never fast-forward during the merge"
            ], { title: "Select options", canPickMany: true }
        );
        let option = options?.map(el => {
            let m = el.match(/\[([^\]]*)\]/);
            return m === null ? '' : m[1];
        }).join(" ");

        let cmd = `git flow feature finish ${option} ${name?.split("/")[1]}`;

        this.util.execCb(cmd, s => {
            vscode.window.showInformationMessage(`Feature ${name} have been finished successfuly!`);
            this._onDidChangeTreeData.fire();
        });

    }
    async rebaseFeature(node: Flow | undefined) {
        let name = node?.full;
        if (name === undefined) {
            name = await vscode.window.showQuickPick(
                this.listBranches.filter(el => el.search('feature/') !== -1),
                { title: "Select feature" }
            );
        }

        let options = await vscode.window.showQuickPick(
            ["[-i] An interactive rebase", "[-p] Preserve merges"], { title: "Select options", canPickMany: true }
        );
        let option = options?.map(el => {
            let m = el.match(/\[([^\]]*)\]/);
            return m === null ? '' : m[1];
        }).join(" ");

        let base = await vscode.window.showQuickPick(
            ["develop", "masert"],
            { title: "Select base branch" }
        );

        if (name === undefined || base === undefined) {
            return;
        }

        let cmd = `git flow feature rebase ${option} ${name?.split("/")[1]} ${base}`;

        this.util.execCb(cmd, s => {
            vscode.window.showInformationMessage(`Feature ${name} have been rebased successfuly!`);
            this._onDidChangeTreeData.fire();
        });
    }
    async publishFeature(node: Flow | undefined) {
        let name = node?.full;
        if (name === undefined) {
            name = await vscode.window.showQuickPick(
                this.listBranches.filter(el => el.search('feature/') !== -1),
                { title: "Select feature" }
            );
        }

        let cmd = `git flow feature publish ${name?.split("/")[1]}`;

        this.util.execCb(cmd, s => {
            vscode.window.showInformationMessage(`Feature ${name} have been published or updated successfuly!`);
            this._onDidChangeTreeData.fire();
        });
    }
    async deleteFeature(node: Flow | undefined) {
        let name = node?.full;
        if (name === undefined) {
            name = await vscode.window.showQuickPick(
                this.listBranches.filter(el => el.search('feature/') !== -1),
                { title: "Select feature" }
            );
        }

        let options = await vscode.window.showQuickPick(
            ["[-f] Force deletion", "[-r] Delete remote branch"], { title: "Select options", canPickMany: true }
        );
        let option = options?.map(el => {
            let m = el.match(/\[([^\]]*)\]/);
            return m === null ? '' : m[1];
        }).join(" ");

        let cmd = `git flow feature delete ${option} ${name?.split("/")[1]}`;

        this.util.execCb(cmd, s => {
            vscode.window.showInformationMessage(`Feature ${name} have been deleted successfuly!`);
            this._onDidChangeTreeData.fire();
        });
    }
    async checkoutFeature(node: Flow | undefined) {
        let name = node?.full;
        if (name === undefined) {
            name = await vscode.window.showQuickPick(
                this.listBranches.filter(el => el.search('feature/') !== -1),
                { title: "Select feature" }
            );
        }

        let cmd = `git flow feature checkout ${name?.split("/")[1]}`;

        this.util.execCb(cmd, s => {
            vscode.window.showInformationMessage(`Feature ${name} have been checked out successfuly!`);
            this._onDidChangeTreeData.fire();
        });
    }
    async trackFeature(node: Flow | undefined) {
        let name = node?.full;
        if (name === undefined) {
            name = await vscode.window.showQuickPick(
                this.listRemotes.filter(el => el.search('feature/') !== -1),
                { title: "Select remote feature" }
            );
        }
        if (name === undefined) {
            return;
        }

        let cmd = `git flow feature track ${name?.split("/")[1]}`;

        this.util.execCb(cmd, s => {
            vscode.window.showInformationMessage(`Feature ${name} now is tracked!`);
            this._onDidChangeTreeData.fire();
        });
    }
    //#endregion

    //#region Releases
    async startRelease() {
        let name = await vscode.window.showInputBox({ title: "Enter release name [a-zA-Z0-9-]*" });
        if (name?.length === 0) { return; }
        if (name?.match(/^[a-zA-Z0-9\-\.]*$/) === null) {
            vscode.window.showErrorMessage("Release name have to match [a-zA-Z0-9\-\.]*");
            return;
        }
        if (name === undefined) {
            return;
        }

        let cmd = `git flow release start ${name}`;

        this.util.execCb(cmd, s => {
            vscode.window.showInformationMessage(`Release ${name} have been started!`);
            this._onDidChangeTreeData.fire();
        });
    }
    async publishRelease(node: Flow | undefined) {
        let name = node?.full;
        if (name === undefined) {
            name = await vscode.window.showQuickPick(
                this.listBranches.filter(el => el.search('release/') !== -1),
                { title: "Select release" }
            );
        }

        let cmd = `git flow release publish ${name?.split("/")[1]}`;

        this.util.execCb(cmd, s => {
            vscode.window.showInformationMessage(`Release ${name} have been checked out successfuly!`);
            this._onDidChangeTreeData.fire();
        });
    }
    async deleteRelease(node: Flow | undefined) {
        let name = node?.full;
        if (name === undefined) {
            name = await vscode.window.showQuickPick(
                this.listBranches.filter(el => el.search('release/') !== -1),
                { title: "Select release" }
            );
        }

        let options = await vscode.window.showQuickPick(
            ["[-f] Force deletion", "[-r] Delete remote branch"], { title: "Select options", canPickMany: true }
        );
        let option = options?.map(el => {
            let m = el.match(/\[([^\]]*)\]/);
            return m === null ? '' : m[1];
        }).join(" ");

        let cmd = `git flow release delete ${option} ${name?.split("/")[1]}`;

        this.util.execCb(cmd, s => {
            vscode.window.showInformationMessage(`Release ${name} have been deleted successfuly!`);
            this._onDidChangeTreeData.fire();
        });
    }
    async trackRelease(node: Flow | undefined) {
        let name = node?.full;
        if (name === undefined) {
            name = await vscode.window.showQuickPick(
                this.listRemotes.filter(el => el.search('release/') !== -1),
                { title: "Select remote release" }
            );
        }
        if (name === undefined) {
            return;
        }

        let cmd = `git flow release track ${name?.split("/")[1]}`;

        this.util.execCb(cmd, s => {
            vscode.window.showInformationMessage(`Release ${name} now is tracked!`);
            this._onDidChangeTreeData.fire();
        });
    }
    async finishRelease(node: Flow | undefined) {
        let name = node?.full;
        if (name === undefined) {
            name = await vscode.window.showQuickPick(
                this.listBranches.filter(el => el.search('release/') !== -1),
                { title: "Select release" }
            );
        }

        let version = await vscode.window.showInputBox({
            title: "Tagname", value: name?.split("/")[1]
        });

        let options = await vscode.window.showQuickPick([
            "[-F] Fetch from origin before performing finish",
            "[-p] Push to origin after performing finish",
            "[-D] Force delete release branch after finish",
            "[--pushproduction] Push the production branch",
            "[--pushdevelop] Push the develop branch",
            "[--pushtag] Push the tag",
            "[-k] Keep branch after performing finish",
            "[--keepremote] Keep the remote branch",
            "[--keeplocal] Keep the local branch",
            "[-n] Don't tag this release",
            "[-b] Don't back-merge master, or tag if applicable, in develop",
            "[-S] Squash release during merge",
            "[--ff-master] Fast forward master branch if possible",
            // "[-T] Use given tag name",
            "[--nodevelopmerge] Don't back-merge develop branch"
        ], { title: "Select options", canPickMany: true });
        let option = options?.map(el => {
            let m = el.match(/\[([^\]]*)\]/);
            return m === null ? '' : m[1];
        }).join(" ");

        let cmd = `git flow release finish -T ${version} ${option} ${name?.split("/")[1]}`;

        this.util.execCb(cmd, s => {
            vscode.window.showInformationMessage(`Release ${name} have been finished successfuly!`);
            this._onDidChangeTreeData.fire();
            vscode.commands.executeCommand('gitflow.refreshT');
        });

    }



    //#endregion



    _isCurrent(name: string | undefined): boolean {
        return name?.replace("* ", "") === this.curBranch.replace("* ", "");
    }
    _getIcon(folder: string): string {
        switch (folder) {
            case 'feature':
                return 'test-view-icon';
            case 'release':
                return 'tag';
            case 'hotfix':
                return 'callstack-view-session';
        }
        return 'folder';
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    init() {
        vscode.window.showInformationMessage("Please, open a terminal and run `git flow init` command");
    }

}

export class Flow extends vscode.TreeItem {
    constructor(
        public full: string,
        public readonly label: string,
        private icon: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public current?: boolean,
        public parent?: string
    ) {
        super(label, collapsibleState);
        this.description = current ? 'Current' : '';
        this.contextValue = parent ? parent : full.replace("* ", "").split("/")[0];
    }

    iconPath = new vscode.ThemeIcon(this.icon);
}