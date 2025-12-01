import * as vscode from 'vscode';

export class Logger {
    private static outputChannel: vscode.OutputChannel;

    public static initialize(name: string) {
        this.outputChannel = vscode.window.createOutputChannel(name);
    }

    public static log(message: string) {
        const timestamp = new Date().toLocaleTimeString();
        this.outputChannel.appendLine(`[${timestamp}] ${message}`);
    }

    public static error(message: string, error?: any) {
        const timestamp = new Date().toLocaleTimeString();
        this.outputChannel.appendLine(`[${timestamp}] [ERROR] ${message}`);
        if (error) {
            this.outputChannel.appendLine(JSON.stringify(error, null, 2));
        }
    }

    public static show() {
        this.outputChannel.show();
    }
}
