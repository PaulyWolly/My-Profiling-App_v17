# Enhanced Backup System for Angular Profiling App

## Overview
This backup system creates comprehensive backups of your Angular profiling app while maintaining security by excluding sensitive files.

## Features
- ✅ **Comprehensive Backup**: Backs up all source code, configuration, and documentation
- 🔒 **Security First**: Automatically excludes secrets, node_modules, and sensitive files
- 📊 **Change Analysis**: Analyzes files for changes, TODOs, and new functions
- 📝 **Detailed Reports**: Generates comprehensive change summaries
- 🧹 **Auto Cleanup**: Keeps only the 5 most recent backups
- 🔧 **Restore Script**: Includes a script to restore the backup

## Usage

### Quick Backup
```bash
npm run backup
```

### Manual Backup
```bash
node scripts/ENHANCED_BACKUP_ANGULAR_APP.js
```

## What Gets Backed Up
- ✅ `src/` - All Angular source code
- ✅ `server/` - Backend Node.js code (excluding secrets)
- ✅ `scripts/` - Utility scripts
- ✅ `environments/` - Environment configuration
- ✅ Root configuration files (`package.json`, `angular.json`, etc.)
- ✅ Documentation files (`.md` files)

## What Gets Excluded
- ❌ `node_modules/` - Dependencies (can be reinstalled)
- ❌ `dist/` - Build output
- ❌ `.angular/` - Angular cache
- ❌ `backups/` - Previous backups
- ❌ `server/secrets/` - Sensitive configuration
- ❌ `.env` files - Environment variables
- ❌ `config.json` - Database credentials
- ❌ Log files and temporary files

## Backup Location
Backups are stored in: `./backups/enhanced_backup_YYYYMMDD_HHMMSS/`

## Backup Contents
Each backup includes:
- 📁 All source code and configuration files
- 📄 `ENHANCED_BACKUP_SUMMARY.md` - Detailed change analysis
- 🔧 `restore.sh` - Script to restore the backup
- 📊 File analysis and statistics

## Restoring a Backup
1. Navigate to the backup directory
2. Run the restore script: `./restore.sh`
3. Follow the instructions in the script

## Security Notes
- 🔒 Secrets are excluded from backups for security
- 🔒 Backup files may contain sensitive code - store securely
- 🔒 Always verify no secrets are in the backup before sharing

## Configuration
The backup system can be configured by editing `ENHANCED_BACKUP_ANGULAR_APP.js`:
- `MAX_BACKUPS_PER_FILE`: Number of backups to keep (default: 5)
- `BACKUP_EXCLUDE_PATTERNS`: Files/patterns to exclude

## Troubleshooting
- If backup fails, check file permissions
- Ensure you have write access to the `backups/` directory
- Check that Node.js is installed and accessible

## Example Output
```
📦 Starting enhanced backup process for Angular Profiling App...
📦 Retention policy: Keeping 5 most recent backups
🔒 Security: Excluding secrets and sensitive files
🔍 Analyzing git history...
📂 Scanning directory: src
📂 Scanning directory: server
📂 Scanning directory: scripts
✅ Backed up: src/app/app.component.ts (2.5 KB)
✅ Backed up: server/server.js (8.2 KB)
📄 Created enhanced change summary: ./backups/enhanced_backup_20250927_1430/ENHANCED_BACKUP_SUMMARY.md
📄 Created restore script: ./backups/enhanced_backup_20250927_1430/restore.sh
🧹 Cleaned up 2 old backup(s)

📊 Enhanced Backup Summary:
✅ Successfully backed up: 45 files
📁 Enhanced backup location: ./backups/enhanced_backup_20250927_1430/
📄 Detailed summary: ./backups/enhanced_backup_20250927_1430/ENHANCED_BACKUP_SUMMARY.md
🔧 Restore script: ./backups/enhanced_backup_20250927_1430/restore.sh

🔒 Security Note: Secrets are excluded from this backup for security.
```
