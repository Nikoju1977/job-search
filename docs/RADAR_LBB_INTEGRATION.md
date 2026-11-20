# Radar marché caché — Suivi des entreprises et La Bonne Boîte (20 novembre 2026)

## Fonctionne immédiatement sur la production

- Ouvrir \`/marche-cache.html\`, rechercher les **entreprises réelles** autour d'une commune et du secteur de son choix.
- Cliquer **Suivre cette entreprise** pour ajouter un SIREN vérifiable à son suivi personnel.
- Renseigner métier visé, étape de prospection, date de prochaine action ou relance, et notes.
- Filtrer les relances échues ; sauvegarder ou exporter ses données en JSON / CSV.
- Préparer une **candidature spontanée** dans le Studio ; aucun e-mail n'est envoyé par le radar.
- Sur chaque fiche suivie, ouvrir La Bonne Boîte pour confronter **manuellement** le potentiel d'embauche pour un métier et une localisation donnés.

## Différence capitale entre les deux jeux de données

1. **API Recherche d'entreprises (DINUM / Insee)** : une entreprise existe. Son SIREN, son activité et sa localisation proviennent d'un registre. Cela ne signifie **pas** qu'elle recrute. Le nombre d'établissements déclaré est **national**, pas local.
2. **La Bonne Boîte (France Travail)** : classement statistique par potentiel d'embauche en fonction de la zone et du métier, sur environ six mois. **Ces scores ne sont pas intégrés à Niko Emploi dans la version actuelle**, car l'API v2 nécessite un accès / une habilitation et les détails de son contrat API ne sont pas publiquement vérifiables ici.

Les mentions « contactée », « réponse reçue » et « La Bonne Boîte consultée » sont **déclaratives**, pas des preuves techniques d'un recrutement ni d'un envoi.

## Obtenir l'autorisation officielle

1. Ouvrir la page officielle France Travail : https://francetravail.io/produits-partages/catalogue/bonne-boite-v2
2. Créer un compte et une application, demander l'habilitation **La Bonne Boîte v2** pour l'usage de Niko Emploi (recommandations de candidatures spontanées).
3. Après accord, obtenir les identifiants par le portail officiel. **Ne jamais les placer dans GitHub, le code frontend, un fichier committé ou un message.** Les stocker uniquement comme variables secrètes sur Vercel.
4. Faire valider le schéma d'appel, les scopes, les quotas et les conditions de réutilisation directement avec la documentation contractuelle fournie par France Travail. Développer l'adaptateur backend et des tests sur une branche de préproduction. Vérifier un appel de bout en bout avant toute activation publique.
5. Maintenir un mode dégradé explicite lorsque l'autorisation manque, expire ou qu'un quota est atteint. Ne jamais fabriquer des « scores de potentiel ».

**Ne pas activer un endpoint LBB présumé, ni copier un token utilisateur ou contourner les mécanismes d'accès.**

API officielle : https://www.data.gouv.fr/dataservices/api-la-bonne-boite

## Données et RGPD

Le suivi personnel est stocké **uniquement en localStorage**, sans chiffrement. Son import/export JSON est volontaire. Le navigateur de l'appareil conserve les notes : ne pas écrire de données personnelles sensibles sur un appareil partagé.

- Pas de synchronisation cloud, de notifications planifiées serveur, de scraping de comptes, ni d'envoi aux recruteurs.
- Limite 300 entreprises / 800 caractères par note.
- La sauvegarde JSON permet un transfert **manuel** vers un autre navigateur.
- L'export CSV est protégé contre l'exécution de formules au début des cellules.

## Validation

- \`npm test\` et vérification de syntaxe dans GitHub Actions.
- Tester le passage entreprise → suivi → modification → export et import de la sauvegarde.
- Vérifier un changement de statut dans deux onglets et un échec de stockage.
- Tester le service sur Chrome Android, Safari iOS et bureau. Les tests automatisés DOM ne remplacent pas ce contrôle.
