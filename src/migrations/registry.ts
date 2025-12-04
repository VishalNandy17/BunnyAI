import { MigrationDefinition } from './types';
import { jsToTsMigration } from './migrations/jsToTs';
import { expressToNestjsMigration } from './migrations/expressToNestjs';
import { reactClassToHooksMigration } from './migrations/reactClassToHooks';

export class MigrationRegistry {
    private static migrations: MigrationDefinition[] = [
        jsToTsMigration,
        expressToNestjsMigration,
        reactClassToHooksMigration
    ];

    /**
     * Get all available migrations
     */
    static getAll(): MigrationDefinition[] {
        return this.migrations;
    }

    /**
     * Get migrations applicable to a project
     */
    static getApplicable(projectInfo: { type: string; framework?: string; hasTypeScript?: boolean; hasJSX?: boolean }): MigrationDefinition[] {
        return this.migrations.filter(migration => {
            // Create a minimal ProjectInfo for checking
            const mockProjectInfo = {
                type: projectInfo.type as any,
                framework: projectInfo.framework,
                hasTypeScript: projectInfo.hasTypeScript,
                hasJSX: projectInfo.hasJSX
            };
            return migration.appliesTo(mockProjectInfo);
        });
    }

    /**
     * Get migration by ID
     */
    static getById(id: string): MigrationDefinition | undefined {
        return this.migrations.find(m => m.id === id);
    }
}
