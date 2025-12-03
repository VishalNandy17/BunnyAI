import { AIProvider } from './AIProvider';
import { GitHubFile, GitHubPR } from '../integrations/github';
import { Logger } from '../utils/logger';

export interface PRReviewFinding {
    file: string;
    severity: 'info' | 'warning' | 'error';
    category: 'architecture' | 'code-smell' | 'security' | 'test-coverage' | 'style' | 'performance';
    message: string;
    line?: number;
    suggestion?: string;
    codeSnippet?: string;
}

export interface PRReviewResult {
    summary: string;
    findings: PRReviewFinding[];
    filesReviewed: number;
    totalFindings: number;
    findingsByCategory: {
        architecture: number;
        'code-smell': number;
        security: number;
        'test-coverage': number;
        style: number;
        performance: number;
    };
}

export class AIPRReviewer {
    private aiProvider: AIProvider;

    constructor() {
        this.aiProvider = new AIProvider();
    }

    async reviewPR(pr: GitHubPR, files: GitHubFile[]): Promise<PRReviewResult> {
        try {
            // Build context for AI
            const prContext = this.buildPRContext(pr, files);
            
            // Generate PR summary
            const summary = await this.generateSummary(pr, files);
            
            // Generate file-by-file review
            const findings = await this.generateReviewFindings(pr, files);

            const findingsByCategory = {
                architecture: findings.filter(f => f.category === 'architecture').length,
                'code-smell': findings.filter(f => f.category === 'code-smell').length,
                security: findings.filter(f => f.category === 'security').length,
                'test-coverage': findings.filter(f => f.category === 'test-coverage').length,
                style: findings.filter(f => f.category === 'style').length,
                performance: findings.filter(f => f.category === 'performance').length
            };

            return {
                summary,
                findings,
                filesReviewed: files.length,
                totalFindings: findings.length,
                findingsByCategory
            };
        } catch (error) {
            Logger.error('Failed to review PR', error);
            throw error;
        }
    }

    private buildPRContext(pr: GitHubPR, files: GitHubFile[]): string {
        const fileList = files.map(f => `- ${f.filename} (${f.status}, +${f.additions}/-${f.deletions})`).join('\n');
        
        return `Pull Request #${pr.number}: ${pr.title}
Description: ${pr.body || 'No description'}
Branch: ${pr.head.ref} -> ${pr.base.ref}
Files Changed: ${files.length}

Files:
${fileList}`;
    }

    private async generateSummary(pr: GitHubPR, files: GitHubFile[]): Promise<string> {
        const prompt = `Review this GitHub Pull Request and provide a concise summary (2-3 sentences) covering:
1. What changes are being made
2. The scope and impact
3. Any high-level concerns

PR Title: ${pr.title}
PR Description: ${pr.body || 'No description'}
Files Changed: ${files.length}
Total Changes: +${files.reduce((sum, f) => sum + f.additions, 0)} / -${files.reduce((sum, f) => sum + f.deletions, 0)}

Provide a clear, professional summary.`;

        try {
            return await this.aiProvider.explainSecurityIssues(prompt);
        } catch (error) {
            Logger.error('Failed to generate PR summary', error);
            return `This PR includes ${files.length} file(s) with ${files.reduce((sum, f) => sum + f.additions + f.deletions, 0)} total changes.`;
        }
    }

    private async generateReviewFindings(pr: GitHubPR, files: GitHubFile[]): Promise<PRReviewFinding[]> {
        const findings: PRReviewFinding[] = [];

        // Process files in batches to avoid token limits
        for (const file of files) {
            if (!file.patch) {
                continue; // Skip files without diffs
            }

            try {
                const fileFindings = await this.reviewFile(file, pr);
                findings.push(...fileFindings);
            } catch (error) {
                Logger.error(`Failed to review file ${file.filename}`, error);
                // Continue with other files
            }
        }

        return findings;
    }

    private async reviewFile(file: GitHubFile, pr: GitHubPR): Promise<PRReviewFinding[]> {
        const prompt = `Review this code change from a GitHub Pull Request. Analyze for:
1. Architecture issues (design patterns, coupling, separation of concerns)
2. Code smells (duplication, complexity, naming)
3. Security concerns (injection, XSS, secrets, unsafe operations)
4. Test coverage gaps (missing tests, edge cases)
5. Style inconsistencies (formatting, conventions)
6. Performance issues (inefficient algorithms, N+1 queries)

File: ${file.filename}
Status: ${file.status}
Changes: +${file.additions}/-${file.deletions}

Diff:
\`\`\`diff
${file.patch}
\`\`\`

Respond in JSON format with an array of findings. Each finding should have:
{
  "severity": "info" | "warning" | "error",
  "category": "architecture" | "code-smell" | "security" | "test-coverage" | "style" | "performance",
  "message": "Clear description of the issue",
  "line": <line number if applicable>,
  "suggestion": "Specific suggestion for improvement",
  "codeSnippet": "Relevant code snippet if applicable"
}

Return ONLY valid JSON, no markdown formatting or explanations.`;

        try {
            const response = await this.aiProvider.explainSecurityIssues(prompt);
            
            // Try to extract JSON from response
            const jsonMatch = response.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return parsed.map((f: any) => ({
                    file: file.filename,
                    severity: f.severity || 'info',
                    category: f.category || 'code-smell',
                    message: f.message || 'Issue found',
                    line: f.line,
                    suggestion: f.suggestion,
                    codeSnippet: f.codeSnippet
                })) as PRReviewFinding[];
            }

            // Fallback: parse as plain text and create basic findings
            return [{
                file: file.filename,
                severity: 'info',
                category: 'code-smell',
                message: 'AI review completed. See full response for details.',
                suggestion: response.substring(0, 200)
            }];
        } catch (error) {
            Logger.error(`Failed to review file ${file.filename}`, error);
            return [];
        }
    }
}

