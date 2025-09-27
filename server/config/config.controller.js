const config = require('../config.json');
const jwt = require('jsonwebtoken');

// Add a debug log to see the available config
console.log('Config loaded in controller:', {
    // Log the keys but not their values for security
    configKeys: Object.keys(config),
    hasGoogleApiKey: !!config.googleApiKey,
    googleApiKeyLength: config.googleApiKey ? config.googleApiKey.length : 0
});

module.exports = {
    getPublicConfig
};

function getPublicConfig(req, res) {
    console.log('Config endpoint called with auth:', req.headers.authorization ? 'Yes' : 'No');
    
    // Log the auth header for debugging
    if (req.headers.authorization) {
        const authParts = req.headers.authorization.split(' ');
        console.log('Auth type:', authParts[0]);
        console.log('Token length:', authParts[1]?.length || 0);
        // Print the first 10 chars of the token for debugging without exposing the whole token
        console.log('Token preview:', authParts[1]?.substring(0, 10) + '...');
    }
    
    // Verify the user is authenticated
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
        console.log('No token provided, returning 401');
        return res.status(401).json({ message: 'Unauthorized' });
    }
    
    try {
        // Verify token
        console.log('Attempting to verify token...');
        const decoded = jwt.verify(token, config.secret);
        console.log('Token verified successfully:', {
            id: decoded.id,
            hasId: !!decoded.id,
            exp: new Date(decoded.exp * 1000).toISOString(),
            isExpired: decoded.exp * 1000 < Date.now()
        });
        
        const userId = decoded.id;
        
        if (!userId) {
            console.log('Invalid token (no userId), returning 401');
            return res.status(401).json({ message: 'Invalid token' });
        }
        
        // Return only the public configuration that's needed by the client
        // Never return sensitive server-side configuration
        const response = {
            apiKeys: {
                googleMaps: config.googleApiKey || ''
            }
        };
        
        console.log('Returning config with Google Maps API key:', !!response.apiKeys.googleMaps);
        console.log('Google Maps API key length:', response.apiKeys.googleMaps.length);
        return res.json(response);
    } catch (error) {
        console.log('Token verification error:', error.message);
        return res.status(401).json({ message: 'Invalid token' });
    }
} 