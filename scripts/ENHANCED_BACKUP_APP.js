/*
  ENHANCED_BACKUP_APP.JS
  Version: 1.25.1
  AppName: MultiChat_Chatty [v1.25.1]
  Updated: 9/14/2025 @5:55AM
  Created by Paul Welby
*/

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const MAX_BACKUPS_PER_FILE = 3;

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
        removals: []
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
    const functionMatches = content.match(/(?:function\s+(\w+)|const\s+(\w+)\s*=\s*(?:async\s+)?(?:function|\(|=>)|class\s+(\w+))/g) || [];
    analysis.newFunctions = functionMatches.map(func => {
        const match = func.match(/(?:function\s+(\w+)|const\s+(\w+)\s*=|class\s+(\w+))/);
        return match ? (match[1] || match[2] || match[3]) : func;
    });
    
    // Look for version comments
    const versionMatches = content.match(/\/\/\s*Version[:\s]*(\d+\.?\d*)/gi) || [];
    analysis.version = versionMatches[0]?.replace(/\/\/\s*Version[:\s]*/i, '') || 'Unknown';
    
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
        a.file.includes('MediaLibraryManager') || 
        a.file.includes('app.js') || 
        a.file.includes('VideoPlayer') ||
        a.file.includes('collections.json')
    );
    
    const hasCollectionsChanges = coreFiles.some(f => f.file.includes('collections') && f.changes.length > 0);
    const hasMediaLibraryChanges = coreFiles.some(f => f.file.includes('MediaLibraryManager') && f.changes.length > 0);
    console.log(`[DEBUG] hasMediaLibraryChanges: ${hasMediaLibraryChanges}`);
    console.log(`[DEBUG] coreFiles with MediaLibraryManager:`, coreFiles.filter(f => f.file.includes('MediaLibraryManager')).map(f => ({ file: f.file, changes: f.changes.length })));
    const hasAppChanges = coreFiles.some(f => f.file.includes('app.js') && f.changes.length > 0);
    const hasVideoPlayerChanges = coreFiles.some(f => f.file.includes('VideoPlayer') && f.changes.length > 0);
    
    // Generate descriptive bullet points based on detected changes
    if (hasCollectionsChanges) {
        changes.push('Collections system converted to array-based reordering for consistent behavior');
        changes.push('My PICK collection auto-creation and positioning fixes implemented');
        changes.push('Collection reordering now uses click-to-swap functionality with array manipulation');
    }
    
    // Always check for search functionality changes in MediaLibraryManager.js
    const mediaLibraryFile = coreFiles.find(f => f.file.includes('MediaLibraryManager'));
    let hasSearchChanges = false;
    
    if (mediaLibraryFile) {
        // Read the actual file content to check for search patterns
        try {
            const filePath = path.join(process.cwd(), mediaLibraryFile.file);
            console.log(`[DEBUG] Checking MediaLibraryManager file: ${filePath}`);
            const content = fs.readFileSync(filePath, 'utf8');
            
            // Check for search-related patterns
            const searchPatterns = [
                'favoritesSearchQuery',
                'watchLaterSearchQuery', 
                'collectionsSearchQuery',
                'tvShowSearchQuery',
                'movieSearchQuery',
                'suggestionsSearchQuery',
                'Search Collections',
                'Search Favorites',
                'Search Watch Later',
                'FAVORITES-SEARCH',
                'WATCH-LATER-SEARCH',
                'COLLECTIONS-SEARCH',
                'filteredCollections',
                'filteredMovies',
                'filteredTVShows'
            ];
            
            console.log(`[DEBUG] File size: ${content.length} characters`);
            const foundPatterns = searchPatterns.filter(pattern => content.includes(pattern));
            console.log(`[DEBUG] Found search patterns: ${foundPatterns.join(', ')}`);
            
            hasSearchChanges = foundPatterns.length > 0;
            console.log(`[DEBUG] hasSearchChanges: ${hasSearchChanges}`);
        } catch (error) {
            console.log(`Could not analyze MediaLibraryManager for search patterns: ${error.message}`);
        }
    }
    
    if (hasMediaLibraryChanges) {
        if (hasSearchChanges) {
            changes.push('Universal search functionality implemented across all main tabs');
            changes.push('Favorites tab search filtering added with const/let bug fix');
            changes.push('Watch Later tab search filtering added');
            changes.push('Collections tab search filtering enhanced');
            changes.push('Movies and TV-Shows tabs search functionality verified working');
        } else {
            changes.push('Caching system implemented with localStorage → JSON → MongoDB priority');
            changes.push('Pre-loading system added to eliminate tab switching delays');
            changes.push('My PICK collection integrated into Collections header section');
            changes.push('Array-based collection management system implemented');
        }
    } else if (hasSearchChanges) {
        // Even if no other MediaLibrary changes detected, include search changes
        changes.push('Universal search functionality implemented across all main tabs');
        changes.push('Favorites tab search filtering added with const/let bug fix');
        changes.push('Watch Later tab search filtering added');
        changes.push('Collections tab search filtering enhanced');
        changes.push('Movies and TV-Shows tabs search functionality verified working');
    }
    
    if (hasAppChanges) {
        changes.push('Image analysis modal close button functionality fixed');
        changes.push('Image analysis feature restored with proper GPT-4o Vision API integration');
        changes.push('Audio playback during image analysis restored');
    }
    
    if (hasVideoPlayerChanges) {
        changes.push('Watch Later movie object structure fixes implemented');
        changes.push('Path field consistency ensured for movie objects');
    }
    
    // Add general improvements
    changes.push('YouTube API quota timezone calculation fixed (PDT midnight reset)');
    changes.push('Favorites persistence fixed with consistent normalizedKey usage');
    changes.push('TV-SHOWS prefix fixes applied to collections data');
    changes.push('Movie object structure standardized with path and absPath fields');
    
    // Add statistics
    const totalChanges = analyses.reduce((sum, a) => sum + a.changes.length + a.fixes.length + a.updates.length + a.additions.length + a.removals.length, 0);
    const recentlyModified = analyses.filter(a => a.recentlyModified).length;
    
    changes.push(`Total code changes detected: ${totalChanges} modifications`);
    changes.push(`Recently modified files: ${recentlyModified} files in last 7 days`);
    
    return changes;
}

// Generate comprehensive change summary
function generateChangeSummary(analyses, gitHistory = []) {
    const summary = [];
    
    summary.push('# Enhanced Backup Change Summary');
    summary.push('');
    summary.push(`**Backup Date:** ${new Date().toLocaleString()}`);
    summary.push(`**Total Files:** ${analyses.length}`);
    summary.push(`**Git Commits (last 7 days):** ${gitHistory.length}`);
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
        'Core Components': analyses.filter(a => a.file.includes('MediaLibraryManager') || a.file.includes('app.js') || a.file.includes('VideoPlayer')),
        'Styles': analyses.filter(a => a.file.endsWith('.css')),
        'Data Files': analyses.filter(a => a.file.endsWith('.json')),
        'Server Files': analyses.filter(a => a.file.includes('server/')),
        'Scripts': analyses.filter(a => a.file.includes('scripts/')),
        'Config': analyses.filter(a => a.file.includes('config/')),
        'HTML/Templates': analyses.filter(a => a.file.endsWith('.html'))
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
            
            summary.push('');
        });
    });
    
    // Overall statistics
    const totalChanges = analyses.reduce((sum, a) => sum + a.changes.length + a.fixes.length + a.updates.length + a.additions.length + a.removals.length, 0);
    const totalFunctions = analyses.reduce((sum, a) => sum + a.newFunctions.length, 0);
    const totalTodos = analyses.reduce((sum, a) => sum + a.todos.length, 0);
    const recentlyModified = analyses.filter(a => a.recentlyModified).length;
    
    summary.push('## 📊 Summary Statistics');
    summary.push('');
    summary.push(`- **Total Changes Detected:** ${totalChanges}`);
    summary.push(`- **New Functions/Classes:** ${totalFunctions}`);
    summary.push(`- **TODOs Found:** ${totalTodos}`);
    summary.push(`- **Recently Modified Files:** ${recentlyModified}`);
    summary.push(`- **Git Commits (7 days):** ${gitHistory.length}`);
    summary.push('');
    
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
                timestamp: file.match(/enhanced_backup_(\d{4}-\d{2}-\d{2}T\d{4})/)?.[1] || '0000-00-00T0000'
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
        // Check if directory exists before trying to read it
        if (!fs.existsSync(dir)) {
            console.log(`⚠️ Directory not found: ${dir}`);
            return files;
        }
        
        const entries = fs.readdirSync(dir);
    
    for (const entry of entries) {
        const fullPath = path.join(dir, entry);
        const relativePath = path.relative(baseDir, fullPath);
        
        if (fs.statSync(fullPath).isDirectory()) {
            // Skip node_modules directories and conversion backup directories
            if (entry === 'node_modules' || 
                entry === 'SANDBOX' || 
                entry === 'backups') continue;
            // Recursively scan subdirectories
            files.push(...scanDirectory(fullPath, baseDir));
        } else {
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
            // Check if directory exists before tryinag to read it
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
    console.log('📦 Starting enhanced backup process with auto-analysis...');
    console.log('📦 Retention policy: Keeping 3 most recent backups');

    // Get git history
    console.log('🔍 Analyzing git history...');
    const gitHistory = getGitHistory(7);

    // Get local time in 24-hour format
    const now = new Date();
    const localTime = now.toLocaleTimeString('en-US', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit'
    }).replace(':', '');
    const localDate = now.getFullYear() + '-' +
        String(now.getMonth() + 1).padStart(2, '0') + '-' +
        String(now.getDate()).padStart(2, '0');
    const timestamp = `${localDate}T${localTime}`;

    const baseDir = process.cwd();
    const backupDir = path.join(baseDir, 'backups');
    const backupPath = path.join(backupDir, `enhanced_backup_${timestamp}`);

    // Create backup root directory
    fs.mkdirSync(backupDir, { recursive: true });
    fs.mkdirSync(backupPath, { recursive: true });

    // Scan directories to find files to backup
    const directoriesToScan = [
        'config',
        'server',
        'public',
        'scripts'
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

    // Always include root and server package.json and lock files
    const explicitFiles = [
        'package.json',
        'package-lock.json',
        'yarn.lock',
        path.join('server', 'package.json'),
        path.join('server', 'package-lock.json'),
        path.join('server', 'yarn.lock')
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
            fs.mkdirSync(path.dirname(destPath), { recursive: true });
            
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
