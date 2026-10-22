# Niko Intelligence 5.0 — IA gratuite, locale et facultative

Niko Emploi comporte désormais **NeuroMatch**, une recherche sémantique dans le navigateur. Elle ne nécessite **aucune API IA payante, aucun abonnement IA et aucune clé API IA**.

## Technologies

- **Transformers.js**, bibliothèque open source de Hugging Face, chargée **uniquement après clic** sur « Lancer l'IA gratuite » depuis le CDN jsDelivr, version @huggingface/transformers@4.3.1.
- **Modèle** : Xenova/paraphrase-multilingual-MiniLM-L12-v2 (version ONNX multilingue, modèle amont sous licence Apache-2.0). Les inférences s'exécutent dans un Web Worker sur CPU/WASM.
- **Modèle quantifié q8** : les poids ONNX représentent environ 118 Mo, auxquels s'ajoutent les fichiers de tokenisation et l'environnement d'exécution. Un accès Internet est nécessaire pour le premier téléchargement ; selon le navigateur et le cache, le téléchargement peut être répété.
- **Classement hybride** : 60 % de proximité sémantique normalisée, 40 % du score heuristique existant, avec un bonus de préférences limité à 9 points de score interne. Ce sont des paramètres expérimentaux de classement, **pas une probabilité de recrutement ni un score ATS certifié**.
- **Passeport** : lecture des compétences explicitement repérées et propositions prudentes de métiers voisins. Les compétences non trouvées ne sont jamais déclarées comme inexistantes.

Références :
- https://huggingface.co/docs/transformers.js/
- https://huggingface.co/Xenova/paraphrase-multilingual-MiniLM-L12-v2
- https://huggingface.co/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2

## Parcours utilisateur

1. Ouvrir https://niko-emploi.vercel.app/candidatures.html.
2. Importer un CV ou saisir un métier cible.
3. Rechercher de **vraies** offres. L'IA ne travaille que sur les offres renvoyées par les connecteurs existants : aucune annonce n'est fabriquée.
4. Cliquer sur « Créer mon passeport local » pour voir les compétences repérées et les passerelles professionnelles (fonctionne sans modèle téléchargé).
5. Cliquer sur « Lancer l'IA gratuite » pour comparer le profil et les 30 premières offres réelles reçues sur cet appareil.
6. Marquer les annonces « Utile pour moi » ou « Écarter » ; « Effacer mes préférences » supprime ce classement appris localement.
7. « Annuler le calcul » interrompt le travail du Web Worker. Le radar classique fonctionne indépendamment.

## Confidentialité

- Le texte du CV **n'est pas transmis à une API d'inférence externe** : le modèle et le calcul résident dans le navigateur. Le navigateur télécharge la bibliothèque et les poids depuis les services tiers, qui reçoivent les métadonnées réseau habituelles, mais pas le texte du CV dans les requêtes de NeuroMatch.
- Des lignes manifestement sensibles (RQTH, MDPH, diagnostics, invalidité, handicap personnel) sont supprimées du texte de comparaison. Cette protection est **heuristique et non exhaustive**.
- Les professions de santé et l'expérience d'accompagnement de personnes handicapées ne sont pas supprimées par principe.
- Les préférences sont sauvegardées **en localStorage uniquement** (URL, titre public de l'annonce et statut « utile/écarté »). Pas de sauvegarde supplémentaire du CV.
- Aucune candidature ni réponse n'est envoyée automatiquement par ce module.

## Limites techniques

- Nécessite un navigateur moderne compatible Web Workers modules, une connexion pour charger le modèle et une RAM suffisante.
- Le modèle quantifié pèse environ **118 Mo** pour les poids ONNX et d'autres ressources sont nécessaires. Le premier chargement peut être long ou inadapté à certaines connexions mobiles.
- Le radar sans modèle reste disponible en cas d'erreur. Les scores sont indicatifs : l'IA peut se tromper, notamment sur les compétences et les exigences particulières.
- Les tests automatisés valident les règles et les interfaces avec des vecteurs simulés ; ils **ne confirment pas un téléchargement et une exécution réels dans tous les navigateurs**.
- Les agents serveur qui travaillent lorsque le site est fermé nécessitent toujours une base PostgreSQL et les autres secrets Vercel ; l'IA locale ne remplace pas cette infrastructure.

## Coûts

- **Inférence IA dans le navigateur : 0 € par requête** pour Niko Emploi.
- Cela **ne garantit pas que l'ensemble de l'application sera gratuit** : hébergement, bande passante, domaine, base de données et messagerie peuvent engendrer des coûts selon les quotas.
- L'ancien point d'accès OpenAI payant des lettres reste indépendant et non requis pour NeuroMatch. La rédaction classique des lettres fonctionne localement.

Tests : npm test, particulièrement tests/neuromatch-v5.test.js.
