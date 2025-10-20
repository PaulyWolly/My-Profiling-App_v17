#!/bin/bash
# Restore script for Angular Profiling App backup
# Generated: 10/20/2025, 8:16:42 AM

echo "🔄 Restoring Angular Profiling App from backup..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Not in the Angular app root directory"
    echo "Please run this script from the My-Profiling-App directory"
    exit 1
fi

# Restore files
echo "📁 Restoring files..."
cp -r ./* ../restored_app_20251020_081639/

echo "✅ Restore completed!"
echo "📁 Restored app location: ../restored_app_20251020_081639/"
echo ""
echo "To run the restored app:"
echo "1. cd ../restored_app_20251020_081639/"
echo "2. npm install"
echo "3. cd server && npm install"
echo "4. Copy secrets from /server/secrets/ to the restored app"
echo "5. npm run start:all"
