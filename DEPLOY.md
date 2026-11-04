# Deploying Hotel Mansarover

1. https://console.firebase.google.com → Add project → (analytics not needed).
2. Build > Firestore Database > Create database (production mode, region asia-south1 / Mumbai).
3. Project settings > Your apps > Web (</>) → register app → copy the config into `.env`
   (see `.env.example`).
4. In a terminal in this folder:
   ```
   npm install
   npm run build
   npx firebase-tools login
   npx firebase-tools use --add      # pick your project
   npx firebase-tools deploy --only firestore:rules,hosting
   ```
5. Open the Hosting URL on a phone → browser menu → "Add to Home screen" / "Install app".
6. First visit asks you to create the Management account. Then add other users under Users.

Note: Firestore rules are open because login is not via Firebase Auth. Don't share the URL or
project keys beyond staff. If a query ever asks for an index, click the link in the error.
