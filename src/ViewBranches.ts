import { debounce, memoize, throttle } from './lib/decorators';
import * as vscode from "vscode";
import { Util } from "./lib/Util";
import { Tag } from './ViewVersions';
import { GitFlowImplementation, OperationContext } from './lib/GitFlowImplementation';

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
            try {
            let config = vscode.workspace.getConfiguration("gitflow");
            if (config.get("disableOnRepo")) {
                return Promise.resolve([]);
            }

            let configList = this.util.execSync(`${this.util.flowPath} config list`);
            if (this.impl.isNotInitialized(configList) && config.get("showNotification") === true) {

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

            // Use variant-aware config parser (handles both AVH key=value and Next hierarchical formats)
            this.branches = this.impl.parseConfigList(configList);
            this.listBranches = this.util
                .execSync(`"${this.util.path}" branch`)
                .split("\n")
                .map((el) => el.trim().replace("* ", ""))
                .filter((el) => el !== "");

            this.listRemoteBranches = this.util
                .execSync(`"${this.util.path}" branch -r`)
                .split("\n")
                .map((el) => el.trim())
                .filter((el) => el !== "")
                .map((el) => {
                    if (el.toLowerCase().includes("origin/")) {
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
            } catch (e) {
                console.error(`Git Flow tree init error: ${e}`);
                vscode.window.showErrorMessage(vscode.l10n.t('Git Flow failed to load. See the Output panel for details.'));
                return Promise.resolve([]);
            }
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

    // ═══════════════════════════════════════════════════════════
    // Implementation access
    // ═══════════════════════════════════════════════════════════

    private get impl(): GitFlowImplementation {
        return this.util.gitFlowImpl;
    }

    private _ctx(): OperationContext {
        return {
            listBranches: this.listBranches,
            listRemoteBranches: this.listRemoteBranches,
            curBranch: this.curBranch,
            branches: this.branches,
            hasOrigin: this.hasOrigin,
            workspaceRoot: this.util.workspaceRoot,
            onComplete: () => this._onDidChangeTreeData.fire(),
        };
    }

    /**
     * Minimal dispatcher for the QuickPick command (cm.ts).
     * Routes a what/branch pair to the correct typed method.
     */
    async generalOp(what: string, branch: string) {
        const prefix = branch.split('/')[0];
        const node = new Flow(branch, branch, '', vscode.TreeItemCollapsibleState.None);
        const methods: Record<string, Record<string, (node: Flow) => Promise<void>>> = {
            feature: { finish: this.finishFeature, delete: this.deleteFeature, rebase: this.rebaseFeature, publish: this.publishFeature },
            bugfix: { finish: this.finishBugfix, delete: this.deleteBugfix, rebase: this.rebaseBugfix, publish: this.publishBugfix },
            release: { finish: this.finishRelease, delete: this.deleteRelease, rebase: this.rebaseRelease, publish: this.publishRelease },
            hotfix: { finish: this.finishHotfix, delete: this.deleteHotfix, rebase: this.rebaseHotfix, publish: this.publishHotfix },
            support: { delete: this.deleteSupport, rebase: this.rebaseSupport, publish: this.publishSupport },
        };
        const fn = methods[prefix]?.[what];
        if (fn) {
            await fn.call(this, node);
        } else {
            vscode.window.showWarningMessage(
                vscode.l10n.t('Unknown operation: {0} on {1}', what, branch)
            );
        }
    }

    /**
     * Helper for simple git-flow operations (publish, track, checkout)
     * that don't need variant-specific logic.
     */
    private async _simpleGitFlowOp(what: string, node: Flow | undefined, prefix: string, progress: boolean = false) {
        let name = node?.full;
        if (name === undefined) {
            name = await vscode.window.showQuickPick(
                this.listBranches.filter(el => el.search(prefix) !== -1),
                { title: vscode.l10n.t('Select branch') }
            );
        }
        if (name === undefined) { return; }

        const feature = name.split('/')[0];
        const branchName = name.substring(name.indexOf('/') + 1);
        const cmd = `${this.util.flowPath} ${feature} ${what}${this.impl.showCommands()}${branchName}`;

        this.util.exec(cmd, progress, () => {
            this._onDidChangeTreeData.fire();
        });
    }

    //#region Support
    async startSupport()              { await this.impl.startSupport(this._ctx()); }
    async rebaseSupport(node?: Flow)  { await this.impl.rebaseSupport(node, this._ctx()); }
    async deleteSupport(node?: Flow)  { await this.impl.deleteSupport(node, this._ctx()); }

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
        if (name === undefined) { return; }

        let cmd = `"${this.util.path}" push origin ${name}`;
        this.util.exec(cmd, true, (s) => { this._onDidChangeTreeData.fire(); });
    }

    async checkoutSupport(node: Flow | undefined) {
        let name = node?.full;
        if (name === undefined) {
            name = await vscode.window.showQuickPick(
                this.listBranches.filter((el) => el.search(this.branches.support) !== -1),
                { title: vscode.l10n.t('Select support branch') }
            );
        }
        if (name === undefined) { return; }

        let cmd = `"${this.util.path}" checkout -q ${name}`;
        this.util.exec(cmd, false, (s) => { this._onDidChangeTreeData.fire(); });
    }

    //#endregion

    //#region Bugfix
    async startBugfix()              { await this.impl.startBugfix(this._ctx()); }
    async finishBugfix(node?: Flow)  { await this.impl.finishBugfix(node, this._ctx()); }
    async deleteBugfix(node?: Flow)  { await this.impl.deleteBugfix(node, this._ctx()); }
    async rebaseBugfix(node?: Flow)  { await this.impl.rebaseBugfix(node, this._ctx()); }
    async publishBugfix(node?: Flow) { await this._simpleGitFlowOp('publish', node, this.branches.bugfix); }
    async checkoutBugfix(node?: Flow){ await this._simpleGitFlowOp('checkout', node, this.branches.bugfix); }
    async trackBugfix(node?: Flow)   { await this._simpleGitFlowOp('track', node, this.branches.bugfix); }
    //#endregion

    //#region Features
    async startFeature()              { await this.impl.startFeature(this._ctx()); }
    async finishFeature(node?: Flow)  { await this.impl.finishFeature(node, this._ctx()); }
    async deleteFeature(node?: Flow)  { await this.impl.deleteFeature(node, this._ctx()); }
    async rebaseFeature(node?: Flow)  { await this.impl.rebaseFeature(node, this._ctx()); }
    async publishFeature(node?: Flow) { await this._simpleGitFlowOp('publish', node, this.branches.feature); }
    async checkoutFeature(node?: Flow){ await this._simpleGitFlowOp('checkout', node, this.branches.feature); }
    async trackFeature(node?: Flow)   { await this._simpleGitFlowOp('track', node, this.branches.feature); }
    //#endregion

    //#region Hotfix
    async startHotfix()              { await this.impl.startHotfix(this._ctx()); }
    async finishHotfix(node?: Flow)  { await this.impl.finishHotfix(node, this._ctx()); }
    async deleteHotfix(node?: Flow)  { await this.impl.deleteHotfix(node, this._ctx()); }
    async rebaseHotfix(node?: Flow)  { await this.impl.rebaseHotfix(node, this._ctx()); }
    async publishHotfix(node?: Flow) { await this._simpleGitFlowOp('publish', node, this.branches.hotfix); }
    async checkoutHotfix(node?: Flow){ await this._simpleGitFlowOp('checkout', node, this.branches.hotfix); }
    //#endregion

    //#region Releases
    async startRelease()              { await this.impl.startRelease(this._ctx()); }
    async finishRelease(node?: Flow)  { await this.impl.finishRelease(node, this._ctx()); }
    async deleteRelease(node?: Flow)  { await this.impl.deleteRelease(node, this._ctx()); }
    async rebaseRelease(node?: Flow)  { await this.impl.rebaseRelease(node, this._ctx()); }
    async publishRelease(node?: Flow) { await this._simpleGitFlowOp('publish', node, this.branches.release); }
    async trackRelease(node?: Flow)   { await this._simpleGitFlowOp('track', node, this.branches.release); }

    async checkoutRelease(node: Flow | undefined) {
        let name = node?.full;
        if (name === undefined) {
            name = await vscode.window.showQuickPick(
                this.listBranches.filter((el) => el.search(this.branches.release) !== -1),
                { title: vscode.l10n.t('Select release branch') }
            );
        }
        if (name === undefined) { return; }
        let cmd = `"${this.util.path}" checkout -q ${name}`;
        this.util.exec(cmd, false, (s) => { this._onDidChangeTreeData.fire(); });
    }
    //#endregion

    version(): string {
        return this.util.execSync(`${this.util.flowPath} version`);
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    init() {
        this._runTerminal(this.impl.initCommand());
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
