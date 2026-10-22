# Niko Intelligence 4.1 — Mise en service native (sans Supabase, sans n8n)

Niko Emploi reste une application unique hébergée sur Vercel. Le moteur de recommandation, le serveur de comptes, la gestion des consentements et l'orchestrateur sont directement dans ce dépôt. **Neon n'est utilisé que comme stockage PostgreSQL persistant**. Resend ne sert qu'à envoyer des liens de connexion et, sur consentement distinct, les alertes au candidat.

## 1. Ce qui fonctionne sans aucun secret

- Recherche d'offres provenant des sources publiques intégrées.
- Analyse locale CV / offre, score indicatif sur cinq axes, compétences communes et manquantes.
- Inclusion : filtre sur les **mentions présentes dans l'annonce**, sans inférer la situation médicale d'une personne.
- Lettres locales, tableau de bord local, vérification indicative de fraude, préparation STAR et export de calendrier.
- Les envois Gmail de la première génération ne fonctionnent que lorsque OAuth Google est réellement configuré, depuis une page ouverte.

Aucun CV fictif, aucune annonce fictive, aucun candidat fictif et aucun e-mail de candidature de démonstration ne sont envoyés par la tâche de veille.

## 2. Mettre en service l'autonomie côté serveur

1. Créer un **projet Neon PostgreSQL** et récupérer sa chaîne de connexion privée avec TLS, idéalement dans une région de l'UE et avec des droits limités pour le rôle d'exécution.
2. Exécuter dans l'ordre **database/niko-autonomy.sql**, puis **database/niko-engine-v4.sql**. Les deux scripts créent les tables et index pour les offres, comptes, préférences, décisions et audits d'exécution.
3. Vérifier le schéma, les contraintes d'unicité et la politique de sauvegarde. Les scripts de migration ne s'exécutent jamais depuis le navigateur.
4. Ajouter les variables suivantes depuis les **réglages Vercel** du projet, en production, puis redéployer :
   - `DATABASE_URL` : connexion PostgreSQL Neon privée, **serveur uniquement**.
   - `DATA_ENCRYPTION_KEY` : 32 octets aléatoires encodés en base64, **serveur uniquement**, clé stable et sauvegardée dans un coffre.
   - `APP_ORIGIN` : `https://niko-emploi.vercel.app`.
   - `CRON_SECRET` : secret serveur aléatoire de longueur importante.
   - `RESEND_API_KEY` : secret de l'API e-mail, seulement après création de l'expéditeur.
   - `EMAIL_FROM` : adresse validée sur un domaine Resend dont l'organisation détient les DNS, par exemple `Niko Emploi <connexion@votre-domaine.fr>`.
5. Dans Resend, vérifier le domaine d'envoi, SPF et DKIM et les limitations du compte. Tester l'envoi d'un lien sur **son propre compte de test**.
6. Ouvrir le Studio, demander un lien de connexion, vérifier la session HttpOnly et activer facultativement la sauvegarde chiffrée du CV.
7. Activer volontairement l'agent, enregistrer les critères et demander une prévisualisation. Pour les alertes, cocher les **deux cases distinctes** (veille + e-mail) et enregistrer.
8. Laisser la tâche Vercel `/api/engine-cron` s'exécuter au prochain créneau. Le planificateur vérifie `CRON_SECRET` et doit être lancé uniquement par Vercel. Il indexe des offres publiques puis classe les profils opt-in. Le service envoie un digest uniquement pour de **nouvelles** recommandations, jamais les données du CV, les informations RQTH ni les messages de recruteurs.

L'application est conçue pour **refuser par défaut** toutes les fonctions nécessitant des services non configurés.

## 3. Ce que l'autonomie signifie dans cette version

- **Disponible en arrière-plan après configuration** : indexation quotidienne, matching des comptes consentants, conservation des recommandations, synthèse e-mail facultative avec anti-doublons.
- **Toujours sous validation humaine** : candidatures, messages aux recruteurs, rendez-vous, décisions engageantes, divulgation d'informations RQTH.
- **Non opérationnel 24 h/24 à ce stade** : lecture permanente des réponses Gmail, automatisation des ATS externes et relances serveur. La version navigateur doit rester ouverte pour le suivi Gmail autorisé.
- La tâche programmée est **quotidienne**. Sur Vercel Hobby, sa précision horaire peut varier ; elle ne promet pas de détection instantanée. La version actuelle traite un lot limité de candidats par passage afin de respecter les limites de durée des fonctions. Pour une charge réelle importante, prévoir une file de tâches durable avec supervision.
- Resend gère les **e-mails de connexion et les alertes aux candidats**, pas l'envoi arbitraire de messages aux recruteurs ni la lecture des boîtes Gmail personnelles.

## 4. Sécurité, conformité et lancement public

- Tester création de compte, consommation unique du lien, authentification, connexion depuis un deuxième appareil, révocation, effacement du compte et suppression en cascade.
- Contrôler quotas, abuse des liens de connexion, injection, filtrage des offres frauduleuses, parcours clavier et écrans mobiles.
- Régler la durée de conservation, la suppression des sauvegardes et les coordonnées du responsable de traitement (les anciennes mentions doivent être relues juridiquement).
- Aucun secret dans GitHub, les fichiers publics ou cette conversation. Ne pas modifier la clé AES sans préparer la migration des données chiffrées.
- L'envoi des alertes est limité par une clé d'idempotence et un journal utilisateur/jour ; un échec de notification ne doit pas faire échouer les recommandations.
- Vérifier les conditions d'utilisation des sources d'annonces et les règles de contact des recruteurs ; aucun CAPTCHA n'est contourné.

## 5. Contrôles techniques

`npm test` valide les règles de matching, la protection RQTH, les API, l'anti-doublon Gmail, la classification des réponses, le consentement aux notifications et les contrôles de l'interface. La CI vérifie ces tests sur GitHub Actions.

Liens : [le Studio](https://niko-emploi.vercel.app/candidatures.html) et [le dépôt GitHub](https://github.com/Nikoju1977/job-search).

**Important :** une publication Vercel prête ou des tests unitaires réussis ne prouvent pas la connexion à Neon, la délivrabilité Resend ou l'exécution réelle du Cron. Les trois nécessitent une validation sur un environnement configuré avant toute communication « totalement autonome ».
