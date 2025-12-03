export interface RemovedComment {
    line: number;
    text: string;
}

export interface CommentRemovalResult {
    original: string;
    withoutComments: string;
    removedComments: RemovedComment[];
}

interface CommentConfig {
    lineComment?: string[];
    blockComment?: Array<{ start: string; end: string }>;
    stringDelimiters: string[];
    supportsTemplateLiterals?: boolean;
    supportsTripleQuotes?: boolean;
}

function getCommentConfig(languageId: string): CommentConfig {
    const id = languageId.toLowerCase();

    if (['javascript', 'javascriptreact', 'typescript', 'typescriptreact'].includes(id)) {
        return {
            lineComment: ['//'],
            blockComment: [{ start: '/*', end: '*/' }],
            stringDelimiters: [`'`, `"`, '`'],
            supportsTemplateLiterals: true
        };
    }

    if (['python'].includes(id)) {
        return {
            lineComment: ['#'],
            blockComment: [],
            stringDelimiters: [`'`, `"`],
            supportsTripleQuotes: true
        };
    }

    if (['php'].includes(id)) {
        return {
            lineComment: ['//', '#'],
            blockComment: [{ start: '/*', end: '*/' }],
            stringDelimiters: [`'`, `"`]
        };
    }

    if (['java', 'c', 'cpp', 'csharp', 'go', 'rust', 'css', 'scss', 'less'].includes(id)) {
        return {
            lineComment: ['//'],
            blockComment: [{ start: '/*', end: '*/' }],
            stringDelimiters: [`'`, `"`]
        };
    }

    if (['html', 'xml', 'xhtml'].includes(id)) {
        return {
            lineComment: [],
            blockComment: [{ start: '<!--', end: '-->' }],
            stringDelimiters: [`'`, `"`]
        };
    }

    if (['shellscript', 'bash', 'sh'].includes(id)) {
        return {
            lineComment: ['#'],
            blockComment: [],
            stringDelimiters: [`'`, `"`]
        };
    }

    // Fallback: treat like C-style with // and /* */
    return {
        lineComment: ['//'],
        blockComment: [{ start: '/*', end: '*/' }],
        stringDelimiters: [`'`, `"`]
    };
}

export function removeComments(code: string, languageId: string): CommentRemovalResult {
    const config = getCommentConfig(languageId);

    const original = code;
    const result: string[] = [];
    const removedComments: RemovedComment[] = [];

    let i = 0;
    let line = 1;

    let inBlockComment: { end: string } | null = null;
    let inLineComment = false;
    let inString = false;
    let stringDelimiter = '';
    let isTemplateLiteral = false;
    let isTripleQuoted = false;

    let currentCommentText = '';
    let currentCommentLine = line;

    const flushCommentLine = () => {
        if (currentCommentText.trim().length > 0) {
            removedComments.push({ line: currentCommentLine, text: currentCommentText });
        }
        currentCommentText = '';
    };

    const startsWithAny = (tokens: string[] | undefined): string | undefined => {
        if (!tokens) {
            return undefined;
        }
        for (const t of tokens) {
            if (code.startsWith(t, i)) {
                return t;
            }
        }
        return undefined;
    };

    while (i < code.length) {
        const ch = code[i];
        const next = i + 1 < code.length ? code[i + 1] : '';

        // Track newlines regardless of state for line counting
        if (ch === '\n') {
            if (inLineComment) {
                flushCommentLine();
                inLineComment = false;
            }
            line += 1;
        }

        if (inLineComment) {
            currentCommentText += ch;
            i += 1;
            continue;
        }

        if (inBlockComment) {
            currentCommentText += ch;
            if (code.startsWith(inBlockComment.end, i)) {
                // Include end token
                for (let k = 1; k < inBlockComment.end.length; k++) {
                    currentCommentText += code[i + k];
                }
                flushCommentLine();
                i += inBlockComment.end.length;
                inBlockComment = null;
                continue;
            }
            i += 1;
            continue;
        }

        if (inString) {
            result.push(ch);

            if (ch === '\\') {
                // Escape next character
                if (i + 1 < code.length) {
                    result.push(code[i + 1]);
                    i += 2;
                    continue;
                }
            } else if (config.supportsTripleQuotes && isTripleQuoted) {
                if (code.startsWith(stringDelimiter.repeat(3), i)) {
                    result.push(stringDelimiter, stringDelimiter);
                    i += 3;
                    inString = false;
                    isTripleQuoted = false;
                    stringDelimiter = '';
                    continue;
                }
            } else if (ch === stringDelimiter) {
                inString = false;
                isTemplateLiteral = false;
                stringDelimiter = '';
            }

            i += 1;
            continue;
        }

        // Not in string or comment: check for string start
        if (config.supportsTripleQuotes && (ch === `"` || ch === `'`) && code.startsWith(ch + ch + ch, i)) {
            inString = true;
            isTripleQuoted = true;
            stringDelimiter = ch;
            result.push(ch, ch, ch);
            i += 3;
            continue;
        }

        if (config.stringDelimiters.includes(ch)) {
            inString = true;
            stringDelimiter = ch;
            isTemplateLiteral = !!config.supportsTemplateLiterals && ch === '`';
            isTripleQuoted = false;
            result.push(ch);
            i += 1;
            continue;
        }

        // Check for block comments
        const blockStart = config.blockComment && config.blockComment.find(b => code.startsWith(b.start, i));
        if (blockStart) {
            inBlockComment = { end: blockStart.end };
            currentCommentLine = line;
            currentCommentText = blockStart.start;
            i += blockStart.start.length;
            continue;
        }

        // Check for line comments
        const lineToken = startsWithAny(config.lineComment);
        if (lineToken) {
            inLineComment = true;
            currentCommentLine = line;
            currentCommentText = lineToken;
            i += lineToken.length;
            continue;
        }

        // Normal character
        result.push(ch);
        i += 1;
    }

    // Flush trailing comment text if file didn't end with newline
    if (inLineComment || inBlockComment) {
        flushCommentLine();
    }

    return {
        original,
        withoutComments: result.join(''),
        removedComments
    };
}


