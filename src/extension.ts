import * as vscode from "vscode";
import {Flow, TreeViewBranches} from "./ViewBranches";
import {TreeViewVersions, Tag} from "./ViewVersions";
import {GitExtension, API as GitAPI} from "./lib/git";

export function activate(context: vscode.ExtensionContext) {
    let rootPath: string =
        vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0
            ? vscode.workspace.workspaceFolders[0].uri.fsPath
            : "";

    const viewBranches = new TreeViewBranches(rootPath);
    const a = vscode.window.createTreeView("gitflowExplorer", {
        treeDataProvider: viewBranches,
        showCollapseAll: true,
    });
    viewBranches.getChildren();
    const viewVersions = new TreeViewVersions(rootPath);
    const b = vscode.window.createTreeView("gitflowTags", {
        treeDataProvider: viewVersions,
    });
    viewVersions.getChildren();

    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 1) {
        a.message = "Current repo: " + rootPath.split("/").reverse()[0];
        b.message = "Current repo: " + rootPath.split("/").reverse()[0];
    }

    context.subscriptions.push(
        vscode.commands.registerCommand("gitflow.switchRepo", async () => {
            let list: string[] =
                vscode.workspace.workspaceFolders?.map((el) => el.uri.fsPath) || [];
            if (list.length < 2) {
                vscode.window.showInformationMessage("Not a multi folder workspace");
                return;
            }
            let repo = await vscode.window.showQuickPick(list, {
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

    context.subscriptions.push(
        vscode.commands.registerCommand("gitflow.quickPick", async () => {
            if (viewBranches.listBranches.length < 2) {
                vscode.window.showWarningMessage("Looks like view was not yet initialized");
                return;
            }
            let list = [
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
            let action = await vscode.window.showQuickPick(list, {
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
            vscode.commands.executeCommand("workbench.view.scm");

            function ucf(string: string) {
                return string.charAt(0).toUpperCase() + string.slice(1);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("gitflow.refreshB", () => {
            viewBranches.refresh();
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("gitflow.fetchAllBranches", () => {
            viewBranches.fetchAllBranches();
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("gitflow.init", () => {
            viewBranches.init();
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("gitflow.checkoutBranch", (node?: Flow) => {
            viewBranches.checkoutBranch(node);
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("gitflow.syncAll", () => {
            viewBranches.syncAll();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("gitflow.newSupport", () => {
            viewBranches.startSupport();
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("gitflow.checkoutSupport", (node?: Flow) => {
            viewBranches.checkoutSupport(node);
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("gitflow.deleteSupport", (node?: Flow) => {
            viewBranches.deleteSupport(node);
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("gitflow.rebaseSupport", (node?: Flow) => {
            viewBranches.rebaseSupport(node);
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("gitflow.publishSupport", (node?: Flow) => {
            viewBranches.publishSupport(node);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("gitflow.newHotfix", () => {
            viewBranches.startHotfix();
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("gitflow.publishHotfix", (node?: Flow) => {
            viewBranches.publishHotfix(node);
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("gitflow.deleteHotfix", (node?: Flow) => {
            viewBranches.deleteHotfix(node);
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("gitflow.finishHotfix", (node?: Flow) => {
            viewBranches.finishHotfix(node);
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("gitflow.rebaseHotfix", (node?: Flow) => {
            viewBranches.rebaseHotfix(node);
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("gitflow.checkoutHotfix", (node?: Flow) => {
            viewBranches.checkoutHotfix(node);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("gitflow.newRelease", () => {
            viewBranches.startRelease();
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("gitflow.publishRelease", (node?: Flow) => {
            viewBranches.publishRelease(node);
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("gitflow.deleteRelease", (node?: Flow) => {
            viewBranches.deleteRelease(node);
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("gitflow.finishRelease", (node?: Flow) => {
            viewBranches.finishRelease(node);
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("gitflow.trackRelease", (node?: Flow) => {
            viewBranches.trackRelease(node);
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("gitflow.rebaseRelease", (node?: Flow) => {
            viewBranches.rebaseRelease(node);
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("gitflow.checkoutRelease", (node?: Flow) => {
            viewBranches.checkoutRelease(node);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("gitflow.newFeature", () => {
            viewBranches.startFeature();
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("gitflow.checkoutFeature", (node?: Flow) => {
            viewBranches.checkoutFeature(node);
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("gitflow.publishFeature", (node?: Flow) => {
            viewBranches.publishFeature(node);
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("gitflow.deleteFeature", (node?: Flow) => {
            viewBranches.deleteFeature(node);
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("gitflow.rebaseFeature", (node?: Flow) => {
            viewBranches.rebaseFeature(node);
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("gitflow.trackFeature", (node?: Flow) => {
            viewBranches.trackFeature(node);
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("gitflow.finishFeature", (node?: Flow) => {
            viewBranches.finishFeature(node);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("gitflow.newBugfix", () => {
            viewBranches.startBugfix();
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("gitflow.checkoutBugfix", (node?: Flow) => {
            viewBranches.checkoutBugfix(node);
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("gitflow.publishBugfix", (node?: Flow) => {
            viewBranches.publishBugfix(node);
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("gitflow.deleteBugfix", (node?: Flow) => {
            viewBranches.deleteBugfix(node);
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("gitflow.rebaseBugfix", (node?: Flow) => {
            viewBranches.rebaseBugfix(node);
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("gitflow.trackBugfix", (node?: Flow) => {
            viewBranches.trackBugfix(node);
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("gitflow.finishBugfix", (node?: Flow) => {
            viewBranches.finishBugfix(node);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("gitflow.refreshT", () => {
            viewVersions.refresh();
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("gitflow.pushTags", () => {
            viewVersions.pushTags();
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("gitflow.pushTag", (e?: Tag) => {
            viewVersions.pushTag(e);
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("gitflow.deleteTag", (e?: Tag) => {
            viewVersions.deleteTag(e);
        })
    );
}

export function deactivate() {}
