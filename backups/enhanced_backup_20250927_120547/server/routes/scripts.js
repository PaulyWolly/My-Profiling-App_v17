const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const { isAdmin } = require('../middleware/auth');

// Get list of available scripts
router.get('/list', isAdmin, async (req, res) => {
    try {
        const scriptsDir = path.join(__dirname, 'scripts');
        const files = await fs.readdir(scriptsDir);
        const scripts = files
            .filter(file => file.endsWith('.js'))
            .map(file => ({
                name: file,
                path: path.join(scriptsDir, file)
            }));
        res.json(scripts);
    } catch (error) {
        console.error('Error listing scripts:', error);
        res.status(500).json({ error: 'Failed to list scripts' });
    }
});

// Run a script
router.post('/run/:scriptName', isAdmin, async (req, res) => {
    try {
        const { scriptName } = req.params;
        const scriptPath = path.join(__dirname, 'scripts', scriptName);
        
        // Check if script exists
        try {
            await fs.access(scriptPath);
        } catch {
            return res.status(404).json({ error: 'Script not found' });
        }

        // Execute script
        const { stdout, stderr } = await execAsync(`node ${scriptPath}`);
        
        // Log execution
        const logEntry = {
            script: scriptName,
            timestamp: new Date(),
            output: stdout,
            error: stderr
        };

        // TODO: Store log entry in database

        res.json({
            success: true,
            output: stdout,
            error: stderr
        });
    } catch (error) {
        console.error('Error running script:', error);
        res.status(500).json({ error: 'Failed to run script' });
    }
});

// Get script execution history
router.get('/history', isAdmin, async (req, res) => {
    try {
        // TODO: Implement history retrieval from database
        res.json([]);
    } catch (error) {
        console.error('Error getting script history:', error);
        res.status(500).json({ error: 'Failed to get script history' });
    }
});

module.exports = router; 