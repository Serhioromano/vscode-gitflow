import * as vscode from 'vscode';
import { Flow, TreeViewBranches } from './ViewBranches';
import { TreeViewVersions, Tag } from './ViewVersions';

export function activate(context: vscode.ExtensionContext) {
    const rootPath: string = (vscode.workspace.workspaceFolders && (vscode.workspace.workspaceFolders.length > 0))
        ? vscode.workspace.workspaceFolders[0].uri.fsPath : "";

    const viewBranches = new TreeViewBranches(rootPath);
    vscode.window.createTreeView('gitflowExplorer', {
        treeDataProvider: viewBranches, showCollapseAll: true
    });

    context.subscriptions.push(vscode.commands.registerCommand('gitflow.refreshB', () => {
        viewBranches.refresh();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('gitflow.init', () => {
        viewBranches.init();
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
    context.subscriptions.push(vscode.commands.registerCommand('gitflow.finishFeature', (node?: Flow) => {
        viewBranches.finishFeature(node);
    }));


    const viewVersions = new TreeViewVersions(rootPath);
    vscode.window.createTreeView('gitflowTags', {
        treeDataProvider: viewVersions
    });

    context.subscriptions.push(vscode.commands.registerCommand('gitflow.refreshT', () => {
        viewVersions.refresh();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('gitflow.pushTags', () => {
        viewVersions.pushTags();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('gitflow.pushTag', (e?: Tag) => {
        viewVersions.pushTag(e);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('gitflow.fetchAllBranches', () => {
        viewBranches.fetchAllBranches();
    }));

    context.subscriptions.push(
        vscode.commands.registerCommand('gitflow.newRelese', () => {
            viewBranches.startRelease();
        })
    );


}

export function deactivate() { }
