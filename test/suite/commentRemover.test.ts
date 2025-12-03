import * as assert from 'assert';
import { removeComments } from '../../src/analysis/commentRemover';

suite('Comment Remover Suite', () => {
    test('preserves comment-like text inside strings (JS/TS)', () => {
        const code = `
            const url = "http://example.com"; // trailing comment
            const notComment = "// inside string";
        `;

        const result = removeComments(code, 'typescript');
        assert.ok(result.withoutComments.includes('http://example.com'));
        assert.ok(result.withoutComments.includes('"// inside string"'));
        assert.strictEqual(result.removedComments.length, 1);
    });

    test('handles mixed line and block comments (C-style)', () => {
        const code = `
            int main() {
                // line comment
                int x = 0; /* inline block comment */
                /*
                    multi-line
                    block comment
                */
                return x;
            }
        `;

        const result = removeComments(code, 'cpp');
        assert.ok(!result.withoutComments.includes('// line comment'));
        assert.ok(!result.withoutComments.includes('inline block comment'));
        assert.ok(!result.withoutComments.includes('multi-line'));
        assert.ok(result.removedComments.length >= 3);
    });

    test('python: # in strings is preserved, comments removed', () => {
        const code = `
            text = "# not a comment"
            value = 42  # real comment
        `;

        const result = removeComments(code, 'python');
        assert.ok(result.withoutComments.includes('"# not a comment"'));
        assert.ok(!result.withoutComments.includes('# real comment'));
        assert.strictEqual(result.removedComments.length, 1);
    });

    test('shell: # in strings is preserved, comments removed', () => {
        const code = `
            echo "value # not comment" # real comment
        `;

        const result = removeComments(code, 'shellscript');
        assert.ok(result.withoutComments.includes('"value # not comment"'));
        assert.ok(!result.withoutComments.trim().endsWith('# real comment'));
        assert.strictEqual(result.removedComments.length, 1);
    });

    test('HTML with inline script: strips HTML comments without breaking scripts', () => {
        const code = `
            <!-- page-level comment -->
            <script>
                const x = "// not a comment string"; // JS comment should remain
            </script>
        `;

        const result = removeComments(code, 'html');
        assert.ok(!result.withoutComments.includes('page-level comment'));
        assert.ok(result.withoutComments.includes('// JS comment should remain'));
        assert.ok(result.withoutComments.includes('"// not a comment string"'));
        assert.strictEqual(result.removedComments.length, 1);
    });
});


