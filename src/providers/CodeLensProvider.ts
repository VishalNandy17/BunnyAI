import * as vscode from 'vscode';
import { ExpressParser } from '../parsers/ExpressParser';
import { IRoute } from '../types';

export class CodeLensProvider implements vscode.CodeLensProvider {
    private parser: ExpressParser;

    constructor() {
        this.parser = new ExpressParser();
    }

    async provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): Promise<vscode.CodeLens[]> {
        if (!this.parser.supports(document.languageId)) {
            return [];
        }

        const text = document.getText();
        const routes = await this.parser.parse(text);
        const lenses: vscode.CodeLens[] = [];

        for (const route of routes) {
            const range = new vscode.Range(route.line, 0, route.line, 0);
            const command: vscode.Command = {
                title: `$(play) Run ${route.method} ${route.path}`,
                command: 'bunnyai.runApi',
                arguments: [route]
            };
            lenses.push(new vscode.CodeLens(range, command));
        }

        return lenses;
    }
}
