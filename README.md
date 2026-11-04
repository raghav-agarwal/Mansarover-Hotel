# Hotel Mansarover app

React + Vite + Tailwind PWA on Firebase (Firestore + Hosting).

## Setup
1. Create a Firebase project, add a Web app, and enable Firestore (production mode).
2. Copy `.env.example` to `.env` and fill in the web app config values.
3. `npm install` then `npm run dev`.
4. On first open, the login page asks you to create the Management account.

## Deploy
```
npm run build
npx firebase-tools login
npx firebase-tools init   # choose existing project; keep firebase.json as is
npx firebase-tools deploy
```

## Phases
1. Setup, PIN login, roles, route shell (done)
2. User management (done)
3. Daily summary + pending banner (done)
4. Monthly table (done)
5. Tasks (done)
6. Polish and deploy (done, see DEPLOY.md)

## Security note
Login is checked against the database (no Firebase Auth), so Firestore rules are open and role
checks run in the app only. Keep the project private.
