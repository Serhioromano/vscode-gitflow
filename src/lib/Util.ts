import * as vscode from 'vscode';
import { execSync, exec, spawn, SpawnOptions } from "child_process";

type CmdResult = {
    retc: number | null,
    stdout: string[],
    stderr: string[]
};

export class Util {
    constructor(private workspaceRoot: string) { };

    // public cmd(cmd: string, args?: string[]): Promise<CmdResult> {
    //     let options: SpawnOptions = {};
    //     options.cwd = this.workspaceRoot;
    //     //options.shell = true;
    //     //options.stdio = ['inherit', 'inherit', 'inherit'];
    //     options.detached = true;

    //     return new Promise((resolve, reject) => {
    //         console.log(cmd, args?.join(' '));
    //         const child = spawn(cmd, args || [], options);
    //         child.on('error', err => { reject(err); });

    //         let stdout: string[] = [];
    //         let stderr: string[] = [];

    //         child.stdout?.on('data', (data: Uint8Array) => {
    //             console.log(`Stdout: ${data}`);
    //             stdout.push(data.toString());
    //         });
    //         child.stderr?.on('data', (data: Uint8Array) => {
    //             console.log(`Stderr: ${data}`);
    //             stderr.push(data.toString());
    //         });
    //         child.on('error', err => {
    //             console.error(`${cmd} ${args?.join(" ")}" returned`, err);
    //         });
    //         child.on('spawm', err => {
    //             console.log(`Spawn: "${cmd} ${args?.join(" ")}" returned`, err);
    //         });
    //         child.on('exit', code => {
    //             console.log(`Exit: "${cmd} ${args?.join(" ")} exited`, code);
    //         });
    //         child.on('close', retc => {
    //             console.log(`Close: "${cmd}" returned code ${retc}:`, stderr, stdout);
    //             //resolve({ retc: retc, stdout: stdout, stderr: stderr });
    //         });
    //     });
    // }

    // async cmdCb(cmd: string, args?: string[], cb?: (res: CmdResult) => void) {
    //     let result = await this.cmd(cmd, args);
    //     if (result.retc !== 0) {
    //         vscode.window.showErrorMessage(`Error: ${cmd} ${args?.join(" ")} : ${result.stderr.join("\n")}`);
    //         return;
    //     }
    //     if (typeof cb === 'function' && result.retc === 0) {
    //         vscode.window.showInformationMessage(`Success:${result.stdout.join("\n")}`);
    //         cb(result);
    //     }
    // }

    private progress(cmd: string, cb: (s: string) => void) {
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Executing ${cmd}`,
            cancellable: false
        }, (progress, token) => new Promise<void>(resolve => {
            setTimeout(() => {
                this.execCb(cmd, res => {
                    cb(res);
                    resolve();
                }, resolve);
            }, 100);
        }));
    }

    public exec(cmd: string, progress: boolean, cb: (s: string) => void): void {
        console.log(cmd);
        if (progress) {
            this.progress(cmd, cb);
        } else {
            this.execCb(cmd, cb);
        }
    }

    public execSync(cmd: string): string {
        try {
            return execSync(cmd, { cwd: this.workspaceRoot }).toString();
        }
        catch (e) {
            return '' + e;
        }
    }
    private execCb(cmd: string, cb: (s: string) => void, resolve?:any): void {
        console.log(this.workspaceRoot);
        exec(cmd, {
            cwd: this.workspaceRoot
        }, (err, stdout, stderr) => {
            if (err) {
                vscode.window.showErrorMessage(`Error executing: ${cmd} : ${err}`);
                if(resolve !== undefined) {
                    resolve();
                }
                return;
            }
            cb(stdout);
            vscode.window.showInformationMessage(`${stdout}`);
        });
    }

    public check(): boolean {
        if (!this.workspaceRoot) {
            vscode.window.showInformationMessage('Empty workspace');
            return false;
        }
        let status = this.execSync("git status").toLowerCase();

        if (status.search('not recognized') > 0 || status.search('not found') > 0
        ) {
            vscode.window.showWarningMessage('Looks like git CLI is not installed.');
            return false;
        }
        if (status.search('not a git repository') > 0) {
            vscode.window.showWarningMessage('This project is not a Git repository.');
            return false;
        }

        if (this.execSync('git flow').toLowerCase().search('is not a git command') > 0) {
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