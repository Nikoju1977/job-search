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



## Extension du 18 novembre 2026 — sources additionnelles

**Nouveaux connecteurs : Remotive, Jooble France, Lever, Ashby, SmartRecruiters.** Le moteur peut maintenant appeler 11 plateformes, mais uniquement 5 sont tentées par défaut (EasyJobs, Jobicy, Arbeitnow, Himalayas et Remotive). Les 6 autres nécessitent une configuration serveur. Une source « prévue » n'est pas une source « opérationnelle » : seuls les fournisseurs qui répondent effectivement sont comptés dans /api/jobs.

### Remotive — actif sans identifiants

Source : https://remotive.com/remote-jobs/api

Les annonces proviennent du flux officiel et renvoient toujours au lien Remotive, avec attribution visible. Le fournisseur retarde les annonces de 24 heures et recommande un maximum de 4 consultations par jour. Le moteur utilise un cache de 24 h *par instance* ; plusieurs instances Vercel peuvent encore générer plus de requêtes, ce qui impose un cache persistant centralisé en cas de trafic important. Les annonces sont filtrées pour une éligibilité explicite France/Europe/monde. Interdiction de transmettre le contenu Remotive à un agrégateur tiers ou de le bloquer derrière une inscription.

### Jooble France — nécessite une clé

Portail pour la clé régionale : https://fr.jooble.org/api/about

    JOOBLE_FR_API_KEY=cle_fr_obtenue_aupres_de_jooble

L'API est interrogée en POST à fr.jooble.org côté serveur uniquement. Aucun identifiant n'est renvoyé au navigateur. Documentation : https://help.jooble.org/fr/support/solutions/articles/60001448238-documentation-de-la-jooble-rest-api

### Lever — sites carrières publics

    LEVER_BOARDS=site-entreprise:Vrai nom de l'entreprise;eu/site-europe:Entreprise Europe

Au plus 6 tableaux configurés. Les données sont demandées exclusivement à api.lever.co / api.eu.lever.co. Les postes réservés hors France/Europe sont exclus. Documentation : https://github.com/lever/postings-api

### Ashby — sites carrières publics

    ASHBY_BOARDS=nom-du-board:Vrai nom de l'entreprise

Au plus 8 tableaux configurés. Source publique : https://api.ashbyhq.com/posting-api/job-board/{board}?includeCompensation=true . Les offres non listées sont exclues. Le statut de télétravail repose sur workplaceType=Remote : dans cette API le champ isRemote est vrai pour certains emplois hybrides. Les salaires ne sont affichés que s'ils sont fournis. Documentation : https://developers.ashbyhq.com/docs/public-job-posting-api

### SmartRecruiters — offres publiques FR

    SMARTRECRUITERS_BOARDS=identifiant-entreprise:Vrai nom de l'entreprise

Au plus 8 tableaux configurés. Requête sur api.smartrecruiters.com avec country=FR et destination=PUBLIC. Aucune offre interne n'est demandée. Les liens vers les offres doivent être vérifiés sur des résultats réels avant d'affirmer que toutes les pages sont accessibles. Documentation : https://developers.smartrecruiters.com/docs/endpoints

## Références open source et bonnes pratiques

- freehire (licence MIT) : https://github.com/strelov1/freehire — recherche à facettes et transparence des fournisseurs.
- Openings (licence MIT) : https://github.com/openings-dev/web — traçabilité des annonces et préférences locales.
- stillopen (licence Apache-2.0) : https://github.com/Druvo/stillopen — suivi des candidatures et respect de la republication.

Ces projets ont servi de références d'architecture, sans copie de leur code source. Aucun d'eux ne doit être compté comme une API d'offres disponible dans Niko Emploi.

## Validation de la version

Les tests automatisés et la validation sur navigateur sont distincts des appels réels aux API. Exécuter npm test et vérifier /api/jobs, ses champs sources / received / partial, les erreurs 401/403/429, le nombre de résultats pertinents, les liens et l'affichage PC/mobile. La présence d'une source dans cette documentation ne garantit jamais son activation en production.

France Travail, HelloWork, Apec, Welcome to the Jungle, La bonne alternance et Agefiph sont proposés **uniquement sous forme de liens externes**, sans importation de leurs annonces.
