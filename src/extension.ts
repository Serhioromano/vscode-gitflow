import * as vscode from 'vscode';
import { Flow, TreeViewBranches } from './ViewBranches';
import { TreeViewVersions, Tag } from './ViewVersions';
import { GitExtension, API as GitAPI } from './lib/git';

export function activate(context: vscode.ExtensionContext) {


    let rootPath: string = (vscode.workspace.workspaceFolders && (vscode.workspace.workspaceFolders.length > 0))
        ? vscode.workspace.workspaceFolders[0].uri.fsPath : "";

    console.log(vscode.workspace.workspaceFolders?.map((el) => el.uri.fsPath));

    // let disposables: vscode.Disposable[] = [];
    // let git = vscode.extensions.getExtension<GitExtension>('vscode.git')!.exports;
    // let gitAPI: GitAPI | undefined = git.getAPI(1);
    // let repos = gitAPI.repositories.map(el => el.rootUri.path);
    // let rootPath = repos[0];
    // console.log(repos, rootPath);


    const viewBranches = new TreeViewBranches(rootPath);
    const a = vscode.window.createTreeView('gitflowExplorer', {
        treeDataProvider: viewBranches, showCollapseAll: true
    });
    const viewVersions = new TreeViewVersions(rootPath);
    const b = vscode.window.createTreeView('gitflowTags', {
        treeDataProvider: viewVersions
    });

    if (vscode.workspace.workspaceFolders && (vscode.workspace.workspaceFolders.length > 1)) {
        a.message = "Current repo: " + rootPath.split('/').reverse()[0];
        b.message = "Current repo: " + rootPath.split('/').reverse()[0];
    }

    context.subscriptions.push(vscode.commands.registerCommand('gitflow.switchRepo', async () => {
        let list: string[] = vscode.workspace.workspaceFolders?.map((el) => el.uri.fsPath) || [];
        if(list.length < 2) {
            vscode.window.showInformationMessage("Not a multi folder workspace");
            return;
        }
        let repo = await vscode.window.showQuickPick(list, { title: "Select active repository" });
        if (repo === undefined) {
            return;
        }
        
        a.message = "Current repo: " + `${repo}`.split('/').reverse()[0];
        viewBranches.workspaceRoot = `${repo}`;
        viewBranches.refresh();
        b.message = "Current repo: " + `${repo}`.split('/').reverse()[0];
        viewVersions.workspaceRoot = `${repo}`;
        viewVersions.refresh();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('gitflow.refreshB', () => {
        viewBranches.refresh();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('gitflow.fetchAllBranches', () => {
        viewBranches.fetchAllBranches();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('gitflow.init', () => {
        viewBranches.init();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('gitflow.checkoutBranch', (node?: Flow) => {
        viewBranches.checkoutBranch(node);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('gitflow.syncAll', () => {
        viewBranches.syncAll();
    }));


    context.subscriptions.push(vscode.commands.registerCommand('gitflow.newSupport', () => {
        viewBranches.startSupport();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('gitflow.checkoutSupport', (node?: Flow) => {
        viewBranches.checkoutSupport(node);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('gitflow.deleteSupport', (node?: Flow) => {
        viewBranches.deleteSupport(node);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('gitflow.rebaseSupport', (node?: Flow) => {
        viewBranches.rebaseSupport(node);
    }));

    context.subscriptions.push(vscode.commands.registerCommand('gitflow.newHotfix', () => {
        viewBranches.startHotfix();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('gitflow.publishHotfix', (node?: Flow) => {
        viewBranches.publishHotfix(node);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('gitflow.deleteHotfix', (node?: Flow) => {
        viewBranches.deleteHotfix(node);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('gitflow.finishHotfix', (node?: Flow) => {
        viewBranches.finishHotfix(node);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('gitflow.rebaseHotfix', (node?: Flow) => {
        viewBranches.rebaseHotfix(node);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('gitflow.checkoutHotfix', (node?: Flow) => {
        viewBranches.checkoutHotfix(node);
    }));

    context.subscriptions.push(vscode.commands.registerCommand('gitflow.newRelease', () => {
        viewBranches.startRelease();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('gitflow.publishRelease', (node?: Flow) => {
        viewBranches.publishRelease(node);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('gitflow.deleteRelease', (node?: Flow) => {
        viewBranches.deleteRelease(node);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('gitflow.finishRelease', (node?: Flow) => {
        viewBranches.finishRelease(node);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('gitflow.trackRelease', (node?: Flow) => {
        viewBranches.trackRelease(node);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('gitflow.rebaseRelease', (node?: Flow) => {
        viewBranches.rebaseRelease(node);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('gitflow.checkoutRelease', (node?: Flow) => {
        viewBranches.checkoutRelease(node);
    }));


    context.subscriptions.push(vscode.commands.registerCommand('gitflow.newFeature', () => {
        viewBranches.startFeature();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('gitflow.checkoutFeature', (node?: Flow) => {
        viewBranches.checkoutFeature(node);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('gitflow.publishFeature', (node?: Flow) => {
        viewBranches.publishFeature(node);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('gitflow.deleteFeature', (node?: Flow) => {
        viewBranches.deleteFeature(node);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('gitflow.rebaseFeature', (node?: Flow) => {
        viewBranches.rebaseFeature(node);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('gitflow.trackFeature', (node?: Flow) => {
        viewBranches.trackFeature(node);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('gitflow.finishFeature', (node?: Flow) => {
        viewBranches.finishFeature(node);
    }));

    context.subscriptions.push(vscode.commands.registerCommand('gitflow.newBugfix', () => {
        viewBranches.startBugfix();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('gitflow.checkoutBugfix', (node?: Flow) => {
        viewBranches.checkoutBugfix(node);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('gitflow.publishBugfix', (node?: Flow) => {
        viewBranches.publishBugfix(node);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('gitflow.deleteBugfix', (node?: Flow) => {
        viewBranches.deleteBugfix(node);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('gitflow.rebaseBugfix', (node?: Flow) => {
        viewBranches.rebaseBugfix(node);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('gitflow.trackBugfix', (node?: Flow) => {
        viewBranches.trackBugfix(node);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('gitflow.finishBugfix', (node?: Flow) => {
        viewBranches.finishBugfix(node);
    }));


    context.subscriptions.push(vscode.commands.registerCommand('gitflow.refreshT', () => {
        viewVersions.refresh();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('gitflow.pushTags', () => {
        viewVersions.pushTags();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('gitflow.pushTag', (e?: Tag) => {
        viewVersions.pushTag(e);
    }));
}

export function deactivate() { }
