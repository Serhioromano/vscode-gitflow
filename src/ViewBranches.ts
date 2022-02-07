import * as vscode from "vscode";
import {Util} from "./lib/Util";
import {readFileSync, writeFileSync, existsSync} from "fs";

interface BranchList {
    develop: string;
    master: string;
    release: string;
    feature: string;
    hotfix: string;
    bugfix: string;
    support: string;
}
type Emitter = Flow | undefined | null | void;

export class TreeViewBranches implements vscode.TreeDataProvider<Flow> {
    private _onDidChangeTreeData: vscode.EventEmitter<Emitter> = new vscode.EventEmitter<Emitter>();
    readonly onDidChangeTreeData: vscode.Event<Emitter> = this._onDidChangeTreeData.event;

    public curBranch: string = "";
    public listBranches: string[] = [];
    public listRemoteBranches: string[] = [];

    private terminal: vscode.Terminal | null;
    private branches: BranchList;

    constructor(private util: Util) {
        this.terminal = null;
        this.branches = {
            develop: "",
            master: "",
            release: "",
            feature: "",
            hotfix: "",
            bugfix: "",
            support: "",
        };
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
            let list = this.util.execSync("git flow config list");

            if (list.toLowerCase().search("not a gitflow-enabled repo yet") > 0) {
                let initLink = "Init";
                vscode.window
                    .showWarningMessage(
                        "Not a gitflow-enabled repo yet. Please, open a terminal and run `git flow init` command.",
                        initLink
                    )
                    .then((selection) => {
                        if (selection === initLink) {
                            vscode.commands.executeCommand("gitflow.init");
                        }
                    });
                return Promise.resolve([]);
            }

            this.curBranch = this.util.execSync("git rev-parse --abbrev-ref HEAD").trim();

            let b = this.util.execSync("git flow config list").replace("\r", "").split("\n");
            this.branches.master = b[0].split(": ")[1].trim();
            this.branches.develop = b[1].split(": ")[1].trim();
            this.branches.feature = b[2].split(": ")[1].trim();
            this.branches.bugfix = b[3].split(": ")[1].trim();
            this.branches.release = b[4].split(": ")[1].trim();
            this.branches.hotfix = b[5].split(": ")[1].trim();
            this.branches.support = b[6].split(": ")[1].trim();

            // this.listRemotes = [...new Set(
            //     this.util.execSync('git remote -v')
            //         .split("\n")
            //         .map(el => el.split("\t")[0].trim())
            //         .filter(el => el !== '')
            // )];
            this.listBranches = this.util
                .execSync("git branch")
                .split("\n")
                .map((el) => el.trim().replace("* ", ""))
                .filter((el) => el !== "");

            this.listRemoteBranches = this.util
                .execSync("git branch -r")
                .split("\n")
                .map((el) => {
                    let a = el.split("/");
                    a.shift();
                    return a.join("/");
                });

            this.listBranches
                .filter((el) => el.split("/").length < 2)
                .forEach((el) => {
                    tree.push(
                        new Flow(
                            el,
                            el,
                            "git-branch",
                            vscode.TreeItemCollapsibleState.None,
                            this._isCurrent(el),
                            "branch"
                        )
                    );
                });
            tree.push(
                new Flow(
                    this.branches.release.replace("/", ""),
                    "Releases",
                    "tag",
                    vscode.TreeItemCollapsibleState.Expanded,
                    false,
                    "r"
                )
            );
            tree.push(
                new Flow(
                    this.branches.feature.replace("/", ""),
                    "Features",
                    "test-view-icon",
                    vscode.TreeItemCollapsibleState.Expanded,
                    false,
                    "f"
                )
            );
            tree.push(
                new Flow(
                    this.branches.bugfix.replace("/", ""),
                    "BugFixes",
                    "callstack-view-session",
                    vscode.TreeItemCollapsibleState.Expanded,
                    false,
                    "b"
                )
            );
            tree.push(
                new Flow(
                    this.branches.hotfix.replace("/", ""),
                    "HotFixes",
                    "flame",
                    vscode.TreeItemCollapsibleState.Expanded,
                    false,
                    "h"
                )
            );
            tree.push(
                new Flow(
                    this.branches.support.replace("/", ""),
                    "Support",
                    "history",
                    vscode.TreeItemCollapsibleState.Expanded,
                    false,
                    "s"
                )
            );

            vscode.commands.executeCommand("setContext", "gitflow.initialized", true);
            return Promise.resolve(tree);
        }

        this.listBranches
            .filter((el) => el.split("/")[0] === element.full)
            .forEach((el) => {
                tree.push(
                    new Flow(
                        el,
                        el.split("/")[1],
                        "git-branch",
                        vscode.TreeItemCollapsibleState.None,
                        this._isCurrent(el),
                        element.full + (!this.listRemoteBranches.includes(el) ? "_local" : "")
                    )
                );
            });

        this.listRemoteBranches
            .filter((el) => {
                return (
                    el.split("/").length > 1 &&
                    el.search("HEAD") === -1 &&
                    !this.listBranches.includes(el) &&
                    el.split("/")[0] === element.full
                );
            })
            .forEach((el) => {
                tree.push(
                    new Flow(
                        el,
                        "ORIGIN/" + el.split("/")[1],
                        "git-branch",
                        vscode.TreeItemCollapsibleState.None,
                        false,
                        "origin_" + element.full
                    )
                );
            });
        return Promise.resolve(tree);
    }

    fetchAllBranches() {
        this.util.exec("git fetch --all", true, (s) => {
            this._onDidChangeTreeData.fire();
        });
    }

    syncAll() {
        vscode.window
            .withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: `Sync all root branches`,
                    cancellable: false,
                },
                (progress, token) =>
                    new Promise<void>((resolve) => {
                        setTimeout(() => {
                            this.listBranches
                                .filter((el) => el.split("/").length < 2)
                                .forEach((el) => {
                                    if (this.listRemoteBranches.includes(el)) {
                                        this.util.execSync(`git pull origin ${el}`);
                                    }
                                    this.util.execSync(`git push origin ${el}:${el}`);
                                });
                            resolve();
                        }, 100);
                    })
            )
            .then(() => {
                this._onDidChangeTreeData.fire();
            });
    }

    async checkoutBranch(node: Flow | undefined) {
        let name = node?.full;
        if (name === undefined) {
            name = await vscode.window.showQuickPick(
                this.listBranches.filter((el) => el.split("/").length < 2),
                {title: "Select branch"}
            );
        }

        let cmd = `git checkout -q ${name}`;

        this.util.exec(cmd, false, (s) => {
            this._onDidChangeTreeData.fire();
        });
    }

    async general(what: string, branch: string | undefined, search?: string) {
        if (branch === undefined && search !== undefined) {
            let branches = this.listBranches.filter((el) => el.search(search) !== -1);
            if (branches.length === 0) {
                vscode.window.showWarningMessage(`Could not find any ${ucf(search)}`);
                return;
            }
            branch = await vscode.window.showQuickPick(branches, {
                title: `Select `,
            });
        }
        if (branch === undefined) {
            return;
        }

        let option: string | undefined = "";
        let list: string[];
        let base: string | undefined = "";
        let options: string[] | undefined;
        let feature = branch.split("/")[0];
        let name: string | undefined = branch.split("/")[1];
        let progress = false;
        let version = "";
        let exist: boolean = existsSync(this.util.workspaceRoot + "/package.json");

        switch (what) {
            case "start":
                if (["hotfix", "release"].includes(feature) && exist) {
                    version =
                        JSON.parse(readFileSync(this.util.workspaceRoot + "/package.json", "utf8")).version ||
                        "";
                }

                name = await vscode.window.showInputBox({
                    title: `Enter ${ucf(feature)} name [a-zA-Z0-9-.]*`,
                    value: version,
                });
                if (name === undefined) {
                    return;
                }
                if (name?.match(/^([a-zA-Z0-9\-\.]*)$/) === null) {
                    vscode.window.showErrorMessage(`${feature} name have to match [a-zA-Z0-9\\-\\.]*`);
                    return;
                }

                if (this.curBranch.search(this.branches.support) !== -1) {
                    let b =
                        (await vscode.window.showQuickPick(["Yes", "No"], {
                            title: `Start release based on ${this.curBranch}?`,
                        })) || "No";
                    base = b === "Yes" ? this.curBranch : "";
                }
                if (feature === "support") {
                    base = await vscode.window.showQuickPick(
                        this.util
                            .execSync("git tag --sort=-v:refname")
                            .split("\n")
                            .map((el) => el.trim().replace("* ", ""))
                            .filter((el) => el !== ""),
                        {title: "Start support branch based on a tag"}
                    );
                    if (base === undefined) {
                        return;
                    }
                }

                break;
            case "delete":
                list = ["[-f] Force deletion"];
                if (this.listRemoteBranches.includes(branch)) {
                    list.push("[-r] Delete remote branch");
                }
                options = await vscode.window.showQuickPick(list, {
                    title: "Select options",
                    canPickMany: true,
                });
                if (options?.includes("[-r] Delete remote branch")) {
                    progress = true;
                }
                option = options
                    ?.map((el) => {
                        let m = el.match(/\[([^\]]*)\]/);
                        return m === null ? "" : m[1];
                    })
                    .join(" ");
                break;
            case "rebase":
                options = await vscode.window.showQuickPick(
                    ["[-i] An interactive rebase", "[-p] Preserve merges"],
                    {
                        title: "Select options",
                        canPickMany: true,
                    }
                );
                option = options
                    ?.map((el) => {
                        let m = el.match(/\[([^\]]*)\]/);
                        return m === null ? "" : m[1];
                    })
                    .join(" ");

                switch (feature) {
                    case "support":
                        let root = this.listBranches.filter((el) => el.split("/").length < 2);
                        let tags = this.util
                            .execSync("git tag --sort=-v:refname")
                            .split("\n")
                            .map((el) => el.trim().replace("* ", ""))
                            .filter((el) => el !== "");
                        base =
                            (await vscode.window.showQuickPick([...root, ...tags], {
                                title: "Select base branch",
                            })) || "";
                        break;
                    default:
                        base =
                            (await vscode.window.showQuickPick(
                                this.listBranches.filter((el) => el.split("/").length < 2),
                                {title: "Select base branch"}
                            )) || "";
                }
                if (base === undefined) {
                    return;
                }
                break;
            case "finish":
                options = await this._getFinishOptions(feature);
                if (
                    this.listRemoteBranches.includes(branch) &&
                    !options?.includes("[--keepremote] Keep the remote branch")
                ) {
                    progress = true;
                }
                option =
                    options
                        ?.map((el) => {
                            let m = el.match(/\[([^\]]*)\]/);
                            return m === null ? "" : m[1];
                        })
                        .join(" ") || "";
                if (["hotfix", "release"].includes(feature) && exist) {
                    version =
                        JSON.parse(readFileSync(this.util.workspaceRoot + "/package.json", "utf8")).version ||
                        "";
                    if (version !== "" && name !== version && `${name}`.match(/^[0-9\.]*$/) !== null) {
                        writeFileSync(
                            this.util.workspaceRoot + "/package.json",
                            readFileSync(this.util.workspaceRoot + "/package.json", "utf8").replace(
                                version,
                                `${name}`
                            )
                        );
                        this.util.execSync("git add ./package.json");
                        this.util.execSync('git commit ./package.json -m"Version bump"');
                    }
                    option = `${option} -m"Finish ${ucf(feature)}: ${name}" -T "${name}"`;
                }
                break;
        }

        let command =
            vscode.workspace.getConfiguration("gitflow").get("showAllCommands") === true
                ? " --showcommands "
                : " ";
        let cmd = `git flow ${feature} ${what}${command}${option} ${name} ${base}`;
        console.log(cmd);

        this.util.exec(cmd, progress, (s) => {
            this._onDidChangeTreeData.fire();
            if (["hotfix", "release"].includes(feature)) {
                vscode.commands.executeCommand("gitflow.refreshT");
            }
        });

        function ucf(string: string) {
            return string.charAt(0).toUpperCase() + string.slice(1);
        }
    }

    async _getFinishOptions(what: string): Promise<string[]> {
        return new Promise(async (resolve) => {
            let list: string[] = [];
            switch (what) {
                case "bugfix":
                    list = [
                        "[-F] Fetch from origin before performing finish",
                        "[-r] Rebase before merging",
                        "[-p] Preserve merges while rebasing",
                        "[-k] Keep branch after performing finish",
                        "[--keepremote] Keep the remote branch",
                        "[--keeplocal] Keep the local branch",
                        "[-D] Force delete bugfix branch after finish",
                        "[-S] Squash bugfix during merge",
                        "[--no-ff] Never fast-forward during the merge",
                    ];
                    break;
                case "hotfix":
                    list = [
                        "[-F] Fetch from origin before performing finish",
                        "[-p] Push to origin after performing finish",
                        "[-k] Keep branch after performing finish",
                        "[--keepremote] Keep the remote branch",
                        "[--keeplocal] Keep the local branch",
                        "[-D] Force delete hotfix branch after finish",
                        "[-n] Don't tag this hotfix",
                        "[-b] Don't back-merge master, or tag if applicable, in develop",
                        "[-S] Squash hotfix during merge",
                    ];
                    break;
                case "feature":
                    list = [
                        "[-F] Fetch from origin before performing finish",
                        "[-r] Rebase before merging",
                        "[-p] Preserve merges while rebasing",
                        "[--push] Push to origin after performing finish",
                        "[-k] Keep branch after performing finish",
                        "[--keepremote] Keep the remote branch",
                        "[--keeplocal] Keep the local branch",
                        "[-D] Force delete feature branch after finish",
                        "[-S] Squash feature during merge",
                        "[--no-ff] Never fast-forward during the merge",
                    ];
                    break;
                case "release":
                    list = [
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
                        "[--nodevelopmerge] Don't back-merge develop branch",
                    ];
                    break;
            }
            resolve(
                (await vscode.window.showQuickPick(list, {
                    title: "Select delete options",
                    canPickMany: true,
                })) || []
            );
        });
    }

    //#region Support
    async startSupport() {
        this.general("start", "support");
    }
    async rebaseSupport(node: Flow | undefined) {
        this.general("rebase", node?.full, this.branches.support);
    }
    async deleteSupport(node: Flow | undefined) {
        let name = node?.full;
        if (name === undefined) {
            name = await vscode.window.showQuickPick(
                this.listBranches.filter((el) => el.search(this.branches.support) !== -1),
                {title: "Select bugfix"}
            );
        }
        if (name === undefined) {
            return;
        }

        let list: string[] = ["[-f] Force deletion"];
        if (this.listRemoteBranches.includes(`${name}`)) {
            list.push("[-r] Delete remote branch");
        }
        let options = await vscode.window.showQuickPick(list, {
            title: "Select options",
            canPickMany: true,
        });
        let option = options?.includes("[-f] Force deletion") ? "-D" : "-d";

        this.util.execSync(`git checkout -d ${this.branches.develop}`);
        this.util.execSync(`git branch ${option} ${name}`);

        if (options?.includes("[-r] Delete remote branch")) {
            this.util.exec(`git push --delete origin ${name}`, true, () => {
                this._onDidChangeTreeData.fire();
            });
            return;
        }

        this._onDidChangeTreeData.fire();
    }
    async publishSupport(node: Flow | undefined) {
        let name = node?.full;
        if (name === undefined) {
            name = await vscode.window.showQuickPick(
                this.listBranches.filter((el) => el.search(this.branches.support) !== -1),
                {title: "Select support branch"}
            );
        }
        if (name === undefined) {
            return;
        }

        let cmd = `git push origin ${name}`;

        this.util.exec(cmd, true, (s) => {
            this._onDidChangeTreeData.fire();
        });
    }
    async checkoutSupport(node: Flow | undefined) {
        let name = node?.full;
        if (name === undefined) {
            name = await vscode.window.showQuickPick(
                this.listBranches.filter((el) => el.search(this.branches.support) !== -1),
                {title: "Select support branch"}
            );
        }
        if (name === undefined) {
            return;
        }

        let cmd = `git checkout -q ${name}`;

        this.util.exec(cmd, false, (s) => {
            this._onDidChangeTreeData.fire();
        });
    }

    //#endregion

    //#region Bugfix
    async startBugfix() {
        this.general("start", "bugfix");
    }
    async finishBugfix(node: Flow | undefined) {
        this.general("finish", node?.full, this.branches.bugfix);
    }
    async rebaseBugfix(node: Flow | undefined) {
        this.general("rebase", node?.full, this.branches.bugfix);
    }
    async publishBugfix(node: Flow | undefined) {
        this.general("publish", node?.full, this.branches.bugfix);
    }
    async deleteBugfix(node: Flow | undefined) {
        this.general("delete", node?.full, this.branches.bugfix);
    }
    async checkoutBugfix(node: Flow | undefined) {
        this.general("checkout", node?.full, this.branches.bugfix);
    }
    async trackBugfix(node: Flow | undefined) {
        this.general("track", node?.full, this.branches.bugfix);
    }
    //#endregion

    //#region Features
    async startFeature() {
        this.general("start", "feature");
    }
    async finishFeature(node: Flow | undefined) {
        this.general("finish", node?.full, this.branches.feature);
    }
    async rebaseFeature(node: Flow | undefined) {
        this.general("rebase", node?.full, this.branches.feature);
    }
    async publishFeature(node: Flow | undefined) {
        this.general("publish", node?.full, this.branches.feature);
    }
    async deleteFeature(node: Flow | undefined) {
        this.general("delete", node?.full, this.branches.feature);
    }
    async checkoutFeature(node: Flow | undefined) {
        this.general("checkout", node?.full, this.branches.feature);
    }
    async trackFeature(node: Flow | undefined) {
        this.general("track", node?.full, this.branches.feature);
    }
    //#endregion

    //#region Hotfix
    async startHotfix() {
        this.general("start", "hotfix");
    }
    async checkoutHotfix(node: Flow | undefined) {
        this.general("checkout", node?.full, this.branches.hotfix);
    }
    async publishHotfix(node: Flow | undefined) {
        this.general("publish", node?.full, this.branches.hotfix);
    }
    async deleteHotfix(node: Flow | undefined) {
        this.general("delete", node?.full, this.branches.hotfix);
    }
    async rebaseHotfix(node: Flow | undefined) {
        this.general("rebase", node?.full, this.branches.hotfix);
    }
    async finishHotfix(node: Flow | undefined) {
        this.general("finish", node?.full, this.branches.hotfix);
    }
    //#endregion

    //#region Releases
    async startRelease() {
        this.general("start", "release");
    }
    async checkoutRelease(node: Flow | undefined) {
        let name = node?.full;
        if (name === undefined) {
            name = await vscode.window.showQuickPick(
                this.listBranches.filter((el) => el.search(this.branches.release) !== -1),
                {title: "Select release branch"}
            );
        }
        if (name === undefined) {
            return;
        }
        let cmd = `git checkout -q ${name}`;

        this.util.exec(cmd, false, (s) => {
            this._onDidChangeTreeData.fire();
        });
    }
    async publishRelease(node: Flow | undefined) {
        this.general("publish", node?.full, this.branches.release);
    }
    async deleteRelease(node: Flow | undefined) {
        this.general("delete", node?.full, this.branches.release);
    }
    async trackRelease(node: Flow | undefined) {
        this.general("track", node?.full, this.branches.release);
    }
    async finishRelease(node: Flow | undefined) {
        this.general("finish", node?.full, this.branches.release);
    }
    async rebaseRelease(node: Flow | undefined) {
        this.general("rebase", node?.full, this.branches.release);
    }
    //#endregion

    version(): string {
        return this.util.execSync("git flow version");
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    init() {
        this._runTerminal("git flow init -f");
    }

    _initTerminal() {
        let terminal: vscode.Terminal | null = null;
        const terminals = <vscode.Terminal[]>(<any>vscode.window).terminals;
        terminals.forEach((t) => {
            if (t.name === "GitFlow") {
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
        this.terminal?.sendText(`cd ${this.util.workspaceRoot}`);
        this.terminal?.sendText(cmd);
    }

    _isCurrent(name: string | undefined): boolean {
        return name === this.curBranch;
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
        this.description = current ? "Current" : "";
        this.contextValue = parent ? parent : full.replace("* ", "").split("/")[0];
    }

    iconPath = new vscode.ThemeIcon(this.icon);
}
