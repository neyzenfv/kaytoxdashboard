# KAYTOX DASHBOARD
Backend Node sans framework + frontend statique. En local, les données sont dans `data/`; sur Vercel, Postgres et Blob sont utilisés.

## Lancer en local
    node server.js      # Node 20+, http://localhost:3000  (code par défaut : KAYTOX)

## Mettre en ligne sur Vercel
1. Importe le dépôt dans Vercel et sélectionne comme répertoire racine celui qui contient `server.js` et `package.json`.
2. Dans le Marketplace, connecte une base Postgres (par exemple Neon) et crée un Blob store **privé**.
3. Vérifie que le projet reçoit `POSTGRES_URL` (ou `DATABASE_URL`) et que le Blob store est connecté au projet.
4. Dans les variables d’environnement Vercel, définis `KAYTOX_CODE` et `SESSION_SECRET` (une longue valeur aléatoire), puis redéploie.
5. Les images téléversées via Vercel sont limitées à 4 Mo. Le stockage privé est servi uniquement après connexion.

## Mettre en ligne sur Render, Railway, Fly.io ou un VPS
1. Dépose ce dossier dans un dépôt GitHub, crée un « Web Service » Node (commande : `node server.js`).
2. Variables : `KAYTOX_CODE=KAYTOX` et `SESSION_SECRET=<texte aléatoire long>`.
3. IMPORTANT : ajoute un disque persistant monté sur `/data` et mets `DATA_DIR=/data`, sinon tes données sont perdues à chaque redéploiement.
4. Ouvre l’URL (HTTPS) sur l’iPhone → Partager → « Sur l’écran d’accueil ».

## Limites
- Code vérifié côté serveur, 5 essais / 15 min, session d’un an (cookie HttpOnly).
- Notifications push 8h/18h : NON incluses (nécessitent web-push + clés VAPID + tâche planifiée sur le serveur ; iOS 16.4+ et PWA installée requis).
