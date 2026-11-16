# KAYTOX DASHBOARD
Backend Node (sans dépendance) + frontend statique + données dans `data/` (db.json + uploads).

## Lancer en local
    node server.js      # http://localhost:3000  (code par défaut : KAYTOX)

## Mettre en ligne (Render, Railway, Fly.io, VPS…)
1. Dépose ce dossier dans un dépôt GitHub, crée un « Web Service » Node (commande : `node server.js`).
2. Variables : `KAYTOX_CODE=KAYTOX` et `SESSION_SECRET=<texte aléatoire long>`.
3. IMPORTANT : ajoute un disque persistant monté sur `/data` et mets `DATA_DIR=/data`, sinon tes données sont perdues à chaque redéploiement.
4. Ouvre l’URL (HTTPS) sur l’iPhone → Partager → « Sur l’écran d’accueil ».

## Limites
- Code vérifié côté serveur, 5 essais / 15 min, session d’un an (cookie HttpOnly).
- Notifications push 8h/18h : NON incluses (nécessitent web-push + clés VAPID + tâche planifiée sur le serveur ; iOS 16.4+ et PWA installée requis).
