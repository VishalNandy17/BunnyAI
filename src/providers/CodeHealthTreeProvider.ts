import * as vscode from 'vscode';
import { WorkspaceHealthReport } from '../analysis/workspaceAnalyzer';
import { WorkspaceStorage } from '../storage/WorkspaceStorage';

const LAST_SCAN_KEY = 'codeHealth.lastScan';

export class CodeHealthTreeProvider implements vscode.TreeDataProvider<CodeHealthTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<CodeHealthTreeItem | undefined | null | void> = 
        new vscode.EventEmitter<CodeHealthTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<CodeHealthTreeItem | undefined | null | void> = 
        this._onDidChangeTreeData.event;

    private storage: WorkspaceStorage;
    private lastReport: WorkspaceHealthReport | null = null;

    constructor() {
        this.storage = WorkspaceStorage.getInstance();
        this.loadLastScan();
    }

    refresh(): void {
        this.loadLastScan();
        this._onDidChangeTreeData.fire();
    }

    updateReport(report: WorkspaceHealthReport): void {
        this.lastReport = report;
        this.saveLastScan(report);
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: CodeHealthTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: CodeHealthTreeItem): CodeHealthTreeItem[] {
        if (!element) {
            // Root items
            if (!this.lastReport) {
                return [
                    new CodeHealthTreeItem(
                        'No scan performed yet',
                        vscode.TreeItemCollapsibleState.None,
                        'info',
                        { command: 'bunnyai.analyzeWorkspaceCodeHealth', title: 'Run Analysis' }
                    )
                ];
            }

            const summary = this.lastReport.summary;
            return [
                new CodeHealthTreeItem(
                    `Files Scanned: ${summary.filesScanned}/${summary.totalFiles}`,
                    vscode.TreeItemCollapsibleState.None,
                    'file'
                ),
                new CodeHealthTreeItem(
                    `Avg Complexity: ${summary.averageCyclomaticComplexity.toFixed(2)}`,
                    vscode.TreeItemCollapsibleState.None,
                    summary.averageCyclomaticComplexity > 10 ? 'warning' : 'info'
                ),
                new CodeHealthTreeItem(
                    `Security Issues: ${summary.totalSecurityIssues}`,
                    vscode.TreeItemCollapsibleState.None,
                    summary.totalSecurityIssues > 0 ? 'error' : 'info'
                ),
                new CodeHealthTreeItem(
                    'Run New Analysis',
                    vscode.TreeItemCollapsibleState.None,
                    'refresh',
                    { command: 'bunnyai.analyzeWorkspaceCodeHealth', title: 'Run Analysis' }
                )
            ];
        }

        return [];
    }

    private async loadLastScan(): Promise<void> {
        try {
            const data = await this.storage.get(LAST_SCAN_KEY);
            if (data) {
                this.lastReport = JSON.parse(data) as WorkspaceHealthReport;
            }
        } catch (error) {
            // Ignore errors
        }
    }

    private async saveLastScan(report: WorkspaceHealthReport): Promise<void> {
        try {
            await this.storage.set(LAST_SCAN_KEY, JSON.stringify(report));
        } catch (error) {
            // Ignore errors
        }
    }

    getLastReport(): WorkspaceHealthReport | null {
        return this.lastReport;
    }
}

class CodeHealthTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly icon: 'info' | 'warning' | 'error' | 'file' | 'refresh',
        public readonly command?: vscode.Command
    ) {
        super(label, collapsibleState);
        this.tooltip = label;
        this.command = command;

        // Set icon
        switch (icon) {
            case 'info':
                this.iconPath = new vscode.ThemeIcon('info');
                break;
            case 'warning':
                this.iconPath = new vscode.ThemeIcon('warning');
                break;
            case 'error':
                this.iconPath = new vscode.ThemeIcon('error');
                break;
            case 'file':
                this.iconPath = new vscode.ThemeIcon('file');
                break;
            case 'refresh':
                this.iconPath = new vscode.ThemeIcon('refresh');
                break;
        }
    }
}

