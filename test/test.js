const express = require('express');
const axios = require('axios');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static('public'));

// In-memory store (Replace with a DB for long-term use)
let stats = {
    today: { commits: 0, loc: 0, files: new Set() },
    yesterday: { commits: 2, loc: 100, files: new Set(['init.js']) } 
};

// 1. WEBHOOK ENDPOINT
app.post('/webhook', async (req, res) => {
    const pushData = req.body;
    if (!pushData.commits) return res.sendStatus(200);

    for (let commit of pushData.commits) {
        stats.today.commits++;
        
        // Tracking unique files changed today
        commit.added.concat(commit.modified).forEach(f => stats.today.files.add(f));

        // OPTIONAL: Fetch real LOC (Requires GitHub Token if repo is private)
        // If you don't use a token, this may hit rate limits quickly.
        try {
            const response = await axios.get(commit.url); // GitHub Commit API
            stats.today.loc += response.data.stats.total; 
        } catch (err) {
            // Fallback: estimate LOC by file count if API fails
            stats.today.loc += (commit.added.length + commit.modified.length) * 10;
        }
    }

    console.log(`Update received! Today's LOC: ${stats.today.loc}`);
    res.status(200).send('OK');
});

// 2. DATA API FOR FRONTEND
app.get('/api/stats', (req, res) => {
    const yesterdayCommits = stats.yesterday.commits || 1;
    const diff = ((stats.today.commits - stats.yesterday.commits) / yesterdayCommits) * 100;

    res.json({
        today: {
            commits: stats.today.commits,
            loc: stats.today.loc,
            files: stats.today.files.size
        },
        yesterday: {
            commits: stats.yesterday.commits,
            loc: stats.yesterday.loc,
            files: stats.yesterday.files.size || stats.yesterday.files.length
        },
        percentChange: diff.toFixed(1)
    });
});

// 3. MIDNIGHT ROTATION LOGIC
setInterval(() => {
    const now = new Date();
    if (now.getHours() === 0 && now.getMinutes() === 0) {
        stats.yesterday = { ...stats.today, files: Array.from(stats.today.files) };
        stats.today = { commits: 0, loc: 0, files: new Set() };
    }
}, 60000);

app.listen(3000, () => console.log('Server running on http://localhost:3000'));