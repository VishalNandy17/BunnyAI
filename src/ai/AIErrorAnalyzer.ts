import { AIProvider } from './AIProvider';

export class AIErrorAnalyzer {
    private aiProvider: AIProvider;

    constructor() {
        this.aiProvider = new AIProvider();
    }

    async analyze(error: string): Promise<string> {
        return this.aiProvider.analyzeError(error);
    }
}
