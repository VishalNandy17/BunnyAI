import { IAIProvider } from '../types';

export class AITestGenerator implements IAIProvider {
    async generateTests(code: string): Promise<string> {
        // TODO: Call AI API to generate tests
        return `// Generated test for: ${code.substring(0, 50)}...`;
    }

    async generateDocs(code: string): Promise<string> {
        return '/** Documentation */';
    }

    async analyzeError(error: string): Promise<string> {
        return 'Error analysis...';
    }
}
