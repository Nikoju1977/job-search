# NIKO Intelligence Engine 3.0 — architecture autonome sans Supabase et sans n8n

## Vue d'ensemble
Le moteur appartient au dépôt Niko Emploi. Le client \`public/niko-engine.js\` est une bibliothèque JavaScript universelle (browser et Node) qui ne dépend d'aucun service IA externe : aucune donnée de CV n'est transmise pour calculer la compatibilité.

### Agents intégrés
- **Scout :** les offres proviennent de sources publiques réelles du backend. Le moteur de recommandations filtre les doublons et les candidatures déjà envoyées.
- **Match :** score indicatif sur cinq axes (intitulé recherché, preuves de compétences, parcours, localisation et fraîcheur). Le détail est consultable sur chaque carte.
- **Trust :** signaux de fraudes habituelles, sans affirmer qu'une offre est garantie.
- **Reply :** tri prudent des messages recruteurs, sans envoi automatique depuis l'analyse locale.
- **Coach :** entraînement à l'entretien et calendrier local.
- **Orchestrator :** radar présentant les meilleures offres, avec relecture avant candidature.

Le modèle reste une **aide à la décision, pas une décision de recrutement**. Il ne calcule pas de statut de handicap et n'utilise jamais la RQTH pour dégrader la note.

### Surveillance locale
Dans le Studio, l'utilisateur peut activer la surveillance **tant que l'onglet est ouvert et visible**. Une recherche d'offres réelles est relancée approximativement toutes les 15 minutes. Rien n'est envoyé aux recruteurs par ce contrôle. Les URL déjà vues sont conservées uniquement dans la session du navigateur. Le CV reste dans le navigateur.

### Surveillance publique serveur
La fonction \`api/engine-cron.js\` est planifiée chaque jour à 06:00 UTC sur Vercel. Sans \`DATABASE_URL\`, elle renvoie \`paused\` et ne scanne rien. Avec la base et \`CRON_SECRET\`, elle :
1. Recherche les offres réelles des sources disponibles.
2. Valide et déduplique les résultats.
3. Insère ou met à jour les annonces dans PostgreSQL/Neon par URL unique.
4. Conserve les statistiques des sources et élimine les annonces non observées depuis 60 jours.

Les annonces publiques ne comportent pas le CV ni l'identité des candidats. **Ce composant ne surveille pas encore les e-mails ni les candidatures individuelles : il constitue le catalogue autonome, pas la totalité du système d'agents.**

### Activer le catalogue serveur
1. Créer une base PostgreSQL/Neon et y exécuter \`database/niko-autonomy.sql\`.
2. Renseigner dans Vercel \`DATABASE_URL\` (chaîne de connexion à une base prévue pour ce service) et \`CRON_SECRET\` (au moins 16 caractères aléatoires). Ne jamais mettre les secrets dans GitHub ou dans un chat.
3. Redéployer la production. Un cron quotidien est compatible avec les restrictions des plans Hobby ; les cadences plus fréquentes dépendent du plan Vercel.
4. Vérifier la rubrique Vercel Cron Jobs, les exécutions et les lignes des tables \`niko_scan_runs\` et \`niko_public_jobs\`.
5. Faire vérifier les sources, limites de fréquence, droit de réutilisation des contenus et la politique de conservation.

### Étapes supplémentaires indispensables à une autonomie candidats 24 h/24
La base publique ne suffit pas. Pour un agent agissant au nom de personnes physiques, il faudra une authentification multi-utilisateurs **sans Supabase**, un stockage chiffré des profils et des autorisations e-mail, un planificateur de tâches candidates, la révocation des accès et les garde-fous d'envoi. Les services de communication (Gmail ou un domaine de messagerie contrôlé) requièrent une configuration et une validation propres. Niko Emploi ne doit jamais confirmer automatiquement un entretien, accepter un contrat, négocier un salaire ou divulguer une RQTH.

### Tests
\`npm test\` couvre l'analyse multicritère, les limites de confiance, la non-discrimination RQTH, les refus, la déduplication, le verrouillage du cron, ainsi que les anciens parcours. Les tests HTTP réels de Google ou de la base PostgreSQL ne sont pas réalisés sans identifiants de test fournis dans un environnement protégé.

Dernière mise à jour : octobre 2026.
