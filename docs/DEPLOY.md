# Deploying the app so others can use it

You can run the **Angular frontend** on **Netlify** and host the **Node/Express backend** somewhere else. Netlify only serves static files and serverless functions; it does not run a long‑running server (so no Express, MongoDB, or WebSockets on Netlify).

---

## 1. Host the backend (API) somewhere

The app needs:

- **Node/Express server** (`server/`)
- **MongoDB** (Atlas or another provider)
- **Auth0** (you already have this)
- Optional: **S3** for profile images, **WebSockets** for chat

Good options for the backend:

| Service   | Notes                                      |
|----------|---------------------------------------------|
| **Render** | Free tier, runs Node, easy deploy from Git. **Step-by-step: see [DEPLOY-RENDER.md](DEPLOY-RENDER.md).** |
| **Railway** | Free tier, supports Node + MongoDB add‑ons  |
| **Fly.io**  | Free tier, good for WebSockets              |
| **Cyclic**  | Free tier, Node support                     |

**If you use Render**, follow **[DEPLOY-RENDER.md](DEPLOY-RENDER.md)** for the exact build/start commands and environment variables. Summary:

1. Push your repo to GitHub.
2. Create a **Web Service** on [render.com](https://render.com), connect the repo.
3. Set **Root Directory** to `server` (not the repo root).
4. **Build command**: `npm install`
5. **Start command**: `npm run start:prod` (or `npm start` if that’s what your `server/package.json` uses).
6. Add **Environment Variables** in the Render dashboard: `server/secrets/.env` and `server/secrets/config.json` (e.g. `PORT`, MongoDB URL, Auth0, AWS for S3, etc.). Do **not** commit real secrets; use Render’s env vars.
7. Deploy. Note the URL, e.g. `https://your-app-name.onrender.com`.

If you use **WebSockets** (chat), pick a host that supports them (e.g. Render, Fly.io) and use the same base URL for the API and WebSockets.

Your backend currently allows all CORS origins. For production you can restrict this in `server/server.js` to your Netlify domain (e.g. `https://your-site.netlify.app`) for better security.

---

## 2. Configure production environment (Angular)

Before building the frontend for production, point it at your deployed API and Auth0.

1. Copy the example prod env and fill in real values:

   ```bash
   cp src/environments/environment.prod.example.ts src/environments/environment.prod.ts
   ```

2. Edit `src/environments/environment.prod.ts`:

   - **apiUrl**: your backend URL, e.g. `https://your-app-name.onrender.com`
   - **wsUrl**: WebSocket URL, e.g. `wss://your-app-name.onrender.com` (same host, `wss` instead of `https`)
   - **auth0**: same Auth0 app; set **authorizationParams.redirect_uri** to your **Netlify site URL** (e.g. `https://your-site.netlify.app`)

3. In the **Auth0 dashboard** (Application → Settings):

   - Add to **Allowed Callback URLs**: `https://your-site.netlify.app` (and any paths Auth0 uses, e.g. `https://your-site.netlify.app/*` if required).
   - Add to **Allowed Logout URLs**: `https://your-site.netlify.app`
   - Add to **Allowed Web Origins**: `https://your-site.netlify.app`

4. **Do not commit** `environment.prod.ts` if it contains secrets. Add it to `.gitignore` if needed, and use Netlify build env or a secure way to inject values in CI.

---

## 3. Deploy the frontend to Netlify

1. **Build locally (optional but recommended first):**

   ```bash
   npm ci
   npm run build
   ```

   Open `dist/angular15-signup-verify-mongodb/index.html` in a browser and confirm the app loads (it will call your production API if `environment.prod.ts` is set).

2. **Deploy to Netlify:**

   - Push your code to GitHub (without real secrets; use env vars / Netlify env for production URLs if you prefer).
   - In [Netlify](https://app.netlify.com): **Add new site → Import an existing project** and connect the GitHub repo.
   - Netlify will use the repo’s `netlify.toml`:
     - **Build command**: `npm run build`
     - **Publish directory**: `dist/angular15-signup-verify-mongodb`
   - If you need to override:
     - **Build command**: `npm run build`
     - **Publish directory**: `dist/angular15-signup-verify-mongodb`
   - Save and deploy.

3. **SPA routing:**  
   The repo’s `netlify.toml` and `src/_redirects` are set so all routes serve `index.html` (Angular handles routing). No extra step needed.

4. **Custom domain (optional):**  
   In Netlify: Site settings → Domain management → Add custom domain.

---

## 4. Checklist

- [ ] Backend deployed and reachable (e.g. `https://your-api.onrender.com`).
- [ ] MongoDB and Auth0 (and S3 if used) configured for the backend via env vars.
- [ ] `environment.prod.ts` (or build-time env) has correct `apiUrl`, `wsUrl`, and `auth0.redirect_uri` for the Netlify URL.
- [ ] Auth0 dashboard has the Netlify URL in callback, logout, and web origins.
- [ ] Netlify build succeeds and the published folder is `dist/angular15-signup-verify-mongodb`.
- [ ] You open the Netlify URL and can log in and use the app (API and Auth0 work).

---

## Summary

- **Netlify** = Angular frontend only (static files).
- **Render / Railway / Fly.io / etc.** = Node API, DB, WebSockets, uploads.
- Set **apiUrl** and **wsUrl** (and Auth0 redirect URI) to your backend and Netlify URLs so the frontend talks to the right API and Auth0 from the live site.
