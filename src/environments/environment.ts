// Default/development environment. Production build replaces this with environment.prod.ts.
// Keep this file in the repo so Render (and any CI) can build; local dev can override.

export const environment = {
    production: false,
    apiUrl: 'http://localhost:5001',
    wsUrl: 'ws://localhost:5001',
    googleMapsApiKey: '',
    auth0: {
        domain: '',
        clientId: '',
        authorizationParams: {
            redirect_uri: '',
            audience: ''
        }
    }
};
