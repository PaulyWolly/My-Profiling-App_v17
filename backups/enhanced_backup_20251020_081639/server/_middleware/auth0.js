const { auth } = require('express-openid-connect');
const jwt = require('jsonwebtoken');

console.log('[Auth0 Middleware] Loading with built-in fetch:', typeof fetch);

// Auth0 configuration
const auth0Config = {
    authRequired: false,
    auth0Logout: true,
    secret: process.env.AUTH0_SECRET || 'your-auth0-secret',
    baseURL: process.env.AUTH0_BASE_URL || 'http://localhost:5001',
    clientID: process.env.AUTH0_CLIENT_ID || 'your-auth0-client-id',
    issuerBaseURL: process.env.AUTH0_ISSUER_BASE_URL || 'https://your-auth0-domain.auth0.com',
    routes: {
        login: false, // Disable the /login route
        logout: false, // Disable the /logout route
        callback: false, // Disable the /callback route
        postLogoutRedirect: process.env.AUTH0_POST_LOGOUT_REDIRECT || 'http://localhost:5000'
    }
};

// Middleware to validate Auth0 JWT tokens
async function validateAuth0Token(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next(); // No token, continue without Auth0 user
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    try {
        // Decode the JWT token to get the payload
        const decoded = jwt.decode(token, { complete: true });

        if (!decoded || !decoded.payload) {
            console.log('[Auth0] Invalid token structure');
            return next(); // Invalid token, continue without Auth0 user
        }

        console.log('[Auth0] Token payload:', JSON.stringify(decoded.payload, null, 2));

        // Extract user info from the token payload
        let email = decoded.payload.email;
        let name = decoded.payload.name;
        let picture = decoded.payload.picture;

        // If email is not in the main payload, fetch from userinfo endpoint
        if (!email) {
            console.log('[Auth0] No email in token, fetching from userinfo endpoint...');
            console.log('[Auth0] Fetch function type:', typeof fetch);
            try {
                const userinfoResponse = await fetch('https://pwconsulting.auth0.com/userinfo', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (userinfoResponse.ok) {
                    const userinfo = await userinfoResponse.json();
                    console.log('[Auth0] Userinfo response:', JSON.stringify(userinfo, null, 2));

                    email = userinfo.email;
                    name = userinfo.name;
                    picture = userinfo.picture;
                } else {
                    console.log('[Auth0] Failed to fetch userinfo:', userinfoResponse.status);
                }
            } catch (fetchError) {
                console.error('[Auth0] Error fetching userinfo:', fetchError.message);
            }
        }

        // If no email, use the sub (user ID) as a fallback
        if (!email) {
            console.log('[Auth0] No email found in token or userinfo, using sub as fallback');
            email = decoded.payload.sub; // Use the sub (e.g., "facebook|10238740267503134") as email
        }

        // Add Auth0 user info to request
        req.auth0User = {
            sub: decoded.payload.sub,
            email: email,
            name: name || email.split('@')[0] || email.split('|')[1] || 'User', // Fallback to email prefix or sub suffix
            picture: picture,
            email_verified: decoded.payload.email_verified || false,
            authProvider: 'auth0'
        };

        console.log('[Auth0] Valid Auth0 token for user:', req.auth0User.email);
        next();
    } catch (error) {
        console.error('[Auth0] Token validation error:', error.message);
        next(); // Continue without Auth0 user
    }
}

// Middleware to require Auth0 authentication
function requireAuth0(req, res, next) {
    if (!req.auth0User) {
        return res.status(401).json({ message: 'Auth0 authentication required' });
    }
    next();
}

module.exports = {
    validateAuth0Token,
    requireAuth0,
    auth0Config
};
