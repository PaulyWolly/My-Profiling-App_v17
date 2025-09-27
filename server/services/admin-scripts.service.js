console.log('*** [adminService] - run ***');
const express = require('express');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const router = express.Router();
const ScriptRun = require('../models/scriptRun.model'); // We'll create this model next
const SCRIPTS_DIR = path.join(__dirname, '../scripts');
const jwt = require('jsonwebtoken');
const { secret } = require('../config.json');
const { v4: uuidv4 } = require('uuid');
const processes = {};

// Helper function to extract token from request
function extractToken(req) {
    if (req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Bearer') {
        return req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
        return req.cookies.token;
    }
    return null;
}

// Middleware: Only allow Admin/Super-Admin
function requireAdmin(req, res, next) {
    const token = extractToken(req);
    if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
        const decoded = jwt.verify(token, secret);
        if (!['Admin', 'Super-Admin'].includes(decoded.role)) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
    }
}

// GET /api/admin/scripts - List available scripts with metadata
router.get('/', requireAdmin, (req, res) => {
  const metadataPath = path.join(SCRIPTS_DIR, 'scripts-metadata.json');
  fs.readFile(metadataPath, 'utf8', (err, data) => {
    if (err) {
      console.error('[AdminScripts] Error reading scripts-metadata.json:', err);
      return res.status(500).json({ error: err.message });
    }
    try {
      const scripts = JSON.parse(data);
      res.json(scripts);
    } catch (parseErr) {
      console.error('[AdminScripts] Error parsing scripts-metadata.json:', parseErr);
      return res.status(500).json({ error: parseErr.message });
    }
  });
});

// POST /api/admin/scripts/run - Run a script
router.post('/run', requireAdmin, (req, res) => {
  const { scriptName } = req.body;
  if (!scriptName || !scriptName.endsWith('.js')) {
    return res.status(400).json({ error: 'Invalid script name' });
  }
  const scriptPath = path.join(SCRIPTS_DIR, scriptName);
  if (!fs.existsSync(scriptPath)) {
    return res.status(404).json({ error: 'Script not found' });
  }
  const child = spawn('node', [scriptPath], { stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '', stderr = '';
  child.stdout.on('data', data => { stdout += data.toString(); });
  child.stderr.on('data', data => { stderr += data.toString(); });
  child.on('close', async (code) => {
    console.log('[AdminScripts] Script stdout:', stdout);
    console.log('[AdminScripts] Script stderr:', stderr);
    // Log the run
    await ScriptRun.create({
      script: scriptName,
      executedBy: req.user.email,
      timestamp: new Date(),
      status: code === 0 ? 'success' : 'error',
      output: stdout,
      error: stderr
    });
    res.json({ code, stdout, stderr });
  });
});

// GET /api/admin/scripts/history - List script run history
router.get('/history', requireAdmin, async (req, res) => {
  const history = await ScriptRun.find().sort({ timestamp: -1 }).limit(50);
  res.json(history);
});

// DELETE /api/admin/scripts/history/:id - Delete a script history item
router.delete('/history/:id', requireAdmin, async (req, res) => {
  try {
    const result = await ScriptRun.findByIdAndDelete(req.params.id);
    if (!result) {
      return res.status(404).json({ error: 'Script history item not found' });
    }
    res.json({ message: 'Script history item deleted successfully' });
  } catch (error) {
    console.error('[AdminScripts] Error deleting script history:', error);
    res.status(500).json({ error: 'Failed to delete script history item' });
  }
});

// POST /api/admin/scripts/interactive-run/start
router.post('/interactive-run/start', requireAdmin, (req, res) => {
  const { scriptName } = req.body;
  if (scriptName !== 'hello-user.js') {
    return res.status(400).json({ error: 'Only hello-user.js is supported in demo' });
  }
  const scriptPath = path.join(SCRIPTS_DIR, scriptName);
  if (!fs.existsSync(scriptPath)) {
    return res.status(404).json({ error: 'Script not found' });
  }
  const child = spawn('node', [scriptPath], { stdio: ['pipe', 'pipe', 'pipe'] });
  const sessionId = uuidv4();
  processes[sessionId] = child;
  let output = '';
  const onData = (data) => {
    output += data.toString();
    // If prompt detected, return it
    if (output.includes('?')) {
      child.stdout.off('data', onData);
      res.json({ sessionId, output });
    }
  };
  child.stdout.on('data', onData);
  child.stderr.on('data', (data) => {
    output += data.toString();
  });
  child.on('close', (code) => {
    delete processes[sessionId];
  });
});

// POST /api/admin/scripts/interactive-run/input
router.post('/interactive-run/input', requireAdmin, (req, res) => {
  const { sessionId, input } = req.body;
  const child = processes[sessionId];
  if (!child) {
    return res.status(400).json({ error: 'Session not found or expired' });
  }
  let output = '';
  const onData = (data) => {
    output += data.toString();
    // If output ends with newline, return it
    if (output.trim().length > 0) {
      child.stdout.off('data', onData);
      res.json({ output, done: false });
    }
  };
  child.stdout.on('data', onData);
  child.stderr.on('data', (data) => {
    output += data.toString();
  });
  child.stdin.write(input + '\n');
  child.on('close', (code) => {
    delete processes[sessionId];
    res.json({ output, done: true });
  });
});

module.exports = router; 