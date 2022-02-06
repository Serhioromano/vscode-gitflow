import {
    workspace,
    window,
    commands,
    StatusBarAlignment,
    ExtensionContext,
    QuickPickItemKind,
} from "vscode";
import {Flow, TreeViewBranches} from "./ViewBranches";
import {TreeViewVersions, Tag} from "./ViewVersions";
// import {GitExtension, API as GitAPI} from "./lib/git";

export function activate({subscriptions}: ExtensionContext) {
    let rootPath: string =
        workspace.workspaceFolders && workspace.workspaceFolders.length > 0
            ? workspace.workspaceFolders[0].uri.fsPath
            : "";

    const viewBranches = new TreeViewBranches(rootPath);
    const a = window.createTreeView("gitflowExplorer", {
        treeDataProvider: viewBranches,
        showCollapseAll: true,
    });
    viewBranches.getChildren();
    const viewVersions = new TreeViewVersions(rootPath);
    const b = window.createTreeView("gitflowTags", {
        treeDataProvider: viewVersions,
    });
    viewVersions.getChildren();

    if (workspace.workspaceFolders && workspace.workspaceFolders.length > 1) {
        a.message = "Current repo: " + rootPath.split("/").reverse()[0];
        b.message = "Current repo: " + rootPath.split("/").reverse()[0];
    }

    subscriptions.push(
        commands.registerCommand("gitflow.switchRepo", async () => {
            let list: string[] = workspace.workspaceFolders?.map((el) => el.uri.fsPath) || [];
            if (list.length < 2) {
                window.showInformationMessage("Not a multi folder workspace");
                return;
            }
            let repo = await window.showQuickPick(list, {
                title: "Select active repository",
            });
            if (repo === undefined) {
                return;
            }

            a.message = "Current repo: " + `${repo}`.split("/").reverse()[0];
            viewBranches.workspaceRoot = `${repo}`;
            viewBranches.refresh();
            b.message = "Current repo: " + `${repo}`.split("/").reverse()[0];
            viewVersions.workspaceRoot = `${repo}`;
            viewVersions.refresh();
        })
    );

    subscriptions.push(
        commands.registerCommand("gitflow.quickPick", async () => {
            if (viewBranches.listBranches.length < 2) {
                window.showWarningMessage("Looks like view was not yet initialized");
                return;
            }

            let list = [
                {label: "Start new branch", id: "", kind: QuickPickItemKind.Separator},
                {label: "$(test-view-icon) Start Feature", id: "newFeature", description: ""},
                {label: "$(callstack-view-session) Start Bugfix", id: "newBugfix", description: ""},
                {label: "$(history) Start Support", id: "newSupport", description: ""},
            ];
            // Only single release might be at a time
            if (
                viewBranches.listBranches.filter((el) => el.search("release/") !== -1).length === 0
            ) {
                list.push({label: "$(tag) Start Release", id: "newRelease", description: ""});
            }
            // Only single hotfix at a time
            if (
                viewBranches.listBranches.filter((el) => el.search("hotfix/") !== -1).length === 0
            ) {
                list.push({label: "$(flame) Start Hotfix", id: "newHotfix", description: ""});
            }

            let cur = viewBranches.curBranch.split("/")[0];
            if (["feature", "release", "hotfix", "bugfix"].includes(cur)) {
                list.push({
                    label: "Current branch",
                    id: "",
                    kind: QuickPickItemKind.Separator,
                });
                list.push({
                    label: `$(trash) Delete ${ucf(cur)}`,
                    description: viewBranches.curBranch,
                    id: "delete",
                });
                list.push({
                    label: `$(debug-stop) Finalize ${ucf(cur)}`,
                    description: viewBranches.curBranch,
                    id: "finish",
                });
                list.push({
                    label: `$(git-merge) Rebase ${ucf(cur)}`,
                    description: viewBranches.curBranch,
                    id: "rebase",
                });
                if (!viewBranches.listRemoteBranches.includes(viewBranches.curBranch)) {
                    list.push({
                        label: `$(cloud-upload) Publish ${ucf(cur)}`,
                        description: viewBranches.curBranch,
                        id: "publish",
                    });
                }
            }
            let action = await window.showQuickPick(list, {
                title: "Select action",
            });
            if (action === undefined) {
                return;
            }
            if (action.id.search("new") !== -1) {
                await viewBranches.general("start", action.id.replace("new", "").toLowerCase());
            } else {
                await viewBranches.general(action.id, action.description);
            }
            commands.executeCommand("workbench.view.scm");

            function ucf(string: string) {
                return string.charAt(0).toUpperCase() + string.slice(1);
            }
        })
    );

    let statBar = window.createStatusBarItem(StatusBarAlignment.Left, 10);
    statBar.command = "gitflow.quickPick";
    statBar.text = "$(list-flat) Git Flow";
    statBar.tooltip = "Show Git Flow Quick Pick menu";
    statBar.show();
    subscriptions.push(statBar);

    subscriptions.push(
        commands.registerCommand("gitflow.refreshB", () => {
            viewBranches.refresh();
        })
    );
    subscriptions.push(
        commands.registerCommand("gitflow.fetchAllBranches", () => {
            viewBranches.fetchAllBranches();
        })
    );
    subscriptions.push(
        commands.registerCommand("gitflow.init", () => {
            viewBranches.init();
        })
    );
    subscriptions.push(
        commands.registerCommand("gitflow.checkoutBranch", (node?: Flow) => {
            viewBranches.checkoutBranch(node);
        })
    );
    subscriptions.push(
        commands.registerCommand("gitflow.syncAll", () => {
            viewBranches.syncAll();
        })
    );

    subscriptions.push(
        commands.registerCommand("gitflow.newSupport", () => {
            viewBranches.startSupport();
        })
    );
    subscriptions.push(
        commands.registerCommand("gitflow.checkoutSupport", (node?: Flow) => {
            viewBranches.checkoutSupport(node);
        })
    );
    subscriptions.push(
        commands.registerCommand("gitflow.deleteSupport", (node?: Flow) => {
            viewBranches.deleteSupport(node);
        })
    );
    subscriptions.push(
        commands.registerCommand("gitflow.rebaseSupport", (node?: Flow) => {
            viewBranches.rebaseSupport(node);
        })
    );
    subscriptions.push(
        commands.registerCommand("gitflow.publishSupport", (node?: Flow) => {
            viewBranches.publishSupport(node);
        })
    );

    subscriptions.push(
        commands.registerCommand("gitflow.newHotfix", () => {
            viewBranches.startHotfix();
        })
    );
    subscriptions.push(
        commands.registerCommand("gitflow.publishHotfix", (node?: Flow) => {
            viewBranches.publishHotfix(node);
        })
    );
    subscriptions.push(
        commands.registerCommand("gitflow.deleteHotfix", (node?: Flow) => {
            viewBranches.deleteHotfix(node);
        })
    );
    subscriptions.push(
        commands.registerCommand("gitflow.finishHotfix", (node?: Flow) => {
            viewBranches.finishHotfix(node);
        })
    );
    subscriptions.push(
        commands.registerCommand("gitflow.rebaseHotfix", (node?: Flow) => {
            viewBranches.rebaseHotfix(node);
        })
    );
    subscriptions.push(
        commands.registerCommand("gitflow.checkoutHotfix", (node?: Flow) => {
            viewBranches.checkoutHotfix(node);
        })
    );

    subscriptions.push(
        commands.registerCommand("gitflow.newRelease", () => {
            viewBranches.startRelease();
        })
    );
    subscriptions.push(
        commands.registerCommand("gitflow.publishRelease", (node?: Flow) => {
            viewBranches.publishRelease(node);
        })
    );
    subscriptions.push(
        commands.registerCommand("gitflow.deleteRelease", (node?: Flow) => {
            viewBranches.deleteRelease(node);
        })
    );
    subscriptions.push(
        commands.registerCommand("gitflow.finishRelease", (node?: Flow) => {
            viewBranches.finishRelease(node);
        })
    );
    subscriptions.push(
        commands.registerCommand("gitflow.trackRelease", (node?: Flow) => {
            viewBranches.trackRelease(node);
        })
    );
    subscriptions.push(
        commands.registerCommand("gitflow.rebaseRelease", (node?: Flow) => {
            viewBranches.rebaseRelease(node);
        })
    );
    subscriptions.push(
        commands.registerCommand("gitflow.checkoutRelease", (node?: Flow) => {
            viewBranches.checkoutRelease(node);
        })
    );

    subscriptions.push(
        commands.registerCommand("gitflow.newFeature", () => {
            viewBranches.startFeature();
        })
    );
    subscriptions.push(
        commands.registerCommand("gitflow.checkoutFeature", (node?: Flow) => {
            viewBranches.checkoutFeature(node);
        })
    );
    subscriptions.push(
        commands.registerCommand("gitflow.publishFeature", (node?: Flow) => {
            viewBranches.publishFeature(node);
        })
    );
    subscriptions.push(
        commands.registerCommand("gitflow.deleteFeature", (node?: Flow) => {
            viewBranches.deleteFeature(node);
        })
    );
    subscriptions.push(
        commands.registerCommand("gitflow.rebaseFeature", (node?: Flow) => {
            viewBranches.rebaseFeature(node);
        })
    );
    subscriptions.push(
        commands.registerCommand("gitflow.trackFeature", (node?: Flow) => {
            viewBranches.trackFeature(node);
        })
    );
    subscriptions.push(
        commands.registerCommand("gitflow.finishFeature", (node?: Flow) => {
            viewBranches.finishFeature(node);
        })
    );

    subscriptions.push(
        commands.registerCommand("gitflow.newBugfix", () => {
            viewBranches.startBugfix();
        })
    );
    subscriptions.push(
        commands.registerCommand("gitflow.checkoutBugfix", (node?: Flow) => {
            viewBranches.checkoutBugfix(node);
        })
    );
    subscriptions.push(
        commands.registerCommand("gitflow.publishBugfix", (node?: Flow) => {
            viewBranches.publishBugfix(node);
        })
    );
    subscriptions.push(
        commands.registerCommand("gitflow.deleteBugfix", (node?: Flow) => {
            viewBranches.deleteBugfix(node);
        })
    );
    subscriptions.push(
        commands.registerCommand("gitflow.rebaseBugfix", (node?: Flow) => {
            viewBranches.rebaseBugfix(node);
        })
    );
    subscriptions.push(
        commands.registerCommand("gitflow.trackBugfix", (node?: Flow) => {
            viewBranches.trackBugfix(node);
        })
    );
    subscriptions.push(
        commands.registerCommand("gitflow.finishBugfix", (node?: Flow) => {
            viewBranches.finishBugfix(node);
        })
    );

    subscriptions.push(
        commands.registerCommand("gitflow.refreshT", () => {
            viewVersions.refresh();
        })
    );
    subscriptions.push(
        commands.registerCommand("gitflow.pushTags", () => {
            viewVersions.pushTags();
        })
    );
    subscriptions.push(
        commands.registerCommand("gitflow.pushTag", (e?: Tag) => {
            viewVersions.pushTag(e);
        })
    );
    subscriptions.push(
        commands.registerCommand("gitflow.deleteTag", (e?: Tag) => {
            viewVersions.deleteTag(e);
        })
    );
}

export function deactivate() {}
