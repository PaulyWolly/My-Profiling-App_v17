// This is an example file. Create a copy named "environment.prod.ts" with your actual values.
// DO NOT commit files containing actual API keys or secrets to version control.
// For Netlify: set these to your deployed backend URL (e.g. Render, Railway).

export const environment = {
    production: true,
    apiUrl: 'https://your-production-api-url.com',
    wsUrl: 'wss://your-production-api-url.com',  // WebSocket URL for chat (same host as apiUrl, wss instead of https)
    googleMapsApiKey: 'YOUR_GOOGLE_MAPS_API_KEY',
    auth0: {
        domain: 'YOUR_AUTH0_DOMAIN.auth0.com',
        clientId: 'YOUR_AUTH0_CLIENT_ID',
        authorizationParams: {
            redirect_uri: 'https://your-netlify-site.netlify.app',  // Add this URL in Auth0 dashboard
            audience: ''
        }
    }
}; 