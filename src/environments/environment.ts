// Default/development environment. Production build replaces this with environment.prod.ts.
// Keep this file in the repo so Render (and any CI) can build; local dev can override.

export const environment = {
    production: false,
    apiUrl: 'http://localhost:5001',
    wsUrl: 'ws://localhost:5001',
    googleMapsApiKey: '',
    // Auth0 for "Continue with Google" (same app as prod; add http://localhost:5000/profile to Auth0 Allowed Callback URLs).
    auth0: {
        domain: 'pwconsulting.auth0.com',
        clientId: 'rPt7mWcx4eKBj1b4tqz8wH5Zr7ILR7PG',
        authorizationParams: {
            redirect_uri: 'http://localhost:5000/profile',
            audience: 'https://my-profiling-app-api'
        }
    }
};
