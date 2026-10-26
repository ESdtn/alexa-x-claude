# Implementation Plan — V1 « Alexa, demande à Claude »

| | |
|---|---|
| **Statut** | Brouillon v0.1 |
| **Date** | 27/10/2026 |
| **Estimation totale** | 2 à 3 jours de travail |
| **Documents liés** | [PRD](01-PRD.md) · [TRD](02-TRD.md) · [Backend Schema](05-BACKEND-SCHEMA.md) |

## Prérequis

- [ ] Compte **Amazon Developer** avec **la même adresse** que le compte Alexa des appareils (sinon la skill en développement n'apparaît pas sur l'Echo ni l'Arc).
- [ ] Compte **AWS**, AWS CLI configurée, région `eu-west-1`.
- [ ] Compte **Console Claude** : clé API dédiée « alexa-x-claude » et plafond de dépense mensuel (ex. 5 $).
- [ ] Node.js 22, ASK CLI v2 (`npm i -g ask-cli`), `ask configure` lié aux comptes Amazon Developer et AWS.

## Arborescence cible

```text
alexa-x-claude/
├── docs/                              # ces documents
├── model/carriers.fr-FR.json          # source du modèle d'interaction
├── scripts/build-interaction-model.ts # génère le modèle
├── skill-package/
│   ├── skill.json
│   └── interactionModels/custom/fr-FR.json  # généré, versionné
├── lambda/
│   ├── src/  (index, handlers/, claude/, conversation/, speech/, config, secrets, log)
│   ├── test/
│   ├── package.json · tsconfig.json · esbuild.config.mjs
├── infrastructure/cfn-deployer/skill-stack.yaml
├── ask-resources.json
└── .github/workflows/ci.yml
```

## Phase 0 — Spike de validation (2 à 3 h) · go / no-go

But : lever les trois inconnues bloquantes **avant** d'écrire le vrai code.

- [ ] Créer la skill à la main dans la console développeur : custom, `fr-FR`, nom d'appel `claude`, une intention `AskClaudeIntent` avec quelques mots porteurs, et un endpoint Lambda « écho » qui répète la question.
- [ ] **Nom d'appel** : la console accepte-t-elle `claude` ? « Alexa, demande à Claude… » ouvre-t-il bien *ta* skill ?
- [ ] **Alexa+** : si actif sur le compte, la phrase atteint-elle la skill ou Alexa+ répond-il à la place ?
- [ ] **Appareils** : tester sur un Echo Dot **et** sur la Sonos Arc.
- [ ] **Capture** : dicter 10 questions variées, noter ce qu'arrive dans `query` (mots perdus, erreurs de reconnaissance).
- [ ] **Latence** : appeler Claude Haiku 5.5 depuis la Lambda écho sur 10 questions et noter p50/p95.

**Critère de sortie** : la skill répond sur les deux appareils, avec `claude` ou un nom de repli (`assistant claude`). Sinon, revoir le nom d'appel avant la phase 1. Consigner les résultats dans `docs/spike-results.md`.

## Phase 1 — Socle du repo (½ jour)

- [ ] `lambda/` : TypeScript strict, ESLint, Prettier, Vitest, bundle esbuild vers `lambda/dist/index.js`.
- [ ] `config.ts` + tests (valeurs par défaut, bornes, `SKILL_ID` obligatoire).
- [ ] `log.ts` (JSON structuré, détection du démarrage à froid).
- [ ] `ask-resources.json` + `infrastructure/cfn-deployer/skill-stack.yaml` (Lambda arm64 512 Mo, délai 8 s, IAM, logs 14 j, permission Alexa).
- [ ] Récupérer la skill du spike dans `skill-package/` (`ask smapi export-package` ou `ask init`).
- [ ] CI GitHub Actions : lint, typecheck, tests sur chaque push et PR.
- [ ] Créer le paramètre SSM `/alexa-claude/anthropic-api-key`.

**Fini quand** : `ask deploy` déploie une skill qui répond « Je t'écoute. » au lancement, et la CI est verte.

## Phase 2 — Modèle d'interaction (½ jour)

- [ ] `model/carriers.fr-FR.json` avec la table du [TRD §4](02-TRD.md#4-capter-la-question-libre), enrichie des résultats du spike.
- [ ] `scripts/build-interaction-model.ts` : génération, vérification des doublons, échec explicite. Tests.
- [ ] `NewConversationIntent`, phrases ajoutées à `AMAZON.StopIntent`, intentions obligatoires (`Help`, `Cancel`, `Stop`, `NavigateHome`, `Fallback`).
- [ ] Script npm `model:build` lancé avant `ask deploy`.

**Fini quand** : dans l'onglet Test de la console, « pourquoi le ciel est bleu » est routé vers `AskPourquoiIntent` avec `query = "le ciel est bleu"`.

## Phase 3 — Appel à Claude et conversation (½ à 1 jour)

- [ ] `secrets.ts` : lecture SSM et cache module. Test avec un client SSM simulé.
- [ ] `claude/prompt.ts` : consigne du [brief UX §4](04-UX-VOICE-BRIEF.md#4-consigne-système-de-claude).
- [ ] `claude/client.ts` : `timeout`, `maxRetries: 0`, extraction du texte, classement des erreurs (`timeout`, `rate_limit`, `overloaded`, `auth`, `credit`, `unknown`). Tests avec un client simulé.
- [ ] `conversation/history.ts` : lecture tolérante, ajout, troncature à `HISTORY_MAX_TURNS`. Tests.
- [ ] `speech/sanitize.ts` : règles du [brief UX §5](04-UX-VOICE-BRIEF.md#5-règles-de-mise-en-forme-pour-la-synthèse-vocale). Tests sur des sorties Markdown réelles.
- [ ] `speech/messages.ts` : messages fixes du brief UX §3.
- [ ] `handlers/ask.ts` : reconstruction de la question (préfixe), appel, historique, réponse + `reprompt`.
- [ ] `handlers/launch.ts`, `handlers/builtins.ts`, `handlers/error.ts`.

**Fini quand** : P1, P2, P3 et P6 de l'[App Flow](03-APP-FLOW.md) passent dans `ask dialog` et sur l'Echo Dot.

## Phase 4 — Robustesse (½ jour)

- [ ] Réponse progressive « Je réfléchis… » en parallèle de l'appel Claude, échec ignoré.
- [ ] Coupe à la dernière fin de phrase sur `stop_reason = max_tokens`.
- [ ] Chaque erreur du [TRD §7](02-TRD.md#7-gestion-des-erreurs) testée (dont un délai forcé à 100 ms pour P4).
- [ ] `withSkillId()` actif ; vérifier qu'un appel avec un autre skill ID est rejeté.
- [ ] Requête CloudWatch Logs Insights enregistrée : p50/p95 de `claudeMs`, erreurs par type.

**Fini quand** : P4 et P5 passent, et aucun chemin de code ne laisse Alexa sans réponse.

## Phase 5 — Recette sur appareils et réglages (½ jour + une semaine d'usage)

- [ ] Série de 20 questions variées sur l'Echo Dot et la Sonos Arc (critères de succès du [PRD §8](01-PRD.md#8-critères-de-succès)).
- [ ] 3 relances successives avec contexte.
- [ ] Ajuster la consigne système, `max_tokens` et la table des mots porteurs selon les logs `fallback`.
- [ ] Écoute comparative voix Alexa / voix Polly (brief UX §6), décision.
- [ ] Une semaine d'usage réel, puis relevé du coût dans la Console Claude.

**Fini quand** : tous les critères de succès du PRD sont atteints.

## Après la V1 (backlog)

Dans l'ordre recommandé par l'étude de faisabilité :

1. **Annonce Claude Code → Alexa** (≈ 1 h) : hook `Notification` + Voice Monkey. Indépendant de la skill, peut être fait à tout moment.
2. **Réponses différées** : « je cherche et je te rappelle » pour les questions longues, avec annonce via Voice Monkey ; ouvre la porte à la recherche web.
3. **Validation vocale des permissions Claude Code** : relais cloud (Lambda + DynamoDB), hook `PermissionRequest` de type `http`, liste blanche d'actions.
4. **Réponses libres** vers une session Claude Code via un canal MCP (Claude Code Channels).

## Journal des décisions

| Date | Décision | Raison |
|---|---|---|
| 27/10/2026 | Nom d'appel « Claude » au lieu de « Majordome » (étude) | Choix produit d'Evans ; à valider en phase 0 |
| 27/10/2026 | Lambda dans le compte AWS d'Evans plutôt que skill hébergée par Alexa (étude) | Code et déploiement depuis GitHub, clé API dans SSM, logs maîtrisés |
| 27/10/2026 | Pas de base de données en V1 | L'historique tient dans la session Alexa |
| 27/10/2026 | Une intention par mot porteur | `AMAZON.SearchQuery` retire le mot porteur de la valeur du slot |
