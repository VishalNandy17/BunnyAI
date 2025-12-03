import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { CodeQualityAnalyzer, FileQualityReport, FunctionMetric } from './codeQualityAnalyzer';
import { scanSecurity, SecurityScanResult, SecurityIssue } from './securityScanner';
import { ConfigManager } from '../core/ConfigManager';
import { getLanguageId, isSupportedLanguage, findWorkspaceFiles, DEFAULT_EXCLUDES } from './analyzerUtils';

export interface WorkspaceFileReport {
    filePath: string;
    relativePath: string;
    languageId: string;
    qualityReport?: FileQualityReport;
    securityReport?: SecurityScanResult;
    error?: string;
}

export interface WorkspaceHealthReport {
    summary: {
        totalFiles: number;
        filesScanned: number;
        filesWithErrors: number;
        averageCyclomaticComplexity: number;
        maxCyclomaticComplexity: number;
        totalSecurityIssues: number;
        securityIssuesBySeverity: {
            high: number;
            medium: number;
            low: number;
        };
    };
    topComplexFunctions: Array<{
        filePath: string;
        relativePath: string;
        functionName: string;
        line: number;
        complexity: number;
        maintainability: string;
    }>;
    worstOffenders: Array<{
        filePath: string;
        relativePath: string;
        averageComplexity: number;
        maxComplexity: number;
        functionCount: number;
        securityIssues: number;
    }>;
    securityIssues: Array<{
        filePath: string;
        relativePath: string;
        issue: SecurityIssue;
    }>;
    files: WorkspaceFileReport[];
}


export class WorkspaceAnalyzer {
    private codeQualityAnalyzer: CodeQualityAnalyzer;
    private configManager: ConfigManager;
    private cancellationToken?: vscode.CancellationToken;

    constructor() {
        this.codeQualityAnalyzer = new CodeQualityAnalyzer();
        this.configManager = ConfigManager.getInstance();
    }

    async analyzeWorkspace(
        workspaceFolder: vscode.WorkspaceFolder,
        includeSecurity?: boolean,
        progress?: vscode.Progress<{ message?: string; increment?: number }>,
        cancellationToken?: vscode.CancellationToken
    ): Promise<WorkspaceHealthReport> {
        this.cancellationToken = cancellationToken;

        // Use config if includeSecurity not explicitly provided
        const shouldIncludeSecurity = includeSecurity !== undefined 
            ? includeSecurity 
            : this.configManager.isSecurityScanningEnabled();

        const files: WorkspaceFileReport[] = [];
        const allFunctions: Array<{
            filePath: string;
            relativePath: string;
            function: FunctionMetric;
        }> = [];
        const allSecurityIssues: Array<{
            filePath: string;
            relativePath: string;
            issue: SecurityIssue;
        }> = [];

        const workspacePath = workspaceFolder.uri.fsPath;
        const maxFiles = this.configManager.getMaxWorkspaceFiles();
        const fileUris = await findWorkspaceFiles(workspaceFolder, '**/*.{ts,js,tsx,jsx}', DEFAULT_EXCLUDES, maxFiles);

        let filesScanned = 0;
        let filesWithErrors = 0;
        let totalComplexity = 0;
        let totalFunctions = 0;
        let maxComplexity = 0;

        const securityIssuesBySeverity = {
            high: 0,
            medium: 0,
            low: 0
        };

        for (const fileUri of fileUris) {
            if (cancellationToken?.isCancellationRequested) {
                break;
            }

            const relativePath = path.relative(workspacePath, fileUri.fsPath);
            const languageId = await getLanguageId(fileUri);

            if (!isSupportedLanguage(languageId)) {
                continue;
            }

            progress?.report({
                message: `Analyzing ${relativePath}...`,
                increment: 100 / fileUris.length
            });

            try {
                const fileContent = fs.readFileSync(fileUri.fsPath, 'utf-8');
                const fileReport: WorkspaceFileReport = {
                    filePath: fileUri.fsPath,
                    relativePath: relativePath,
                    languageId: languageId
                };

                // Run code quality analysis
                try {
                    const qualityReport = this.codeQualityAnalyzer.analyzeCode(
                        fileContent,
                        fileUri.fsPath
                    );
                    fileReport.qualityReport = qualityReport;

                    // Aggregate complexity metrics
                    for (const func of qualityReport.functions) {
                        totalComplexity += func.cyclomatic;
                        totalFunctions++;
                        maxComplexity = Math.max(maxComplexity, func.cyclomatic);
                        allFunctions.push({
                            filePath: fileUri.fsPath,
                            relativePath: relativePath,
                            function: func
                        });
                    }
                } catch (error) {
                    fileReport.error = `Quality analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
                    filesWithErrors++;
                }

                // Run security analysis
                if (shouldIncludeSecurity) {
                    try {
                        const securityReport = scanSecurity(
                            fileContent,
                            languageId,
                            fileUri.fsPath
                        );
                        fileReport.securityReport = securityReport;

                        for (const issue of securityReport.issues) {
                            securityIssuesBySeverity[issue.severity]++;
                            allSecurityIssues.push({
                                filePath: fileUri.fsPath,
                                relativePath: relativePath,
                                issue: issue
                            });
                        }
                    } catch (error) {
                        // Security scan errors are non-fatal
                        if (!fileReport.error) {
                            fileReport.error = `Security scan failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
                        }
                    }
                }

                files.push(fileReport);
                filesScanned++;
            } catch (error) {
                filesWithErrors++;
                files.push({
                    filePath: fileUri.fsPath,
                    relativePath: relativePath,
                    languageId: languageId,
                    error: `Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`
                });
            }
        }

        // Calculate top complex functions
        const topComplexFunctions = allFunctions
            .sort((a, b) => b.function.cyclomatic - a.function.cyclomatic)
            .slice(0, 10)
            .map(item => ({
                filePath: item.filePath,
                relativePath: item.relativePath,
                functionName: item.function.name,
                line: item.function.startLine,
                complexity: item.function.cyclomatic,
                maintainability: item.function.maintainability
            }));

        // Calculate worst offenders (files with highest average complexity)
        const fileComplexityMap = new Map<string, {
            complexities: number[];
            securityIssues: number;
        }>();

        for (const file of files) {
            if (file.qualityReport) {
                const complexities = file.qualityReport.functions.map(f => f.cyclomatic);
                const securityCount = file.securityReport?.issues.length || 0;
                fileComplexityMap.set(file.filePath, {
                    complexities: complexities,
                    securityIssues: securityCount
                });
            }
        }

        const worstOffenders = Array.from(fileComplexityMap.entries())
            .map(([filePath, data]) => {
                const file = files.find(f => f.filePath === filePath);
                if (!file) return null;
                const avgComplexity = data.complexities.length > 0
                    ? data.complexities.reduce((a, b) => a + b, 0) / data.complexities.length
                    : 0;
                const maxComplexity = data.complexities.length > 0
                    ? Math.max(...data.complexities)
                    : 0;
                return {
                    filePath: filePath,
                    relativePath: file.relativePath,
                    averageComplexity: avgComplexity,
                    maxComplexity: maxComplexity,
                    functionCount: data.complexities.length,
                    securityIssues: data.securityIssues
                };
            })
            .filter((item): item is NonNullable<typeof item> => item !== null)
            .sort((a, b) => b.averageComplexity - a.averageComplexity)
            .slice(0, 20);

        const averageComplexity = totalFunctions > 0 ? totalComplexity / totalFunctions : 0;

        return {
            summary: {
                totalFiles: fileUris.length,
                filesScanned: filesScanned,
                filesWithErrors: filesWithErrors,
                averageCyclomaticComplexity: averageComplexity,
                maxCyclomaticComplexity: maxComplexity,
                totalSecurityIssues: allSecurityIssues.length,
                securityIssuesBySeverity: securityIssuesBySeverity
            },
            topComplexFunctions: topComplexFunctions,
            worstOffenders: worstOffenders,
            securityIssues: allSecurityIssues,
            files: files
        };
    }

}

