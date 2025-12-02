import * as assert from 'assert';
import { ExpressParser } from '../../src/parsers/ExpressParser';

suite('Express Parser Test Suite', () => {
    let parser: ExpressParser;

    setup(() => {
        parser = new ExpressParser();
    });

    test('Should parse basic GET route', async () => {
        const code = `
            app.get('/users', (req, res) => {
                res.json({ users: [] });
            });
        `;

        const routes = await parser.parse(code);
        assert.strictEqual(routes.length, 1);
        assert.strictEqual(routes[0].method, 'GET');
        assert.strictEqual(routes[0].path, '/users');
    });

    test('Should parse POST route', async () => {
        const code = `
            app.post('/users', createUser);
        `;

        const routes = await parser.parse(code);
        assert.strictEqual(routes.length, 1);
        assert.strictEqual(routes[0].method, 'POST');
        assert.strictEqual(routes[0].path, '/users');
    });

    test('Should parse route with parameters', async () => {
        const code = `
            app.get('/users/:id', getUserById);
        `;

        const routes = await parser.parse(code);
        assert.strictEqual(routes.length, 1);
        assert.strictEqual(routes[0].method, 'GET');
        assert.strictEqual(routes[0].path, '/users/:id');
        assert.ok(routes[0].params?.includes('id'));
    });

    test('Should parse multiple routes', async () => {
        const code = `
            app.get('/users', getUsers);
            app.post('/users', createUser);
            app.put('/users/:id', updateUser);
            app.delete('/users/:id', deleteUser);
        `;

        const routes = await parser.parse(code);
        assert.strictEqual(routes.length, 4);
    });

    test('Should parse template string routes', async () => {
        const code = `
            app.get(\`/users/\${userId}\`, getUser);
        `;

        const routes = await parser.parse(code);
        assert.strictEqual(routes.length, 1);
        assert.ok(routes[0].path.includes('/users'));
    });

    test('Should handle routes with middleware array', async () => {
        const code = `
            app.get('/users', auth, getUsers);
        `;

        const routes = await parser.parse(code);
        assert.strictEqual(routes.length, 1);
        assert.strictEqual(routes[0].method, 'GET');
    });

    test('Should remove duplicate routes', async () => {
        const code = `
            app.get('/users', getUsers);
            app.get('/users', getUsers);
        `;

        const routes = await parser.parse(code);
        assert.strictEqual(routes.length, 1);
    });

    test('Should parse PATCH route', async () => {
        const code = `
            app.patch('/users/:id', updateUser);
        `;

        const routes = await parser.parse(code);
        assert.strictEqual(routes.length, 1);
        assert.strictEqual(routes[0].method, 'PATCH');
    });

    test('Should parse DELETE route', async () => {
        const code = `
            app.delete('/users/:id', deleteUser);
        `;

        const routes = await parser.parse(code);
        assert.strictEqual(routes.length, 1);
        assert.strictEqual(routes[0].method, 'DELETE');
    });

    test('Should handle empty code gracefully', async () => {
        const routes = await parser.parse('');
        assert.strictEqual(routes.length, 0);
    });

    test('Should handle invalid code gracefully', async () => {
        const code = 'invalid javascript code {{{';
        const routes = await parser.parse(code);
        // Should return empty array or handle gracefully
        assert.ok(Array.isArray(routes));
    });
});


