# Niko Emploi — connecteurs d'offres API

Cette version ajoute **Himalayas**, **Adzuna France** et **Greenhouse Job Board** aux connecteurs existants EasyJobs, Jobicy et Arbeitnow. Le moteur ne crée aucune annonce artificielle. Tous les résultats passent par la validation des URL, la normalisation des champs, les critères France et le dédoublonnage intersources.

## Activation

### Himalayas — actif sans identifiants

L'API publique de recherche est appelée côté serveur : `GET https://himalayas.app/jobs/api/search?country=FR&sort=recent&page=1`, avec `q` si le candidat saisit une recherche. L'API inclut les offres admissibles aux candidats en France et certaines offres mondiales.

`HIMALAYAS_API_KEY` est facultatif. Une clé gratuite augmente la marge de requêtes ; elle doit rester secrète et être placée **uniquement dans Vercel**, jamais dans du JavaScript navigateur.

- Les restrictions géographiques de l'annonce sont vérifiées à nouveau après la réponse API.
- Une offre ayant dépassé `expiryDate` est exclue ; une offre peut toutefois fermer avant sa date théorique.
- Les résultats conservent le champ `applicationLink` de l'API comme lien de candidature ; une attribution visible à **Himalayas** et un lien vers [himalayas.app](https://himalayas.app) sont affichés.
- Le fournisseur actualise ses données approximativement chaque jour. La recherche réutilise un cache serveur en mémoire de 12 heures par requête sur chaque instance ; **ce cache n'est pas partagé entre les instances Vercel**. Pour une forte audience, utiliser une synchronisation quotidienne persistante, une limite globale de requêtes et/ou une clé fournisseur.
- Ne pas transmettre ces données à d'autres sites d'emploi, agrégateurs, flux de syndication ou moteurs de recherche tiers. Ne pas modifier les liens de candidature.

Référence : https://himalayas.app/docs/remote-jobs-api

### Adzuna France — optionnel

Obtenir ses propres identifiants sur https://developer.adzuna.com et placer dans les variables d'environnement **Production** de Vercel :

```text
ADZUNA_APP_ID=identifiant_fourni_par_adzuna
ADZUNA_APP_KEY=cle_privee_fournie_par_adzuna
```

Le connecteur s'active lorsque **les deux** variables sont définies. Il interroge la recherche officielle France, page 1, jusqu'à 50 annonces par recherche. Les clés ne sont pas retournées au navigateur. Aucune offre Adzuna n'est prétendue disponible tant que cette configuration n'est pas effectuée.

Référence : https://developer.adzuna.com/docs/search

### Greenhouse Job Board — optionnel

Sélectionner de vrais sites carrières Greenhouse **publics** dont le jeton de tableau est connu et dont l'affichage est pertinent. Configurer dans Vercel :

```text
GREENHOUSE_BOARDS=board-token:Nom réel de l'entreprise;autre-board:Autre entreprise
```

Le nom d'entreprise doit correspondre au vrai recruteur du site visé : Niko Emploi ne l'invente pas. Un maximum de **4 sites carrières** est interrogé. Le moteur lit uniquement le point d'accès public officiel `GET /v1/boards/{board_token}/jobs?content=true` sur `boards-api.greenhouse.io`, et affiche le lien publié par le recruteur. Il exclut les offres réservées aux États-Unis lorsque l'éligibilité française n'est pas explicitement établie.

**Production Niko Emploi :** la variable `GREENHOUSE_BOARDS` a été configurée sur Vercel pour les tableaux publics **Datadog, Dataiku, DataDome et Doctolib**. Les tableaux ont été identifiés sur leurs pages Greenhouse publiques ; leur bonne réponse via l'API du site déployé reste à contrôler dans les diagnostics de sources.

Le connecteur est volontairement **inactif** tant que `GREENHOUSE_BOARDS` n'est pas renseigné. La lecture des annonces publiées ne permet pas pour autant de soumettre des candidatures sans autorisation.

Référence : https://docs.greenhouse.io/job-board

## Qualité et conformité

- Le tableau de bord « Sources consultées » affiche les fournisseurs réellement activés, les nombres **reçus** et les défaillances.
- Les annonces sont dédoublonnées par URL canonique puis par employeur, métier et lieu ; les rôles de villes différentes sont conservés.
- Les indicateurs ne comptent jamais l'ensemble du marché, uniquement les résultats effectivement récupérés.
- La filtration France et le télétravail mondial sont prudents : une offre sans preuve suffisante d'éligibilité est exclue.
- Les informations RQTH éventuelles sont seulement celles mentionnées explicitement dans l'annonce et **ne préjugent jamais du statut d'un candidat**.
- Pas de formulaire tiers automatisé, pas de contournement CAPTCHA, pas de candidature envoyée par l'ajout de ces API.

Tests de connecteurs : `npm test` (en particulier `tests/jobs-new-sources.test.js`).

**Important :** des tests simulés réussis ne garantissent pas qu'une API externe réponde au moment de la recherche. Surveiller la rubrique « Sources consultées » et les quotas des fournisseurs.

### EasyJobs — accès public et partenaire (diagnostic 403)

La recherche EasyJobs utilise par défaut le mode anonyme documenté, avec les en-têtes `Accept: application/json` et un `User-Agent` identifié. **Un HTTP 403 est un refus du fournisseur**, et non une offre vide ; Niko Emploi continue alors à consulter les autres sources, sans inventer de résultats.

Si EasyJobs valide un accès partenaire, ajouter dans les variables serveur Vercel (production) :

```text
EASYJOBS_PARTNER_ID=identifiant_officiel_fourni
EASYJOBS_PARTNER_KEY=cle_partenaire_privee
```

Les deux valeurs doivent être présentes ensemble. Le serveur transmet alors les en-têtes officiels `X-EasyJobs-Partner` et `X-EasyJobs-Partner-Key` **uniquement à api.easyjobs.fr**, jamais au navigateur. Ne pas ajouter ces secrets dans GitHub ni dans `public/`.

Une erreur `401` ou `403` reste affichée comme refus de la source. En cas de blocage persistant, demander une vérification à EasyJobs (sans contourner les protections d'accès). Sources : [documentation de l'API](https://api.easyjobs.fr/public/docs/) et [diagnostic User-Agent/403](https://api.easyjobs.fr/ui/error-403.html).

