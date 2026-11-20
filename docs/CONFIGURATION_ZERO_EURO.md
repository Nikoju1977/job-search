# Configuration zéro euro de Niko Emploi (20 novembre 2026)

**Exigence : aucune facturation, aucun abonnement, aucune carte bancaire.**
Niko Emploi doit toujours disposer d'un fonctionnement local réellement utilisable, même lorsque les intégrations de comptes tiers ne sont pas autorisées.

## État contrôlé de la production

Sur Vercel `niko-emploi`, les variables sont présentes : `APP_ORIGIN`, `CRON_SECRET`, `DATA_ENCRYPTION_KEY`, `GREENHOUSE_BOARDS`.

Les variables **absentes** sont notamment : `DATABASE_URL`, `RESEND_API_KEY`, `EMAIL_FROM`, `GOOGLE_CLIENT_ID`, `OPENAI_API_KEY`. Il n'est pas possible de fabriquer ou de deviner ces identifiants, ni de les extraire d'autres comptes.

| Usage | Solution gratuite immédiatement fonctionnelle | Extension gratuite avec consentement |
|---|---|---|
| Trouver les offres | Agrégateurs publics configurés, recherche et filtres | API France Travail avec habilitation si disponible |
| Repérer les entreprises | Recherche Géo + annuaire public, recherche de propreté ciblée | La Bonne Boîte après habilitation officielle |
| Candidature spontanée | Studio et rédaction par règles locales à partir du CV | Modèle local compatible avec l'appareil, si installé |
| Envoyer un e-mail | `mailto:` : brouillon dans la messagerie du candidat, ajout manuel du CV, envoi humain | Google OAuth/Gmail (inscription Google Cloud et consentement requis, selon les règles applicables) |
| Analyser une réponse | Coller un message dans l'analyseur local et vérifier le brouillon | Gmail OAuth + scopes consentis (le service ne peut pas consulter le compte sans autorisation) |
| Relance | Fichier iCalendar / calendrier personnel | Notifications cloud uniquement après configuration contrôlée et autorisée |
| Sauvegarde de la prospection | Enregistrement local + export JSON/CSV | Neon Free et comptes si les étapes ci-dessous sont réalisées |

### Système cloud gratuit : condition préalable

- **Neon Free** propose un PostgreSQL avec quotas. Choisir uniquement le plan marqué **Free / 0 €**. Vérifier que toute fonctionnalité payante, dépassement facturable ou mise à niveau est désactivé avant création. Plan officiel : https://neon.com/pricing
- Connexion : utiliser l'app Neon dans ChatGPT ou la console officielle, avec l'action explicite de l'utilisateur. **Aucun fournisseur de base de données n'est encore relié à ce projet Vercel.**
- Pour ne pas risquer d'affecter les données existantes : faire une sauvegarde, exécuter `database/niko-autonomy.sql` puis `database/niko-engine-v4.sql` dans un projet vierge, tester les contraintes et utiliser un rôle applicatif restreint.
- Dans Vercel, créer `DATABASE_URL` comme secret **production**, sans l'exposer dans GitHub ni dans le chat. Les comptes cloud actuels requièrent en plus un **fournisseur d'e-mail transactionnel** (v. `lib/platform.js`). Sans celui-ci, ne pas activer les comptes.
- Resend possède une formule Free mais son envoi vers des tiers implique généralement la validation d'un domaine que l'utilisateur contrôle. Si un domaine gratuit approprié n'est pas disponible, **ne pas le créer à titre payant**. Le cloud candidat reste désactivé. L'envoi manuel est suffisant pour une solution à 0 €.

### Gmail direct, seulement si l'utilisateur le souhaite

- Configurer un projet OAuth sur Google Cloud Console et les origines autorisées pour `https://niko-emploi.vercel.app`. Vérifier limites, consentement, conditions de publication de l'application et frais éventuels avant activation. La connexion ne peut pas être faite à la place de l'utilisateur sans son autorisation Google.
- Stocker l'identifiant client public `GOOGLE_CLIENT_ID` dans Vercel. Ne pas intégrer de `client_secret` dans JavaScript côté navigateur.
- Tant que cette configuration manque : boutons Gmail direct **désactivés**, `mailto:` gratuit toujours disponible. Aucun message ne part automatiquement.

### France Travail La Bonne Boîte

- Demande d'habilitation sur https://francetravail.io/produits-partages/catalogue/bonne-boite-v2
- Tant que l'accès n'est pas approuvé : ouverture du service public par lien, sans prétendre disposer de son API ni de ses scores. Aucune clé factice.

### IA : pas de facturation

- La rédaction locale et la classification locale des réponses sont des moteurs à règles, **pas des modèles LLM**. Elles fonctionnent sans clé.
- Les modèles IA exécutés dans le navigateur (si compatibles matériellement) ne déclenchent pas de facturation fournisseur, mais peuvent demander un téléchargement important et des ressources de l'appareil.
- Le serveur `OPENAI_API_KEY` **n'est pas configuré** et aucune clé payante ne sera ajoutée. Si l'utilisateur souhaite garder la contrainte zéro euro, ne pas installer des API payantes ou du compute hébergé à la consommation.

## Validation exigée

1. GitHub Actions : syntaxe, tests unitaires et parcours réel Chrome (radar → suivi → lettre locale → lecture manuelle de réponse).
2. Vercel : build `READY`, commit attendu en production, contrôle `/api/config` sans valeur secrète.
3. Test sur téléphone personnel lorsque l'utilisateur est disponible ; les tests Chrome serveur ne prouvent pas la compatibilité de toutes les versions Android / iOS.
4. **Ne jamais déclarer les fonctionnalités cloud actives** sur la base d'une simple compilation ou d'une variable existante. Confirmer authentification, envoi à une adresse autorisée, stockage et suppression sur comptes de test.

L'absence de connecteur externe n'empêche pas d'utiliser l'application gratuite. Elle limite seulement les fonctions de synchronisation, de lecture directe Gmail et de scoring La Bonne Boîte.
