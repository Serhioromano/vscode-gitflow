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


    let statBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 10);
    statBar.command = "gitflow.quickPick";
    statBar.text = `$(list-flat) ${vscode.l10n.t('Git Flow')}`;
    statBar.tooltip = vscode.l10n.t('Show Git Flow Quick Pick menu');
    statBar.show();
    context.subscriptions.push(statBar);

    const util = new Util(rootPath, logger, statBar);

    const viewBranches = new TreeViewBranches(util);
    const viewVersions = new TreeViewVersions(util);

    // Register switchRepo before creating tree views so it's always available,
    // even if tree loading fails during activation (#56).
    // Use let vars captured by closure — assigned after command registration.
    let a: vscode.TreeView<Flow | import("./ViewBranches").FolderNode>;
    let b: vscode.TreeView<Tag>;

    const cm: CommandManager = new CommandManager(context, logger, viewBranches, viewVersions);

    cm.rc("gitflow.switchRepo", async () => {
        let list: string[] = vscode.workspace.workspaceFolders?.map((el) => el.uri.fsPath) || [];
        if (list.length < 2) {
            vscode.window.showInformationMessage(vscode.l10n.t('Not a multi-folder workspace'));
            return;
        }
        let repo = await vscode.window.showQuickPick(list, {
            title: vscode.l10n.t('Select active repository'),
        });
        if (repo === undefined) {
            return;
        }

        util.workspaceRoot = `${repo}`;
        a.message = vscode.l10n.t('Current repo: {0}', `${repo}`.split('/').reverse()[0]);
        b.message = vscode.l10n.t('Current repo: {0}', `${repo}`.split('/').reverse()[0]);
        util.resetReady();

        viewBranches.refresh();
        viewVersions.refresh();
    });

    a = vscode.window.createTreeView("gitflowExplorer", {
        treeDataProvider: viewBranches,
        showCollapseAll: true,
    });
    b = vscode.window.createTreeView("gitflowTags", {
        treeDataProvider: viewVersions,
    });

    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 1) {
        a.message = vscode.l10n.t('Current repo: {0}', rootPath.split('/').reverse()[0]);
        b.message = vscode.l10n.t('Current repo: {0}', rootPath.split('/').reverse()[0]);
    }
}

export function deactivate() { }
