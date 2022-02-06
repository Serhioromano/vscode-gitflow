import * as vscode from "vscode";
import {Disposable} from "./disposables";

export enum LogLevels {
    info = 'INFO',
    warning = 'WARNING',
    error = 'ERROR'
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
        const date = new Date();

        this.channel.appendLine(`${level}: [${cmd}] ${msg}`);
    }
}
