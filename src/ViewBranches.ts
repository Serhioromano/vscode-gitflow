import * as vscode from 'vscode';
import { Util } from './Util';

export class GitflowTreeView implements vscode.TreeDataProvider<Flow> {
    private _onDidChangeTreeData: vscode.EventEmitter<Flow | undefined | null | void> = new vscode.EventEmitter<Flow | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<Flow | undefined | null | void> = this._onDidChangeTreeData.event;
    private curBranch: string = '';
    private listBranches: string[] = [];
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

            let folders: string[] = [];
            this.listBranches = this.util.exec("git branch")
                .split("\n")
                .map(el => el.trim())
                .filter(el => el !== '');

            this.listBranches.forEach(el => {
                if (el.indexOf('* ') !== -1) {
                    this.curBranch = el.replace('* ', '');
                    el = this.curBranch;
                }

                if (el.indexOf('/') !== -1) {
                    if (!folders.includes(el.split("/")[0])) {
                        tree.push(new Flow(el.split("/")[0],
                            el.split("/")[0], this._getIcon(el.split("/")[0]),
                            (this._isCurrent(el) ?
                                vscode.TreeItemCollapsibleState.Expanded :
                                vscode.TreeItemCollapsibleState.Expanded)
                        ));
                    }
                    folders.push(el.split("/")[0]);
                    return;
                }

                tree.push(new Flow(el, el, 'git-branch', vscode.TreeItemCollapsibleState.None,
                    this._isCurrent(el)
                ));
            });
            return Promise.resolve(tree);
        }

        this.listBranches.forEach(el => {
            if (el.indexOf('* ') !== -1) {
                this.curBranch = el.replace('* ', '');
                el = this.curBranch;
            }

            if (el.split("/")[0].replace("* ", "") == element.label) {
                tree.push(new Flow(el, el.split("/")[1], 'git-branch', vscode.TreeItemCollapsibleState.None,
                    this._isCurrent(el), element.label
                ));
            }
        });
        // console.log(element);

        return Promise.resolve(tree);
    }
    fetchAllBranches(){
        this.util.execCb("git pull --all", s => {
            this._onDidChangeTreeData.fire();
        });
    }
    async startFeature() {
        let name = await vscode.window.showInputBox({ title: "Enter feature name [a-zA-Z0-9-]*" });
        if (name?.length === 0) { return }
        if (name?.match(/^([a-zA-Z0-9\\-]*)$/) === null) {
            vscode.window.showErrorMessage("Feature name have to match [a-zA-Z0-9\\-]*");
            return;
        }

        let cmd = `git flow feature start -F ${name}`;

        this.util.execCb(cmd, s => {
            vscode.window.showInformationMessage(`Feature ${name} have been created successfuly!`);
            this._onDidChangeTreeData.fire();
        });
    }
    async finishFeature() { }
    async rebaseFeature() {
        let name = await vscode.window.showQuickPick(
            this.listBranches.filter(el => el.search('feature/') !== -1),
            { title: "Select feature to rebase" }
        );

        let options = await vscode.window.showQuickPick(
            ["An interactive rebase", "Preserve merges"], { title: "Select options", canPickMany: true }
        );
        let option = options?.map(el => {
            switch (el.toLowerCase().replace(" ", "")) {
                case "aninteractiverebase":
                    return "-i";
                case "preservemerges":
                    return "-p";
            }
        });

        let base = await vscode.window.showQuickPick(
            ["develop", "masert"],
            { title: "Select base branch" }
        );

        if (name === undefined || base === undefined) {
            return;
        }

        let cmd = `git flow feature rebase ${option} ${name?.split("/")[1]} ${base}`;

        this.util.execCb(cmd, s => {
            vscode.window.showInformationMessage(`Feature ${name} have been published or updated successfuly!`);
            this._onDidChangeTreeData.fire();
        });
    }
    async publishFeature() {
        let name = await vscode.window.showQuickPick(
            this.listBranches.filter(el => el.search('feature/') !== -1),
            { title: "Select feature" }
        );

        let cmd = `git flow feature publish ${name?.split("/")[1]}`;

        this.util.execCb(cmd, s => {
            vscode.window.showInformationMessage(`Feature ${name} have been published or updated successfuly!`);
            this._onDidChangeTreeData.fire();
        });
    }
    async checkoutFeature() {
        let name = await vscode.window.showQuickPick(
            this.listBranches.filter(el => el.search('feature/') !== -1),
            { title: "Select feature" }
        );

        let cmd = `git flow feature checkout ${name?.split("/")[1]}`;

        this.util.execCb(cmd, s => {
            vscode.window.showInformationMessage(`Feature ${name} have been checked out successfuly!`);
            this._onDidChangeTreeData.fire();
        });
    }


    async startRelease() {
        let name = await vscode.window.showInputBox({ title: "Enter release name [a-zA-Z0-9-]*" });
        if (name?.length === 0) { return }
        if (name?.match(/^([a-zA-Z0-9\\-]*)$/) === null) {
            vscode.window.showErrorMessage("Release name have to match [a-zA-Z0-9\\-]*");
            return;
        }

        let cmd = `git flow feature start -F ${name}`;

        this.util.execCb(cmd, s => {
            vscode.window.showInformationMessage(`Release ${name} have been started!`);
            this._onDidChangeTreeData.fire();
        });
    }
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
        // vscode.window.showInputBox({title: "Enter this", value: "master"}); 
        // let o = gft.exec(`git flow init --feature ${vscode.workspace.getConfiguration().get('gitflow.feature')} --hotfix ${vscode.workspace.getConfiguration().get('gitflow.hotfix')} --release ${vscode.workspace.getConfiguration().get('gitflow.release')} `);
        // if (o.toLowerCase().search('fatal:') || o.toLowerCase().search('error:')) {
        //     vscode.window.showWarningMessage(o);
        // } else {
        //     vscode.window.showInformationMessage(o);
        // }
    }

}

class Flow extends vscode.TreeItem {
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
    }

    iconPath = new vscode.ThemeIcon(this.icon);
}