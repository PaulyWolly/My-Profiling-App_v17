# Auth0 Google Authentication Setup Guide

## ✅ What's Already Done

1. **Frontend Setup Complete:**
   - Installed `@auth0/auth0-angular` package
   - Updated Angular app module with Auth0 configuration
   - Added Auth0 service for handling authentication
   - Updated login component with Google login button
   - Environment files configured for Auth0 settings

2. **Backend Setup Complete:**
   - Installed `express-openid-connect` package
   - Created Auth0 middleware for token validation
   - Added Auth0 authentication route
   - Backend can now handle Auth0 JWT tokens

## 🔧 What You Need to Do

### 1. Configure Your Auth0 Account

1. **You're already in the right place!** - I can see you're in the Google OAuth2 connection settings

2. **Configure Google OAuth Credentials:**
   - **Great news!** You already have Google OAuth2 credentials for "My MEAN Profiling App"
   - **Your Client ID:** `908461895884-4s3ij0vvgu40hh11m1cmo2edi53oifqn.apps.googleusercontent.com`
   - **Next steps:**
     1. Go back to your Auth0 dashboard (Google OAuth2 connection settings)
     2. Paste your Client ID into the "Client ID" field
     3. Click the copy icon next to the Client Secret (the `****6zhx` value)
     4. Paste the Client Secret into the "Client Secret" field in Auth0
     5. Save the configuration

3. **Get Your Auth0 Application Credentials:**
   - Go to Applications → [Your App Name] → Settings
   - Note down:
     - **Domain** (e.g., `pwconsulting.auth0.com`)
     - **Client ID** (this is different from the Google Client ID)
   - Go to APIs → Create API (if you haven't already)
     - **API Identifier** (e.g., `https://your-api-identifier`)

### 2. Update Environment Configuration

**Update `src/environments/environment.ts`:**
```typescript
auth0: {
    domain: 'pwconsulting.auth0.com', // Your Auth0 domain from the dashboard
    clientId: 'your-auth0-app-client-id', // From Applications → [Your App] → Settings
    authorizationParams: {
        redirect_uri: window.location.origin,
        audience: 'https://your-api-identifier' // From APIs section
    }
}
```

**Update `src/environments/environment.prod.ts`** with the same values.

### 3. Configure Auth0 Application Settings

In your Auth0 Dashboard → Applications → Settings:

1. **Allowed Callback URLs:**
   ```
   http://localhost:5000, https://your-production-domain.com
   ```

2. **Allowed Logout URLs:**
   ```
   http://localhost:5000, https://your-production-domain.com
   ```

3. **Allowed Web Origins:**
   ```
   http://localhost:5000, https://your-production-domain.com
   ```

4. **Allowed Origins (CORS):**
   ```
   http://localhost:5000, https://your-production-domain.com
   ```

### 4. Configure Google Cloud Console OAuth2

**⚠️ CRITICAL STEP**: You need to add Auth0's callback URL to your Google Cloud Console:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (the one with "My MEAN Profiling App")
3. Go to "APIs & Services" > "Credentials"
4. Click on your OAuth 2.0 Client ID (`908461895884-4s3ij0vvgu40hh11m1cmo2edi53oifqn.apps.googleusercontent.com`)
5. **Add the following to "Authorized redirect URIs":**
   - `https://pwconsulting.auth0.com/login/callback` (Auth0's callback URL)
   - `http://localhost:5000` (for development)
   - `http://localhost:5000/profile` (for development profile redirect)
6. Click "Save"

**This is what's causing your `redirect_uri_mismatch` error!**

**⚠️ ALSO UPDATE AUTH0 DASHBOARD**: You need to add the profile redirect URI to your Auth0 application:

1. Go to [Auth0 Dashboard](https://manage.auth0.com/)
2. Go to "Applications" > "Applications"
3. Click on your application
4. Go to "Settings" tab
5. **Add to "Allowed Callback URLs":**
   - `http://localhost:5000/profile` (for development)
   - `https://yourdomain.com/profile` (for production)
6. Click "Save Changes"

### 5. Test the Integration

1. **Start your application:**
   ```bash
   npm run start:all
   ```

2. **Navigate to the login page** (`http://localhost:5000/account/login`)

3. **Click the "Continue with Google" button**

4. **You should be redirected to Google's OAuth consent screen**

5. **After successful authentication, you'll be redirected back to your app**

## 🔍 How It Works

1. **User clicks "Continue with Google"** → Auth0 handles the OAuth flow
2. **Google authenticates the user** → Returns to Auth0
3. **Auth0 redirects back to your app** → With authentication code
4. **Your app exchanges code for tokens** → Auth0 provides JWT tokens
5. **Frontend sends Auth0 token to backend** → Via `/accounts/auth0/authenticate`
6. **Backend validates Auth0 token** → Creates/updates user account
7. **Backend returns your app's JWT** → User is now logged in

## 🚨 Troubleshooting

### Common Issues:

1. **"Invalid redirect URI"**
   - Make sure your callback URLs in Auth0 match exactly

2. **"Invalid audience"**
   - Check that your API identifier in Auth0 matches the audience in environment config

3. **"CORS errors"**
   - Add your domain to Allowed Origins in Auth0 application settings

4. **"Token validation failed"**
   - Ensure your Auth0 domain is correct in environment config

### Debug Steps:

1. Check browser console for Auth0 errors
2. Check server logs for authentication errors
3. Verify Auth0 dashboard settings match your configuration
4. Test with a fresh browser session (clear cookies/cache)

## 📝 Next Steps

Once Google authentication is working:

1. **Add Facebook authentication** (similar process)
2. **Customize user roles** based on Auth0 user data
3. **Add profile picture sync** from Google/Facebook
4. **Implement logout functionality** with Auth0

## 🔐 Security Notes

- Never commit your Auth0 credentials to version control
- Use environment variables in production
- Regularly rotate your Auth0 secrets
- Monitor Auth0 logs for suspicious activity
