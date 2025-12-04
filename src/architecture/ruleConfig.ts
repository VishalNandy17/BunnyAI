export interface NamingRule {
    components?: 'PascalCase' | 'camelCase' | 'kebab-case' | 'snake_case';
    services?: 'PascalCase' | 'camelCase' | 'kebab-case' | 'snake_case';
    controllers?: 'PascalCase' | 'camelCase' | 'kebab-case' | 'snake_case';
    repositories?: 'PascalCase' | 'camelCase' | 'kebab-case' | 'snake_case';
    modules?: 'PascalCase' | 'camelCase' | 'kebab-case' | 'snake_case';
    files?: 'PascalCase' | 'camelCase' | 'kebab-case' | 'snake_case';
    [key: string]: 'PascalCase' | 'camelCase' | 'kebab-case' | 'snake_case' | undefined;
}

export interface StructureRule {
    componentsDir?: string;
    servicesDir?: string;
    controllersDir?: string;
    repositoriesDir?: string;
    modulesDir?: string;
    requiredLayers?: string[]; // e.g., ['controllers', 'services', 'repositories']
    [key: string]: string | string[] | undefined;
}

export interface ImportRule {
    disallowCircularImports?: boolean;
    enforceAbsoluteImports?: boolean;
    importOrder?: string[]; // e.g., ['external', 'internal', 'relative']
    maxImportDepth?: number;
    disallowParentImports?: boolean; // Disallow imports from parent directories
}

export interface ArchitectureRules {
    naming?: NamingRule;
    structure?: StructureRule;
    imports?: ImportRule;
}

export interface BunnyAIConfig {
    rules?: ArchitectureRules;
}

