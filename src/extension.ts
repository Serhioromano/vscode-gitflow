import * as vscode from 'vscode';
import { GitflowTreeView } from './ViewBranches';
import { GitflowTagsView, Tag } from './ViewVersions';

export function activate(context: vscode.ExtensionContext) {
    const rootPath: string = (vscode.workspace.workspaceFolders && (vscode.workspace.workspaceFolders.length > 0))
        ? vscode.workspace.workspaceFolders[0].uri.fsPath : "";

    const gft = new GitflowTreeView(rootPath);
    const tree = vscode.window.createTreeView('gitflowExplorer', {
        treeDataProvider: gft, showCollapseAll: true
    });
    tree.onDidChangeSelection(e => console.log(e))
    
    const gtt = new GitflowTagsView(rootPath);
    vscode.window.createTreeView('gitflowTags', {
        treeDataProvider: gtt
    });

    context.subscriptions.push(vscode.commands.registerCommand('gitflow.refresh', () => {
        gft.refresh();
        gtt.refresh();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('gitflow.init', () => {
        gft.init();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('gitflow.pushTags', () => {
        gtt.pushTags();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('gitflow.fetchAllBranches', () => {
        gft.fetchAllBranches();
    }));

    context.subscriptions.push(vscode.commands.registerCommand('gitflow.newFeature', () => {
        gft.startFeature();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('gitflow.checkoutFeature', () => {
        gft.checkoutFeature();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('gitflow.publishFeature', () => {
        gft.publishFeature();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('gitflow.rebaseFeature', () => {
        gft.rebaseFeature();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('gitflow.finishFeature', () => {
        gft.finishFeature();
    }));




    context.subscriptions.push(
        vscode.commands.registerCommand('gitflow.newRelese', () => {
            gft.startRelease();
        })
    );


}

export function deactivate() { }
