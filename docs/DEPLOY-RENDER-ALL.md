# Run everything on Render (frontend + backend)

You can host **both** the Angular frontend and the Node/Express backend on Render—no Netlify needed.

**Alternative:** For Netlify (frontend) + Render (backend), see [DEPLOY-NETLIFY-RENDER.md](DEPLOY-NETLIFY-RENDER.md).

- **Backend**: Render **Web Service** (Node)
- **Frontend**: Render **Static Site** (built Angular app)

---

## Quick checklist (what to do on Render)

Do these in order. Fill in your real URLs and secrets where shown.

### Backend (Web Service)

| Step | Where on Render | What to set |
|------|-----------------|-------------|
| 1 | **New +** → **Web Service** → connect this repo | — |
| 2 | **Settings** → **Build & Deploy** | **Root Directory:** `server` |
| 3 | Same | **Build Command:** `npm install` (nothing else) |
| 4 | Same | **Start Command:** `npm run start:prod` |
| 5 | **Environment** tab | Add variables (see table below) |

**Backend env vars (required):**

| Key | Value (use your own) |
|-----|----------------------|
| `NODE_ENV` | `production` |
| `MONGODB_URI` | Your MongoDB Atlas connection string (replace `<password>`) |
| `JWT_SECRET` | Long random string, e.g. run: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

**Backend env vars (optional):** `API_URL` (your backend URL, e.g. `https://my-profiling-app-api.onrender.com` — needed so image upload URLs are correct when S3 is not used), `DB_NAME`, `GOOGLE_MAPS_API_KEY`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `S3_BUCKET_NAME` (see section 1 below).

After deploy, copy your **backend URL** (e.g. `https://my-profiling-app-api.onrender.com`).

---

### Frontend (Static Site)

| Step | Where on Render | What to set |
|------|-----------------|-------------|
| 1 | **New +** → **Static Site** → connect same repo | — |
| 2 | **Settings** → **Build & Deploy** | **Root Directory:** leave empty |
| 3 | Same | **Build Command:** `npm install && npm run build` |
| 4 | Same | **Publish Directory:** `dist/angular15-signup-verify-mongodb` |
| 5 | **Redirects/Rewrites** | Add rule: **Source** `/*` → **Destination** `/index.html` → **Rewrite** |

**Frontend:** Ensure `src/environments/environment.prod.ts` has your **backend** URL in `apiUrl` and `wsUrl`, and your **frontend** URL in `auth0.authorizationParams.redirect_uri`. Commit and push so Render builds with the correct API URL.

After deploy, copy your **frontend URL** (e.g. `https://my-profiling-app.onrender.com`).

---

### Auth0 (one-time)

| Step | Where | What to do |
|------|--------|------------|
| 1 | Auth0 → **Applications** → your app → **Settings** | In **Allowed Callback URLs**, **Allowed Logout URLs**, **Allowed Web Origins** add your **frontend** URL (e.g. `https://my-profiling-app.onrender.com`) |
| 2 | Save | — |

---

### Images (profile / followers)

- **Uploads:** The app uses the **hybrid** upload endpoint so uploads work on Render even without S3. Set **`API_URL`** on the backend to your Render backend URL so returned image URLs are correct.
- **Why follower images work locally but not on Render:** Images uploaded **locally** live only in `server/uploads/followers/` on your machine (not in Git; Render has no access). The DB stores the path, so production requests the file from Render’s server—where it doesn’t exist. **Fix:** Set S3 env vars on the backend, then **re-upload** those follower images while logged in on the **production** site so they go to S3; or the app will show the default avatar for missing images.
- **Option A:** Follower and profile image files under `server/uploads/` are only on the machine where they were uploaded; they are typically not in Git. Production will not have them unless you use S3.
- **Gallery:** Each user has a **Gallery** section (photos & videos). Same hybrid S3 + local storage. Sharing is **Only me** or **Share with specific member(s)** only—no public viewing; users choose exactly who can see their gallery.
- **Option B:** Set S3 env vars on the **backend** (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `S3_BUCKET_NAME`) and re-upload images in the live app so they’re stored in S3 and URLs in the DB point to S3.

---

### S3 environment variables – what to assign

These are **environment variables** you add in Render: open your **backend** Web Service → **Environment** tab → **Add Environment Variable**. The server reads them when it runs `npm run start:prod` (via `write-config-from-env.js`).

| Key | What to assign | Where you get it |
|-----|----------------|-------------------|
| `AWS_ACCESS_KEY_ID` | Your AWS access key ID (e.g. `AKIA...`, ~20 characters) | **AWS Console** → **IAM** → **Users** → your user → **Security credentials** → **Create access key** → copy **Access key ID**. |
| `AWS_SECRET_ACCESS_KEY` | The matching secret key (long string, ~40 characters) | Same **Create access key** flow → copy **Secret access key** (shown only once; store it securely). |
| `AWS_REGION` | The region where your S3 bucket lives | e.g. `us-east-1`, `us-west-2`. In **S3** → your bucket → **Properties** → **AWS Region**. |
| `S3_BUCKET_NAME` | The exact name of your S3 bucket | **S3** → **Buckets** → your bucket name (e.g. `my-profiling-app-images`). Must be globally unique. |

**One-time setup in AWS:**

1. **Create an S3 bucket** (if you don’t have one): S3 → Create bucket → choose a name and region. For this app, uploads use `public-read` so images load in the browser; you may need to allow public read in the bucket policy or turn off “Block all public access” for the bucket (or use a policy that allows public read on the uploaded object prefix).
2. **Create an IAM user** for the app: IAM → Users → Create user → attach a policy that allows `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` (and `s3:PutObjectAcl` if using public-read) on that bucket. Create an **Access key** for programmatic access and copy the Access key ID and Secret access key into the Render env vars above.
3. In Render, add the four variables; **do not** commit these values to Git.

After you set them and redeploy, profile, follower, and gallery uploads will go to S3 and the stored URLs will work in production.

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

## Fix "Cannot find module 'mongoose'" (backend)

If the backend fails on start with **`Error: Cannot find module 'mongoose'`** and the log shows **`Running 'npm run start:server:prod'`**, the backend is running from the **repo root** instead of the `server` folder, so `server/node_modules` was never installed.

**Fix:**

1. In the Render dashboard, open your **backend Web Service** → **Settings**.
2. Under **Build & Deploy**, set **Root Directory** to: **`server`** (not empty, not the repo root).
3. Set **Build Command** to: **`npm install`**.
4. Set **Start Command** to: **`npm run start:prod`** (not `npm run start:server:prod`).
5. Save and trigger a **Manual Deploy** → **Deploy latest commit**.

With **Root Directory** = `server`, the build runs inside `server/`, installs mongoose and other backend deps into `server/node_modules`, and the start command finds them.

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

### SPA routing on Render (fix "Not found" on refresh)

If you see a white page or **"Not found"** when you **refresh** or open a direct link (e.g. `/profile`), the static server isn’t sending `index.html` for those paths. Add a **Rewrite** rule so all routes serve `index.html` and Angular can handle routing:

1. In the Render dashboard, open your **frontend Static Site** (e.g. My-Profiling-App_v17-1).
2. Go to **Settings** (left sidebar).
3. Find the **Redirects/Rewrites** section (under Build & Deploy or its own section).
4. Click **Add Rule** (or **Add Redirect/Rewrite**).
5. Add a **Rewrite** (not Redirect):
   - **Source (path):** `/*`
   - **Destination:** `/index.html`
   - **Action/Type:** **Rewrite** (so the URL stays the same and the response is 200 with index.html content).
6. Save. Redeploy if needed.

After this, refreshing or opening e.g. `https://your-site.onrender.com/profile` will return `index.html` and Angular will show the right view.

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
