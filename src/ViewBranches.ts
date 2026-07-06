import { debounce, memoize, throttle } from './lib/decorators';
import * as vscode from "vscode";
import { Util } from "./lib/Util";
import { readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";
import os from "os";
import { Tag } from './ViewVersions';

interface BranchList {
    develop: string;
    master: string;
    release: string;
    feature: string;
    hotfix: string;
    bugfix: string;
    support: string;
}
type Emitter = Flow | FolderNode | undefined | null | void;


/**
 * Represents an intermediate folder node in the branch tree hierarchy.
 * Used for branches with multiple slash-separated segments (e.g., feature/a/b/c).
 */
export class FolderNode extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly full: string,       // partial path: "feature/sub1/sub2"
        public readonly prefix: string,     // gitflow prefix: "feature", "release", etc.
        public readonly depth: number       // nesting level (0 = direct child of category)
    ) {
        super(label, vscode.TreeItemCollapsibleState.Expanded);
        this.iconPath = new vscode.ThemeIcon("folder");
        this.contextValue = "folder";
    }
}


export class TreeViewBranches implements vscode.TreeDataProvider<Flow | FolderNode> {
    private _onDidChangeTreeData: vscode.EventEmitter<Emitter> = new vscode.EventEmitter<Emitter>();
    readonly onDidChangeTreeData: vscode.Event<Emitter> = this._onDidChangeTreeData.event;

    public curBranch: string = "";
    public listBranches: string[] = [];
    public listRemoteBranches: string[] = [];
    public hasOrigin: boolean = false;

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

    getTreeItem(element: Flow | FolderNode): vscode.TreeItem {
        return element;
    }

    /**
     * Recursively build a tree of FolderNode and Flow items from a list of branch names.
     * Each slash-separated segment after the prefix becomes a folder level.
     */
    private buildBranchTree(
        branches: string[],
        prefix: string,
        currentPath: string,
        depth: number
    ): (Flow | FolderNode)[] {
        const result: (Flow | FolderNode)[] = [];
        const folders = new Map<string, string[]>();

        for (const branch of branches) {
            // Get the remaining path after stripping the currentPath prefix
            let remaining = branch;
            if (currentPath) {
                remaining = branch.substring(currentPath.length + 1);
            }

            const segments = remaining.split("/");
            const firstSegment = segments[0];

            if (segments.length === 1) {
                // This is a leaf branch - create a Flow node
                const branchKey = currentPath ? `${currentPath}/${firstSegment}` : firstSegment;
                const isLocal = this.listBranches.includes(branchKey);
                const isRemote = this.listRemoteBranches.includes(branchKey);
                let contextSuffix = prefix;

                if (isLocal && !isRemote) {
                    contextSuffix = `${prefix}_local`;
                } else if (isRemote && !isLocal) {
                    contextSuffix = `origin_${prefix}`;
                }

                const label = isRemote && !isLocal ? `ORIGIN/${firstSegment}` : firstSegment;
                result.push(
                    new Flow(
                        branchKey,
                        label,
                        "git-branch",
                        vscode.TreeItemCollapsibleState.None,
                        this._isCurrent(branchKey),
                        contextSuffix
                    )
                );
            } else {
                // More segments - group into folder
                const folderPath = currentPath ? `${currentPath}/${firstSegment}` : firstSegment;
                if (!folders.has(firstSegment)) {
                    folders.set(firstSegment, []);
                }
                folders.get(firstSegment)!.push(branch);
            }
        }

        // Add folder nodes (sorted)
        for (const [folderName, folderBranches] of Array.from(folders.entries()).sort()) {
            const folderPath = currentPath ? `${currentPath}/${folderName}` : folderName;
            const folderNode = new FolderNode(folderName, folderPath, prefix, depth);
            // Store children lazily by attaching them to the node
            // We'll handle this in getChildren by checking the full path
            result.push(folderNode);
        }

        // Sort: folders first, then branches
        result.sort((a, b) => {
            if (a instanceof FolderNode && !(b instanceof FolderNode)) return -1;
            if (!(a instanceof FolderNode) && b instanceof FolderNode) return 1;
            return a.label.localeCompare(b.label);
        });

        return result;
    }

    getChildren(element?: Flow | FolderNode): Thenable<(Flow | FolderNode)[]> {

        if (!this.util.isReady()) {
            return Promise.resolve([]);
        }

        let tree: (Flow | FolderNode)[] = [];

        if (element === undefined) {
            let config = vscode.workspace.getConfiguration("gitflow");
            if (config.get("disableOnRepo")) {
                return Promise.resolve([]);
            }

            let configList = this.util.execSync(`${this.util.flowPath} config list`);
            if (configList.toLowerCase().search("not a gitflow-enabled repo yet") > 0 && config.get("showNotification") === true) {

                let initLink = vscode.l10n.t('Init');
                let disableCheck = vscode.l10n.t('Disable');
                vscode.window
                    .showWarningMessage(
                        vscode.l10n.t('Not a gitflow-enabled repo yet. Please, open a terminal and run `git flow init` command.'),
                        initLink, disableCheck
                    )
                    .then((selection) => {
                        if (selection === initLink) {
                            vscode.commands.executeCommand("gitflow.init");
                        }
                        if (selection === disableCheck) {
                            config.update("disableOnRepo", true, vscode.ConfigurationTarget.Workspace);
                        }
                    });
                return Promise.resolve([]);
            }

            this.curBranch = this.util.execSync(`"${this.util.path}" rev-parse --abbrev-ref HEAD`).trim();

            let b = configList.replace("\r", "").split("\n");
            this.branches.master = `${b[0].split(": ")[1]}`.trim();
            this.branches.develop = `${b[1].split(": ")[1]}`.trim();
            this.branches.feature = `${b[2].split(": ")[1]}`.trim();
            this.branches.bugfix = `${b[3].split(": ")[1]}`.trim();
            this.branches.release = `${b[4].split(": ")[1]}`.trim();
            this.branches.hotfix = `${b[5].split(": ")[1]}`.trim();
            this.branches.support = `${b[6].split(": ")[1]}`.trim();
            this.listBranches = this.util
                .execSync(`"${this.util.path}" branch`)
                .split("\n")
                .map((el) => el.trim().replace("* ", ""))
                .filter((el) => el !== "");

            this.listRemoteBranches = this.util
                .execSync(`"${this.util.path}" branch -r`)
                .split("\n")
                .map((el) => {
                    if (el.toLowerCase().search("origin/") !== -1) {
                        this.hasOrigin = true;
                    }
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
                    vscode.l10n.t('Releases'),
                    "tag",
                    vscode.TreeItemCollapsibleState.Expanded,
                    false,
                    "r"
                )
            );
            tree.push(
                new Flow(
                    this.branches.feature.replace("/", ""),
                    vscode.l10n.t('Features'),
                    "test-view-icon",
                    vscode.TreeItemCollapsibleState.Expanded,
                    false,
                    "f"
                )
            );
            tree.push(
                new Flow(
                    this.branches.bugfix.replace("/", ""),
                    vscode.l10n.t('BugFixes'),
                    "callstack-view-session",
                    vscode.TreeItemCollapsibleState.Expanded,
                    false,
                    "b"
                )
            );
            tree.push(
                new Flow(
                    this.branches.hotfix.replace("/", ""),
                    vscode.l10n.t('HotFixes'),
                    "flame",
                    vscode.TreeItemCollapsibleState.Expanded,
                    false,
                    "h"
                )
            );
            tree.push(
                new Flow(
                    this.branches.support.replace("/", ""),
                    vscode.l10n.t('Support'),
                    "history",
                    vscode.TreeItemCollapsibleState.Expanded,
                    false,
                    "s"
                )
            );

            vscode.commands.executeCommand("setContext", "gitflow.initialized", true);
            return Promise.resolve(tree);
        }

        // Handle FolderNode (intermediate folder in nested branch structure)
        if (element instanceof FolderNode) {
            // Get all branches (local + remote) that start with the folder's path
            const allBranches = [...this.listBranches, ...this.listRemoteBranches];
            const matchingBranches = allBranches.filter((el) => {
                return el.startsWith(element.full + "/");
            });

            // Remove duplicates while preserving order
            const uniqueBranches = Array.from(new Set(matchingBranches));

            tree = this.buildBranchTree(
                uniqueBranches,
                element.prefix,
                element.full,
                element.depth + 1
            );
            return Promise.resolve(tree);
        }

        // Handle category nodes (Features, Releases, etc.)
        // Get the prefix from element.full (e.g., "feature", "release", etc.)
        const prefix = element.full;

        // Collect local branches matching this prefix
        const localBranches = this.listBranches.filter((el) => {
            return el.startsWith(prefix + "/");
        });

        // Collect remote branches matching this prefix (not already local)
        const remoteBranches = this.listRemoteBranches.filter((el) => {
            return el.startsWith(prefix + "/") && !this.listBranches.includes(el);
        });

        // Combine all branches for this prefix
        const allBranches = [...localBranches, ...remoteBranches];

        tree = this.buildBranchTree(allBranches, prefix, prefix, 0);
        return Promise.resolve(tree);
    }

    fetchAllBranches() {
        this.util.exec(`"${this.util.path}" fetch --all`, true, (s) => {
            this._onDidChangeTreeData.fire();
        });
    }

    syncAll() {
        if (!this.hasOrigin) {
            vscode.window.showWarningMessage(vscode.l10n.t('No ORIGIN remote has been found!'));
            return;
        }
        vscode.window
            .withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: vscode.l10n.t('Sync all root branches'),
                    cancellable: false,
                },
                (progress, token) =>
                    new Promise<void>((resolve) => {
                        setTimeout(() => {
                            this.listBranches
                                .filter((el) => el.split("/").length < 2)
                                .forEach((el) => {
                                    if (this.listRemoteBranches.includes(el)) {
                                        this.util.execSync(`"${this.util.path}" pull origin ${el}`);
                                    }
                                    this.util.execSync(`"${this.util.path}" push origin ${el}:${el}`);
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
                this.listBranches,
                { title: vscode.l10n.t('Select branch') }
            );
        }

        let cmd = `"${this.util.path}" checkout -q ${name}`;

        this.util.exec(cmd, false, (s) => {
            this._onDidChangeTreeData.fire();
        });
    }

    async general(what: string, branch: string | undefined, search?: string) {
        if (branch === undefined && search !== undefined) {
            let branches = this.listBranches.filter((el) => el.search(search) !== -1);
            if (branches.length === 0) {
                vscode.window.showWarningMessage(vscode.l10n.t('Could not find any {0}', ucf(search)));
                return;
            }
            branch = await vscode.window.showQuickPick(branches, {
                title: vscode.l10n.t('Select branch'),
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
        // Get the full name after the prefix (preserves nested segments like "a/b/c")
        let name: string | undefined = branch.substring(branch.indexOf("/") + 1);
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
                    title: vscode.l10n.t('Enter a valid {0} branch name', ucf(feature)),
                    value: version,
                });
                if (name === undefined) {
                    return;
                }
                let config = vscode.workspace.getConfiguration("gitflow");
                name = name.replace(/\s/igm, `${config.get("replaceSymbol")}`);
                const checked = this.util.execSync(`"${this.util.path}" check-ref-format --branch ${name}`).trim();

                if (checked !== name) {
                    vscode.window.showErrorMessage(vscode.l10n.t('Error creating a branch: {0}', checked));
                    return;
                }

                if (this.curBranch.search(this.branches.support) !== -1) {
                    let b =
                        (await vscode.window.showQuickPick([vscode.l10n.t('Yes'), vscode.l10n.t('No')], {
                            title: vscode.l10n.t('Start release based on {0}?', this.curBranch),
                        })) || vscode.l10n.t('No');
                    base = b === vscode.l10n.t('Yes') ? this.curBranch : "";
                }
                if (feature === "support") {
                    base = await vscode.window.showQuickPick(
                        this.util
                            .execSync(`"${this.util.path}" tag --sort=-v:refname`)
                            .split("\n")
                            .map((el) => el.trim().replace("* ", ""))
                            .filter((el) => el !== ""),
                        { title: vscode.l10n.t('Start support branch based on a tag') }
                    );
                    if (base === undefined) {
                        return;
                    }
                }

                break;
            case "delete":
                let forceDel = `[-f] ${vscode.l10n.t('Force deletion')}`;
                let remoteDel = `[-r] ${vscode.l10n.t('Delete remote branch')}`;
                list = [forceDel];
                if (this.listRemoteBranches.includes(branch)) {
                    list.push(remoteDel);
                }
                options = await vscode.window.showQuickPick(list, {
                    title: vscode.l10n.t('Select options'),
                    canPickMany: true,
                });
                if (options === undefined) {
                    return;
                }
                if (options.includes(remoteDel)) {
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
                let interactiveRebase = `[-i] ${vscode.l10n.t('Interactive rebase')}`;
                let preserveMerges = `[-p] ${vscode.l10n.t('Preserve merges')}`;
                options = await vscode.window.showQuickPick(
                    [interactiveRebase, preserveMerges],
                    {
                        title: vscode.l10n.t('Select options'),
                        canPickMany: true,
                    }
                );
                if (options === undefined) {
                    return;
                }
                option = options
                    .map((el) => {
                        let m = el.match(/\[([^\]]*)\]/);
                        return m === null ? "" : m[1];
                    })
                    .join(" ");

                switch (feature) {
                    case "support":
                        let root = this.listBranches.filter((el) => el.split("/").length < 2);
                        let tags = this.util
                            .execSync(`"${this.util.path}" tag --sort=-v:refname`)
                            .split("\n")
                            .map((el) => el.trim().replace("* ", ""))
                            .filter((el) => el !== "");
                        base =
                            (await vscode.window.showQuickPick([...root, ...tags], {
                                title: vscode.l10n.t('Select base branch'),
                            })) || "";
                        break;
                    default:
                        base =
                            (await vscode.window.showQuickPick(
                                this.listBranches.filter((el) => el.split("/").length < 2),
                                { title: vscode.l10n.t('Select base branch') }
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
                    !options?.includes(`[--keepremote] ${vscode.l10n.t('Keep the remote branch')}`)
                ) {
                    progress = true;
                }
                if (options === undefined) {
                    return;
                }
                option =
                    options.map((el) => {
                        let m = el.match(/\[([^\]]*)\]/);
                        return m === null ? "" : m[1];
                    }).join(" ") || "";

                let msg;

                if (["hotfix", "release"].includes(feature)) {
                    msg = await vscode.window.showInputBox({
                        title: vscode.l10n.t('Message'),
                        value: vscode.l10n.t('Finish {0}: {1}', ucf(feature), name),
                    });
                    if (msg === undefined) {
                        return;
                    }
                    msg = `${msg}`.trim();
                    if (msg === "") {
                        msg = vscode.l10n.t('Finish {0}: {1}', ucf(feature), name);
                    }

                    let tmpMsgFile = path.join(`${os.tmpdir()}`, `vscode-git-flow-${Math.floor(Math.random() * 10000000)}.msg`);
                    writeFileSync(tmpMsgFile, msg, "utf-8");
                    option = `${option} -f ${tmpMsgFile} -T "${name}"`;

                    if (existsSync(this.util.workspaceRoot + "/CHANGELOG.md")) {
                        let updated = false;
                        let chc = `${readFileSync(this.util.workspaceRoot + "/CHANGELOG.md")}`;
                        chc = chc.split("\n").map(el => {
                            if (el.toLowerCase().includes("[unreleased]")) {
                                let date = new Date();
                                updated = true;
                                el = el
                                    .replace(/\[unreleased\]/i, `[${name}]`)
                                    .replace(/\byyyy\b/i, `${date.getFullYear()}`)
                                    .replace(/\bmm\b/i, `${date.getMonth() < 9 ? '0' : ''}${date.getMonth() + 1}`)
                                    .replace(/\bdd\b/i, `${date.getDate() < 10 ? '0' : ''}${date.getDate()}`);
                            }
                            return el;
                        }).join("\n");

                        if (updated) {
                            writeFileSync(this.util.workspaceRoot + "/CHANGELOG.md", chc);
                            this.util.execSync(`"${this.util.path}" add ./CHANGELOG.md`);
                            this.util.execSync(`"${this.util.path}" commit ./CHANGELOG.md -m"Update Changelog"`);
                        }
                    }
                }
                break;
        }

        let config = vscode.workspace.getConfiguration("gitflow");
        let command = config.get("showAllCommands") === true ? " --showcommands " : " ";
        let cmd = `${this.util.flowPath} ${feature} ${what}${command}${option} ${name} ${base}`;
        // console.log(cmd);

        this.util.exec(cmd, progress, (s) => {
            this._onDidChangeTreeData.fire();
            if (["hotfix", "release"].includes(feature)) {
                vscode.commands.executeCommand("gitflow.refreshT");
            }

            // Bump version
            const shouldBumpVersion = config.get("autoBumpVersion");
            if (shouldBumpVersion && ["hotfix", "release"].includes(feature) && exist && what === 'start') {
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
                    this.util.execSync(`"${this.util.path}" add ./package.json`);
                    this.util.execSync(`"${this.util.path}" commit ./package.json -m "Version bump to ${name}"`);
                }
            }
        });


        function ucf(string: string) {
            return string.charAt(0).toUpperCase() + string.slice(1);
        }
    }

    async _getFinishOptions(what: string): Promise<string[] | undefined> {
        return new Promise(async (resolve) => {
            let list: string[] = [];
            switch (what) {
                case "bugfix":
                    list = [
                        `[-F] ${vscode.l10n.t('Fetch from origin before performing finish')}`,
                        `[-r] ${vscode.l10n.t('Rebase before merging')}`,
                        `[-p] ${vscode.l10n.t('Preserve merges while rebasing')}`,
                        `[-k] ${vscode.l10n.t('Keep branch after performing finish')}`,
                        `[--keepremote] ${vscode.l10n.t('Keep the remote branch')}`,
                        `[--keeplocal] ${vscode.l10n.t('Keep the local branch')}`,
                        `[-D] ${vscode.l10n.t('Force delete branch after finish')}`,
                        `[-S] ${vscode.l10n.t('Squash branch during merge')}`,
                        `[--no-ff] ${vscode.l10n.t('Never fast-forward during the merge')}`,
                    ];
                    break;
                case "hotfix":
                    list = [
                        `[-F] ${vscode.l10n.t('Fetch from origin before performing finish')}`,
                        `[-p] ${vscode.l10n.t('Push to origin after performing finish')}`,
                        `[-k] ${vscode.l10n.t('Keep branch after performing finish')}`,
                        `[--keepremote] ${vscode.l10n.t('Keep the remote branch')}`,
                        `[--keeplocal] ${vscode.l10n.t('Keep the local branch')}`,
                        `[-D] ${vscode.l10n.t('Force delete branch after finish')}`,
                        `[-n] ${vscode.l10n.t("Don't tag this hotfix")}`,
                        `[-b] ${vscode.l10n.t("Don't back-merge master, or tag if applicable, in develop")}`,
                        `[-S] ${vscode.l10n.t('Squash branch during merge')}`,
                    ];
                    break;
                case "feature":
                    list = [
                        `[-F] ${vscode.l10n.t('Fetch from origin before performing finish')}`,
                        `[-r] ${vscode.l10n.t('Rebase before merging')}`,
                        `[-p] ${vscode.l10n.t('Preserve merges while rebasing')}`,
                        `[--push] ${vscode.l10n.t('Push to origin after performing finish')}`,
                        `[-k] ${vscode.l10n.t('Keep branch after performing finish')}`,
                        `[--keepremote] ${vscode.l10n.t('Keep the remote branch')}`,
                        `[--keeplocal] ${vscode.l10n.t('Keep the local branch')}`,
                        `[-D] ${vscode.l10n.t('Force delete branch after finish')}`,
                        `[-S] ${vscode.l10n.t('Squash branch during merge')}`,
                        `[--no-ff] ${vscode.l10n.t('Never fast-forward during the merge')}`,
                    ];
                    break;
                case "release":
                    list = [
                        `[-F] ${vscode.l10n.t('Fetch from origin before performing finish')}`,
                        `[-p] ${vscode.l10n.t('Push to origin after performing finish')}`,
                        `[-D] ${vscode.l10n.t('Force delete branch after finish')}`,
                        `[--pushproduction] ${vscode.l10n.t('Push the production branch')}`,
                        `[--pushdevelop] ${vscode.l10n.t('Push the develop branch')}`,
                        `[--pushtag] ${vscode.l10n.t('Push the tag')}`,
                        `[-k] ${vscode.l10n.t('Keep branch after performing finish')}`,
                        `[--keepremote] ${vscode.l10n.t('Keep the remote branch')}`,
                        `[--keeplocal] ${vscode.l10n.t('Keep the local branch')}`,
                        `[-n] ${vscode.l10n.t("Don't tag this release")}`,
                        `[-b] ${vscode.l10n.t("Don't back-merge master, or tag if applicable, in develop")}`,
                        `[-S] ${vscode.l10n.t('Squash branch during merge')}`,
                        `[--ff-master] ${vscode.l10n.t('Fast forward master branch if possible')}`,
                        `[--nodevelopmerge] ${vscode.l10n.t("Don't back-merge develop branch")}`,
                    ];
                    break;
            }
            resolve(
                await vscode.window.showQuickPick(list, {
                    title: vscode.l10n.t('Select delete options'),
                    canPickMany: true,
                })
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
                { title: vscode.l10n.t('Select bugfix') }
            );
        }
        if (name === undefined) {
            return;
        }

        let sForceDel = `[-f] ${vscode.l10n.t('Force deletion')}`;
        let sRemoteDel = `[-r] ${vscode.l10n.t('Delete remote branch')}`;
        let list: string[] = [sForceDel];
        if (this.listRemoteBranches.includes(`${name}`)) {
            list.push(sRemoteDel);
        }
        let options = await vscode.window.showQuickPick(list, {
            title: vscode.l10n.t('Select options'),
            canPickMany: true,
        });
        if (options === undefined) {
            return;
        }
        let option = options?.includes(sForceDel) ? "-D" : "-d";

        this.util.execSync(`"${this.util.path}" checkout -d ${this.branches.develop}`);
        this.util.execSync(`"${this.util.path}" branch ${option} ${name}`);

        if (options?.includes(sRemoteDel)) {
            this.util.exec(`"${this.util.path}" push --delete origin ${name}`, true, () => {
                this._onDidChangeTreeData.fire();
            });
            return;
        }

        this._onDidChangeTreeData.fire();
    }
    async publishSupport(node: Flow | undefined) {
        if (!this.hasOrigin) {
            vscode.window.showWarningMessage(vscode.l10n.t('No ORIGIN remote has been found!'));
            return;
        }
        let name = node?.full;
        if (name === undefined) {
            name = await vscode.window.showQuickPick(
                this.listBranches.filter((el) => el.search(this.branches.support) !== -1),
                { title: vscode.l10n.t('Select support branch') }
            );
        }
        if (name === undefined) {
            return;
        }

        let cmd = `"${this.util.path}" push origin ${name}`;

        this.util.exec(cmd, true, (s) => {
            this._onDidChangeTreeData.fire();
        });
    }
    async checkoutSupport(node: Flow | undefined) {
        let name = node?.full;
        if (name === undefined) {
            name = await vscode.window.showQuickPick(
                this.listBranches.filter((el) => el.search(this.branches.support) !== -1),
                { title: vscode.l10n.t('Select support branch') }
            );
        }
        if (name === undefined) {
            return;
        }

        let cmd = `"${this.util.path}" checkout -q ${name}`;

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
                { title: vscode.l10n.t('Select release branch') }
            );
        }
        if (name === undefined) {
            return;
        }
        let cmd = `"${this.util.path}" checkout -q ${name}`;

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
        return this.util.execSync(`${this.util.flowPath} version`);
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
        // this.terminal?.sendText(`cd ${this.util.workspaceRoot}`);
        const safePath = this.util.workspaceRoot.replace(/([\"\\\s\'\$\`])/g, '\\$1');
        this.terminal?.sendText(`cd "${safePath}"`);
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
        if (current) {
            this.description = vscode.l10n.t('Current');
            this.iconPath = new vscode.ThemeIcon("home", new vscode.ThemeColor("green"));
        }
        this.contextValue = parent ? parent : full.replace("* ", "").split("/")[0];
    }

    iconPath = new vscode.ThemeIcon(this.icon);
}
