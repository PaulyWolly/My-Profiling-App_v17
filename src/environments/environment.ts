// Default/development environment (LOCAL).
// FE (Angular): http://localhost:4200
// BE (API/WebSocket): http://localhost:5001 / ws://localhost:5001
// Production build replaces this with environment.prod.ts.
// Keep this file in the repo so Render (and any CI) can build; local dev can override.

export const environment = {
    production: false,
    apiUrl: 'http://localhost:5001',
    wsUrl: 'ws://localhost:5001',
    googleMapsApiKey: '',
    // Auth0 for "Continue with Google" (same app as prod).
    // Local callback should be: http://localhost:4200/profile
    auth0: {
        domain: 'pwconsulting.auth0.com',
        clientId: 'rPt7mWcx4eKBj1b4tqz8wH5Zr7ILR7PG',
        authorizationParams: {
            redirect_uri: window.location.origin + '/profile',
            audience: 'https://my-profiling-app-api'
        }
    }
};
