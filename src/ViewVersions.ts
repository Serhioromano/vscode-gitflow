import * as vscode from 'vscode';
import { Util } from './Util';

export class TreeViewVersions implements vscode.TreeDataProvider<Tag> {
    private _onDidChangeTreeData: vscode.EventEmitter<Tag | undefined | null | void> = new vscode.EventEmitter<Tag | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<Tag | undefined | null | void> = this._onDidChangeTreeData.event;
    private util: Util;
    private terminal: vscode.Terminal | null;

    constructor(private workspaceRoot: string) {
        this.util = new Util(workspaceRoot);
        this.terminal = null;
    }


    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: Tag): vscode.TreeItem {
        return element;
    }

    getChildren(element?: Tag): Thenable<Tag[]> {
        let remotes = this.util.exec('git ls-remote --tags origin')
            .split("\n")
            .filter(el => el.trim().search("refs/tags/") > 0)
            .map(el => el.split("/")[2].replace("^{}", ""));

        let tags = this.util.exec('git tag --sort=-v:refname').split("\n").map(el => el.trim()).filter(el => el !== '');
        let list: Tag[] = [];
        tags.forEach(el => {
            list.push(new Tag(el, !remotes.includes(el)));
        });

        return Promise.resolve(list);
    }

    async pushTag(node: Tag | undefined) {
        let name = node?.label;
        if (node === undefined) {
            let tags = this.util.exec('git tag --sort=-v:refname')
                .split("\n").map(el => el.trim()).filter(el => el !== '');
            name = await vscode.window.showQuickPick(tags, {});
        }
        if (name === undefined) {
            return;
        }

        this._runTerminal(`git push origin :refs/tags/${name}`);

        // this.util.execCb(`git push origin :refs/tags/${name}`, (s) => {
        //     this._onDidChangeTreeData.fire();
        // });
    }
    pushTags() {
        this._runTerminal(`git push origin --tags`);
        // this.util.execCb(`git push origin --tags`, (s) => {
        //     this._onDidChangeTreeData.fire();
        // });
    }
    _initTerminal() {
        let terminal: vscode.Terminal | null = null;
        const terminals = <vscode.Terminal[]>(<any>vscode.window).terminals;
        terminals.forEach(t => {
            if (t.name === 'GitFlow') {
                terminal = t;
            }
        });
        if (terminal === null) {
            this.terminal = vscode.window.createTerminal(`GitFlow`);
        } else {
            this.terminal = terminal;
        }
    }
    _runTerminal(cmd: string): void {
        this._initTerminal();
        this.terminal?.show();
        this.terminal?.sendText(cmd);
    }
}

export class Tag extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        private descr: boolean = false

    ) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.label = label;
        this.contextValue = descr ? 'local' : '';
        this.description = descr ? 'local' : '';
    }

    iconPath = new vscode.ThemeIcon('tag');
}