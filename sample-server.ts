import express from 'express';

const app = express();
const port = 3000;

// BunnyAI should detect this route!
app.get('/api/users', (req, res) => {
    res.json([{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }]);
});

// And this one too!
app.post('/api/users', (req, res) => {
    res.status(201).json({ message: 'User created' });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
