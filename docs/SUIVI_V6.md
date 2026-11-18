# Niko Emploi V6 — Suivi de candidatures

## Accès

- Tableau Kanban : /suivi.html
- Studio de préparation et Gmail : /candidatures.html
- API privée : /api/tracker
- Migration PostgreSQL : database/niko-tracker-v6.sql

Le code existant du Studio et de l'envoi Gmail vérifié est conservé. Aucun e-mail de candidature ou de relance n'est envoyé automatiquement à un recruteur.

## Fonctionnalités sans compte

- Tableau Kanban par étapes : préparation, envoi déclaré, réponse, entretien, proposition et clôture.
- Création, modification, archivage et suppression des dossiers ; employeur, poste, URL, canal, contact, notes, échéances, date d'entretien et libellé de version de CV.
- Suggestion de relance à 7, 14 ou 21 jours, liste des actions dues, brouillon de relance à copier ou ouvrir dans son client e-mail.
- Export d'entretien au format ICS, sans ajouter un événement à un agenda à l'insu du candidat.
- Statistiques calculées uniquement sur les dossiers enregistrés, avec précision sur les dates manquantes.
- Export CSV / JSON sur confirmation, protection contre les injections de formules CSV.
- Import volontaire des anciens historiques locaux, sans fausse preuve d'envoi.
- Page statique et scripts PWA disponibles hors connexion après chargement.
- Effacement explicite des dossiers locaux et des métadonnées Gmail locales.

**Confidentialité locale :** notes et métadonnées sont conservées dans localStorage, sans chiffrement au repos. Ne pas utiliser sur un ordinateur partagé. La version de CV dans le dossier est un **libellé**, pas une pièce jointe stockée.

## Fonctionnalités avec compte configuré

- Authentification existante par lien e-mail, cookies de session HttpOnly.
- Notes personnelles et texte des événements chiffrés côté serveur AES-256-GCM avec contexte par utilisateur.
- Toutes les requêtes SQL restreintes au propriétaire via user_id authentifié.
- Journal des événements et modification avec version optimiste : erreur 409 en cas de conflit entre appareils.
- Suivi de candidatures spontanées sans URL, sans lien artificiel.
- Synchronisation volontaire des dossiers locaux et de leurs événements datés (maximum 20 dossiers par opération).
- Rappels e-mail quotidiens uniquement après opt-in. Réservation atomique par utilisateur et jour ; clé d'idempotence fournisseur.
- Suppression des dossiers et des événements associés ; suppression de compte par cascade dans les tables existantes.

**État vérifiable :** sans migration Neon et variables Vercel, le suivi reste local. Un envoi saisi manuellement est une déclaration, et non une preuve SMTP. Les messages recruteurs ne sont pas expédiés automatiquement.

## Mise en service de la base Neon

1. S'assurer que database/niko-autonomy.sql et database/niko-engine-v4.sql sont déjà installés.
2. Sauvegarder la base et appliquer database/niko-tracker-v6.sql dans Neon. La migration est additive.
3. Configurer côté serveur : DATABASE_URL, DATA_ENCRYPTION_KEY (clé base64 de 32 octets), RESEND_API_KEY, EMAIL_FROM, APP_ORIGIN, CRON_SECRET. Ne jamais publier leurs valeurs.
4. Vérifier /api/tracker?public=true, puis se connecter sur /candidatures.html avec un compte de test et ouvrir /suivi.html.
5. Tester création, statut, conflit de version, import, suppression, compteurs, notes chiffrées, suivi d'entretien et consentement d'alerte e-mail.
6. Ne fusionner la PR sur main qu'après contrôle du déploiement et de la migration.

Le retour arrière de la version web peut se faire par rollback Vercel sans supprimer les colonnes ajoutées. Ne jamais effacer les tables v6 en production avant d'avoir pris en compte les données utilisateur.

## Gmail et Outlook

Le Studio peut déjà lire les fils Gmail associés à ses envois après OAuth Google. Avec le choix explicite de l'utilisateur, il peut maintenant partager localement vers le Kanban des **métadonnées** : identifiant du message et du fil, poste, employeur, catégorie suggérée, date. Ni corps de message ni adresse d'expéditeur ni pièce jointe ne sont copiés.

Une réponse détectée est **à vérifier**. Le candidat décide du statut et de l'envoi d'une réponse. La vérification périodique du Studio, si activée, reste en lecture seule : les anciens accusés de réception automatiques ont été retirés.

Outlook n'est pas connecté via Microsoft Graph. La rédaction via le client e-mail par défaut fonctionne, mais un vrai connecteur Outlook nécessiterait application Azure, consentement OAuth Microsoft et tests dédiés. Il n'est pas présenté comme fonctionnel dans V6.

## Rappels e-mail et limites d'exploitation

Le cron Vercel quotidien existant (0 6 * * *, UTC) conserve sa route /api/engine-cron. Il exécute également un traitement distinct des rappels, sans envoyer de message aux recruteurs. Seuls les candidats consentants et ayant une échéance due sont sélectionnés. Limite actuelle : quatre candidats par passage. Pour une audience plus large, remplacer cette limite par une file d'attente durable avec retries maîtrisés.

## Tests et validation

Commande : npm test.

- tests/tracker-core.test.js : statuts, validation, chiffrement, statistiques.
- tests/tracker-api.test.js : protection d'origine, propriétaire, consentement, édition versionnée.
- tests/tracker-reminders.test.js : consentement, idempotence, absence d'envoi recruteur.
- tests/tracker-ui.test.js : tests de fumée du mode local avec DOM simulé.

Les tests automatisés ne remplacent pas les essais réels sur Chrome, Firefox, Safari et Android, ni la validation du cron et des services d'e-mail après migration. Vérifier aussi l'accès hors ligne dans la PWA.

## Évolutions dépendantes d'une intégration supplémentaire

- Microsoft Graph / Outlook : OAuth et autorisations spécifiques.
- Bibliothèque de véritables fichiers PDF/DOCX par candidature avec stockage chiffré : non implémentée, la V6 gère des étiquettes de version de CV.
- Notifications push web : consentement VAPID et service de distribution requis.
- Import d'anciens comptes sur des sites d'emploi externes : seulement via leurs API officielles ou des exports fournis par l'utilisateur.
