# Vérification de la production Niko Emploi

Ce dépôt distingue **code**, **tests automatisés**, **déploiement READY** et **fonctionnement vérifié**. Ces états ne sont pas équivalents.

## Contrôle HTTP public sans données de candidat

Exécuter depuis la racine :

```bash
node --test tests/production-audit.test.js
node tests/production-audit.js
```

L'audit interroge `https://niko-emploi.vercel.app` en GET uniquement. Il contrôle neuf ressources publiques : accueil, radar du marché caché, page candidatures, JavaScript principal, JavaScript du radar, JavaScript de suivi, CSS, service worker et réponse de configuration publique. Chaque contrôle exige HTTP 200, un type MIME cohérent et des marqueurs de contenu attendus.

La CI exécute cet audit en mode **observation** puis archive le JSON du résultat dans GitHub Actions. Les valeurs de la configuration sont vérifiées par leur type, mais **aucune valeur de clé, de compte ou de candidat n'est journalisée**. Aucune requête `POST` n'est déclenchée. L'audit ne lance pas les recherches de vraies offres, ne sollicite pas les fournisseurs externes et ne soumet aucune candidature.

Le résultat `http_verified` signifie seulement : **9 ressources publiques sur 9 ont répondu comme attendu**. `outdated_or_incomplete` signifie qu'une ressource retourne un mauvais statut, mauvais type de contenu ou une ancienne version. `partially_unreachable` signifie qu'une ou plusieurs ressources sont inaccessibles.

## Vérification fonctionnelle indépendante

Le parcours Chromium `tests/browser-smoke.js` vérifie localement le radar, le suivi de prospection, la rédaction de lettres et les garde-fous des fonctions sans API. Il utilise des données **fictives de test**, et ne prouve donc pas l'existence d'offres ni leur fraîcheur dans la production.

Pour pouvoir affirmer qu'un moteur de recherche fonctionne réellement sur le site publié, il reste à contrôler : sources des annonces, taux de réponses, déduplication, liens officiels, fraîcheur, erreurs de fournisseurs, consentement et autorisation pour les comptes. Un test d'affichage sur **vrai Android, iPhone, PC, Mac et tablette** demeure distinct. Les données sensibles ne doivent pas être importées dans un test public.

La publication Vercel et son commit sont à confirmer par la console Vercel ; le statut `READY` ne garantit pas les API métier ni les parcours d'utilisateur.
