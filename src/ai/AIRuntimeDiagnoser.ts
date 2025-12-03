import { AIProvider } from './AIProvider';
import { ParsedError } from '../runtime/logParser';
import { Logger } from '../utils/logger';
import * as fs from 'fs';

export interface RuntimeDiagnosis {
    rootCause: string;
    likelyFix: string;
    preventionStrategy: string;
    testCases: string[];
    confidence: 'high' | 'medium' | 'low';
}

export class AIRuntimeDiagnoser {
    private aiProvider: AIProvider;

    constructor() {
        this.aiProvider = new AIProvider();
    }

    async diagnoseError(
        error: ParsedError,
        sourceCode?: string,
        filePath?: string
    ): Promise<RuntimeDiagnosis> {
        try {
            const prompt = this.buildDiagnosisPrompt(error, sourceCode, filePath);
            const response = await this.aiProvider.explainSecurityIssues(prompt);
            
            return this.parseDiagnosisResponse(response, error);
        } catch (error) {
            Logger.error('Failed to diagnose runtime error', error);
            throw error;
        }
    }

    private buildDiagnosisPrompt(
        error: ParsedError,
        sourceCode?: string,
        filePath?: string
    ): string {
        const stackTrace = error.stackFrames
            .map((frame, idx) => {
                const parts = [];
                if (frame.function) parts.push(`Function: ${frame.function}`);
                if (frame.file) parts.push(`File: ${frame.file}`);
                if (frame.line) parts.push(`Line: ${frame.line}`);
                if (frame.column) parts.push(`Column: ${frame.column}`);
                return `  ${idx + 1}. ${parts.join(', ')}`;
            })
            .join('\n');

        let codeContext = '';
        if (sourceCode && filePath) {
            // Extract relevant code around the error line
            const lines = sourceCode.split('\n');
            const errorLine = error.stackFrames[0]?.line || 0;
            const startLine = Math.max(0, errorLine - 10);
            const endLine = Math.min(lines.length, errorLine + 10);
            const relevantCode = lines.slice(startLine, endLine).join('\n');
            
            codeContext = `\n\nRelevant code from ${filePath} (around line ${errorLine}):\n\`\`\`\n${relevantCode}\n\`\`\``;
        }

        return `Analyze this runtime error and provide a comprehensive diagnosis:

**Error Type:** ${error.type}
**Error Message:** ${error.message}
**Stack Trace:**
${stackTrace}
${codeContext}

Provide a detailed analysis in the following format:

**Root Cause Analysis:**
[Explain what is causing this error, including the underlying issue]

**Likely Fix:**
[Provide specific code fix or solution]

**Prevention Strategy:**
[Explain how to prevent this error in the future]

**Test Cases to Catch This:**
[Provide 2-3 test cases that would have caught this error]

**Confidence Level:** [high/medium/low]

Be specific and actionable. Focus on the root cause, not just symptoms.`;
    }

    private parseDiagnosisResponse(response: string, error: ParsedError): RuntimeDiagnosis {
        // Try to extract structured information from AI response
        const rootCauseMatch = response.match(/\*\*Root Cause Analysis:\*\*\s*([^\*]+)/i) ||
            response.match(/Root Cause[:\s]+([^\n]+(?:\n(?!\*\*)[^\n]+)*)/i);
        const rootCause = rootCauseMatch ? rootCauseMatch[1].trim() : 'Unable to determine root cause from response.';

        const fixMatch = response.match(/\*\*Likely Fix:\*\*\s*([^\*]+)/i) ||
            response.match(/Likely Fix[:\s]+([^\n]+(?:\n(?!\*\*)[^\n]+)*)/i);
        const likelyFix = fixMatch ? fixMatch[1].trim() : 'Review the error and stack trace for clues.';

        const preventionMatch = response.match(/\*\*Prevention Strategy:\*\*\s*([^\*]+)/i) ||
            response.match(/Prevention[:\s]+([^\n]+(?:\n(?!\*\*)[^\n]+)*)/i);
        const preventionStrategy = preventionMatch ? preventionMatch[1].trim() : 'Add proper error handling and validation.';

        // Extract test cases (numbered list or bullet points)
        const testCasesMatch = response.match(/\*\*Test Cases[:\s]+([^\*]+)/i) ||
            response.match(/Test Cases[:\s]+([^\n]+(?:\n(?!\*\*)[^\n]+)*)/i);
        let testCases: string[] = [];
        if (testCasesMatch) {
            const testCasesText = testCasesMatch[1];
            // Extract numbered or bulleted items
            const items = testCasesText.match(/(?:^\d+\.|^[-*])\s*(.+)$/gm) || [];
            testCases = items.map(item => item.replace(/^\d+\.|^[-*]\s*/, '').trim()).filter(t => t.length > 0);
        }
        if (testCases.length === 0) {
            testCases = ['Add test case for this error scenario'];
        }

        // Determine confidence based on response quality
        const confidence: 'high' | 'medium' | 'low' = 
            rootCause.length > 50 && likelyFix.length > 50 ? 'high' :
            rootCause.length > 20 && likelyFix.length > 20 ? 'medium' : 'low';

        return {
            rootCause,
            likelyFix,
            preventionStrategy,
            testCases,
            confidence
        };
    }

    async loadSourceCode(filePath: string): Promise<string | undefined> {
        try {
            if (fs.existsSync(filePath)) {
                return fs.readFileSync(filePath, 'utf-8');
            }
        } catch (error) {
            Logger.error(`Failed to load source code from ${filePath}`, error);
        }
        return undefined;
    }
}

