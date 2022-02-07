import * as vscode from "vscode";
import {Disposable} from "./disposables";

export enum LogLevels {
    info = "INFO",
    warning = "WARNING",
    error = "ERROR",
}

export class Logger extends Disposable {
    private readonly channel: vscode.OutputChannel;

    constructor() {
        super();
        this.channel = vscode.window.createOutputChannel("Git Flow");
        this.registerDisposable(this.channel);
    }

    show() {
        this.channel.show();
    }

    public log(msg: string, cmd: string, level: LogLevels = LogLevels.info) {
        if (
            [
                "git version",
                "git status",
                "git branch",
                "git tag --sort=-v:refname",
                "git branch -r",
                "git flow config list",
            ].includes(cmd)
        ) {
            return;
        }
        this.channel.appendLine(`${level}: [${cmd}] ${msg}`);
    }
}
