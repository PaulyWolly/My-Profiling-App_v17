#!/bin/bash
# Restore script for Angular Profiling App backup
# Generated: 9/27/2025, 12:05:52 PM

echo "🔄 Restoring Angular Profiling App from backup..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Not in the Angular app root directory"
    echo "Please run this script from the My-Profiling-App directory"
    exit 1
fi

# Restore files
echo "📁 Restoring files..."
cp -r ./* ../restored_app_20250927_120547/

echo "✅ Restore completed!"
echo "📁 Restored app location: ../restored_app_20250927_120547/"
echo ""
echo "To run the restored app:"
echo "1. cd ../restored_app_20250927_120547/"
echo "2. npm install"
echo "3. cd server && npm install"
echo "4. Copy secrets from /server/secrets/ to the restored app"
echo "5. npm run start:all"
