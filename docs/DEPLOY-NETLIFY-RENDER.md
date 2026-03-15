# Deploy: Netlify (frontend) + Render (backend)

This guide covers the **split** setup: Angular frontend on **Netlify**, Node/Express API on **Render**.

**Alternative:** To run both frontend and backend on Render, see [DEPLOY-RENDER-ALL.md](DEPLOY-RENDER-ALL.md).

- **Frontend**: Netlify **Static Site** (built Angular app)
- **Backend**: Render **Web Service** (Node)

---

## 1. Deploy the backend on Render

1. Go to [dashboard.render.com](https://dashboard.render.com) → **New +** → **Web Service**.
2. Connect your GitHub repo for this project.
3. Configure the service:

   | Field | Value |
   |-------|--------|
   | **Name** | e.g. `my-profiling-app-api` |
   | **Root Directory** | `server` |
   | **Runtime** | Node |
   | **Build Command** | `npm install` |
   | **Start Command** | `npm run start:prod` |

4. In **Environment**, add:
   - `NODE_ENV` = `production`
   - `MONGODB_URI` = your MongoDB connection string (e.g. from [MongoDB Atlas](https://www.mongodb.com/cloud/atlas))
   - `JWT_SECRET` = a long random string (e.g. run `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)

   Optional: `GOOGLE_MAPS_API_KEY`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `S3_BUCKET_NAME` (see [DEPLOY-RENDER.md](DEPLOY-RENDER.md)).

5. Deploy and copy the backend URL, e.g. `https://my-profiling-app-api.onrender.com`.

---

## 2. Configure the Angular app for production

The frontend must call your **Render backend** and use your **Netlify URL** for Auth0 redirects.

1. Copy the production environment example:

   ```bash
   cp src/environments/environment.prod.example.ts src/environments/environment.prod.ts
   ```

2. Edit `src/environments/environment.prod.ts`:

   - **apiUrl**: your Render backend URL, e.g. `https://my-profiling-app-api.onrender.com`
   - **wsUrl**: same host with `wss://`, e.g. `wss://my-profiling-app-api.onrender.com`
   - **auth0.authorizationParams.redirect_uri**: your **Netlify** site URL (you’ll get this after creating the site), e.g. `https://your-app-name.netlify.app`

3. Do **not** commit `environment.prod.ts` if it contains secrets; add it to `.gitignore` if needed. For Netlify you can instead use build-time env vars and a script that generates this file.

---

## 3. Auth0 settings

In the Auth0 dashboard (Application → Settings):

- **Allowed Callback URLs**: add your Netlify URL, e.g. `https://your-app-name.netlify.app`
- **Allowed Logout URLs**: same
- **Allowed Web Origins**: same

---

## 4. Deploy the frontend on Netlify

1. Push your code to GitHub (with `environment.prod.ts` configured for production, or a build that injects API URL from Netlify env vars).

2. In [Netlify](https://app.netlify.com): **Add new site** → **Import an existing project** → connect the GitHub repo.

3. Netlify will use the repo’s `netlify.toml`:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist/angular15-signup-verify-mongodb`

   Override in the Netlify UI only if needed.

4. Deploy. Your site will be at a URL like `https://your-app-name.netlify.app`.

5. If you didn’t set `auth0.authorizationParams.redirect_uri` yet, update `environment.prod.ts` to this Netlify URL and redeploy.

---

## 5. Optional: restrict CORS on the backend

In `server/server.js` you can limit CORS to your Netlify origin:

```js
const corsOptions = {
  origin: ['https://your-app-name.netlify.app'],
  credentials: true,
  // ... rest unchanged
};
```

---

## 6. Checklist

- [ ] Render Web Service deployed; backend URL works (e.g. `https://your-api.onrender.com`).
- [ ] `environment.prod.ts` has **apiUrl** and **wsUrl** pointing at the Render backend.
- [ ] **auth0.authorizationParams.redirect_uri** is your Netlify URL.
- [ ] Auth0 dashboard has the Netlify URL in callback, logout, and web origins.
- [ ] Netlify build succeeds; publish directory is `dist/angular15-signup-verify-mongodb`.
- [ ] Visiting the Netlify URL lets you log in and use the app (API and Auth0 work).

---

## Summary

| Part     | Host    | URL example                          |
|----------|---------|--------------------------------------|
| Frontend | Netlify | `https://your-app-name.netlify.app`  |
| Backend  | Render  | `https://my-profiling-app-api.onrender.com` |

Set the frontend’s **apiUrl** and **wsUrl** to the **Render** URL, and Auth0’s redirect/callback to the **Netlify** URL.

For **all on Render** (no Netlify), see [DEPLOY-RENDER-ALL.md](DEPLOY-RENDER-ALL.md).
