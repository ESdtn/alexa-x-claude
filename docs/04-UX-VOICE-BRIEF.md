# UX Design Brief — interface vocale (V1)

| | |
|---|---|
| **Statut** | Brouillon v0.1 |
| **Date** | 27/10/2026 |
| **Documents liés** | [PRD](01-PRD.md) · [App Flow](03-APP-FLOW.md) |

Il n'y a pas d'interface graphique. Ce brief remplace le « design system » par un **système vocal** : ton, longueur, formulations fixes, règles de mise en forme pour la synthèse vocale, et la consigne système donnée à Claude.

## 1. Principes

1. **Court d'abord.** Une réponse orale se suit mal au-delà de 20 secondes. Cible : 2 à 3 phrases, 60 mots maximum.
2. **La réponse avant le contexte.** La première phrase répond à la question ; les détails viennent ensuite, ou sur relance.
3. **Jamais de silence.** Toute erreur se traduit par une phrase parlée qui dit quoi faire.
4. **Rester dans la conversation.** Après chaque réponse, le micro reste ouvert ; on n'ajoute pas « Autre chose ? » à voix haute à chaque fois (c'est le `reprompt` qui le dit si l'utilisateur se tait).
5. **Une seule personnalité.** Les messages de la skill (accueil, erreurs) et les réponses de Claude utilisent le même ton.

## 2. Ton et registre

| Aspect | Règle |
|---|---|
| Adresse | Tutoiement |
| Registre | Courant, chaleureux, sans familiarité excessive |
| Phrases | Courtes, voix active, une idée par phrase |
| À éviter | Listes, titres, émojis, URL, code, abréviations, parenthèses, « En tant qu'IA… » |
| Chiffres | Écrits pour l'oral : « environ trois cents kilomètres » plutôt que « ~300 km » |
| Incertitude | Le dire simplement : « Je ne suis pas sûr, mais… » |

## 3. Messages fixes de la skill

| Clé | Moment | Texte parlé | `reprompt` |
|---|---|---|---|
| `welcome` | Ouverture sans question | « Je t'écoute. » | « Pose-moi ta question. » |
| `thinking` | Réponse progressive | « Je réfléchis… » | — |
| `reprompt` | Après une réponse | — | « Autre chose ? » |
| `newConversation` | Nouvelle conversation | « D'accord, on repart de zéro. Je t'écoute. » | « Pose-moi ta question. » |
| `help` | Aide | « Pose-moi n'importe quelle question en commençant par exemple par pourquoi, comment ou dis-moi. Tu peux aussi dire nouvelle conversation, ou stop pour arrêter. » | « Qu'est-ce que tu veux savoir ? » |
| `fallback` | Phrase non reconnue | « Je n'ai pas compris. Commence par exemple ta question par pourquoi, comment ou dis-moi. » | « Tu peux répéter ? » |
| `emptyQuery` | Slot vide | « Je n'ai pas compris la question. Tu peux répéter ? » | « Tu peux répéter ? » |
| `timeout` | Délai Claude dépassé | « Claude met trop de temps à répondre. Essaie une question plus courte. » | « Tu peux reformuler ? » |
| `busy` | 429 / 529 | « Claude est très demandé en ce moment. Réessaie dans un instant. » | « Tu veux réessayer ? » |
| `configError` | 401 / 403 / crédit | « Je n'arrive pas à joindre Claude. Vérifie la configuration. » | — (fin) |
| `genericError` | Erreur inattendue | « Oups, quelque chose s'est mal passé. Réessaie plus tard. » | — (fin) |
| `goodbye` | Stop, merci | « Avec plaisir. » | — (fin) |

Ces textes vivent dans un seul fichier (`lambda/src/speech/messages.ts`) pour pouvoir les ajuster sans toucher à la logique.

## 4. Consigne système de Claude

Brouillon, à affiner pendant les tests sur appareil :

```text
Tu es Claude, et tu réponds à voix haute via une enceinte Alexa, en français.
Ta réponse sera lue par une synthèse vocale : l'utilisateur ne voit rien.

Règles :
- Réponds en 2 ou 3 phrases courtes, 60 mots au maximum, sauf si on te demande explicitement plus de détails.
- Commence directement par la réponse, sans reformuler la question ni dire « bonne question ».
- Tutoie l'utilisateur, avec un ton chaleureux et naturel.
- N'utilise aucune mise en forme : pas de listes, de titres, de gras, d'émojis, de liens, de code ni de parenthèses.
- Écris les nombres, unités et symboles comme on les prononce.
- La question est une transcription vocale : elle peut contenir des erreurs de reconnaissance ou manquer de ponctuation. Interprète-la avec bon sens ; si elle est vraiment ambiguë, pose une seule question de clarification courte.
- Si tu ne sais pas ou si l'information dépend de l'actualité récente, dis-le en une phrase.
```

## 5. Règles de mise en forme pour la synthèse vocale

Appliquées par `speech/sanitize.ts` sur la sortie de Claude, même si la consigne est respectée (filet de sécurité) :

| Entrée | Traitement |
|---|---|
| `**gras**`, `_italique_`, `# Titre` | Marqueurs supprimés, texte conservé |
| Puces `- ` / `1. ` | Transformées en phrases séparées par des points |
| Blocs de code, `` `code` `` | Supprimés ; si la réponse n'était que du code : « La réponse contient du code, je ne peux pas le lire correctement. » |
| URL | Supprimées |
| Émojis | Supprimés |
| `&`, `<`, `>` | Échappés pour le SSML (`&amp;`, `&lt;`, `&gt;`) |
| Texte coupé par `max_tokens` | Coupé à la dernière fin de phrase complète |
| Réponse vide après nettoyage | Message `genericError` |

## 6. Voix

- **V1 : voix Alexa par défaut**, la plus naturelle en français et cohérente sur tous les appareils.
- **Option à tester** : une voix Amazon Polly française (`<voice name="Lea">` ou `Mathieu`) pour distinguer Claude d'Alexa à l'oreille. À décider après écoute sur la Sonos Arc.
- Pas d'effets SSML (`<prosody>`, `<emphasis>`) en V1 : ils sonnent souvent artificiels.

## 7. Critères d'acceptation UX

- Une réponse typique dure entre 5 et 20 secondes à l'écoute.
- Aucune réponse ne contient de symbole lu à voix haute (« astérisque », « dièse »).
- Chaque message d'erreur dit ce que l'utilisateur peut faire ensuite.
- Après une réponse, une relance fonctionne sans redire « Alexa, demande à Claude ».
