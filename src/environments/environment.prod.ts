export const environment = {
    production: true,
    apiUrl: 'https://my-profiling-app-v17.onrender.com',
    wsUrl: 'wss://my-profiling-app-v17.onrender.com',
    // Sensitive information should not be stored in source code
    // This should be loaded from environment variables on the server
    googleMapsApiKey: '', // Load from secure source at runtime

    // Auth0 Configuration - Replace with your production values
    auth0: {
        domain: 'pwconsulting.auth0.com',
        clientId: 'rPt7mWcx4eKBj1b4tqz8wH5Zr7ILR7PG',
        authorizationParams: {
            redirect_uri: window.location.origin + '/profile',
            audience: 'https://my-profiling-app-api'
        }
    }
};
