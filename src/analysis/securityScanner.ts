export interface SecurityIssue {
    id: string;
    severity: 'low' | 'medium' | 'high';
    message: string;
    line: number;
    codeSnippet: string;
    ruleId: string;
}

export interface SecurityScanResult {
    filePath: string;
    issues: SecurityIssue[];
}

interface SecurityRule {
    id: string;
    name: string;
    severity: 'low' | 'medium' | 'high';
    pattern: RegExp;
    message: string;
    languages?: string[];
    excludePattern?: RegExp;
}

const SECURITY_RULES: SecurityRule[] = [
    // Hardcoded secrets
    {
        id: 'hardcoded-api-key',
        name: 'Hardcoded API Key',
        severity: 'high',
        pattern: /(?:api[_-]?key|apikey|api_key)\s*[=:]\s*['"`]([a-zA-Z0-9_\-]{20,})['"`]/i,
        message: 'Potential hardcoded API key detected. Use environment variables or secure storage.',
        languages: ['javascript', 'typescript', 'python', 'java', 'php', 'go', 'rust']
    },
    {
        id: 'hardcoded-token',
        name: 'Hardcoded Token',
        severity: 'high',
        pattern: /(?:token|access_token|bearer_token)\s*[=:]\s*['"`]([a-zA-Z0-9_\-\.]{20,})['"`]/i,
        message: 'Potential hardcoded token detected. Store tokens securely.',
        languages: ['javascript', 'typescript', 'python', 'java', 'php', 'go', 'rust']
    },
    {
        id: 'hardcoded-password',
        name: 'Hardcoded Password',
        severity: 'high',
        pattern: /(?:password|pwd|passwd)\s*[=:]\s*['"`]([^'"`]{6,})['"`]/i,
        message: 'Hardcoded password detected. Never store passwords in source code.',
        languages: ['javascript', 'typescript', 'python', 'java', 'php', 'go', 'rust']
    },
    {
        id: 'hardcoded-secret',
        name: 'Hardcoded Secret',
        severity: 'high',
        pattern: /(?:secret|secret_key|private_key)\s*[=:]\s*['"`]([a-zA-Z0-9_\-\.]{16,})['"`]/i,
        message: 'Hardcoded secret detected. Use secure configuration management.',
        languages: ['javascript', 'typescript', 'python', 'java', 'php', 'go', 'rust']
    },
    // Dangerous code execution
    {
        id: 'eval-usage',
        name: 'eval() Usage',
        severity: 'high',
        pattern: /\beval\s*\(/,
        message: 'eval() can execute arbitrary code and is a security risk. Avoid using eval().',
        languages: ['javascript', 'typescript', 'python', 'php']
    },
    {
        id: 'function-constructor',
        name: 'Function Constructor',
        severity: 'high',
        pattern: /\bnew\s+Function\s*\(/,
        message: 'Function constructor can execute arbitrary code. Use safer alternatives.',
        languages: ['javascript', 'typescript']
    },
    {
        id: 'exec-usage',
        name: 'exec() Usage',
        severity: 'high',
        pattern: /\bexec\s*\(/,
        message: 'exec() can execute shell commands. Validate and sanitize all inputs.',
        languages: ['python', 'php', 'javascript', 'typescript']
    },
    // SQL injection risks
    {
        id: 'sql-string-concat',
        name: 'SQL String Concatenation',
        severity: 'high',
        pattern: /(?:SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)/i,
        message: 'SQL query string concatenation detected. Use parameterized queries to prevent SQL injection.',
        languages: ['javascript', 'typescript', 'python', 'java', 'csharp', 'php']
    },
    {
        id: 'sql-template-literal',
        name: 'SQL Template Literal',
        severity: 'high',
        pattern: /(?:SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)/i,
        message: 'SQL query with template literal interpolation detected. Use parameterized queries.',
        languages: ['javascript', 'typescript']
    },
    // Insecure HTTP
    {
        id: 'http-insecure',
        name: 'Insecure HTTP Request',
        severity: 'medium',
        pattern: /(?:http:\/\/|fetch\s*\(\s*['"`]http:\/\/|axios\.(?:get|post|put|delete)\s*\(\s*['"`]http:\/\/|request\s*\(\s*['"`]http:\/\/)/i,
        message: 'HTTP request detected. Use HTTPS in production to protect data in transit.',
        excludePattern: /(?:localhost|127\.0\.0\.1|0\.0\.0\.0)/i,
        languages: ['javascript', 'typescript', 'python', 'java', 'php', 'go', 'rust']
    },
    // Weak cryptography
    {
        id: 'md5-usage',
        name: 'MD5 Hash Usage',
        severity: 'medium',
        pattern: /\bmd5\s*\(/i,
        message: 'MD5 is cryptographically broken. Use SHA-256 or stronger for security-sensitive operations.',
        languages: ['javascript', 'typescript', 'python', 'php', 'java']
    },
    {
        id: 'sha1-usage',
        name: 'SHA-1 Hash Usage',
        severity: 'medium',
        pattern: /\bsha1\s*\(/i,
        message: 'SHA-1 is deprecated. Use SHA-256 or stronger.',
        languages: ['javascript', 'typescript', 'python', 'php', 'java']
    },
    // XSS risks
    {
        id: 'innerhtml-usage',
        name: 'innerHTML Assignment',
        severity: 'medium',
        pattern: /\.innerHTML\s*=\s*[^=]/,
        message: 'Direct innerHTML assignment can lead to XSS. Sanitize input or use textContent.',
        languages: ['javascript', 'typescript']
    },
    {
        id: 'dangerouslysetinnerhtml',
        name: 'dangerouslySetInnerHTML Usage',
        severity: 'medium',
        pattern: /dangerouslySetInnerHTML/i,
        message: 'dangerouslySetInnerHTML can lead to XSS. Sanitize HTML content.',
        languages: ['javascript', 'typescript', 'javascriptreact', 'typescriptreact']
    },
    // File system risks
    {
        id: 'file-path-traversal',
        name: 'Potential Path Traversal',
        severity: 'medium',
        pattern: /(?:\.\.\/|\.\.\\|\.\.\/\.\.)/,
        message: 'Potential path traversal detected. Validate and sanitize file paths.',
        excludePattern: /(?:import|require|from)\s+['"`]\.\./,
        languages: ['javascript', 'typescript', 'python', 'java', 'php', 'go', 'rust']
    }
];

function getCodeSnippet(code: string, lineNumber: number, contextLines: number = 2): string {
    const lines = code.split('\n');
    const start = Math.max(0, lineNumber - contextLines - 1);
    const end = Math.min(lines.length, lineNumber + contextLines);
    return lines.slice(start, end).join('\n');
}

function isInString(code: string, position: number): boolean {
    const before = code.substring(0, position);
    let inString = false;
    let stringChar = '';
    let escaped = false;

    for (let i = 0; i < before.length; i++) {
        const ch = before[i];
        if (escaped) {
            escaped = false;
            continue;
        }
        if (ch === '\\') {
            escaped = true;
            continue;
        }
        if ((ch === '"' || ch === "'" || ch === '`') && !inString) {
            inString = true;
            stringChar = ch;
        } else if (ch === stringChar && inString) {
            inString = false;
            stringChar = '';
        }
    }

    return inString;
}

function isInComment(code: string, position: number): boolean {
    const before = code.substring(0, position);
    
    // Check for line comments
    const lastLineComment = before.lastIndexOf('//');
    if (lastLineComment !== -1) {
        const afterComment = before.substring(lastLineComment + 2);
        if (!afterComment.includes('\n')) {
            return true;
        }
    }

    // Check for block comments
    let blockStart = before.lastIndexOf('/*');
    if (blockStart !== -1) {
        const afterStart = before.substring(blockStart + 2);
        const blockEnd = afterStart.indexOf('*/');
        if (blockEnd === -1 || blockEnd > afterStart.lastIndexOf('\n')) {
            return true;
        }
    }

    return false;
}

export function scanSecurity(code: string, languageId: string, filePath: string = ''): SecurityScanResult {
    const issues: SecurityIssue[] = [];
    const lines = code.split('\n');
    const langId = languageId.toLowerCase();

    for (const rule of SECURITY_RULES) {
        // Skip if language doesn't match
        if (rule.languages && !rule.languages.includes(langId)) {
            continue;
        }

        let match: RegExpExecArray | null;
        const regex = new RegExp(rule.pattern.source, rule.pattern.flags + 'g');

        while ((match = regex.exec(code)) !== null) {
            const matchStart = match.index;
            const matchEnd = matchStart + match[0].length;

            // Skip if in comment
            if (isInComment(code, matchStart)) {
                continue;
            }

            // For SQL rules, check if SQL keyword is in a string AND there's concatenation/interpolation nearby
            // For other rules, skip if in string literal
            const isSqlRule = rule.id.startsWith('sql-');
            if (isSqlRule) {
                // SQL rules: only flag if SQL keyword is in a string AND there's + or ${ nearby
                if (!isInString(code, matchStart)) {
                    continue; // SQL keyword not in string, not a concatenation risk
                }
                // Check if there's concatenation or interpolation nearby (within 200 chars)
                const contextStart = Math.max(0, matchStart - 200);
                const contextEnd = Math.min(code.length, matchEnd + 200);
                const context = code.substring(contextStart, contextEnd);
                
                if (rule.id === 'sql-string-concat') {
                    // Look for + concatenation
                    if (!context.includes('+')) {
                        continue;
                    }
                } else if (rule.id === 'sql-template-literal') {
                    // Look for template literal with ${ interpolation
                    if (!context.includes('`') || !context.includes('${')) {
                        continue;
                    }
                }
            } else if (isInString(code, matchStart)) {
                continue;
            }

            // Check exclude pattern - check match and surrounding context
            if (rule.excludePattern) {
                const contextStart = Math.max(0, matchStart - 50);
                const contextEnd = Math.min(code.length, matchEnd + 50);
                const context = code.substring(contextStart, contextEnd);
                if (rule.excludePattern.test(context)) {
                    continue;
                }
            }

            // Calculate line number
            const lineNumber = code.substring(0, matchStart).split('\n').length;
            const codeSnippet = getCodeSnippet(code, lineNumber);

            issues.push({
                id: `${rule.id}-${lineNumber}-${matchStart}`,
                severity: rule.severity,
                message: rule.message,
                line: lineNumber,
                codeSnippet: codeSnippet,
                ruleId: rule.id
            });
        }
    }

    return {
        filePath: filePath,
        issues: issues
    };
}

