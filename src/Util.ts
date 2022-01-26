import * as vscode from 'vscode';
import { execSync, exec } from "child_process";

export function sys(cmd: string, workspaceRoot: string, cb: (s: string) => void) {
    console.log(cmd);
    try {
        exec(cmd, { cwd: workspaceRoot }, (err, stdout, stderr) => {

            if (err) {
                vscode.window.showErrorMessage(`Error executing: ${cmd} : ${err}`);
                return;
            }
            cb(stdout);
            vscode.window.showInformationMessage(`${stdout}`);
        });
    }
    catch (e) {
        vscode.window.showErrorMessage(`Error executing: ${cmd}`);
    }
}
export class Util {
    constructor(private workspaceRoot: string) { };

    public exec(cmd: string): string {
        try {
            return execSync(cmd, { cwd: this.workspaceRoot }).toString();
        }
        catch (e) {
            return '' + e;
        }
    }
    public execCb(cmd: string, cb: (s: string) => void): void {
        console.log(cmd);
        try {
            exec(cmd, { cwd: this.workspaceRoot }, (err, stdout, stderr) => {

                if (err) {
                    vscode.window.showErrorMessage(`Error executing: ${cmd} : ${err}`);
                    return;
                }
                cb(stdout);
                vscode.window.showInformationMessage(`${stdout}`);
            });
        }
        catch (e) {
            vscode.window.showErrorMessage(`Error executing: ${cmd}`);
        }
    }

    public check(): boolean {
        if (!this.workspaceRoot) {
            vscode.window.showInformationMessage('Empty workspace');
            return false;
        }
        let status = this.exec("git status").toLowerCase();

        if (status.search('not recognized') > 0 || status.search('not found') > 0
        ) {
            vscode.window.showWarningMessage('Looks like git CLI is not installed.');
            return false;
        }
        if (status.search('not a git repository') > 0) {
            vscode.window.showWarningMessage('This project is not a Git repository.');
            return false;
        }

        if (this.exec('git flow').toLowerCase().search('is not a git command') > 0) {
            let installLink = 'Install';
            vscode.window
                .showWarningMessage('To use GitFlow extension please install Git flow.', installLink)
                .then(selection => {
                    if (selection === installLink) {
                        vscode.env.openExternal(vscode.Uri.parse('https://github.com/petervanderdoes/gitflow-avh/wiki/Installation'));
                    }
                });
            return false;
        }
        return true;
    }
}