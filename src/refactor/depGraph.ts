import * as path from 'path';
import * as fs from 'fs';
import { FileInfo } from './workspaceScanner';

export interface GraphNode {
    file: string;
    relativePath: string;
    imports: string[];
    exports: string[];
    resolvedImports: string[]; // Files in workspace that this imports
    dependents: string[]; // Files that import this
}

export interface DependencyGraph {
    nodes: Map<string, GraphNode>;
    circularDependencies: string[][];
    orphanedFiles: string[];
    highlyCoupledModules: Array<{
        files: string[];
        coupling: number;
    }>;
}

export class DependencyGraphBuilder {
    private workspacePath: string;

    constructor(workspacePath: string) {
        this.workspacePath = workspacePath;
    }

    buildGraph(files: FileInfo[]): DependencyGraph {
        const nodes = new Map<string, GraphNode>();

        // Create nodes
        for (const file of files) {
            const resolvedImports = this.resolveImports(file.imports, file.relativePath, files);
            const node: GraphNode = {
                file: file.file,
                relativePath: file.relativePath,
                imports: file.imports,
                exports: file.exports,
                resolvedImports: resolvedImports,
                dependents: []
            };
            nodes.set(file.relativePath, node);
        }

        // Build dependents (reverse dependencies)
        for (const [filePath, node] of nodes.entries()) {
            for (const importedFile of node.resolvedImports) {
                const importedNode = nodes.get(importedFile);
                if (importedNode && !importedNode.dependents.includes(filePath)) {
                    importedNode.dependents.push(filePath);
                }
            }
        }

        // Detect circular dependencies
        const circularDependencies = this.detectCircularDependencies(nodes);

        // Find orphaned files (no imports, no dependents)
        const orphanedFiles = Array.from(nodes.entries())
            .filter(([_, node]) => node.resolvedImports.length === 0 && node.dependents.length === 0)
            .map(([path]) => path);

        // Find highly coupled modules
        const highlyCoupledModules = this.findHighlyCoupledModules(nodes);

        return {
            nodes,
            circularDependencies,
            orphanedFiles,
            highlyCoupledModules
        };
    }

    private resolveImports(imports: string[], fromFile: string, allFiles: FileInfo[]): string[] {
        const resolved: string[] = [];
        const fromDir = path.dirname(fromFile);

        for (const imp of imports) {
            // Skip external dependencies
            if (!imp.startsWith('.') && !imp.startsWith('/') && !path.isAbsolute(imp)) {
                continue;
            }

            // Try to resolve relative imports
            let resolvedPath: string | null = null;

            if (imp.startsWith('.')) {
                // Relative import
                const candidate = path.resolve(this.workspacePath, fromDir, imp);
                
                // Try with extensions
                const extensions = ['.ts', '.js', '.tsx', '.jsx', '.py', '.java', '.go', '.php'];
                for (const ext of extensions) {
                    if (fs.existsSync(candidate + ext)) {
                        resolvedPath = path.relative(this.workspacePath, candidate + ext);
                        break;
                    }
                }

                // Try as directory with index file
                if (!resolvedPath && fs.existsSync(candidate)) {
                    const indexFiles = ['index.ts', 'index.js', 'index.tsx', 'index.jsx', '__init__.py'];
                    for (const indexFile of indexFiles) {
                        const indexPath = path.join(candidate, indexFile);
                        if (fs.existsSync(indexPath)) {
                            resolvedPath = path.relative(this.workspacePath, indexPath);
                            break;
                        }
                    }
                }

                // Try without extension
                if (!resolvedPath && fs.existsSync(candidate)) {
                    resolvedPath = path.relative(this.workspacePath, candidate);
                }
            }

            if (resolvedPath) {
                // Normalize path separators
                const normalized = resolvedPath.replace(/\\/g, '/');
                const found = allFiles.find(f => f.relativePath.replace(/\\/g, '/') === normalized);
                if (found) {
                    resolved.push(found.relativePath);
                }
            }
        }

        return resolved;
    }

    private detectCircularDependencies(nodes: Map<string, GraphNode>): string[][] {
        const cycles: string[][] = [];
        const visited = new Set<string>();
        const recursionStack = new Set<string>();

        const dfs = (file: string, path: string[]): void => {
            if (recursionStack.has(file)) {
                // Found a cycle
                const cycleStart = path.indexOf(file);
                if (cycleStart !== -1) {
                    const cycle = path.slice(cycleStart).concat([file]);
                    // Avoid duplicates
                    const cycleKey = cycle.sort().join('->');
                    if (!cycles.some(c => c.sort().join('->') === cycleKey)) {
                        cycles.push(cycle);
                    }
                }
                return;
            }

            if (visited.has(file)) {
                return;
            }

            visited.add(file);
            recursionStack.add(file);

            const node = nodes.get(file);
            if (node) {
                for (const imported of node.resolvedImports) {
                    dfs(imported, [...path, file]);
                }
            }

            recursionStack.delete(file);
        };

        for (const file of nodes.keys()) {
            if (!visited.has(file)) {
                dfs(file, []);
            }
        }

        return cycles;
    }

    private findHighlyCoupledModules(nodes: Map<string, GraphNode>): Array<{ files: string[]; coupling: number }> {
        // Group files by directory (module)
        const modules = new Map<string, string[]>();

        for (const [filePath, node] of nodes.entries()) {
            const dir = path.dirname(filePath) || 'root';
            if (!modules.has(dir)) {
                modules.set(dir, []);
            }
            modules.get(dir)!.push(filePath);
        }

        const highlyCoupled: Array<{ files: string[]; coupling: number }> = [];

        for (const [dir, files] of modules.entries()) {
            // Calculate coupling: number of dependencies between files in this module and external files
            let externalDeps = 0;
            let internalDeps = 0;

            for (const file of files) {
                const node = nodes.get(file);
                if (node) {
                    for (const imported of node.resolvedImports) {
                        const importedDir = path.dirname(imported) || 'root';
                        if (importedDir === dir) {
                            internalDeps++;
                        } else {
                            externalDeps++;
                        }
                    }
                }
            }

            const coupling = externalDeps / (internalDeps + externalDeps || 1);
            
            if (coupling > 0.5 && files.length > 1) {
                highlyCoupled.push({
                    files,
                    coupling: Math.round(coupling * 100) / 100
                });
            }
        }

        return highlyCoupled.sort((a, b) => b.coupling - a.coupling).slice(0, 10);
    }
}

