import * as vscode from "vscode";
import {Util} from "./lib/Util";

let checked:boolean = false;

export class TreeViewVersions implements vscode.TreeDataProvider<Tag> {
    private _onDidChangeTreeData: vscode.EventEmitter<Tag | undefined | null | void> =
        new vscode.EventEmitter<Tag | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<Tag | undefined | null | void> =
        this._onDidChangeTreeData.event;
    private terminal: vscode.Terminal | null;
    private remotes: string[] = [];
    private tags: string[] = [];

    constructor(private util: Util) {
        this.terminal = null;
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: Tag): vscode.TreeItem {
        return element;
    }

    getChildren(element?: Tag): Thenable<Tag[]> {
        if (!checked && !this.util.check()) {
            return Promise.resolve([]);
        }
        checked = true;
        
        this.remotes = this.util
            .execSync("git ls-remote --tags origin")
            .split("\n")
            .filter((el) => el.trim().search("refs/tags/") > 0)
            .map((el) => el.split("/")[2].replace("^{}", ""));

        this.tags = this.util
            .execSync("git tag --sort=-v:refname")
            .split("\n")
            .map((el) => el.trim())
            .filter((el) => el !== "");
        let list: Tag[] = [];
        this.tags.forEach((el) => {
            if (el.search(" ") !== -1) {
                return;
            }
            list.push(new Tag(el, !this.remotes.includes(el)));
        });

        return Promise.resolve(list);
    }

    async deleteTag(node: Tag | undefined) {
        let name = node?.label;
        if (node === undefined) {
            let tags = this.util
                .execSync("git tag --sort=-v:refname")
                .split("\n")
                .map((el) => el.trim())
                .filter((el) => el !== "");
            name = await vscode.window.showQuickPick(tags, {});
        }
        if (name === undefined) {
            return;
        }

        let remotes = ["Delete local"];
        if (this.remotes.includes(name)) {
            remotes =
                (await vscode.window.showQuickPick(["Delete local", "Delete Remote"], {
                    title: `Where to delete from?`,
                    canPickMany: true,
                })) || [];
        }
        if (remotes.includes("Delete Remote")) {
            this.util.execSync(`git push --delete origin ${name}`);
        }
        if (remotes.includes("Delete local")) {
            this.util.execSync(`git tag -d ${name}`);
        }
        this._onDidChangeTreeData.fire();
    }

    async pushTag(node: Tag | undefined) {
        let name = node?.label;
        if (node === undefined) {
            let tags = this.util
                .execSync("git tag --sort=-v:refname")
                .split("\n")
                .map((el) => el.trim())
                .filter((el) => el !== "");
            name = await vscode.window.showQuickPick(tags, {});
        }
        if (name === undefined) {
            return;
        }

        this.util.exec(`git push origin ${name}`, true, (s) => {
            this._onDidChangeTreeData.fire();
        });
    }
    pushTags() {
        this.util.exec(`git push origin --tags`, true, (s) => {
            this._onDidChangeTreeData.fire();
        });
    }
}

export class Tag extends vscode.TreeItem {
    constructor(public readonly label: string, private descr: boolean = false) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.label = label;
        this.contextValue = descr ? "local" : "";
        this.description = descr ? "local" : "";
    }

    iconPath = new vscode.ThemeIcon("tag");
}
