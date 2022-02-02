import * as vscode from 'vscode';
import { Util } from './lib/Util';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { GitExtension, API as GitAPI } from './lib/git';


interface BranchList {
    develop: string,
    master: string,
    release: string,
    feature: string,
    hotfix: string,
    bugfix: string,
    support: string
};

export class TreeViewBranches implements vscode.TreeDataProvider<Flow> {
    private _onDidChangeTreeData: vscode.EventEmitter<Flow | undefined | null | void> = new vscode.EventEmitter<Flow | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<Flow | undefined | null | void> = this._onDidChangeTreeData.event;
    public curBranch: string = '';
    public listBranches: string[] = [];
    public listRemoteBranches: string[] = [];
    private util;
    private terminal: vscode.Terminal | null;
    private branches: BranchList;

    constructor(public workspaceRoot: string) {
        this.util = new Util(workspaceRoot);
        this.terminal = null;
        this.branches = {
            develop: "",
            master: "",
            release: "",
            feature: "",
            hotfix: "",
            bugfix: "",
            support: ""
        };
    }

    getTreeItem(element: Flow): vscode.TreeItem {
        return element;
    }

    getChildren(element?: Flow): Thenable<Flow[]> {
        this.util = new Util(this.workspaceRoot);
        if (!this.util.check()) {
            return Promise.resolve([]);
        }
        console.log("Start tree");

        let tree: Flow[] = [];

        if (element === undefined) {
            let list = this.util.execSync("git flow config list");

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
            this.listBranches = this.util.execSync("git branch")
                .split("\n")
                .map(el => el.trim().replace("* ", ""))
                .filter(el => el !== '');

            this.listRemoteBranches = this.util.execSync("git branch -r")
                .split("\n")
                .map(el => {
                    let a = el.split("/");
                    a.shift();
                    return a.join("/");
                });

            this.listBranches
                .filter(el => el.split("/").length < 2)
                .forEach(el => {
                    tree.push(new Flow(el,
                        el, 'git-branch', vscode.TreeItemCollapsibleState.None,
                        this._isCurrent(el), 'branch'
                    ));
                });

            tree.push(new Flow(this.branches.release.replace("/", ""), 'Releases', 'tag', vscode.TreeItemCollapsibleState.Expanded, false, 'r'));
            tree.push(new Flow(this.branches.feature.replace("/", ""), 'Features', 'test-view-icon', vscode.TreeItemCollapsibleState.Expanded, false, 'f'));
            tree.push(new Flow(this.branches.bugfix.replace("/", ""), 'BugFixes', 'callstack-view-session', vscode.TreeItemCollapsibleState.Expanded, false, 'b'));
            tree.push(new Flow(this.branches.hotfix.replace("/", ""), 'HotFixes', 'flame', vscode.TreeItemCollapsibleState.Expanded, false, 'h'));
            tree.push(new Flow(this.branches.support.replace("/", ""), 'Support', 'history', vscode.TreeItemCollapsibleState.Expanded, false, 's'));

            vscode.commands.executeCommand('setContext', 'gitflow.initialized', true);
            return Promise.resolve(tree);
        }

        this.listBranches
            .filter(el => el.split("/")[0] === element.full)
            .forEach(el => {
                tree.push(new Flow(el, el.split("/")[1], 'git-branch',
                    vscode.TreeItemCollapsibleState.None, this._isCurrent(el),
                    element.full + (!this.listRemoteBranches.includes(el) ? '_local' : '')
                ));
            });


        this.listRemoteBranches
            .filter(el => {
                return (
                    el.split("/").length > 1
                    && el.search("HEAD") === -1
                    && !this.listBranches.includes(el)
                    && el.split("/")[0] === element.full
                );
            })
            .forEach(el => {
                tree.push(new Flow(el, 'ORIGIN/' + el.split("/")[1], 'git-branch', vscode.TreeItemCollapsibleState.None,
                    false, 'origin_' + element.full
                ));
            });
        return Promise.resolve(tree);
    }

    fetchAllBranches() {
        this.util.exec("git fetch --all", true, s => {
            this._onDidChangeTreeData.fire();
        });
    }

    syncAll() {
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Sync all root branches`,
            cancellable: false
        }, (progress, token) => new Promise<void>(resolve => {
            setTimeout(() => {
                this.listBranches.filter(el => el.split("/").length < 2).forEach(el => {
                    if (this.listRemoteBranches.includes(el)) {
                        this.util.execSync(`git pull origin ${el}`);
                    }
                    this.util.execSync(`git push origin ${el}:${el}`);
                });
                resolve();
            }, 100);
        })).then(() => {
            this._onDidChangeTreeData.fire();
        });
    }
    async checkoutBranch(node: Flow | undefined) {
        let name = node?.full;
        if (name === undefined) {
            name = await vscode.window.showQuickPick(
                this.listBranches.filter(el => el.split("/").length < 2),
                { title: "Select branch" }
            );
        }

        let cmd = `git checkout -q ${name}`;

        this.util.exec(cmd, false, s => {
            this._onDidChangeTreeData.fire();
        });
    }

    async general(what: string, branch: string) {
        let option: string | undefined = "";
        let list: string[];
        let options: string[] | undefined;

        switch (what) {
            case "delete":
                list = ["[-f] Force deletion"];
                if (this.listRemoteBranches.includes(branch)) {
                    list.push("[-r] Delete remote branch");
                }
                options = await vscode.window.showQuickPick(
                    list, { title: "Select options", canPickMany: true }
                );
                option = options?.map(el => {
                    let m = el.match(/\[([^\]]*)\]/);
                    return m === null ? '' : m[1];
                }).join(" ");
                break;
            case "rebase":
                options = await vscode.window.showQuickPick(
                    ["[-i] An interactive rebase", "[-p] Preserve merges"], { title: "Select options", canPickMany: true }
                );
                option = options?.map(el => {
                    let m = el.match(/\[([^\]]*)\]/);
                    return m === null ? '' : m[1];
                }).join(" ");

                let base = await vscode.window.showQuickPick(
                    this.listBranches.filter(el => el.split("/").length < 2),
                    { title: "Select base branch" }
                );
                if (base === undefined) {
                    return;
                }
                break;
            case "finish":
                option = await this._getDeleteOptions(branch.split("/")[0]);
                break;
        }

        let cmd = `git flow ${what} ${option}`;
        console.log(cmd);

    }

    async _getDeleteOptions(what: string): Promise<string> {
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
                        "[--no-ff] Never fast-forward during the merge"
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
                        "[-S] Squash hotfix during merge"
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
                        "[--no-ff] Never fast-forward during the merge"
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
                        "[--nodevelopmerge] Don't back-merge develop branch"
                    ];
                    break;
            }
            let options = await vscode.window.showQuickPick(
                list, { title: "Select delete options", canPickMany: true }
            );
            resolve(options?.map(el => {
                let m = el.match(/\[([^\]]*)\]/);
                return m === null ? '' : m[1];
            }).join(" ") || "");
        });
    }

    //#region Support
    async startSupport() {
        let base = await vscode.window.showQuickPick(
            this.util.execSync('git tag --sort=-v:refname').split("\n").map(el => el.trim().replace("* ", "")).filter(el => el !== ''),
            { title: "Start support branch based on a tag" }
        );
        if (base === undefined) {
            return;
        }

        let name = await vscode.window.showInputBox({
            title: "Enter Support name [a-zA-Z0-9-]*", value: base.split(".")[0]
        });
        if (name === undefined) {
            return;
        }
        if (name?.match(/^([a-zA-Z0-9\-]*)$/) === null) {
            vscode.window.showErrorMessage("Support name have to match [a-zA-Z0-9\\-]*");
            return;
        }

        let cmd = `git flow support start '${name}' refs/tags/${base}`;

        this.util.exec(cmd, false, s => {
            this._onDidChangeTreeData.fire();
        });
    }
    async rebaseSupport(node: Flow | undefined) {
        let name = node?.full;
        if (name === undefined) {
            name = await vscode.window.showQuickPick(
                this.listBranches.filter(el => el.search(this.branches.support) !== -1),
                { title: "Select support branch" }
            );
        }
        if (name === undefined) {
            return;
        }

        let options = await vscode.window.showQuickPick(
            ["[-i] An interactive rebase", "[-p] Preserve merges"], { title: "Select options", canPickMany: true }
        );
        let option = options?.map(el => {
            let m = el.match(/\[([^\]]*)\]/);
            return m === null ? '' : m[1];
        }).join(" ");

        let root = this.listBranches.filter(el => el.split("/").length < 2);
        let tags = this.util.execSync('git tag --sort=-v:refname').split("\n").map(el => el.trim().replace("* ", "")).filter(el => el !== '');
        let base = await vscode.window.showQuickPick(
            [...root, ...tags],
            { title: "Select base branch" }
        );

        if (base === undefined) {
            return;
        }

        let cmd = `git flow support rebase ${option} ${name?.split("/")[1]} ${base}`;

        this.util.exec(cmd, false, s => {
            this._onDidChangeTreeData.fire();
        });
    }
    async deleteSupport(node: Flow | undefined) {
        let name = node?.full;
        if (name === undefined) {
            name = await vscode.window.showQuickPick(
                this.listBranches.filter(el => el.search(this.branches.support) !== -1),
                { title: "Select bugfix" }
            );
        }
        if (name === undefined) {
            return;
        }

        let list: string[] = ["[-f] Force deletion"];
        if (this.listRemoteBranches.includes(`${name}`)) {
            list.push("[-r] Delete remote branch");
        }
        let options = await vscode.window.showQuickPick(
            list, { title: "Select options", canPickMany: true }
        );
        let option = options?.includes("[-f] Force deletion") ? "-D" : "-d";

        this.util.execSync(`git checkout -d ${this.branches.develop}`);
        this.util.execSync(`git branch ${option} ${name}`);

        if (options?.includes("[-r] Delete remote branch")) {
            this.util.execSync(`git push --delete origin ${name}`);
        }

        this._onDidChangeTreeData.fire();
    }
    async checkoutSupport(node: Flow | undefined) {
        let name = node?.full;
        if (name === undefined) {
            name = await vscode.window.showQuickPick(
                this.listBranches.filter(el => el.search(this.branches.support) !== -1),
                { title: "Select support branch" }
            );
        }
        if (name === undefined) {
            return;
        }
        let cmd = `git checkout -q ${name}`;

        this.util.exec(cmd, false, s => {
            this._onDidChangeTreeData.fire();
        });
    }

    //#endregion

    //#region Bugfix
    async startBugfix() {
        let name = await vscode.window.showInputBox({ title: "Enter Bugfix name [a-zA-Z0-9-]*" });
        if (name?.length === 0) { return; }
        if (name?.match(/^([a-zA-Z0-9\-]*)$/) === null) {
            vscode.window.showErrorMessage("Feature name have to match [a-zA-Z0-9\\-]*");
            return;
        }

        if (name === undefined) {
            return;
        }

        let base = ((this.curBranch.search(this.branches.support) !== -1)
            ? await vscode.window.showQuickPick(['Yes', 'No'], { title: `Start release based on ${this.curBranch}?` })
            : 'No');

        let cmd = `git flow bugfix start ${name} ${base === 'Yes' ? this.curBranch : ''}`;

        this.util.exec(cmd, false, s => {
            this._onDidChangeTreeData.fire();
        });
    }
    async finishBugfix(node: Flow | undefined) {
        let name = node?.full;
        if (name === undefined) {
            name = await vscode.window.showQuickPick(
                this.listBranches.filter(el => el.search(this.branches.bugfix) !== -1),
                { title: "Select bugfix" }
            );
        }
        let option = await this._getDeleteOptions('bugfix');

        let cmd = `git flow bugfix finish ${option} ${name?.split("/")[1]}`;

        this.util.exec(cmd,
            (this.listRemoteBranches.includes(`${name}`) && !options?.includes("[--keepremote] Keep the remote branch")),
            s => {
                this._onDidChangeTreeData.fire();
            });

    }
    async rebaseBugfix(node: Flow | undefined) {
        let name = node?.full;
        if (name === undefined) {
            name = await vscode.window.showQuickPick(
                this.listBranches.filter(el => el.search(this.branches.bugfix) !== -1),
                { title: "Select bugfix" }
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
            this.listBranches.filter(el => el.split("/").length < 2),
            { title: "Select base branch" }
        );

        if (name === undefined || base === undefined) {
            return;
        }

        let cmd = `git flow bugfix rebase ${option} ${name?.split("/")[1]} ${base}`;

        this.util.exec(cmd, false, s => {
            this._onDidChangeTreeData.fire();
        });
    }
    async publishBugfix(node: Flow | undefined) {
        let name = node?.full;
        if (name === undefined) {
            name = await vscode.window.showQuickPick(
                this.listBranches
                    .filter(el => el.search(this.branches.bugfix) !== -1 && !this.listRemoteBranches.includes(el)),
                { title: "Select local Bugfix that is not on ORIGIN" }
            );
        }

        let cmd = `git flow bugfix publish ${name?.split("/")[1]}`;

        this.util.exec(cmd, true, s => {
            this._onDidChangeTreeData.fire();
        });
    }
    async deleteBugfix(node: Flow | undefined) {
        let name = node?.full;
        if (name === undefined) {
            name = await vscode.window.showQuickPick(
                this.listBranches.filter(el => el.search(this.branches.bugfix) !== -1),
                { title: "Select bugfix" }
            );
        }
        let list: string[] = ["[-f] Force deletion"];
        if (this.listRemoteBranches.includes(`${name}`)) {
            list.push("[-r] Delete remote branch");
        }
        let options = await vscode.window.showQuickPick(
            list, { title: "Select options", canPickMany: true }
        );
        let option = options?.map(el => {
            let m = el.match(/\[([^\]]*)\]/);
            return m === null ? '' : m[1];
        }).join(" ");

        let cmd = `git flow bugfix delete ${option} ${name?.split("/")[1]}`;

        this.util.exec(cmd,
            !!(options?.includes("[-r] Delete remote branch")),
            s => {
                this._onDidChangeTreeData.fire();
            });
    }
    async checkoutBugfix(node: Flow | undefined) {
        let name = node?.full;
        if (name === undefined) {
            name = await vscode.window.showQuickPick(
                this.listBranches.filter(el => el.search(this.branches.bugfix) !== -1),
                { title: "Select bugfix" }
            );
        }

        let cmd = `git flow bugfix checkout ${name?.split("/")[1]}`;

        this.util.exec(cmd, false, s => {
            this._onDidChangeTreeData.fire();
        });
    }
    async trackBugfix(node: Flow | undefined) {
        let name = node?.full;
        if (name === undefined) {
            name = await vscode.window.showQuickPick(
                this.listRemoteBranches.filter(el => el.search(this.branches.bugfix) !== -1),
                { title: "Select remote bugfix" }
            );
        }
        if (name === undefined) {
            return;
        }

        let cmd = `git flow bugfix track ${name?.split("/")[1]}`;

        this.util.exec(cmd, true, s => {
            this._onDidChangeTreeData.fire();
        });
    }
    //#endregion

    //#region Features
    async startFeature() {
        let name = await vscode.window.showInputBox({ title: "Enter feature name [a-zA-Z0-9-.]*" });
        if (name?.length === 0) { return; }
        if (name?.match(/^([a-zA-Z0-9\-\.]*)$/) === null) {
            vscode.window.showErrorMessage("Feature name have to match [a-zA-Z0-9\\-]*");
            return;
        }

        if (name === undefined) {
            return;
        }
        let base = ((this.curBranch.search(this.branches.support) !== -1)
            ? await vscode.window.showQuickPick(['Yes', 'No'], { title: `Start release based on ${this.curBranch}?` })
            : 'No');

        let cmd = `git flow feature start ${name} ${base === 'Yes' ? this.curBranch : ''}`;

        this.util.exec(cmd, false, s => {
            this._onDidChangeTreeData.fire();
        });
    }
    async finishFeature(node: Flow | undefined) {
        let name = node?.full;
        if (name === undefined) {
            name = await vscode.window.showQuickPick(
                this.listBranches.filter(el => el.search(this.branches.feature) !== -1),
                { title: "Select feature" }
            );
        }

        let option = await this._getDeleteOptions('feature');

        let cmd = `git flow feature finish ${option} ${name?.split("/")[1]}`;

        this.util.exec(cmd,
            (this.listRemoteBranches.includes(`${name}`) && !options?.includes("[--keepremote] Keep the remote branch")),
            s => {
                this._onDidChangeTreeData.fire();
            });

    }
    async rebaseFeature(node: Flow | undefined) {
        let name = node?.full;
        if (name === undefined) {
            name = await vscode.window.showQuickPick(
                this.listBranches.filter(el => el.search(this.branches.feature) !== -1),
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
            this.listBranches.filter(el => el.split("/").length < 2),
            { title: "Select base branch" }
        );

        if (name === undefined || base === undefined) {
            return;
        }

        let cmd = `git flow feature rebase ${option} ${name?.split("/")[1]} ${base}`;

        this.util.exec(cmd, false, s => {
            this._onDidChangeTreeData.fire();
        });
    }
    async publishFeature(node: Flow | undefined) {
        let name = node?.full;
        if (name === undefined) {
            name = await vscode.window.showQuickPick(
                this.listBranches
                    .filter(el => el.search(this.branches.feature) !== -1 && !this.listRemoteBranches.includes(el)),
                { title: "Select local feature that is not on ORIGIN" }
            );
        }

        let cmd = `git flow feature publish ${name?.split("/")[1]}`;

        this.util.exec(cmd, true, s => {
            this._onDidChangeTreeData.fire();
        });
    }
    async deleteFeature(node: Flow | undefined) {
        let name = node?.full;
        if (name === undefined) {
            name = await vscode.window.showQuickPick(
                this.listBranches.filter(el => el.search(this.branches.feature) !== -1),
                { title: "Select feature" }
            );
        }
        let list: string[] = ["[-f] Force deletion"];
        if (this.listRemoteBranches.includes(`${name}`)) {
            list.push("[-r] Delete remote branch");
        }
        let options = await vscode.window.showQuickPick(
            list, { title: "Select options", canPickMany: true }
        );
        let option = options?.map(el => {
            let m = el.match(/\[([^\]]*)\]/);
            return m === null ? '' : m[1];
        }).join(" ");

        let cmd = `git flow feature delete ${option} ${name?.split("/")[1]}`;

        this.util.exec(cmd,
            !!(options?.includes("[-r] Delete remote branch")),
            s => {
                this._onDidChangeTreeData.fire();
            });
    }
    async checkoutFeature(node: Flow | undefined) {
        let name = node?.full;
        if (name === undefined) {
            name = await vscode.window.showQuickPick(
                this.listBranches.filter(el => el.search(this.branches.feature) !== -1),
                { title: "Select feature" }
            );
        }

        let cmd = `git flow feature checkout ${name?.split("/")[1]}`;

        this.util.exec(cmd, false, s => {
            this._onDidChangeTreeData.fire();
        });
    }
    async trackFeature(node: Flow | undefined) {
        let name = node?.full;
        if (name === undefined) {
            name = await vscode.window.showQuickPick(
                this.listRemoteBranches.filter(el => el.search(this.branches.feature) !== -1),
                { title: "Select remote feature" }
            );
        }
        if (name === undefined) {
            return;
        }

        let cmd = `git flow feature track ${name?.split("/")[1]}`;

        this.util.exec(cmd, true, s => {
            this._onDidChangeTreeData.fire();
        });
    }
    //#endregion

    //#region Hotfix
    async startHotfix() {
        let exist: boolean = existsSync(this.workspaceRoot + '/package.json');
        let version: string = exist ? JSON.parse(readFileSync(this.workspaceRoot + '/package.json', 'utf8')).version : '';
        let name = await vscode.window.showInputBox({
            title: "Enter release name [a-zA-Z0-9-.]*",
            value: version
        });
        if (name === undefined) {
            return;
        }
        if (name?.match(/^[a-zA-Z0-9\-\.]*$/) === null) {
            vscode.window.showErrorMessage("Release name have to match [a-zA-Z0-9\-\.]*");
            return;
        }
        if (name !== version && exist) {
            writeFileSync(
                this.workspaceRoot + '/package.json',
                readFileSync(this.workspaceRoot + '/package.json', 'utf8').replace(version, name)
            );
            this.util.execSync("git add ./package.json");
            this.util.execSync('git commit ./package.json -m"Version bump"');
        }

        let base = ((this.curBranch.search(this.branches.support) !== -1)
            ? await vscode.window.showQuickPick(['Yes', 'No'], { title: `Start release based on ${this.curBranch}?` })
            : 'No');

        let cmd = `git flow hotfix start ${name} ${base === 'Yes' ? this.curBranch : ''}`;


        this.util.exec(cmd, false, s => {
            this._onDidChangeTreeData.fire();
        });
    }
    async checkoutHotfix(node: Flow | undefined) {
        let name = node?.full;
        if (name === undefined) {
            name = await vscode.window.showQuickPick(
                this.listBranches.filter(el => el.search(this.branches.hotfix) !== -1),
                { title: "Select hotfix branch" }
            );
        }
        if (name === undefined) {
            return;
        }
        let cmd = `git checkout -q ${name}`;

        this.util.exec(cmd, false, s => {
            this._onDidChangeTreeData.fire();
        });
    }
    async publishHotfix(node: Flow | undefined) {
        let name = node?.full;
        if (name === undefined) {
            name = await vscode.window.showQuickPick(
                this.listBranches.filter(el => el.search(this.branches.hotfix) !== -1),
                { title: "Select hotfix" }
            );
        }

        let cmd = `git flow hotfix publish ${name?.split("/")[1]}`;

        this.util.exec(cmd, true, s => {
            this._onDidChangeTreeData.fire();
        });
    }
    async deleteHotfix(node: Flow | undefined) {
        let name = node?.full;
        if (name === undefined) {
            name = await vscode.window.showQuickPick(
                this.listBranches.filter(el => el.search(this.branches.hotfix) !== -1),
                { title: "Select hotfix" }
            );
        }
        let list: string[] = ["[-f] Force deletion"];
        if (this.listRemoteBranches.includes(`${name}`)) {
            list.push("[-r] Delete remote branch");
        }
        let options = await vscode.window.showQuickPick(
            list, { title: "Select options", canPickMany: true }
        );
        let option = options?.map(el => {
            let m = el.match(/\[([^\]]*)\]/);
            return m === null ? '' : m[1];
        }).join(" ");

        let cmd = `git flow hotfix delete ${option} ${name?.split("/")[1]}`;

        this.util.exec(cmd, !!(options?.includes("[-r] Delete remote branch")), s => {
            this._onDidChangeTreeData.fire();
        });
    }
    async rebaseHotfix(node: Flow | undefined) {
        let name = node?.full;
        if (name === undefined) {
            name = await vscode.window.showQuickPick(
                this.listBranches.filter(el => el.search(this.branches.release) !== -1),
                { title: "Select release" }
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
            this.listBranches.filter(el => el.split("/").length < 2),
            { title: "Select base branch" }
        );

        if (name === undefined || base === undefined) {
            return;
        }

        let cmd = `git flow hotfix rebase ${option} ${name?.split("/")[1]} ${base}`;

        this.util.exec(cmd, false, s => {
            this._onDidChangeTreeData.fire();
        });
    }
    async finishHotfix(node: Flow | undefined) {
        let name = node?.full;
        if (name === undefined) {
            name = await vscode.window.showQuickPick(
                this.listBranches.filter(el => el.search(this.branches.hotfix) !== -1),
                { title: "Select hotfix" }
            );
        }

        let version = await vscode.window.showInputBox({
            title: "Tagname", value: name?.split("/")[1]
        });


        let option = await this._getDeleteOptions('hotfix');

        let cmd = `git flow hotfix finish -m"New hotfix: ${version}" -T ${version} ${option} ${name?.split("/")[1]}`;

        this.util.exec(cmd,
            (this.listRemoteBranches.includes(`${name}`) && !options?.includes("[--keepremote] Keep the remote branch")),
            s => {
                this._onDidChangeTreeData.fire();
            });
    }
    //#endregion

    //#region Releases
    async startRelease() {
        let exist: boolean = existsSync(this.workspaceRoot + '/package.json');
        let version: string = exist ? JSON.parse(readFileSync(this.workspaceRoot + '/package.json', 'utf8')).version : '';
        let name = await vscode.window.showInputBox({
            title: "Enter release name [a-zA-Z0-9-]*",
            value: version
        });
        if (name === undefined) {
            return;
        }
        if (name?.match(/^[a-zA-Z0-9\-\.]*$/) === null) {
            vscode.window.showErrorMessage("Release name have to match [a-zA-Z0-9\-\.]*");
            return;
        }

        if (name !== version && exist) {
            writeFileSync(
                this.workspaceRoot + '/package.json',
                readFileSync(this.workspaceRoot + '/package.json', 'utf8').replace(version, name)
            );
            this.util.execSync("git add ./package.json");
            this.util.execSync('git commit ./package.json -m"Version bump"');
        }

        let base = ((this.curBranch.search(this.branches.support) !== -1)
            ? await vscode.window.showQuickPick(['Yes', 'No'], { title: `Start release based on ${this.curBranch}?` })
            : 'No');

        let cmd = `git flow release start ${name} ${base === 'Yes' ? this.curBranch : ''}`;

        this.util.exec(cmd, false, s => {
            this._onDidChangeTreeData.fire();
        });
    }
    async checkoutRelease(node: Flow | undefined) {
        let name = node?.full;
        if (name === undefined) {
            name = await vscode.window.showQuickPick(
                this.listBranches.filter(el => el.search(this.branches.release) !== -1),
                { title: "Select release branch" }
            );
        }
        if (name === undefined) {
            return;
        }
        let cmd = `git checkout -q ${name}`;

        this.util.exec(cmd, false, s => {
            this._onDidChangeTreeData.fire();
        });
    }
    async publishRelease(node: Flow | undefined) {
        let name = node?.full;
        if (name === undefined) {
            name = await vscode.window.showQuickPick(
                this.listBranches.filter(el => el.search(this.branches.release) !== -1),
                { title: "Select release" }
            );
        }

        let cmd = `git flow release publish ${name?.split("/")[1]}`;

        this.util.exec(cmd, true, s => {
            this._onDidChangeTreeData.fire();
        });
    }
    async deleteRelease(node: Flow | undefined) {
        let name = node?.full;
        if (name === undefined) {
            name = await vscode.window.showQuickPick(
                this.listBranches.filter(el => el.search(this.branches.release) !== -1),
                { title: "Select release" }
            );
        }
        let list: string[] = ["[-f] Force deletion"];
        if (this.listRemoteBranches.includes(`${name}`)) {
            list.push("[-r] Delete remote branch");
        }
        let options = await vscode.window.showQuickPick(
            list, { title: "Select options", canPickMany: true }
        );
        let option = options?.map(el => {
            let m = el.match(/\[([^\]]*)\]/);
            return m === null ? '' : m[1];
        }).join(" ");

        let cmd = `git flow release delete ${option} ${name?.split("/")[1]}`;

        this.util.exec(cmd, !!options?.includes("[-r] Delete remote branch"), s => {
            this._onDidChangeTreeData.fire();
        });
    }
    async trackRelease(node: Flow | undefined) {
        let name = node?.full;
        if (name === undefined) {
            name = await vscode.window.showQuickPick(
                this.listRemoteBranches.filter(el => el.search(this.branches.release) !== -1),
                { title: "Select remote release" }
            );
        }
        if (name === undefined) {
            return;
        }

        let cmd = `git flow release track ${name?.split("/")[1]}`;

        this.util.exec(cmd, true, s => {
            this._onDidChangeTreeData.fire();
        });
    }
    async finishRelease(node: Flow | undefined) {
        let name = node?.full;
        if (name === undefined) {
            name = await vscode.window.showQuickPick(
                this.listBranches.filter(el => el.search(this.branches.release) !== -1),
                { title: "Select release" }
            );
        }

        let version = await vscode.window.showInputBox({
            title: "Tagname", value: name?.split("/")[1]
        });

        let option = await this._getDeleteOptions('release');
        let cmd = `git flow release finish -m"New release: ${version}" -T ${version} ${option} ${name?.split("/")[1]}`;

        this.util.exec(cmd,
            (this.listRemoteBranches.includes(`${name}`) && !options?.includes("[--keepremote] Keep the remote branch")),
            s => {
                this._onDidChangeTreeData.fire();
                vscode.commands.executeCommand('gitflow.refreshT');
            });
    }
    async rebaseRelease(node: Flow | undefined) {
        let name = node?.full;
        if (name === undefined) {
            name = await vscode.window.showQuickPick(
                this.listBranches.filter(el => el.search(this.branches.release) !== -1),
                { title: "Select release" }
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
            this.listBranches.filter(el => el.split("/").length < 2),
            { title: "Select base branch" }
        );

        if (name === undefined || base === undefined) {
            return;
        }

        let cmd = `git flow release rebase ${option} ${name?.split("/")[1]} ${base}`;

        this.util.exec(cmd, false, s => {
            this._onDidChangeTreeData.fire();
        });
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
        this.terminal?.sendText(`cd ${this.workspaceRoot}`);
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
        this.description = current ? 'Current' : '';
        this.contextValue = parent ? parent : full.replace("* ", "").split("/")[0];
    }

    iconPath = new vscode.ThemeIcon(this.icon);
}
