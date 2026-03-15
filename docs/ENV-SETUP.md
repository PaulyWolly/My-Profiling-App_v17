# Environment Variables and API Keys Setup

## Important Security Notice

**NEVER** commit API keys, database credentials, or other sensitive information directly in your code. This project has been updated to handle sensitive information securely.

## Client-Side Environment Setup

1. **Environment Files**:
   - Use the example files (`environment.example.ts` and `environment.prod.example.ts`) as templates
   - Copy them to create your working files:
     ```
     cp src/environments/environment.example.ts src/environments/environment.ts
     cp src/environments/environment.prod.example.ts src/environments/environment.prod.ts
     ```
   - The `.gitignore` file has been updated to exclude these files from Git

2. **API Keys**:
   - API keys (like Google Maps) are now loaded from the server at runtime
   - The client environment files no longer need to contain actual API keys
   - A `ConfigService` has been created to handle secure loading of keys

## Server-Side Configuration Setup

1. **Local development:** The server reads from **`server/secrets/config.json`**. You need:
   - **`connectionString`**: Your MongoDB URI. Must start with `mongodb://` or `mongodb+srv://` (e.g. from MongoDB Atlas: *Connect → Connect your application*).
   - **`secret`**: Used to sign JWT tokens (any string).
   - **`DBName`** (optional): Database name, e.g. `profiling-app`.
   If the connection string is missing or invalid, the server will exit with a clear message and will not retry until you fix it.

   **Port 5001 in use (EADDRINUSE):** If the backend says "address already in use :::5001", another process is using that port (often a previous server instance). Free it with:
   ```bash
   npx kill-port 5001
   ```
   Then start the server again.

2. **Create or update the config file** (e.g. from an example if you have one):
   ```
   cp server/config/config.example.json server/config.json
   ```
   Then ensure **`server/secrets/config.json`** exists with the keys above (the server uses the **secrets** path).

3. **Update the config file** with your actual values:
   - Database connection details
   - JWT secret
   - Email configuration
   - API keys in the `apiKeys` section

3. **For production environments**, consider using environment variables instead:
   - This project uses dotenv (`require('dotenv').config()`)
   - Create a `.env` file in the server directory with values like:
     ```
     DB_CONNECTION_STRING=your_connection_string
     JWT_SECRET=your_secret
     GOOGLE_MAPS_API_KEY=your_api_key
     ```
   - Update the server code to use `process.env.VARIABLE_NAME` where needed

## How API Keys Are Now Handled

1. The Angular application requests keys from the server via a secure endpoint
2. The server only provides keys to authenticated users
3. API keys never appear in client-side code that gets committed to Git

## Security Best Practices

- Keep `.env` files and `config.json` out of version control
- Rotate API keys periodically
- Use environment-specific keys (different keys for dev/test/prod)
- Consider using a secret management service for production

## What Was Fixed

- Removed hardcoded API keys from environment files
- Added example files as templates
- Created a secure server endpoint for providing API keys
- Updated .gitignore to exclude sensitive files
- Created a client-side service for securely loading configuration 