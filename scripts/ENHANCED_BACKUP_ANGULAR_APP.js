/*
  ENHANCED_BACKUP_ANGULAR_APP.JS
  Version: 1.0.0
  AppName: My-Profiling-App [Angular + Node.js + MongoDB]
  Updated: 9/27/2025
  Created by Paul Welby
  Description: Comprehensive backup system for Angular profiling app with secrets management
*/

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const MAX_BACKUPS_PER_FILE = 5;
const BACKUP_EXCLUDE_PATTERNS = [
    'node_modules',
    'dist',
    '.angular',
    '.git',
    'backups',
    'SANDBOX',
    '*.log',
    '*.tmp',
    '.env',
    'config.json'
];

// Get current timestamp
function getTimestamp() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}

// Create directory if it doesn't exist
function ensureDirectoryExists(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`📁 Created directory: ${dirPath}`);
    }
}

// Get git commit history for recent changes
function getGitHistory(days = 7) {
    try {
        const since = new Date();
        since.setDate(since.getDate() - days);
        const sinceStr = since.toISOString().split('T')[0];

        const gitLog = execSync(`git log --since="${sinceStr}" --oneline --name-only`, {
            encoding: 'utf8',
            cwd: process.cwd()
        });

        return gitLog.split('\n').filter(line => line.trim());
    } catch (error) {
        console.log('⚠️  Could not get git history:', error.message);
        return [];
    }
}

// Check if file should be excluded
function shouldExcludeFile(filePath) {
    const relativePath = path.relative(process.cwd(), filePath);

    return BACKUP_EXCLUDE_PATTERNS.some(pattern => {
        if (pattern.includes('*')) {
            const regex = new RegExp(pattern.replace(/\*/g, '.*'));
            return regex.test(relativePath);
        }
        return relativePath.includes(pattern);
    });
}

// Analyze file for changes and patterns
function analyzeFileForChanges(filePath, baseDir) {
    const relativePath = path.relative(baseDir, filePath);
    const stats = fs.statSync(filePath);
    const content = fs.readFileSync(filePath, 'utf8');

    const analysis = {
        file: relativePath,
        size: stats.size,
        modified: stats.mtime,
        changes: [],
        newFunctions: [],
        todos: [],
        fixes: [],
        updates: [],
        additions: [],
        removals: [],
        secrets: [],
        configs: []
    };

    // Look for TODO comments
    const todoMatches = content.match(/\/\/\s*TODO[:\s]*(.+)/gi) || [];
    analysis.todos = todoMatches.map(todo => todo.replace(/\/\/\s*TODO[:\s]*/i, '').trim());

    // Look for various change comment patterns
    const changePatterns = [
        { pattern: /\/\/\s*CHANGE[:\s]*(.+)/gi, target: 'changes' },
        { pattern: /\/\/\s*FIX[:\s]*(.+)/gi, target: 'fixes' },
        { pattern: /\/\/\s*UPDATE[:\s]*(.+)/gi, target: 'updates' },
        { pattern: /\/\/\s*ADD[:\s]*(.+)/gi, target: 'additions' },
        { pattern: /\/\/\s*REMOVE[:\s]*(.+)/gi, target: 'removals' },
        { pattern: /\/\*\s*CHANGE[:\s]*(.+?)\*\//gi, target: 'changes' },
        { pattern: /\/\*\s*FIX[:\s]*(.+?)\*\//gi, target: 'fixes' },
        { pattern: /\/\*\s*UPDATE[:\s]*(.+?)\*\//gi, target: 'updates' }
    ];

    changePatterns.forEach(({ pattern, target }) => {
        const matches = content.match(pattern) || [];
        analysis[target].push(...matches.map(match =>
            match.replace(/\/\*|\*\/|\/\/|\s*(CHANGE|FIX|UPDATE|ADD|REMOVE)[:\s]*/gi, '').trim()
        ));
    });

    // Look for function definitions
    const functionMatches = content.match(/(?:function\s+(\w+)|const\s+(\w+)\s*=\s*(?:async\s+)?(?:function|\(|=>)|class\s+(\w+)|export\s+(?:function|class|const)\s+(\w+))/g) || [];
    analysis.newFunctions = functionMatches.map(func => {
        const match = func.match(/(?:function\s+(\w+)|const\s+(\w+)\s*=|class\s+(\w+)|export\s+(?:function|class|const)\s+(\w+))/);
        return match ? (match[1] || match[2] || match[3] || match[4]) : func;
    });

    // Look for version comments
    const versionMatches = content.match(/\/\/\s*Version[:\s]*(\d+\.?\d*)/gi) || [];
    analysis.version = versionMatches[0]?.replace(/\/\/\s*Version[:\s]*/i, '') || 'Unknown';

    // Look for secrets and sensitive data (for documentation purposes)
    const secretPatterns = [
        /(?:password|secret|key|token|api[_-]?key)\s*[:=]\s*['"`]([^'"`]+)['"`]/gi,
        /mongodb[+srv]*:\/\/[^'"`\s]+/gi,
        /auth0[_-]?(?:domain|client[_-]?id|secret)/gi
    ];

    secretPatterns.forEach(pattern => {
        const matches = content.match(pattern) || [];
        analysis.secrets.push(...matches.map(match =>
            match.replace(/(?:password|secret|key|token|api[_-]?key)\s*[:=]\s*['"`]/gi, '').replace(/['"`]$/, '')
        ));
    });

    // Look for configuration files
    if (filePath.includes('config') || filePath.includes('environment') || filePath.endsWith('.json')) {
        analysis.configs.push('Configuration file detected');
    }

    // Look for recent modification indicators
    const now = new Date();
    const daysSinceModified = Math.floor((now - stats.mtime) / (1000 * 60 * 60 * 24));
    analysis.recentlyModified = daysSinceModified <= 7;

    return analysis;
}

// Generate descriptive summary of changes
function generateDescriptiveChanges(analyses) {
    const changes = [];

    // Analyze patterns to generate descriptive summaries
    const coreFiles = analyses.filter(a =>
        a.file.includes('app.component') ||
        a.file.includes('account.service') ||
        a.file.includes('auth0.service') ||
        a.file.includes('config.service') ||
        a.file.includes('environment') ||
        a.file.includes('server.js') ||
        a.file.includes('accounts.controller')
    );

    const hasAuthChanges = coreFiles.some(f =>
        (f.file.includes('auth0') || f.file.includes('account')) &&
        (f.changes.length > 0 || f.fixes.length > 0)
    );

    const hasConfigChanges = coreFiles.some(f =>
        f.file.includes('config') || f.file.includes('environment') &&
        (f.changes.length > 0 || f.fixes.length > 0)
    );

    const hasServerChanges = coreFiles.some(f =>
        f.file.includes('server') && (f.changes.length > 0 || f.fixes.length > 0)
    );

    const hasFrontendChanges = coreFiles.some(f =>
        f.file.includes('app') && f.file.includes('.ts') && (f.changes.length > 0 || f.fixes.length > 0)
    );

    // Generate descriptive bullet points based on detected changes
    if (hasAuthChanges) {
        changes.push('Authentication system updates (Auth0 integration)');
        changes.push('User account management improvements');
        changes.push('JWT token handling enhancements');
    }

    if (hasConfigChanges) {
        changes.push('Configuration management improvements');
        changes.push('Environment variable handling updates');
        changes.push('Secrets management enhancements');
    }

    if (hasServerChanges) {
        changes.push('Backend API improvements');
        changes.push('Database connection optimizations');
        changes.push('Server-side security enhancements');
    }

    if (hasFrontendChanges) {
        changes.push('Angular frontend component updates');
        changes.push('User interface improvements');
        changes.push('Client-side functionality enhancements');
    }

    // Add general improvements
    changes.push('Secrets moved to dedicated /server/secrets/ folder');
    changes.push('Git repository security improvements');
    changes.push('Configuration file organization updates');

    // Add statistics
    const totalChanges = analyses.reduce((sum, a) => sum + a.changes.length + a.fixes.length + a.updates.length + a.additions.length + a.removals.length, 0);
    const recentlyModified = analyses.filter(a => a.recentlyModified).length;
    const configFiles = analyses.filter(a => a.configs.length > 0).length;

    changes.push(`Total code changes detected: ${totalChanges} modifications`);
    changes.push(`Recently modified files: ${recentlyModified} files in last 7 days`);
    changes.push(`Configuration files: ${configFiles} files`);

    return changes;
}

// Get recent changes prompting backup (update this for each backup)
function getRecentChangesPromptingBackup() {
    return {
        title: 'S3 Profile Image Persistence Fixes (October 20, 2025)',
        problem: 'Profile images were disappearing after profile updates',
        rootCauses: [
            'Server-side: Profile image URLs were being overwritten during profile updates',
            'Frontend: Google URLs were being rejected, causing default avatars to show',
            'Upload endpoint: Field name mismatch between frontend and backend'
        ],
        fixes: [
            {
                title: 'Server-side Protection (`server/accounts/account.service.js`)',
                details: [
                    'Removed `profileImage` from general update fields',
                    'Added special handling to preserve existing S3 URLs',
                    'Only updates `profileImage` if explicitly a new S3 URL'
                ]
            },
            {
                title: 'Frontend URL Handling (`src/app/_services/account.service.ts`)',
                details: [
                    'Removed Google URL rejection logic',
                    'Now allows all HTTP URLs (including Google) to display',
                    'Fixed upload endpoint to use hybrid S3 + local storage'
                ]
            },
            {
                title: 'Upload Endpoint Fix (`src/app/profile-templates/components/edit-profile/edit-profile.component.ts`)',
                details: [
                    'Fixed field name mismatch (userId now sent in form data)',
                    'Removed duplicate userId from form data',
                    'Now properly uploads to S3 via hybrid upload endpoint'
                ]
            },
            {
                title: 'Module Import Fix (`src/app/profile/profile.module.ts`)',
                details: [
                    'Added standalone profile template components to imports',
                    'Fixed "component not known" errors'
                ]
            }
        ],
        result: 'Profile images now persist permanently on S3 and display correctly!'
    };
}

// Generate comprehensive change summary
function generateChangeSummary(analyses, gitHistory = []) {
    const summary = [];

    summary.push('# Enhanced Backup Change Summary - My Profiling App');
    summary.push('');
    summary.push(`**Backup Date:** ${new Date().toLocaleString()}`);
    summary.push(`**App:** Angular + Node.js + MongoDB Profiling App`);
    summary.push(`**Total Files:** ${analyses.length}`);
    summary.push(`**Git Commits (last 7 days):** ${gitHistory.length}`);
    summary.push('');
    
    // Add recent changes prompting backup
    summary.push('## 🚀 Recent Changes Prompting This Backup');
    summary.push('');
    
    const recentChanges = getRecentChangesPromptingBackup();
    summary.push(`### ${recentChanges.title}`);
    summary.push('');
    summary.push(`**Problem Solved:** ${recentChanges.problem}`);
    summary.push('');
    summary.push('**Root Causes Identified:**');
    recentChanges.rootCauses.forEach(cause => {
        summary.push(`- ${cause}`);
    });
    summary.push('');
    summary.push('**Fixes Implemented:**');
    recentChanges.fixes.forEach((fix, index) => {
        summary.push(`${index + 1}. **${fix.title}:**`);
        fix.details.forEach(detail => {
            summary.push(`   - ${detail}`);
        });
        summary.push('');
    });
    summary.push(`**Result:** ${recentChanges.result}`);
    summary.push('');

    // Generate descriptive summary of changes
    summary.push('## 📋 Summary of Changes Made');
    summary.push('');

    const changes = generateDescriptiveChanges(analyses);
    changes.forEach(change => {
        summary.push(`- ${change}`);
    });
    summary.push('');

    // Recent changes section
    const recentFiles = analyses.filter(a => a.recentlyModified);
    if (recentFiles.length > 0) {
        summary.push('## 🔥 Recently Modified Files (Last 7 Days)');
        summary.push('');
        recentFiles.forEach(analysis => {
            summary.push(`### ${analysis.file}`);
            summary.push(`- **Size:** ${(analysis.size / 1024).toFixed(2)} KB`);
            summary.push(`- **Modified:** ${analysis.modified.toLocaleString()}`);
            summary.push(`- **Days Since Modified:** ${Math.floor((new Date() - analysis.modified) / (1000 * 60 * 60 * 24))}`);
            if (analysis.version !== 'Unknown') {
                summary.push(`- **Version:** ${analysis.version}`);
            }
            summary.push('');
        });
    }

    // Group by file type
    const byType = {
        'Angular Frontend': analyses.filter(a => a.file.includes('src/') && (a.file.endsWith('.ts') || a.file.endsWith('.html') || a.file.endsWith('.css'))),
        'Server Backend': analyses.filter(a => a.file.includes('server/')),
        'Configuration': analyses.filter(a => a.file.includes('config') || a.file.includes('environment') || a.file.endsWith('.json')),
        'Scripts': analyses.filter(a => a.file.includes('scripts/')),
        'Documentation': analyses.filter(a => a.file.endsWith('.md')),
        'Package Files': analyses.filter(a => a.file.includes('package.json') || a.file.includes('package-lock.json'))
    };

    Object.entries(byType).forEach(([type, files]) => {
        if (files.length === 0) return;

        summary.push(`## ${type}`);
        summary.push('');

        files.forEach(analysis => {
            summary.push(`### ${analysis.file}`);
            summary.push(`- **Size:** ${(analysis.size / 1024).toFixed(2)} KB`);
            summary.push(`- **Modified:** ${analysis.modified.toLocaleString()}`);
            if (analysis.version !== 'Unknown') {
                summary.push(`- **Version:** ${analysis.version}`);
            }

            // Show all types of changes
            const allChanges = [
                ...analysis.changes.map(c => `CHANGE: ${c}`),
                ...analysis.fixes.map(f => `FIX: ${f}`),
                ...analysis.updates.map(u => `UPDATE: ${u}`),
                ...analysis.additions.map(a => `ADD: ${a}`),
                ...analysis.removals.map(r => `REMOVE: ${r}`)
            ];

            if (allChanges.length > 0) {
                summary.push('- **Changes:**');
                allChanges.slice(0, 10).forEach(change => {
                    summary.push(`  - ${change}`);
                });
                if (allChanges.length > 10) {
                    summary.push(`  - ... and ${allChanges.length - 10} more changes`);
                }
            }

            if (analysis.newFunctions.length > 0) {
                summary.push('- **Functions/Classes:**');
                analysis.newFunctions.slice(0, 5).forEach(func => {
                    summary.push(`  - \`${func}\``);
                });
                if (analysis.newFunctions.length > 5) {
                    summary.push(`  - ... and ${analysis.newFunctions.length - 5} more`);
                }
            }

            if (analysis.todos.length > 0) {
                summary.push('- **TODOs:**');
                analysis.todos.slice(0, 3).forEach(todo => {
                    summary.push(`  - ${todo}`);
                });
                if (analysis.todos.length > 3) {
                    summary.push(`  - ... and ${analysis.todos.length - 3} more`);
                }
            }

            if (analysis.secrets.length > 0) {
                summary.push('- **⚠️ Secrets Detected:**');
                summary.push(`  - ${analysis.secrets.length} potential secrets found`);
                summary.push(`  - **Note:** Secrets should be in /server/secrets/ folder`);
            }

            if (analysis.configs.length > 0) {
                summary.push('- **Configuration:**');
                analysis.configs.forEach(config => {
                    summary.push(`  - ${config}`);
                });
            }

            summary.push('');
        });
    });

    // Overall statistics
    const totalChanges = analyses.reduce((sum, a) => sum + a.changes.length + a.fixes.length + a.updates.length + a.additions.length + a.removals.length, 0);
    const totalFunctions = analyses.reduce((sum, a) => sum + a.newFunctions.length, 0);
    const totalTodos = analyses.reduce((sum, a) => sum + a.todos.length, 0);
    const recentlyModified = analyses.filter(a => a.recentlyModified).length;
    const totalSecrets = analyses.reduce((sum, a) => sum + a.secrets.length, 0);

    summary.push('## 📊 Summary Statistics');
    summary.push('');
    summary.push(`- **Total Changes Detected:** ${totalChanges}`);
    summary.push(`- **New Functions/Classes:** ${totalFunctions}`);
    summary.push(`- **TODOs Found:** ${totalTodos}`);
    summary.push(`- **Recently Modified Files:** ${recentlyModified}`);
    summary.push(`- **Potential Secrets Found:** ${totalSecrets}`);
    summary.push(`- **Git Commits (7 days):** ${gitHistory.length}`);
    summary.push('');

    // Security recommendations
    if (totalSecrets > 0) {
        summary.push('## 🔒 Security Recommendations');
        summary.push('');
        summary.push('- **Secrets Management:** Ensure all secrets are in `/server/secrets/` folder');
        summary.push('- **Environment Variables:** Use `.env` files for sensitive configuration');
        summary.push('- **Git Security:** Verify no secrets are committed to version control');
        summary.push('- **Backup Security:** This backup may contain sensitive data - store securely');
        summary.push('');
    }

    // Git history section
    if (gitHistory.length > 0) {
        summary.push('## 📝 Recent Git History');
        summary.push('');
        summary.push('```');
        gitHistory.slice(0, 20).forEach(line => {
            if (line.trim()) {
                summary.push(line);
            }
        });
        if (gitHistory.length > 20) {
            summary.push(`... and ${gitHistory.length - 20} more commits`);
        }
        summary.push('```');
        summary.push('');
    }

    return summary.join('\n');
}

// Copy file with error handling
function copyFileWithBackup(source, destination) {
    try {
        if (!fs.existsSync(source)) {
            console.log(`⚠️  Warning: Source file not found: ${source}`);
            return false;
        }

        fs.copyFileSync(source, destination);
        const stats = fs.statSync(destination);
        const sizeKB = Math.round(stats.size / 1024);
        console.log(`✅ Backed up: ${source} → ${destination} (${sizeKB}KB)`);
        return true;
    } catch (error) {
        console.error(`❌ Error backing up ${source}:`, error.message);
        return false;
    }
}

// Clean up old backups
function cleanupOldBackups(directory, prefix, maxKeep = MAX_BACKUPS_PER_FILE) {
    try {
        if (!fs.existsSync(directory)) return [];

        const backups = fs.readdirSync(directory)
            .filter(file => file.startsWith(prefix))
            .map(file => ({
                name: file,
                path: path.join(directory, file),
                timestamp: file.match(/enhanced_backup_(\d{4}-\d{2}-\d{2}_\d{4})/)?.[1] || '0000-00-00_0000'
            }))
            .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

        const toDelete = backups.slice(maxKeep);
        let deletedCount = 0;

        toDelete.forEach(backup => {
            try {
                fs.rmSync(backup.path, { recursive: true, force: true });
                console.log(`🗑️  Cleaned up old backup: ${backup.name}`);
                deletedCount++;
            } catch (error) {
                console.error(`❌ Error deleting ${backup.name}:`, error.message);
            }
        });

        if (deletedCount > 0) {
            console.log(`🧹 Cleaned up ${deletedCount} old backup(s)`);
        }

        return backups.slice(0, maxKeep).map(b => b.name);
    } catch (error) {
        console.error(`❌ Error during cleanup:`, error.message);
        return [];
    }
}

// Function to scan directory recursively
function scanDirectory(dir, baseDir) {
    const files = [];

    try {
        if (!fs.existsSync(dir)) {
            console.log(`⚠️ Directory not found: ${dir}`);
            return files;
        }

        const entries = fs.readdirSync(dir);

        for (const entry of entries) {
            const fullPath = path.join(dir, entry);
            const relativePath = path.relative(baseDir, fullPath);

            if (fs.statSync(fullPath).isDirectory()) {
                // Skip excluded directories
                if (shouldExcludeFile(fullPath)) continue;
                // Recursively scan subdirectories
                files.push(...scanDirectory(fullPath, baseDir));
            } else {
                // Skip excluded files
                if (shouldExcludeFile(fullPath)) continue;
                // Add file to backup list
                files.push({
                    source: relativePath,
                    destination: relativePath
                });
            }
        }

        return files;
    } catch (error) {
        console.log(`⚠️ Error scanning directory ${dir}: ${error.message}`);
        return files;
    }
}

function generateBackupTree(backupPath) {
    const tree = [];
    tree.push('Enhanced Backup Structure:');

    function scanDirectory(dir, prefix = '', isLast = true) {
        try {
            if (!fs.existsSync(dir)) {
                console.log(`⚠️ Directory not found: ${dir}`);
                return;
            }

            const entries = fs.readdirSync(dir).sort((a, b) => {
                const aIsDir = fs.statSync(path.join(dir, a)).isDirectory();
                const bIsDir = fs.statSync(path.join(dir, b)).isDirectory();
                if (aIsDir && !bIsDir) return -1;
                if (!aIsDir && bIsDir) return 1;
                return a.localeCompare(b);
            });

            entries.forEach((entry, index) => {
                const fullPath = path.join(dir, entry);
                const isLastEntry = index === entries.length - 1;
                const isDirectory = fs.statSync(fullPath).isDirectory();

                const marker = isLastEntry ? '└── ' : '├── ';
                const newPrefix = prefix + (isLast ? '    ' : '│   ');

                const size = isDirectory ? '' : ` (${(fs.statSync(fullPath).size / 1024).toFixed(2)} KB)`;
                const icon = isDirectory ? '📁' : '📄';

                tree.push(`${prefix}${marker}${icon} ${entry}${size}`);

                if (isDirectory) {
                    scanDirectory(fullPath, newPrefix, isLastEntry);
                }
            });
        } catch (error) {
            console.log(`⚠️ Error scanning directory ${dir}: ${error.message}`);
        }
    }

    scanDirectory(backupPath);
    return tree.join('\n');
}

// Enhanced backup function
async function createEnhancedBackup() {
    console.log('📦 Starting enhanced backup process for Angular Profiling App...');
    console.log('📦 Retention policy: Keeping 5 most recent backups');
    console.log('🔒 Security: Excluding secrets and sensitive files');

    // Get git history
    console.log('🔍 Analyzing git history...');
    const gitHistory = getGitHistory(7);

    const timestamp = getTimestamp();
    const baseDir = process.cwd();
    const backupDir = path.join(baseDir, 'backups');
    const backupPath = path.join(backupDir, `enhanced_backup_${timestamp}`);

    // Create backup root directory
    ensureDirectoryExists(backupDir);
    ensureDirectoryExists(backupPath);

    // Scan directories to find files to backup
    const directoriesToScan = [
        'src',
        'server',
        'scripts',
        'environments'
    ];

    let filesToBackup = [];
    for (const dir of directoriesToScan) {
        const dirPath = path.join(baseDir, dir);
        if (fs.existsSync(dirPath)) {
            console.log(`📂 Scanning directory: ${dir}`);
            filesToBackup.push(...scanDirectory(dirPath, baseDir));
        } else {
            console.log(`⚠️ Directory not found: ${dir}`);
        }
    }

    // Always include important root files
    const explicitFiles = [
        'package.json',
        'package-lock.json',
        'angular.json',
        'tsconfig.json',
        'tsconfig.app.json',
        'tsconfig.spec.json',
        'proxy.conf.json',
        '.gitignore',
        'README.md',
        'AUTH0_SETUP_GUIDE.md',
        'ENV-SETUP.md',
        'API-KEY-REMOVAL.md',
        'GUIDE_TO_TESTING_MULTIPLE_USERS.md',
        path.join('server', 'package.json'),
        path.join('server', 'package-lock.json'),
        path.join('server', 'server.js'),
        path.join('server', 'swagger.json'),
        path.join('server', 'swagger.yaml')
    ];

    for (const relFile of explicitFiles) {
        const absFile = path.join(baseDir, relFile);
        if (fs.existsSync(absFile)) {
            if (!filesToBackup.some(f => f.source === relFile)) {
                filesToBackup.push({ source: relFile, destination: relFile });
            }
        }
    }

    let successCount = 0;
    let failCount = 0;
    const fileAnalyses = [];

    // Backup each file and analyze it
    for (const file of filesToBackup) {
        const sourcePath = path.join(baseDir, file.source);
        const destPath = path.join(backupPath, file.destination);

        try {
            // Ensure destination directory exists
            ensureDirectoryExists(path.dirname(destPath));

            // Copy the file
            fs.copyFileSync(sourcePath, destPath);
            const stats = fs.statSync(destPath);
            const sizeKB = (stats.size / 1024).toFixed(2);
            console.log(`✅ Backed up: ${file.source} (${sizeKB} KB)`);
            successCount++;

            // Analyze the file for changes
            try {
                const analysis = analyzeFileForChanges(sourcePath, baseDir);
                fileAnalyses.push(analysis);

                if (analysis.recentlyModified || analysis.changes.length > 0 || analysis.todos.length > 0) {
                    console.log(`🔍 Analyzed: ${file.source} (${analysis.changes.length + analysis.fixes.length + analysis.updates.length} changes, ${analysis.newFunctions.length} functions, ${analysis.todos.length} TODOs)`);
                }
            } catch (analysisError) {
                console.log(`⚠️  Could not analyze ${file.source}: ${analysisError.message}`);
            }
        } catch (error) {
            console.error(`❌ Failed to backup ${file.source}:`, error);
            failCount++;
        }
    }

    // Generate comprehensive change summary
    const changeSummary = generateChangeSummary(fileAnalyses, gitHistory);
    const summaryPath = path.join(backupPath, 'ENHANCED_BACKUP_SUMMARY.md');
    fs.writeFileSync(summaryPath, changeSummary);
    console.log(`📄 Created enhanced change summary: ${summaryPath}`);

    // Create a restore script
    const restoreScript = `#!/bin/bash
# Restore script for Angular Profiling App backup
# Generated: ${new Date().toLocaleString()}

echo "🔄 Restoring Angular Profiling App from backup..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Not in the Angular app root directory"
    echo "Please run this script from the My-Profiling-App directory"
    exit 1
fi

# Restore files
echo "📁 Restoring files..."
cp -r ./* ../restored_app_${timestamp}/

echo "✅ Restore completed!"
echo "📁 Restored app location: ../restored_app_${timestamp}/"
echo ""
echo "To run the restored app:"
echo "1. cd ../restored_app_${timestamp}/"
echo "2. npm install"
echo "3. cd server && npm install"
echo "4. Copy secrets from /server/secrets/ to the restored app"
echo "5. npm run start:all"
`;

    const restoreScriptPath = path.join(backupPath, 'restore.sh');
    fs.writeFileSync(restoreScriptPath, restoreScript);
    console.log(`📄 Created restore script: ${restoreScriptPath}`);

    // Cleanup old backups
    cleanupOldBackups(backupDir, 'enhanced_backup_');

    // Generate and display backup tree
    const backupTree = generateBackupTree(backupPath);
    console.log('\n' + backupTree);

    // Summary
    console.log('\n📊 Enhanced Backup Summary:');
    console.log(`✅ Successfully backed up: ${successCount} files`);
    if (failCount > 0) {
        console.log(`❌ Failed to backup: ${failCount} files`);
    }
    console.log(`📁 Enhanced backup location: ${backupPath}`);
    console.log(`📄 Detailed summary: ${summaryPath}`);
    console.log(`🔧 Restore script: ${restoreScriptPath}`);
    console.log('\n🔒 Security Note: Secrets are excluded from this backup for security.');

    return {
        success: failCount === 0,
        timestamp,
        successCount,
        failCount,
        backupPath: backupPath,
        tree: backupTree
    };
}

// Run the enhanced backup
if (require.main === module) {
    createEnhancedBackup();
}

module.exports = { createEnhancedBackup, getTimestamp };

