# Niko Emploi — édition 1.0

Moteur d'offres d'emploi **réelles** (jamais de faux résultats de démonstration) avec recherche, filtres, favoris et dédoublonnage intersources.

## Utiliser localement

Node.js 20+ :

```sh
npm start
```

Ouvrir **http://localhost:3000**. Le navigateur communique avec `GET /api/jobs`, qui interroge les plateformes publiques. **Internet est indispensable pour que des offres apparaissent**. Si les fournisseurs ne répondent pas, 0 offre est affichée avec un message d'erreur.

Tests automatiques :

```sh
npm test
```

## Déployer

Ce projet fonctionne également sur Vercel : `public/` est le site statique et `api/jobs.js` une fonction Node.js. Déployer le dossier racine, sans configuration de clé d'API. Le moteur ne scrape pas France Travail.

## Sources intégrées

- **EasyJobs** (France) : `https://api.easyjobs.fr/public/v1/jobs/search`, accès anonyme, pagination de 50 résultats, 2 pages maximum. Afficher `job_url` de la réponse (attribution conservée). Documentation : https://api.easyjobs.fr/public/docs/
- **Jobicy** (emploi à distance accessible en Europe) : `https://jobicy.com/api/jobs?count=200&geo=europe` et `...&geo=france`, puis exclusion des offres réservées à un autre pays. Annonces des 7 derniers jours selon leur API, crédit obligatoire et clic vers la fiche Jobicy. Documentation : https://jobicy.com/jobs-rss-feed
- **Arbeitnow** : `https://www.arbeitnow.com/api/job-board-api`, conservées uniquement les annonces France ou télétravail explicitement éligibles à une zone internationale. Source et lien visibles. Conditions : https://www.arbeitnow.com/terms/

**France Travail :** l'API officielle Offres d'emploi est annoncée comme restreinte/suspendue à la réutilisation publique au 22/10/2026 : https://www.data.gouv.fr/dataservices/api-offres-demploi . Demander son habilitation, ne pas contourner ses restrictions.

## Anti-doublons & honnêteté statistique

- Vérification des données minimales (intitulé, employeur, lieu, URL HTTP/HTTPS, provenance).
- Détection des URLs équivalentes sans paramètres de tracking ; rapprochement employeur + poste + lieu avec normalisation accents/ponctuation.
- Les offres multi-villes réellement distinctes sont conservées.
- Les fournisseurs inaccessibles sont signalés ; aucun emploi fictif n'est injecté.
- **Le nombre annoncé est celui des résultats effectivement récupérés et filtrés, et non le total national.** L'objectif « 10x plus que France Travail » n'est pas considéré comme atteint sans mesures validées à périmètre équivalent.
- Certaines variantes de titres ou annonces rediffusées peuvent échapper à la détection : un taux anti-doublon de 100 % ne peut pas être garanti sans identifiant de poste commun entre fournisseurs.
- L'affichage d'une offre ne certifie pas que le recrutement reste ouvert au moment du clic : utiliser le lien source.

## Évolutions pour production

Pour le passage à grande échelle, ajouter une base PostgreSQL avec identifiants persistants et URLs canoniques, crawler uniquement les sources autorisées, contrôle des statuts actifs, rapprochement probabiliste supervisé, horodatage, signalement de doublons, journal des consentements/licences, tâches de synchronisation et surveillance des limites fournisseurs. Ajouter la source France Travail uniquement après autorisation.

## Confidentialité

Aucun compte, CV, email ou candidature collecté par ce projet. Les favoris sont stockés localement dans `localStorage` sur l'appareil.

Projet indépendant : pas d'affiliation institutionnelle à France Travail.