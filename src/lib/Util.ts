import * as vscode from "vscode";
import {execSync, exec, spawn, SpawnOptions} from "child_process";
import {Logger, LogLevels} from "./logger";
import {Memoize, MemoizeExpiring} from "typescript-memoize";
import {GitExtension, API as GitAPI} from "./git";
// import { GitBaseExtension, API as GitBaseAPI } from "./lib/git-base";

type CmdResult = {
    retc: number | null;
    stdout: string[];
    stderr: string[];
};

export class Util {
    public path: string = "";
    public flowPath: string = "";
    constructor(public workspaceRoot: string, private logger: Logger) {
        this.path = vscode.workspace.getConfiguration("git").get("path") || "";
        this.flowPath = vscode.workspace.getConfiguration("gitflow").get("path") || `"${this.path}" flow`;
        if (this.path.trim().length === 0) {
            const gitExtension = vscode.extensions.getExtension<GitExtension>("vscode.git")!.exports;
            const git = gitExtension.getAPI(1);
            this.path = git.git.path;
        }
        if (this.path.trim().length === 0) {
            vscode.window.showWarningMessage("Git is not found");
        }
        this.logger.log("Git found (path)", this.path);
    }

    private progress(cmd: string, cb: (s: string) => void) {
        vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: `Executing ${cmd}`,
                cancellable: false,
            },
            (progress, token) =>
                new Promise<void>((resolve) => {
                    setTimeout(() => {
                        this.execCb(
                            cmd,
                            (res) => {
                                cb(res);
                                resolve();
                            },
                            resolve
                        );
                    }, 100);
                })
        );
    }

    public exec(cmd: string, progress: boolean, cb: (s: string) => void): void {
        if (progress) {
            this.progress(cmd, cb);
        } else {
            this.execCb(cmd, cb);
        }
    }

    @MemoizeExpiring(1000)
    public execSync(cmd: string): string {
        if (this.path.trim().length === 0) {
            return "";
        }
        try {
            let out = execSync(cmd, {cwd: this.workspaceRoot}).toString();
            this.logger.log(out, cmd);
            return out;
        } catch (e) {
            this.logger.log(`ERROR: ${e}`, cmd, LogLevels.error);
            vscode.window.showErrorMessage(`Error executing: ${cmd} : ${e}`);
            return "" + e;
        }
    }

    @MemoizeExpiring(1000)
    private execCb(cmd: string, cb: (s: string) => void, resolve?: any): void {
        if (this.path.trim().length === 0) {
            return;
        }
        exec(cmd, {cwd: this.workspaceRoot}, (err, stdout, stderr) => {
            if (err) {
                vscode.window.showErrorMessage(`Error executing: ${cmd} : ${err}`);
                this.logger.log(`${err} ${stderr}`, cmd, LogLevels.error);
                if (resolve !== undefined) {
                    resolve();
                }
                return;
            }
            cb(stdout);
            this.logger.log(`${stdout}`, cmd);
            vscode.window.showInformationMessage(`${stdout}`);
        });
    }
    public check(): boolean {
        if (!this.workspaceRoot) {
            vscode.window.showErrorMessage("No folder opened");
            return false;
        }
        let status = this.execSync(`"${this.path}" version`).toLowerCase();
        if (status.search("git version") === -1) {
            vscode.window.showWarningMessage("Looks like git CLI is not installed.");
            return false;
        }

        status = this.execSync(`"${this.path}" status`).toLowerCase();

        if (status.search("not a git repository") !== -1) {
            vscode.window.showWarningMessage("This project is not a Git repository.");
            return false;
        }

        if (this.execSync(`${this.flowPath} log`).toLowerCase().search("is not a git command") !== -1) {
            let installLink = "Install";
            vscode.window
                .showWarningMessage("To use Git Flow extension please install Git flow (AVH).", installLink)
                .then((selection) => {
                    if (selection === installLink) {
                        vscode.env.openExternal(
                            vscode.Uri.parse(
                                "https://github.com/petervanderdoes/gitflow-avh/wiki/Installation"
                            )
                        );
                    }
                });
            return false;
        }
        return true;
    }
}
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
