# Niko Emploi — Intelligence 4.0, sans Supabase ni n8n

## Architecture
Une application Vercel unique : interface, API Node et moteur de matching. PostgreSQL/Neon conserve les comptes, CV chiffrés, candidatures, consentements et recommandations. Vercel Cron déclenche périodiquement le moteur même lorsque le navigateur est fermé.
Le code ne contient aucune base Supabase ni orchestration n8n. Les e-mails de connexion sont envoyés par Resend avec un domaine vérifié. Un compte est créé à la première connexion via un lien à usage unique.

## Activation
1. Créer une base PostgreSQL Neon en région adaptée aux obligations de protection des données.
2. Dans Neon, exécuter les migrations dans cet ordre : database/niko-autonomy.sql, puis database/niko-engine-v4.sql.
3. Vérifier un domaine expéditeur dans Resend.
4. Configurer directement dans Vercel les variables suivantes : DATABASE_URL, DATA_ENCRYPTION_KEY (32 octets base64), RESEND_API_KEY, EMAIL_FROM, APP_ORIGIN=https://niko-emploi.vercel.app, CRON_SECRET (secret aléatoire long). Ne jamais fournir ces secrets dans le chat ni sur GitHub.
5. Redéployer. Tester la connexion par lien e-mail, la persistance et le chiffrement du CV, les contrôles de veille, la suppression du compte, et les résultats d'un cron autorisé.
6. OPENAI_API_KEY et GOOGLE_CLIENT_ID sont facultatifs pour la lettre générative et Gmail ; Google nécessite les permissions et vérifications OAuth appropriées pour une diffusion publique.

## Capacités réelles
Le moteur compare les profils sauvegardés et consentis aux offres indexées selon cinq axes explicables, sans utiliser le statut RQTH personnel comme variable de décision. Les filtres inclusion dépendent uniquement des annonces. Un bouton arrête la veille. Les propositions restent consultables dans le cockpit.
Aucune candidature ni réponse recruteur n'est envoyée par le cron. L'envoi Gmail du Studio nécessite toujours une autorisation humaine et un navigateur connecté. Le moteur peut recommander de nouvelles annonces même lorsque le site du candidat est fermé, lorsque le cron et la base sont effectivement configurés.

## Fréquence et capacité
Le cron est programmé pour 06:00 UTC tous les jours. Le plan Vercel Hobby limite les tâches à une exécution quotidienne, sans précision à la minute. La version actuelle traite au plus quatre candidats par passage afin de respecter la limite serveur : pour une grande plateforme, prévoir partitionnement, queue et budget.

## Avant le lancement public
Tester réellement sur comptes de démonstration, configurer la lutte anti-spam des liens de connexion et la surveillance d'échecs, faire valider les mentions légales, la confidentialité, les sauvegardes et l'accessibilité. La rotation de la clé de chiffrement nécessite une migration des données cryptées.
Exécuter npm test pour la suite automatisée, sans confondre réussite des tests et mise en service des API externes.