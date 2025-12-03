import * as fs from 'fs';
import * as path from 'path';
import { ArchitectureModel } from './scanner';
import { ArchitectureDocumentation } from './diagramGenerator';
import { Logger } from '../utils/logger';

export class ArchitectureExporter {
    async exportToMarkdown(
        workspacePath: string,
        model: ArchitectureModel,
        documentation: ArchitectureDocumentation
    ): Promise<string> {
        const architectureDir = path.join(workspacePath, 'architecture');
        
        // Create architecture directory if it doesn't exist
        if (!fs.existsSync(architectureDir)) {
            fs.mkdirSync(architectureDir, { recursive: true });
        }

        const markdown = this.generateMarkdown(model, documentation);
        const markdownPath = path.join(architectureDir, 'ARCHITECTURE.md');
        
        fs.writeFileSync(markdownPath, markdown, 'utf-8');

        // Export diagrams as separate files
        const diagramsDir = path.join(architectureDir, 'diagrams');
        if (!fs.existsSync(diagramsDir)) {
            fs.mkdirSync(diagramsDir, { recursive: true });
        }

        fs.writeFileSync(
            path.join(diagramsDir, 'flowchart.mmd'),
            documentation.mermaidDiagrams.flowchart,
            'utf-8'
        );

        fs.writeFileSync(
            path.join(diagramsDir, 'class-diagram.mmd'),
            documentation.mermaidDiagrams.classDiagram,
            'utf-8'
        );

        if (documentation.mermaidDiagrams.sequenceDiagram) {
            fs.writeFileSync(
                path.join(diagramsDir, 'sequence-diagram.mmd'),
                documentation.mermaidDiagrams.sequenceDiagram,
                'utf-8'
            );
        }

        Logger.log(`Architecture documentation exported to ${architectureDir}`);

        return markdownPath;
    }

    private generateMarkdown(model: ArchitectureModel, documentation: ArchitectureDocumentation): string {
        const sections: string[] = [];

        // Header
        sections.push('# Architecture Overview\n');
        sections.push(`**Project Type:** ${model.projectType}`);
        if (model.framework) {
            sections.push(`**Framework:** ${model.framework}`);
        }
        if (model.packageManager) {
            sections.push(`**Package Manager:** ${model.packageManager}`);
        }
        if (model.buildTool) {
            sections.push(`**Build Tool:** ${model.buildTool}`);
        }
        sections.push('');

        // Summary
        sections.push('## Summary\n');
        sections.push(`- **Modules:** ${model.modules.length}`);
        sections.push(`- **Components:** ${model.components.length}`);
        sections.push(`- **Dependencies:** ${model.dependencies.length}`);
        sections.push('');

        // Narrative
        sections.push('## Architecture Description\n');
        sections.push(documentation.narrative);
        sections.push('');

        // Modules
        sections.push('## Modules\n');
        model.modules.forEach(module => {
            sections.push(`### ${module.name}`);
            sections.push(`- **Type:** ${module.type}`);
            sections.push(`- **Path:** ${module.path || 'root'}`);
            sections.push(`- **Files:** ${module.files.length}`);
            sections.push(`- **Dependencies:** ${module.dependencies.length}`);
            if (module.exports.length > 0) {
                sections.push(`- **Exports:** ${module.exports.slice(0, 10).join(', ')}${module.exports.length > 10 ? '...' : ''}`);
            }
            sections.push('');
        });

        // Diagrams
        sections.push('## Architecture Diagrams\n');
        sections.push('### Flowchart\n');
        sections.push('```mermaid');
        sections.push(documentation.mermaidDiagrams.flowchart);
        sections.push('```');
        sections.push('');

        sections.push('### Class Diagram\n');
        sections.push('```mermaid');
        sections.push(documentation.mermaidDiagrams.classDiagram);
        sections.push('```');
        sections.push('');

        if (documentation.mermaidDiagrams.sequenceDiagram) {
            sections.push('### Sequence Diagram\n');
            sections.push('```mermaid');
            sections.push(documentation.mermaidDiagrams.sequenceDiagram);
            sections.push('```');
            sections.push('');
        }

        // Hotspots
        if (documentation.hotspots.length > 0) {
            sections.push('## Hotspots (Complex Modules)\n');
            documentation.hotspots.forEach(hotspot => {
                sections.push(`### ${hotspot.module}`);
                sections.push(`- **Reason:** ${hotspot.reason}`);
                sections.push(`- **Complexity Score:** ${hotspot.complexity}`);
                sections.push('');
            });
        }

        // Improvements
        if (documentation.improvements.length > 0) {
            sections.push('## Suggested Improvements\n');
            documentation.improvements.forEach((improvement, index) => {
                sections.push(`${index + 1}. ${improvement}`);
            });
            sections.push('');
        }

        // Components
        sections.push('## Key Components\n');
        const topComponents = model.components
            .sort((a, b) => b.dependencies.length - a.dependencies.length)
            .slice(0, 30);
        
        topComponents.forEach(component => {
            sections.push(`- **${component.name}** (${component.type}) - ${component.module || 'root'}`);
        });
        sections.push('');

        // Footer
        sections.push('---\n');
        sections.push(`*Generated by BunnyAI Pro on ${new Date().toISOString()}*`);

        return sections.join('\n');
    }
}

