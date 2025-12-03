import * as fs from 'fs';
import * as path from 'path';

export interface StackFrame {
    file?: string;
    line?: number;
    column?: number;
    function?: string;
    code?: string;
}

export interface ParsedError {
    type: string;
    message: string;
    severity: 'error' | 'warning' | 'info';
    timestamp?: string;
    stackFrames: StackFrame[];
    rawTrace: string;
    repeatedPattern?: {
        count: number;
        pattern: string;
    };
}

export interface ParsedLog {
    errors: ParsedError[];
    warnings: ParsedError[];
    info: ParsedError[];
    summary: {
        totalErrors: number;
        totalWarnings: number;
        uniqueErrors: number;
        timeRange?: {
            start: string;
            end: string;
        };
    };
}

export class LogParser {
    parseLogFile(filePath: string): ParsedLog {
        const content = fs.readFileSync(filePath, 'utf-8');
        return this.parseLogContent(content, filePath);
    }

    parseLogContent(content: string, sourcePath?: string): ParsedLog {
        const lines = content.split('\n');
        const errors: ParsedError[] = [];
        const warnings: ParsedError[] = [];
        const info: ParsedError[] = [];
        const timestamps: string[] = [];

        let i = 0;
        while (i < lines.length) {
            // Try to parse different log formats
            const nodeError = this.parseNodeStackTrace(lines, i);
            if (nodeError) {
                errors.push(nodeError);
                // Skip all lines that were part of this stack trace
                const linesParsed = nodeError.rawTrace.split('\n').length;
                i += linesParsed;
                continue;
            }

            const pythonError = this.parsePythonTraceback(lines, i);
            if (pythonError) {
                errors.push(pythonError);
                // Skip all lines that were part of this traceback
                const linesParsed = pythonError.rawTrace.split('\n').length;
                i += linesParsed;
                continue;
            }

            const javaError = this.parseJavaException(lines, i);
            if (javaError) {
                errors.push(javaError);
                // Skip all lines that were part of this exception
                const linesParsed = javaError.rawTrace.split('\n').length;
                i += linesParsed;
                continue;
            }

            const goError = this.parseGoPanic(lines, i);
            if (goError) {
                errors.push(goError);
                // Skip all lines that were part of this panic
                const linesParsed = goError.rawTrace.split('\n').length;
                i += linesParsed;
                continue;
            }

            const dockerLog = this.parseDockerLog(lines[i]);
            if (dockerLog) {
                if (dockerLog.severity === 'error') {
                    errors.push(dockerLog);
                } else if (dockerLog.severity === 'warning') {
                    warnings.push(dockerLog);
                } else {
                    info.push(dockerLog);
                }
                if (dockerLog.timestamp) {
                    timestamps.push(dockerLog.timestamp);
                }
            }

            i++;
        }

        // Detect repeated patterns
        const errorPatterns = this.detectRepeatedPatterns(errors);
        errorPatterns.forEach((pattern, error) => {
            error.repeatedPattern = pattern;
        });

        // Calculate time range
        const timeRange = timestamps.length > 0
            ? {
                start: timestamps[0],
                end: timestamps[timestamps.length - 1]
            }
            : undefined;

        return {
            errors,
            warnings,
            info,
            summary: {
                totalErrors: errors.length,
                totalWarnings: warnings.length,
                uniqueErrors: new Set(errors.map(e => `${e.type}:${e.message}`)).size,
                timeRange
            }
        };
    }

    private parseNodeStackTrace(lines: string[], startIndex: number): ParsedError | null {
        if (startIndex >= lines.length) return null;

        const line = lines[startIndex];
        
        // Match: Error: message or TypeError: message
        const errorMatch = line.match(/^(\w+Error|Error):\s*(.+)$/);
        if (!errorMatch) return null;

        const errorType = errorMatch[1];
        const errorMessage = errorMatch[2];
        const stackFrames: StackFrame[] = [];
        let i = startIndex + 1;

        // Parse stack frames: "    at function (file:line:column)"
        while (i < lines.length && i < startIndex + 50) {
            const frameLine = lines[i].trim();
            if (!frameLine.startsWith('at ')) break;

            const frameMatch = frameLine.match(/at\s+(?:async\s+)?(?:(\S+)\s+\()?([^(]+)(?:\(([^)]+)\))?/);
            if (frameMatch) {
                const functionName = frameMatch[1] || '<anonymous>';
                const location = frameMatch[2] || frameMatch[3] || '';
                
                // Parse file:line:column
                const locationMatch = location.match(/(.+):(\d+):(\d+)/);
                if (locationMatch) {
                    stackFrames.push({
                        function: functionName,
                        file: locationMatch[1],
                        line: parseInt(locationMatch[2], 10),
                        column: parseInt(locationMatch[3], 10)
                    });
                } else if (location) {
                    stackFrames.push({
                        function: functionName,
                        file: location
                    });
                }
            }
            i++;
        }

        const rawTrace = lines.slice(startIndex, i).join('\n');

        return {
            type: errorType,
            message: errorMessage,
            severity: 'error',
            stackFrames,
            rawTrace
        };
    }

    private parsePythonTraceback(lines: string[], startIndex: number): ParsedError | null {
        if (startIndex >= lines.length) return null;

        const line = lines[startIndex];
        if (!line.includes('Traceback (most recent call last):')) return null;

        const stackFrames: StackFrame[] = [];
        let errorType = 'Exception';
        let errorMessage = '';
        let i = startIndex + 1;
        let errorLineIndex = -1;

        // Parse stack frames: "  File "path", line X, in function"
        // Note: Python tracebacks have code lines between File lines, skip those
        while (i < lines.length && i < startIndex + 100) {
            const frameLine = lines[i].trim();
            
            if (frameLine.startsWith('File ')) {
                const fileMatch = frameLine.match(/File\s+"([^"]+)",\s+line\s+(\d+)(?:,\s+in\s+(\S+))?/);
                if (fileMatch) {
                    stackFrames.push({
                        file: fileMatch[1],
                        line: parseInt(fileMatch[2], 10),
                        function: fileMatch[3] || '<module>'
                    });
                }
                i++;
                // Skip the next line if it's code (indented but not starting with File)
                if (i < lines.length && lines[i].trim() && !lines[i].trim().startsWith('File ') && !lines[i].trim().match(/^\w+Error:|^\w+Exception:/)) {
                    i++;
                }
            } else if (frameLine.match(/^\w+Error:|^\w+Exception:/)) {
                const errorMatch = frameLine.match(/^(\w+(?:Error|Exception)):\s*(.+)$/);
                if (errorMatch) {
                    errorType = errorMatch[1];
                    errorMessage = errorMatch[2];
                    errorLineIndex = i;
                }
                break;
            } else {
                // Skip code lines or other content
                i++;
            }
        }

        // If we found an error but no frames, still return the error
        if (errorLineIndex === -1 && stackFrames.length === 0) return null;

        const endIndex = errorLineIndex !== -1 ? errorLineIndex + 1 : i;
        const rawTrace = lines.slice(startIndex, endIndex).join('\n');

        return {
            type: errorType,
            message: errorMessage || 'Unknown error',
            severity: 'error',
            stackFrames,
            rawTrace
        };
    }

    private parseJavaException(lines: string[], startIndex: number): ParsedError | null {
        if (startIndex >= lines.length) return null;

        const line = lines[startIndex];
        const exceptionMatch = line.match(/^(\w+(?:\.\w+)*(?:Exception|Error)):\s*(.+)$/);
        if (!exceptionMatch) return null;

        const errorType = exceptionMatch[1];
        const errorMessage = exceptionMatch[2];
        const stackFrames: StackFrame[] = [];
        let i = startIndex + 1;

        // Parse stack frames: "    at package.Class.method(File.java:123)"
        while (i < lines.length && i < startIndex + 100) {
            const frameLine = lines[i].trim();
            if (!frameLine.startsWith('at ')) break;

            const frameMatch = frameLine.match(/at\s+([^(]+)\(([^:]+):(\d+)\)/);
            if (frameMatch) {
                const methodName = frameMatch[1].trim();
                const file = frameMatch[2];
                const line = parseInt(frameMatch[3], 10);

                stackFrames.push({
                    function: methodName,
                    file: file,
                    line: line
                });
            }
            i++;
        }

        const rawTrace = lines.slice(startIndex, i).join('\n');

        return {
            type: errorType,
            message: errorMessage,
            severity: 'error',
            stackFrames,
            rawTrace
        };
    }

    private parseGoPanic(lines: string[], startIndex: number): ParsedError | null {
        if (startIndex >= lines.length) return null;

        const line = lines[startIndex];
        if (!line.includes('panic:')) return null;

        const panicMatch = line.match(/panic:\s*(.+)$/);
        if (!panicMatch) return null;

        const errorMessage = panicMatch[1];
        const stackFrames: StackFrame[] = [];
        let i = startIndex + 1;

        // Parse stack frames: "goroutine X [running]:\n\tpackage.function(...)\n\t\t/path/to/file.go:123 +0x456"
        while (i < lines.length && i < startIndex + 100) {
            const frameLine = lines[i].trim();
            
            if (frameLine.match(/^\w+\.\w+\(/)) {
                const functionMatch = frameLine.match(/^(\w+\.\w+)\(/);
                const functionName = functionMatch ? functionMatch[1] : '<unknown>';
                
                // Next line should have file:line
                if (i + 1 < lines.length) {
                    const locationLine = lines[i + 1].trim();
                    const locationMatch = locationLine.match(/^(.+):(\d+)/);
                    if (locationMatch) {
                        stackFrames.push({
                            function: functionName,
                            file: locationMatch[1],
                            line: parseInt(locationMatch[2], 10)
                        });
                        i++; // Skip location line
                    }
                }
            }
            i++;
        }

        const rawTrace = lines.slice(startIndex, i).join('\n');

        return {
            type: 'panic',
            message: errorMessage,
            severity: 'error',
            stackFrames,
            rawTrace
        };
    }

    private parseDockerLog(line: string): ParsedError | null {
        // Docker log format: timestamp level message
        const dockerMatch = line.match(/^(\d{4}-\d{2}-\d{2}T[\d:.-]+Z)\s+(\w+)\s+(.+)$/);
        if (dockerMatch) {
            const timestamp = dockerMatch[1];
            const level = dockerMatch[2].toLowerCase();
            const message = dockerMatch[3];

            let severity: 'error' | 'warning' | 'info' = 'info';
            if (level === 'error' || level === 'fatal') {
                severity = 'error';
            } else if (level === 'warn' || level === 'warning') {
                severity = 'warning';
            }

            return {
                type: 'Docker Log',
                message: message,
                severity: severity,
                timestamp: timestamp,
                stackFrames: [],
                rawTrace: line
            };
        }

        return null;
    }

    private detectRepeatedPatterns(errors: ParsedError[]): Map<ParsedError, { count: number; pattern: string }> {
        const patterns = new Map<string, ParsedError[]>();
        
        errors.forEach(error => {
            const key = `${error.type}:${error.message}`;
            if (!patterns.has(key)) {
                patterns.set(key, []);
            }
            patterns.get(key)!.push(error);
        });

        const result = new Map<ParsedError, { count: number; pattern: string }>();
        patterns.forEach((errorList, pattern) => {
            if (errorList.length > 1) {
                errorList.forEach(error => {
                    result.set(error, {
                        count: errorList.length,
                        pattern: pattern
                    });
                });
            }
        });

        return result;
    }

    /**
     * Find the first stack frame that points to a file in the workspace
     */
    findWorkspaceFile(stackFrames: StackFrame[], workspacePath: string): StackFrame | null {
        for (const frame of stackFrames) {
            if (frame.file) {
                // Try to resolve relative to workspace
                const resolvedPath = path.isAbsolute(frame.file)
                    ? frame.file
                    : path.join(workspacePath, frame.file);
                
                if (fs.existsSync(resolvedPath)) {
                    return {
                        ...frame,
                        file: resolvedPath
                    };
                }

                // Try just the filename
                const fileName = path.basename(frame.file);
                const files = this.findFilesInWorkspace(workspacePath, fileName);
                if (files.length > 0) {
                    return {
                        ...frame,
                        file: files[0]
                    };
                }
            }
        }
        return null;
    }

    private findFilesInWorkspace(workspacePath: string, fileName: string): string[] {
        const results: string[] = [];
        
        try {
            const files = fs.readdirSync(workspacePath, { recursive: true });
            for (const file of files) {
                if (typeof file === 'string' && path.basename(file) === fileName) {
                    results.push(path.join(workspacePath, file));
                }
            }
        } catch {
            // Ignore errors
        }

        return results;
    }
}

