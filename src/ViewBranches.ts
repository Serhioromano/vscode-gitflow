import * as vscode from 'vscode';
import { threadId } from 'worker_threads';
import { Util } from './Util';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { exec } from 'child_process';

export class TreeViewBranches implements vscode.TreeDataProvider<Flow> {
    private _onDidChangeTreeData: vscode.EventEmitter<Flow | undefined | null | void> = new vscode.EventEmitter<Flow | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<Flow | undefined | null | void> = this._onDidChangeTreeData.event;
    private curBranch: string = '';
    private listBranches: string[] = [];
    private listRemoteBranches: string[] = [];
    private listRemotes: string[] = [];
    private util;
    private terminal: vscode.Terminal | null;

    constructor(private workspaceRoot: string) {
        this.util = new Util(workspaceRoot);
        this.terminal = null;
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
            this.listRemotes = [...new Set(
                this.util.execSync('git remote -v')
                    .split("\n")
                    .map(el => el.split("\t")[0].trim())
                    .filter(el => el !== '')
            )];
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
                        this._isCurrent(el)
                    ));
                });

            tree.push(new Flow('release', 'Releases', 'tag', vscode.TreeItemCollapsibleState.Expanded, false, 'r'));
            tree.push(new Flow('feature', 'Features', 'test-view-icon', vscode.TreeItemCollapsibleState.Expanded, false, 'f'));
            tree.push(new Flow('bugfix', 'BugFixes',  'callstack-view-session', vscode.TreeItemCollapsibleState.Expanded, false, 'b'));
            tree.push(new Flow('hotfix', 'HotFixes',  'flame', vscode.TreeItemCollapsibleState.Expanded, false, 'h'));
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
    async checkoutBranch(node: Flow | undefined) {
        let name = node?.full;
        if (name === undefined) {
            name = await vscode.window.showQuickPick(
                this.listBranches.filter(el => el.split("/").length < 2),
                { title: "Select branch" }
            );
        }

        let cmd = `git checkout -q ${name?.split("/")[1]}`;

        this.util.exec(cmd, false, s => {
            this._onDidChangeTreeData.fire();
        });
    }

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

        let cmd = `git flow bugfix start -F ${name}`;

        this.util.exec(cmd, false, s => {
            this._onDidChangeTreeData.fire();
        });
    }
    async finishBugfix(node: Flow | undefined) {
        let name = node?.full;
        if (name === undefined) {
            name = await vscode.window.showQuickPick(
                this.listBranches.filter(el => el.search('bugfix/') !== -1),
                { title: "Select bugfix" }
            );
        }
        let options = await vscode.window.showQuickPick(
            [
                "[-F] Fetch from origin before performing finish",
                "[-r] Rebase before merging",
                "[-p] Preserve merges while rebasing",
                "[-k] Keep branch after performing finish",
                "[--keepremote] Keep the remote branch",
                "[--keeplocal] Keep the local branch",
                "[-D] Force delete bugfix branch after finish",
                "[-S] Squash bugfix during merge",
                "[--no-ff] Never fast-forward during the merge"
            ], { title: "Select options", canPickMany: true }
        );
        let option = options?.map(el => {
            let m = el.match(/\[([^\]]*)\]/);
            return m === null ? '' : m[1];
        }).join(" ");

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
                this.listBranches.filter(el => el.search('bugfix/') !== -1),
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
                    .filter(el => el.search('bugfix/') !== -1 && !this.listRemoteBranches.includes(el)),
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
                this.listBranches.filter(el => el.search('bugfix/') !== -1),
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
                this.listBranches.filter(el => el.search('bugfix/') !== -1),
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
                this.listRemoteBranches.filter(el => el.search('bugfix/') !== -1),
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

        this.util.exec(cmd, false, s => {
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
                    .filter(el => el.search('feature/') !== -1 && !this.listRemoteBranches.includes(el)),
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
                this.listBranches.filter(el => el.search('feature/') !== -1),
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
                this.listBranches.filter(el => el.search('feature/') !== -1),
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
                this.listRemoteBranches.filter(el => el.search('feature/') !== -1),
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
            title: "Enter release name [a-zA-Z0-9-]*",
            value: version
        });
        if (name?.length === 0) { return; }
        if (name?.match(/^[a-zA-Z0-9\-\.]*$/) === null) {
            vscode.window.showErrorMessage("Release name have to match [a-zA-Z0-9\-\.]*");
            return;
        }
        if (name === undefined) {
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

        let cmd = `git flow hotfix start ${name}`;

        this.util.exec(cmd, false, s => {
            this._onDidChangeTreeData.fire();
        });
    }
    async publishHotfix(node: Flow | undefined) {
        let name = node?.full;
        if (name === undefined) {
            name = await vscode.window.showQuickPick(
                this.listBranches.filter(el => el.search('hotfix/') !== -1),
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
                this.listBranches.filter(el => el.search('hotfix/') !== -1),
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
                this.listBranches.filter(el => el.search('release/') !== -1),
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
                this.listBranches.filter(el => el.search('hotfix/') !== -1),
                { title: "Select hotfix" }
            );
        }

        let version = await vscode.window.showInputBox({
            title: "Tagname", value: name?.split("/")[1]
        });


        let options = await vscode.window.showQuickPick([
            "[-F] Fetch from origin before performing finish",
            "[-p] Push to origin after performing finish",
            "[-k] Keep branch after performing finish",
            "[--keepremote] Keep the remote branch",
            "[--keeplocal] Keep the local branch",
            "[-D] Force delete hotfix branch after finish",
            "[-n] Don't tag this hotfix",
            "[-b] Don't back-merge master, or tag if applicable, in develop",
            "[-S] Squash hotfix during merge"
        ], { title: "Select options", canPickMany: true });
        let option = options?.map(el => {
            let m = el.match(/\[([^\]]*)\]/);
            return m === null ? '' : m[1];
        }).join(" ");

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
        if (name?.length === 0) { return; }
        if (name?.match(/^[a-zA-Z0-9\-\.]*$/) === null) {
            vscode.window.showErrorMessage("Release name have to match [a-zA-Z0-9\-\.]*");
            return;
        }
        if (name === undefined) {
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

        let cmd = `git flow release start ${name}`;

        this.util.exec(cmd, false, s => {
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

        this.util.exec(cmd, true, s => {
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
                this.listRemoteBranches.filter(el => el.search('release/') !== -1),
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
                this.listBranches.filter(el => el.search('release/') !== -1),
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