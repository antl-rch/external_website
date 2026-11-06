# Déploiement Cloudflare depuis GitHub

Le dépôt `antl-rch/external_website` reste la source. Cloudflare Pages construit chaque commit de la branche configurée avec `npm run build:cloudflare`, puis sert `dist`.

Variables du projet : `NODE_VERSION=24.22.1`, `VITE_HOSTING_PLATFORM=cloudflare`, `VITE_OLYMPE_API_URL` selon la cible. Aucune de ces variables n'est secrète. Les identifiants serveur ne doivent jamais entrer dans un bundle Vite.

Pendant la validation, `CLOUDFLARE_BUILD_PREVIEW=true` impose noindex dans les en-têtes. Cette variable doit être false pour les domaines publics lors de la bascule validée. Les en-têtes sont produits depuis vercel.json ; les paramètres Vercel restent utilisables pendant la transition.

Vercel Analytics n'est pas initialisé sur Cloudflare. La mesure Google Analytics continue de dépendre du consentement existant.

Aucun domaine de production ne doit être associé avant vérification du build, des routes, du formulaire et du retour arrière. Ne pas téléverser manuellement un dossier dist : les déploiements proviennent de l'intégration GitHub.
