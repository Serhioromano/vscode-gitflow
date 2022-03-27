import * as vscode from "vscode";
import { CommandManager } from "./lib/cm";
import { Logger } from "./lib/logger";
import { Util } from "./lib/Util";
import { Flow, TreeViewBranches } from "./ViewBranches";
import { TreeViewVersions, Tag } from "./ViewVersions";

export function activate(context: vscode.ExtensionContext) {
    let rootPath: string =
        vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0
            ? vscode.workspace.workspaceFolders[0].uri.fsPath
            : "";

    const logger = new Logger();
    logger.log("Extension activate", "activate");
    logger.log(rootPath, "Root");

    const util = new Util(rootPath, logger);

    let statBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 10);
    statBar.command = "gitflow.quickPick";
    statBar.text = "$(list-flat) Git Flow";
    statBar.tooltip = "Show Git Flow Quick Pick menu";
    statBar.show();
    context.subscriptions.push(statBar);

    const viewBranches = new TreeViewBranches(util);
    const a = vscode.window.createTreeView("gitflowExplorer", {
        treeDataProvider: viewBranches,
        showCollapseAll: true,
    });
    viewBranches.getChildren();
    const viewVersions = new TreeViewVersions(util);
    const b = vscode.window.createTreeView("gitflowTags", {
        treeDataProvider: viewVersions,
    });
    viewVersions.getChildren();

    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 1) {
        a.message = "Current repo: " + rootPath.split("/").reverse()[0];
        b.message = "Current repo: " + rootPath.split("/").reverse()[0];
    }

    const cm: CommandManager = new CommandManager(context, logger, viewBranches, viewVersions);

    cm.rc("gitflow.switchRepo", async () => {
        let list: string[] = vscode.workspace.workspaceFolders?.map((el) => el.uri.fsPath) || [];
        if (list.length < 2) {
            vscode.window.showInformationMessage("Not a multi folder vscode.workspace");
            return;
        }
        let repo = await vscode.window.showQuickPick(list, {
            title: "Select active repository",
        });
        if (repo === undefined) {
            return;
        }

        util.workspaceRoot = `${repo}`;
        a.message = "Current repo: " + `${repo}`.split("/").reverse()[0];
        b.message = "Current repo: " + `${repo}`.split("/").reverse()[0];
        viewBranches.refresh();
        viewVersions.refresh();
    });
}

export function deactivate() { }

// const gitBaseExtension = extensions.getExtension<GitBaseExtension>("vscode.git-base")!.exports;
// const gitbase = gitExtension.getAPI(1);

// gitbase.onDidChangeState((e) => {
//     if (e.toString().toLowerCase() === "initialized") {
//         console.log(git.repositories);
//         git.onDidChangeState((e) => {
//             console.log("state", e);
//         });
//         git.repositories[0].state.onDidChange((e) => {
//             console.log("repo", e);
//         });
//     }
//     console.log("base", e);
// });
