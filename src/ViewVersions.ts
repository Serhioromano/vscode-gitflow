import * as vscode from "vscode";
import { Util } from "./lib/Util";

let checked: boolean = false;

export class TreeViewVersions implements vscode.TreeDataProvider<Tag> {
    private _onDidChangeTreeData: vscode.EventEmitter<Tag | undefined | null | void> =
        new vscode.EventEmitter<Tag | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<Tag | undefined | null | void> =
        this._onDidChangeTreeData.event;
    private terminal: vscode.Terminal | null;
    private remotes: string[] = [];
    private tags: string[] = [];
    private hasOrigin: boolean = false;

    constructor(private util: Util) {
        this.terminal = null;
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: Tag): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: Tag): Promise<Tag[]> {
        if (!checked && !this.util.check()) {
            return Promise.resolve([]);
        }
        checked = true;
        (await this.util.execSync(`"${this.util.path}" remote`))
            .split("\n")
            .map((el) => {
                if (el.toLowerCase().trim() === "origin") {
                    this.hasOrigin = true;
                }
            });

        if (this.hasOrigin) {
            this.remotes = (await this.util.execSync(`"${this.util.path}" ls-remote --tags origin`))
                .split("\n")
                .filter((el) => el.trim().search("refs/tags/") > 0)
                .map((el) => el.split("/")[2].replace("^{}", ""));
        }

        this.tags = (await this.util.execSync(`"${this.util.path}" tag --sort=-v:refname`))
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
            let tags = (await this.util.execSync(`"${this.util.path}" tag --sort=-v:refname`))
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
            await this.util.execSync(`"${this.util.path}" push --delete origin ${name}`);
        }
        if (remotes.includes("Delete local")) {
            await this.util.execSync(`"${this.util.path}" tag -d ${name}`);
        }
        this._onDidChangeTreeData.fire();
    }

    async pushTag(node: Tag | undefined) {
        if(!this.hasOrigin) {
            vscode.window.showWarningMessage("No ORIGIN remote has been found!");
            return;
        }
        let name = node?.label;
        if (node === undefined) {
            let tags = (await this.util.execSync(`"${this.util.path}" tag --sort=-v:refname`))
                .split("\n")
                .map((el) => el.trim())
                .filter((el) => el !== "");
            name = await vscode.window.showQuickPick(tags, {});
        }
        if (name === undefined) {
            return;
        }

        this.util.exec(`"${this.util.path}" push origin ${name}`, true, (s) => {
            this._onDidChangeTreeData.fire();
        });
    }
    pushTags() {
        if(!this.hasOrigin) {
            vscode.window.showWarningMessage("No ORIGIN remote has been found!");
            return;
        }
        this.util.exec(`"${this.util.path}" push origin --tags`, true, (s) => {
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
