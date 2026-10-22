# Niko Emploi 2.0 — guide de configuration

Le nouveau Studio candidature fonctionne sans compte pour l'import de CV, le matching indicatif, les offres RQTH signalées, les lettres locales, le coaching d'entretien et le tableau de bord local.

## Activer les comptes

Créer un projet Supabase et exécuter le schéma SQL disponible dans `database/schema.sql`. Configurer l'authentification par lien e-mail et autoriser l'URL de retour `https://niko-emploi.vercel.app/candidatures.html`.

Configurer dans le tableau de bord Vercel les paramètres Supabase, la clé serveur de chiffrement AES-256 et l'origine publique du site, sans ajouter de secrets au code source. Les comptes restent désactivés tant que la configuration n'est pas complète. Le candidat choisit lui-même de stocker son CV de façon chiffrée.

## Activer la génération IA

Configurer le service IA côté serveur sur Vercel. Le CV n'est envoyé à ce service qu'après consentement du candidat.

## Activer Gmail

Créer une application OAuth Web dans Google Cloud, activer Gmail API, autoriser l'origine `https://niko-emploi.vercel.app` et configurer l'identifiant client dans Vercel. Les autorisations Gmail de lecture sont soumises à la politique Google applicable, notamment une éventuelle vérification renforcée.

## Limitations actuelles

L'agent de suivi Gmail ne travaille que lorsque le navigateur est ouvert. Il n'existe pas de surveillance serveur continue activée. Les comptes et la génération IA restent facultatifs et ne seront réellement actifs qu'après raccordement des services et tests sur des comptes autorisés.

Avant ouverture à grande échelle : audits de sécurité et RGPD, mentions légales, protection contre le spam et les doublons, tests navigateurs, accessibilité et supervision des erreurs.

Lancer `npm test` pour vérifier la syntaxe, les endpoints, la protection des données et le comportement de base.
