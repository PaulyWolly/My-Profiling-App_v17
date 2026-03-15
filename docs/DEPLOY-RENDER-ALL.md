# Run everything on Render (frontend + backend)

You can host **both** the Angular frontend and the Node/Express backend on Render—no Netlify needed.

**Alternative:** For Netlify (frontend) + Render (backend), see [DEPLOY-NETLIFY-RENDER.md](DEPLOY-NETLIFY-RENDER.md).

- **Backend**: Render **Web Service** (Node)
- **Frontend**: Render **Static Site** (built Angular app)

---

## Fix "Exited with status 1" / wrong build command (backend)

If your **backend** Web Service fails with **"Exited with status 1 while building your code"** and the log shows `Running build command 'npm install; npm run build'`, the Build Command is wrong. Fix it like this:

1. In the Render dashboard, open your **Web Service** (e.g. **My-Profiling-App_v17**).
2. In the **left sidebar**, click **Settings** (under the service name).
3. Scroll to the **Build & Deploy** section.
4. Find **Build Command**. It probably says `npm install; npm run build`.  
   - Change it to **only**: `npm install`  
   - (Delete `; npm run build` — the backend has no `build` script.)
5. Find **Start Command**. Set it to: `npm run start:prod`
6. Check **Root Directory**. It must be: `server`  
   - If it’s empty or something else, set it to `server`.
7. Click **Save Changes** (top or bottom of the page).
8. In the top-right, open **Manual Deploy** → **Deploy latest commit** (or push a new commit to trigger a deploy).

After the new deploy, the build should succeed and the service should start. If it still fails, open **Logs** in the left sidebar and check the new build output for the real error.

---

## 1. Deploy the backend (Web Service)

1. In the Render dashboard: **New +** → **Web Service**.
2. Connect your GitHub repo for this project.
3. Configure (backend has **no** `build` script—do **not** use `npm run build` here):
   - **Name**: e.g. `my-profiling-app-api`
   - **Root Directory**: `server`
   - **Runtime**: Node
   - **Build Command**: `npm install` only (not `npm install; npm run build`—that will fail)
   - **Start Command**: `npm run start:prod`
4. Add **Environment Variables** in the Web Service → **Environment** tab. Use these **keys** and **example values** (replace with your own):

   **Required (backend won’t start without these):**

   | Key | Example value | Where to get it |
   |-----|----------------|-----------------|
   | `NODE_ENV` | `production` | Literally the word `production`. |
   | `MONGODB_URI` | `mongodb+srv://myuser:mypassword@cluster0.xxxxx.mongodb.net/profiling-app?retryWrites=true&w=majority` | **MongoDB Atlas**: Cluster → Connect → “Connect your application” → copy the connection string. Replace `<password>` with your DB user password. |
   | `JWT_SECRET` | `a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456` | Generate a long random string. On your machine run: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and paste the output. |

   **Optional (only if you use the feature):**

   | Key | Example value | Where to get it |
   |-----|----------------|-----------------|
   | `DB_NAME` | `profiling-app` | Any name for your database. Default is `profiling-app` if omitted. |
   | `GOOGLE_MAPS_API_KEY` | `AIzaSyB...` | [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials → create API key, enable Maps JavaScript API. |
   | `AWS_ACCESS_KEY_ID` | `AKIAIOSFODNN7EXAMPLE` | AWS IAM → Users → your user → Security credentials → Create access key. |
   | `AWS_SECRET_ACCESS_KEY` | `wJalrXUtnFEMI/K7MDENG/...` | Shown once when you create the access key above. |
   | `AWS_REGION` or `S3_REGION` | `us-east-1` | Your S3 bucket’s region (e.g. `us-east-1`, `eu-west-1`). |
   | `S3_BUCKET_NAME` | `my-profiling-app-uploads` | Your S3 bucket name (for profile images). |

   **Important:** Do not commit real values to Git. Set them only in the Render **Environment** tab.

5. Deploy and note the backend URL, e.g. `https://my-profiling-app-api.onrender.com`.

---

## 2. Deploy the frontend (Static Site)

1. In the Render dashboard: **New +** → **Static Site**.
2. Connect the **same** GitHub repo.
3. Configure:
   - **Name**: e.g. `my-profiling-app`
   - **Root Directory**: leave **empty** (repo root)
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist/angular15-signup-verify-mongodb`
4. **Environment Variables** for the frontend: the built Angular app needs your **backend URL** and **Auth0** settings. You provide these either in `environment.prod.ts` (see below) or via a build script that reads Render env vars.

### Option A: Build-time API URL (recommended)

Angular bakes `environment.prod.ts` into the build. To use Render’s env vars you have two options:

**A1. One-time setup: `environment.prod.ts`**

1. Copy `src/environments/environment.prod.example.ts` to `src/environments/environment.prod.ts`.
2. Fill in the values using this table (use **your** backend and frontend Render URLs and Auth0 details):

   | Property | Example value | Where to get it |
   |----------|----------------|-----------------|
   | `apiUrl` | `https://my-profiling-app-api.onrender.com` | Your **backend** Render Web Service URL (from step 1). No trailing slash. |
   | `wsUrl` | `wss://my-profiling-app-api.onrender.com` | Same as `apiUrl` but start with `wss://` instead of `https://` (for WebSocket/chat). |
   | `googleMapsApiKey` | `AIzaSyB...` or `''` | Same as backend if you use maps; otherwise leave as `''`. |
   | `auth0.domain` | `dev-xxxxxx.us.auth0.com` | Auth0 dashboard → Applications → your app → Settings → **Domain**. |
   | `auth0.clientId` | `AbCdEfGhIjKlMnOpQrStUvWxYz` | Auth0 → same app → Settings → **Client ID**. |
   | `auth0.authorizationParams.redirect_uri` | `https://my-profiling-app.onrender.com` | Your **frontend** Render Static Site URL (this exact URL must be added in Auth0 “Allowed Callback URLs”). |
   | `auth0.authorizationParams.audience` | `''` or your API identifier | Usually leave `''` unless Auth0 docs say otherwise. |

   **Example `environment.prod.ts`** (replace with your real URLs and Auth0 values):

   ```ts
   export const environment = {
     production: true,
     apiUrl: 'https://my-profiling-app-api.onrender.com',
     wsUrl: 'wss://my-profiling-app-api.onrender.com',
     googleMapsApiKey: '',
     auth0: {
       domain: 'dev-xxxxxx.us.auth0.com',
       clientId: 'AbCdEfGhIjKlMnOpQrStUvWxYz',
       authorizationParams: {
         redirect_uri: 'https://my-profiling-app.onrender.com',
         audience: ''
       }
     }
   };
   ```

3. Commit and push (only if the repo is private and you accept the API URL in the repo). Render will run `npm run build`, which uses `environment.prod.ts`.

**A2. Script to generate `environment.prod.ts` from env vars**

If you prefer not to commit the API URL, add a small script that writes `environment.prod.ts` from environment variables (e.g. `API_URL`, `WS_URL`, `AUTH0_REDIRECT_URI`, `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`) and run it in the **Build Command** before `npm run build`. Then set those env vars in the Render Static Site → **Environment** tab with the same example values as in the table above.

### SPA routing on Render

Render Static Sites serve `index.html` for unknown paths by default for single-page apps, so Angular routing should work without extra config. If you see 404s on refresh, add a **Redirect/Rewrite** in the Static Site settings: path `/*`, redirect to `/index.html` with status 200.

---

## 3. Auth0

In the Auth0 dashboard: [auth0.com](https://manage.auth0.com/) → **Applications** → your app → **Settings**.

Add these **exact** values (use your real frontend Render URL):

| Setting | Value to add |
|--------|---------------|
| **Allowed Callback URLs** | `https://my-profiling-app.onrender.com` (or your Static Site URL; comma-separate if you have more) |
| **Allowed Logout URLs** | `https://my-profiling-app.onrender.com` |
| **Allowed Web Origins** | `https://my-profiling-app.onrender.com` |

Then click **Save Changes**. If these don’t match `auth0.authorizationParams.redirect_uri` in your frontend, login will fail.

---

## 4. Summary

| What        | Render type   | URL you get                          |
|------------|---------------|--------------------------------------|
| Backend API | Web Service   | `https://my-profiling-app-api.onrender.com` |
| Frontend   | Static Site   | `https://my-profiling-app.onrender.com`     |

Set the frontend’s `apiUrl` and `wsUrl` to the **backend** URL, and Auth0’s redirect/callback to the **frontend** URL. Everything then runs on Render.
