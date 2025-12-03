import * as path from 'path';
import { ArchitectureModel, ModuleInfo, ComponentInfo, DependencyEdge } from './scanner';
import { AIProvider } from '../ai/AIProvider';
import { Logger } from '../utils/logger';

export interface ArchitectureDocumentation {
    narrative: string;
    mermaidDiagrams: {
        flowchart: string;
        classDiagram: string;
        sequenceDiagram?: string;
    };
    hotspots: Array<{
        module: string;
        reason: string;
        complexity: number;
    }>;
    improvements: string[];
}

export class DiagramGenerator {
    private aiProvider: AIProvider;

    constructor() {
        this.aiProvider = new AIProvider();
    }

    async generateDocumentation(model: ArchitectureModel): Promise<ArchitectureDocumentation> {
        try {
            // Generate narrative and diagrams with AI
            const prompt = this.buildArchitecturePrompt(model);
            const aiResponse = await this.aiProvider.explainSecurityIssues(prompt);

            // Parse AI response
            const narrative = this.extractNarrative(aiResponse);
            const improvements = this.extractImprovements(aiResponse);

            // Generate Mermaid diagrams
            const flowchart = this.generateFlowchart(model);
            const classDiagram = this.generateClassDiagram(model);
            const sequenceDiagram = this.generateSequenceDiagram(model);

            // Identify hotspots
            const hotspots = this.identifyHotspots(model);

            return {
                narrative,
                mermaidDiagrams: {
                    flowchart,
                    classDiagram,
                    sequenceDiagram
                },
                hotspots,
                improvements
            };
        } catch (error) {
            Logger.error('Failed to generate architecture documentation', error);
            throw error;
        }
    }

    private buildArchitecturePrompt(model: ArchitectureModel): string {
        const modulesSummary = model.modules.map(m => 
            `- ${m.name} (${m.type}): ${m.files.length} files, ${m.dependencies.length} dependencies`
        ).join('\n');

        const componentsSummary = model.components.slice(0, 20).map(c =>
            `- ${c.name} (${c.type}) in ${c.module || 'root'}`
        ).join('\n');

        return `Analyze this software architecture and provide:

1. **Layered Architecture Summary**: Describe the overall architecture layers (presentation, business logic, data access, etc.)

2. **Module Overview**: Explain the purpose and organization of modules

3. **Component Relationships**: Describe how components interact

4. **Suggested Improvements**: List architectural improvements (3-5 items)

Provide a clear, professional narrative description.

Project Type: ${model.projectType}
Framework: ${model.framework || 'None detected'}
Modules (${model.modules.length}):
${modulesSummary}

Key Components (showing first 20 of ${model.components.length}):
${componentsSummary}

Dependencies: ${model.dependencies.length} edges`;
    }

    private extractNarrative(response: string): string {
        // Try to extract narrative section
        const narrativeMatch = response.match(/\*\*Layered Architecture Summary\*\*:?\s*([^\*]+)/i) ||
            response.match(/Layered Architecture[:\s]+([^\n]+(?:\n(?!\*\*)[^\n]+)*)/i);
        
        if (narrativeMatch) {
            return narrativeMatch[1].trim();
        }

        // Fallback: use first paragraph
        const paragraphs = response.split('\n\n').filter(p => p.trim().length > 50);
        return paragraphs[0] || response.substring(0, 500);
    }

    private extractImprovements(response: string): string[] {
        const improvementsMatch = response.match(/\*\*Suggested Improvements\*\*:?\s*([^\*]+)/i) ||
            response.match(/Suggested Improvements[:\s]+([^\n]+(?:\n(?!\*\*)[^\n]+)*)/i);
        
        if (improvementsMatch) {
            const text = improvementsMatch[1];
            // Extract numbered or bulleted items
            const items = text.match(/(?:^\d+\.|^[-*])\s*(.+)$/gm) || [];
            return items.map(item => item.replace(/^\d+\.|^[-*]\s*/, '').trim()).filter(i => i.length > 0);
        }

        return ['Consider modularizing large components', 'Review dependency cycles', 'Add comprehensive tests'];
    }

    private generateFlowchart(model: ArchitectureModel): string {
        const nodes: string[] = [];
        const edges: string[] = [];

        // Group modules by type
        const modulesByType = new Map<string, ModuleInfo[]>();
        model.modules.forEach(m => {
            if (!modulesByType.has(m.type)) {
                modulesByType.set(m.type, []);
            }
            modulesByType.get(m.type)!.push(m);
        });

        // Create subgraphs for each module type
        let subgraphIndex = 0;
        modulesByType.forEach((modules, type) => {
            const subgraphId = `subgraph${subgraphIndex++}`;
            nodes.push(`    subgraph ${subgraphId}["${type}"]`);
            modules.forEach(m => {
                const nodeId = this.sanitizeId(m.name);
                nodes.push(`        ${nodeId}["${m.name}"]`);
            });
            nodes.push(`    end`);
        });

        // Add dependency edges (limit to avoid huge diagrams)
        const edgeCount = Math.min(model.dependencies.length, 50);
        for (let i = 0; i < edgeCount; i++) {
            const dep = model.dependencies[i];
            const fromId = this.sanitizeId(dep.from);
            const toId = this.sanitizeId(dep.to);
            edges.push(`    ${fromId} --> ${toId}`);
        }

        return `flowchart TD
${nodes.join('\n')}
${edges.join('\n')}`;
    }

    private generateClassDiagram(model: ArchitectureModel): string {
        const classes: string[] = [];
        const relationships: string[] = [];

        // Create classes from modules
        model.modules.slice(0, 20).forEach(module => {
            const className = this.sanitizeId(module.name);
            const methods = module.exports.slice(0, 5).join(', ');
            classes.push(`    class ${className} {`);
            classes.push(`        +${module.type}`);
            if (methods) {
                classes.push(`        +${methods}`);
            }
            classes.push(`    }`);
        });

        // Add relationships based on dependencies
        const moduleDeps = new Map<string, Set<string>>();
        model.dependencies.forEach(dep => {
            const fromModule = this.getModuleFromFile(dep.from, model.modules);
            const toModule = this.getModuleFromFile(dep.to, model.modules);
            
            if (fromModule && toModule && fromModule !== toModule) {
                if (!moduleDeps.has(fromModule)) {
                    moduleDeps.set(fromModule, new Set());
                }
                moduleDeps.get(fromModule)!.add(toModule);
            }
        });

        moduleDeps.forEach((deps, from) => {
            deps.forEach(to => {
                relationships.push(`    ${this.sanitizeId(from)} --> ${this.sanitizeId(to)}`);
            });
        });

        return `classDiagram
${classes.join('\n')}
${relationships.join('\n')}`;
    }

    private generateSequenceDiagram(model: ArchitectureModel): string | undefined {
        // Generate a simple sequence diagram for top modules
        const topModules = model.modules
            .sort((a, b) => b.files.length - a.files.length)
            .slice(0, 5);

        if (topModules.length < 2) {
            return undefined;
        }

        const participants = topModules.map(m => `    participant ${this.sanitizeId(m.name)}`).join('\n');
        const interactions: string[] = [];

        // Create sample interactions
        for (let i = 0; i < topModules.length - 1; i++) {
            interactions.push(
                `    ${this.sanitizeId(topModules[i].name)}->>${this.sanitizeId(topModules[i + 1].name)}: request`
            );
        }

        return `sequenceDiagram
${participants}
${interactions.join('\n')}`;
    }

    private identifyHotspots(model: ArchitectureModel): Array<{ module: string; reason: string; complexity: number }> {
        const hotspots: Array<{ module: string; reason: string; complexity: number }> = [];

        model.modules.forEach(module => {
            const complexity = module.files.length * 2 + module.dependencies.length;
            
            if (complexity > 20) {
                hotspots.push({
                    module: module.name,
                    reason: `High complexity: ${module.files.length} files, ${module.dependencies.length} dependencies`,
                    complexity
                });
            } else if (module.dependencies.length > 10) {
                hotspots.push({
                    module: module.name,
                    reason: `High coupling: ${module.dependencies.length} dependencies`,
                    complexity
                });
            }
        });

        return hotspots.sort((a, b) => b.complexity - a.complexity).slice(0, 5);
    }

    private sanitizeId(name: string): string {
        return name.replace(/[^a-zA-Z0-9]/g, '_').replace(/^(\d)/, '_$1');
    }

    private getModuleFromFile(filePath: string, modules: ModuleInfo[]): string | null {
        const dir = path.dirname(filePath);
        const module = modules.find(m => m.path === dir || filePath.startsWith(m.path));
        return module ? module.name : null;
    }
}

