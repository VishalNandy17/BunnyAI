import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { BunnyAIConfig, ArchitectureRules, NamingRule, StructureRule, ImportRule } from './ruleConfig';
import { findWorkspaceFiles, DEFAULT_EXCLUDES } from '../analysis/analyzerUtils';
import { DependencyGraphBuilder } from '../refactor/depGraph';
import { WorkspaceRefactorScanner, FileInfo } from '../refactor/workspaceScanner';

export interface RuleViolation {
    rule: string;
    severity: 'error' | 'warning' | 'info';
    file?: string;
    message: string;
    line?: number;
    column?: number;
    suggestedFix?: {
        type: 'rename' | 'move' | 'reorganize' | 'create' | 'refactor';
        description: string;
        oldValue?: string;
        newValue?: string;
        oldPath?: string;
        newPath?: string;
    };
}

export interface RuleEvaluationResult {
    violations: RuleViolation[];
    summary: {
        total: number;
        errors: number;
        warnings: number;
        info: number;
    };
    config: ArchitectureRules;
}

export class ArchitectureRuleEngine {
    private workspacePath: string;
    private config: ArchitectureRules | null = null;
    private configPath: string;

    constructor(workspaceFolder: vscode.WorkspaceFolder) {
        this.workspacePath = workspaceFolder.uri.fsPath;
        this.configPath = path.join(this.workspacePath, 'bunnyai.json');
        this.loadConfig();
    }

    /**
     * Load configuration from bunnyai.json
     */
    private loadConfig(): void {
        try {
            if (fs.existsSync(this.configPath)) {
                const configContent = fs.readFileSync(this.configPath, 'utf-8');
                const bunnyaiConfig: BunnyAIConfig = JSON.parse(configContent);
                this.config = bunnyaiConfig.rules || {};
            } else {
                this.config = {};
            }
        } catch (error) {
            console.error('Failed to load bunnyai.json:', error);
            this.config = {};
        }
    }

    /**
     * Evaluate all rules against the workspace
     */
    async evaluateRules(): Promise<RuleEvaluationResult> {
        const violations: RuleViolation[] = [];

        if (!this.config) {
            return {
                violations: [],
                summary: { total: 0, errors: 0, warnings: 0, info: 0 },
                config: {}
            };
        }

        // Scan workspace
        const scanner = new WorkspaceRefactorScanner();
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return {
                violations: [],
                summary: { total: 0, errors: 0, warnings: 0, info: 0 },
                config: this.config
            };
        }

        const scanResult = await scanner.scanWorkspace(workspaceFolder);
        const depGraphBuilder = new DependencyGraphBuilder(this.workspacePath);
        const depGraph = depGraphBuilder.buildGraph(scanResult.files);

        // Evaluate naming rules
        if (this.config.naming) {
            violations.push(...this.evaluateNamingRules(scanResult.files, this.config.naming));
        }

        // Evaluate structure rules
        if (this.config.structure) {
            violations.push(...this.evaluateStructureRules(scanResult.files, this.config.structure));
        }

        // Evaluate import rules
        if (this.config.imports) {
            violations.push(...this.evaluateImportRules(scanResult.files, depGraph, this.config.imports));
        }

        // Calculate summary
        const summary = {
            total: violations.length,
            errors: violations.filter(v => v.severity === 'error').length,
            warnings: violations.filter(v => v.severity === 'warning').length,
            info: violations.filter(v => v.severity === 'info').length
        };

        return {
            violations,
            summary,
            config: this.config
        };
    }

    /**
     * Evaluate naming rules
     */
    private evaluateNamingRules(files: FileInfo[], namingRules: NamingRule): RuleViolation[] {
        const violations: RuleViolation[] = [];

        for (const file of files) {
            const fileName = path.basename(file.relativePath, path.extname(file.relativePath));
            const dirName = path.dirname(file.relativePath);

            // Determine file type based on directory or content
            const fileType = this.determineFileType(file.relativePath, file.content);

            // Get naming rule for this file type
            const expectedNaming = namingRules[fileType] || namingRules.files;

            if (expectedNaming) {
                const isValid = this.checkNamingConvention(fileName, expectedNaming);
                if (!isValid) {
                    const suggestedName = this.suggestName(fileName, expectedNaming);
                    violations.push({
                        rule: `naming.${fileType}`,
                        severity: 'warning',
                        file: file.relativePath,
                        message: `File "${fileName}" does not follow ${expectedNaming} convention`,
                        suggestedFix: {
                            type: 'rename',
                            description: `Rename to ${suggestedName}`,
                            oldValue: fileName,
                            newValue: suggestedName,
                            oldPath: file.relativePath,
                            newPath: path.join(dirName, `${suggestedName}${path.extname(file.relativePath)}`)
                        }
                    });
                }
            }
        }

        return violations;
    }

    /**
     * Evaluate structure rules
     */
    private evaluateStructureRules(files: FileInfo[], structureRules: StructureRule): RuleViolation[] {
        const violations: RuleViolation[] = [];

        // Check required directories
        if (structureRules.requiredLayers) {
            for (const layer of structureRules.requiredLayers) {
                const layerDir = structureRules[`${layer}Dir`] as string | undefined;
                if (layerDir) {
                    const fullPath = path.join(this.workspacePath, layerDir);
                    if (!fs.existsSync(fullPath)) {
                        violations.push({
                            rule: `structure.requiredLayers.${layer}`,
                            severity: 'error',
                            message: `Required directory "${layerDir}" does not exist`,
                            suggestedFix: {
                                type: 'create',
                                description: `Create directory ${layerDir}`,
                                newPath: layerDir
                            }
                        });
                    }
                }
            }
        }

        // Check file placement rules
        for (const file of files) {
            const fileType = this.determineFileType(file.relativePath, file.content);
            const expectedDir = structureRules[`${fileType}Dir`] as string | undefined;

            if (expectedDir) {
                const expectedPath = path.join(this.workspacePath, expectedDir);
                const filePath = path.join(this.workspacePath, file.relativePath);
                const fileDir = path.dirname(filePath);

                if (!filePath.startsWith(expectedPath)) {
                    const relativePath = path.relative(this.workspacePath, filePath);
                    const newPath = path.join(expectedDir, path.basename(file.relativePath));
                    violations.push({
                        rule: `structure.${fileType}Dir`,
                        severity: 'warning',
                        file: file.relativePath,
                        message: `${fileType} file should be in "${expectedDir}" directory`,
                        suggestedFix: {
                            type: 'move',
                            description: `Move to ${newPath}`,
                            oldPath: file.relativePath,
                            newPath: newPath
                        }
                    });
                }
            }
        }

        return violations;
    }

    /**
     * Evaluate import rules
     */
    private evaluateImportRules(
        files: FileInfo[],
        depGraph: import('../refactor/depGraph').DependencyGraph,
        importRules: ImportRule
    ): RuleViolation[] {
        const violations: RuleViolation[] = [];

        // Check circular imports
        if (importRules.disallowCircularImports) {
            for (const cycle of depGraph.circularDependencies) {
                violations.push({
                    rule: 'imports.disallowCircularImports',
                    severity: 'error',
                    message: `Circular dependency detected: ${cycle.join(' -> ')}`,
                    suggestedFix: {
                        type: 'refactor',
                        description: 'Break circular dependency by extracting shared code or using dependency injection'
                    }
                });
            }
        }

        // Check import depth
        if (importRules.maxImportDepth !== undefined) {
            for (const file of files) {
                const depth = this.calculateImportDepth(file, depGraph);
                if (depth > importRules.maxImportDepth!) {
                    violations.push({
                        rule: 'imports.maxImportDepth',
                        severity: 'warning',
                        file: file.relativePath,
                        message: `Import depth ${depth} exceeds maximum ${importRules.maxImportDepth}`,
                        suggestedFix: {
                            type: 'reorganize',
                            description: 'Reduce import depth by flattening dependencies'
                        }
                    });
                }
            }
        }

        // Check parent imports
        if (importRules.disallowParentImports) {
            for (const file of files) {
                for (const imp of file.imports) {
                    if (imp.startsWith('../')) {
                        violations.push({
                            rule: 'imports.disallowParentImports',
                            severity: 'warning',
                            file: file.relativePath,
                            message: `Parent directory import detected: ${imp}`,
                            suggestedFix: {
                                type: 'reorganize',
                                description: 'Use absolute imports or restructure to avoid parent imports'
                            }
                        });
                    }
                }
            }
        }

        return violations;
    }

    /**
     * Determine file type based on path and content
     */
    private determineFileType(filePath: string, content: string): string {
        const fileName = path.basename(filePath).toLowerCase();
        const dirName = path.dirname(filePath).toLowerCase();

        // Check directory name
        if (dirName.includes('component')) return 'components';
        if (dirName.includes('service')) return 'services';
        if (dirName.includes('controller')) return 'controllers';
        if (dirName.includes('repository') || dirName.includes('repo')) return 'repositories';
        if (dirName.includes('module')) return 'modules';

        // Check file name patterns
        if (fileName.includes('component')) return 'components';
        if (fileName.includes('service')) return 'services';
        if (fileName.includes('controller')) return 'controllers';
        if (fileName.includes('repository') || fileName.includes('repo')) return 'repositories';
        if (fileName.includes('module')) return 'modules';

        // Check content patterns
        if (content.includes('@Component') || content.includes('React.Component')) return 'components';
        if (content.includes('@Service') || content.includes('class.*Service')) return 'services';
        if (content.includes('@Controller') || content.includes('@Get') || content.includes('@Post')) return 'controllers';
        if (content.includes('@Repository') || content.includes('Repository')) return 'repositories';

        return 'files';
    }

    /**
     * Check if a name follows a naming convention
     */
    private checkNamingConvention(name: string, convention: string): boolean {
        switch (convention) {
            case 'PascalCase':
                return /^[A-Z][a-zA-Z0-9]*$/.test(name);
            case 'camelCase':
                return /^[a-z][a-zA-Z0-9]*$/.test(name);
            case 'kebab-case':
                return /^[a-z][a-z0-9-]*$/.test(name);
            case 'snake_case':
                return /^[a-z][a-z0-9_]*$/.test(name);
            default:
                return true;
        }
    }

    /**
     * Suggest a name following a naming convention
     */
    private suggestName(name: string, convention: string): string {
        // Convert to camelCase first
        let camelCase = name.replace(/[-_](.)/g, (_, c) => c.toUpperCase());
        camelCase = camelCase.charAt(0).toLowerCase() + camelCase.slice(1);

        switch (convention) {
            case 'PascalCase':
                return camelCase.charAt(0).toUpperCase() + camelCase.slice(1);
            case 'camelCase':
                return camelCase;
            case 'kebab-case':
                return camelCase.replace(/([A-Z])/g, '-$1').toLowerCase();
            case 'snake_case':
                return camelCase.replace(/([A-Z])/g, '_$1').toLowerCase();
            default:
                return name;
        }
    }

    /**
     * Calculate import depth for a file
     */
    private calculateImportDepth(file: FileInfo, depGraph: import('../refactor/depGraph').DependencyGraph): number {
        const visited = new Set<string>();
        const queue: Array<{ path: string; depth: number }> = [{ path: file.relativePath, depth: 0 }];
        let maxDepth = 0;

        while (queue.length > 0) {
            const { path: filePath, depth } = queue.shift()!;
            if (visited.has(filePath)) continue;
            visited.add(filePath);

            const node = depGraph.nodes.get(filePath);
            if (node) {
                maxDepth = Math.max(maxDepth, depth);
                for (const imported of node.resolvedImports) {
                    queue.push({ path: imported, depth: depth + 1 });
                }
            }
        }

        return maxDepth;
    }

    /**
     * Get current configuration
     */
    getConfig(): ArchitectureRules | null {
        return this.config;
    }

    /**
     * Save configuration to bunnyai.json
     */
    async saveConfig(config: ArchitectureRules): Promise<void> {
        this.config = config;
        const bunnyaiConfig: BunnyAIConfig = { rules: config };
        await fs.promises.writeFile(this.configPath, JSON.stringify(bunnyaiConfig, null, 2), 'utf-8');
    }
}

