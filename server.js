require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Parse JSON bodies
app.use(express.json());

// Serve static files from the my-site directory
app.use(express.static(path.join(__dirname)));

// Route /api/* to serverless functions in api/
app.post('/api/chat', require('./api/chat'));
app.post('/api/generate-proposal', require('./api/generate-proposal'));

app.listen(PORT, () => {
  console.log(`EDRA server running at http://localhost:${PORT}`);
});
