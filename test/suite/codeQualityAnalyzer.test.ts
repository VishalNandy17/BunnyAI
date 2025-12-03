import * as assert from 'assert';
import { CodeQualityAnalyzer } from '../../src/analysis/codeQualityAnalyzer';

suite('Code Quality Analyzer Suite', () => {
    let analyzer: CodeQualityAnalyzer;

    setup(() => {
        analyzer = new CodeQualityAnalyzer();
    });

    test('analyzes simple function with low complexity', () => {
        const code = `
            function add(a: number, b: number) {
                return a + b;
            }
        `;

        const report = analyzer.analyzeCode(code, 'simple.ts');
        assert.strictEqual(report.functions.length, 1);
        const metric = report.functions[0];
        assert.strictEqual(metric.name, 'add');
        assert.strictEqual(metric.cyclomatic, 1);
        assert.ok(metric.loc >= 3);
        assert.strictEqual(metric.maintainability, 'A');
    });

    test('captures deeply nested branching for higher complexity', () => {
        const code = `
            function complex(x: number) {
                if (x > 0) {
                    for (let i = 0; i < x; i++) {
                        if (i % 2 === 0) {
                            while (x--) {
                                x = condition ? x - 1 : x + 1;
                            }
                        } else {
                            switch(i) {
                                case 0:
                                    x++;
                                    break;
                                case 1:
                                    x--;
                                    break;
                                default:
                                    x += i;
                            }
                        }
                    }
                } else if (x < 0) {
                    return Math.abs(x);
                }
                return x;
            }
        `;

        const report = analyzer.analyzeCode(code, 'complex.ts');
        const metric = report.functions.find((f) => f.name === 'complex');
        assert.ok(metric, 'complex function metric missing');
        assert.ok(metric!.cyclomatic >= 6);
        assert.ok(metric!.nestingDepth >= 3);
        assert.ok(['C', 'D', 'E', 'F'].includes(metric!.maintainability));
    });

    test('handles multiple functions and summary stats', () => {
        const code = `
            const fnA = () => {
                return 1;
            };

            function fnB() {
                if (true) {
                    return 2;
                }
                return 3;
            }

            const fnC = function(value: number) {
                try {
                    if (value) {
                        return value;
                    }
                } catch (err) {
                    return -1;
                }
                return 0;
            };
        `;

        const report = analyzer.analyzeCode(code, 'multi.ts');
        assert.strictEqual(report.functions.length, 3);
        assert.ok(report.summary.avgCyclomatic > 0);
        assert.ok(report.summary.maxCyclomatic >= 1);
        assert.ok(report.summary.worstFunction);
    });
});


