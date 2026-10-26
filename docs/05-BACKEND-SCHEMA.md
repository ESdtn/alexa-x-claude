# Backend Schema — structures de données (V1)

| | |
|---|---|
| **Statut** | Brouillon v0.1 |
| **Date** | 27/10/2026 |
| **Documents liés** | [TRD](02-TRD.md) · [App Flow](03-APP-FLOW.md) |

La V1 n'a **pas de base de données**. Les données vivent à quatre endroits :

| Donnée | Où | Durée de vie |
|---|---|---|
| Historique de conversation | Attributs de session Alexa | Session Alexa en cours |
| Table des mots porteurs | `model/carriers.fr-FR.json` (repo) | Versionnée dans Git |
| Configuration | Variables d'environnement Lambda | Jusqu'au prochain déploiement |
| Clé API Claude | SSM Parameter Store (`SecureString`) | Jusqu'à rotation manuelle |
| Métriques techniques | CloudWatch Logs | 14 jours |

## 1. Attributs de session Alexa

Renvoyés à Alexa dans chaque réponse (`sessionAttributes`) et reçus dans la requête suivante de la même session.

```ts
/** Version du schéma : permet de migrer si la structure change pendant une session. */
type SessionState = {
  v: 1;
  /** Échanges terminés, du plus ancien au plus récent. */
  history: Turn[];
  /** Nombre total de questions posées dans la session (y compris celles tronquées de l'historique). */
  turnCount: number;
};

type Turn = {
  /** Question reconstruite (préfixe porteur + valeur du slot). */
  q: string;
  /** Réponse de Claude après nettoyage, telle qu'elle a été lue. */
  a: string;
};
```

Exemple après deux échanges :

```json
{
  "v": 1,
  "turnCount": 2,
  "history": [
    { "q": "pourquoi le ciel est bleu", "a": "Parce que l'air diffuse davantage la lumière bleue du soleil que les autres couleurs. …" },
    { "q": "pourquoi il est rouge le soir", "a": "Le soir, la lumière traverse beaucoup plus d'atmosphère. …" }
  ]
}
```

**Règles**

- On garde au plus `HISTORY_MAX_TURNS` échanges (6 par défaut) ; les plus anciens sont retirés en premier.
- Une réponse en erreur (délai, 429…) **n'est pas** ajoutée à l'historique.
- Attributs absents, illisibles ou de version inconnue → on repart d'un état vide (`{ v: 1, history: [], turnCount: 0 }`), sans erreur.
- `NewConversationIntent` remet `history` à `[]` et garde `turnCount`.
- La taille de la réponse Alexa est bornée : 6 échanges de 60 mots restent très en dessous des limites.

## 2. Correspondance avec l'API Claude

```ts
function toClaudeMessages(state: SessionState, question: string): MessageParam[] {
  return [
    ...state.history.flatMap((t) => [
      { role: "user", content: t.q },
      { role: "assistant", content: t.a },
    ]),
    { role: "user", content: question },
  ];
}
```

| Champ de la requête Claude | Source |
|---|---|
| `model` | `CLAUDE_MODEL` |
| `max_tokens` | `CLAUDE_MAX_TOKENS` |
| `system` | `claude/prompt.ts` |
| `messages` | `toClaudeMessages(state, question)` |

| Champ de la réponse Claude | Usage |
|---|---|
| `content[].text` (blocs `type: "text"`) | Concaténés, puis nettoyés → texte parlé et `Turn.a` |
| `stop_reason` | `max_tokens` → coupe à la dernière fin de phrase |
| `usage.input_tokens`, `usage.output_tokens` | Logs uniquement |

## 3. Table des mots porteurs

`model/carriers.fr-FR.json` est la source du modèle d'interaction. Le script `scripts/build-interaction-model.ts` génère `skill-package/interactionModels/custom/fr-FR.json` à partir de ce fichier.

```ts
type CarrierFile = {
  invocationName: string;            // "claude"
  slotName: string;                  // "query"
  intents: CarrierIntent[];
  builtins: Record<string, string[]>; // phrases ajoutées aux intentions AMAZON.*
  custom: Record<string, string[]>;   // intentions sans slot (NewConversationIntent…)
};

type CarrierIntent = {
  name: string;           // "AskPourquoiIntent"
  prefix: string | null;  // "pourquoi" ; null = rien à rajouter
  carriers: string[];     // ["pourquoi"] → phrase d'exemple "pourquoi {query}"
};
```

Extrait :

```json
{
  "invocationName": "claude",
  "slotName": "query",
  "intents": [
    { "name": "AskClaudeIntent", "prefix": null, "carriers": ["question", "dis-moi", "je me demande", "de", "réponds"] },
    { "name": "AskPourquoiIntent", "prefix": "pourquoi", "carriers": ["pourquoi"] },
    { "name": "AskCommentIntent", "prefix": "comment", "carriers": ["comment"] },
    { "name": "AskQuelIntent", "prefix": "quel", "carriers": ["quel", "quelle", "quels", "quelles"] }
  ],
  "builtins": {
    "AMAZON.StopIntent": ["merci", "c'est tout", "c'est bon merci"]
  },
  "custom": {
    "NewConversationIntent": ["nouvelle conversation", "on change de sujet", "efface la conversation"]
  }
}
```

**Règles**

- Chaque `carrier` produit la phrase d'exemple `"<carrier> {query}"`.
- Les noms d'intention sont uniques et commencent par `Ask` pour les questions.
- Le même `carrier` ne peut pas apparaître dans deux intentions (vérifié par le script, qui échoue sinon).
- Le handler retrouve le préfixe à partir du nom d'intention : `question = prefix ? prefix + " " + query : query`.

## 4. Configuration

Validée au démarrage par `config.ts` ; une valeur invalide fait échouer le démarrage à froid (erreur visible dans les logs, message `genericError` côté Alexa).

```ts
type Config = {
  claudeModel: string;         // CLAUDE_MODEL, défaut "claude-haiku-5-5"
  claudeMaxTokens: number;     // CLAUDE_MAX_TOKENS, 50..1024, défaut 300
  claudeTimeoutMs: number;     // CLAUDE_TIMEOUT_MS, 1000..7000, défaut 6500
  historyMaxTurns: number;     // HISTORY_MAX_TURNS, 0..10, défaut 6
  apiKeyParam: string;         // ANTHROPIC_API_KEY_PARAM
  skillId: string;             // SKILL_ID, obligatoire
  progressiveResponse: boolean;// PROGRESSIVE_RESPONSE, défaut true
  logLevel: "debug" | "info" | "warn" | "error";
};
```

## 5. Secret

| Paramètre SSM | Type | Créé par |
|---|---|---|
| `/alexa-claude/anthropic-api-key` | `SecureString` (clé KMS gérée par AWS) | À la main, une fois : `aws ssm put-parameter --type SecureString …` |

Lu une fois par démarrage à froid avec `WithDecryption: true`, puis gardé en mémoire dans le module.

## 6. Événements de log

Une ligne JSON par événement. **Aucun texte de question ou de réponse** n'est journalisé, sauf en `LOG_LEVEL=debug` utilisé ponctuellement en développement.

```ts
type LogEvent = {
  level: "debug" | "info" | "warn" | "error";
  event: "ask" | "launch" | "fallback" | "new_conversation" | "help" | "stop" | "session_ended" | "error";
  requestId: string;
  intent?: string;
  coldStart: boolean;
  latencyMs: number;             // durée totale du handler
  // Événement "ask" uniquement
  model?: string;
  claudeMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  stopReason?: string;
  historyTurns?: number;
  queryChars?: number;           // longueur, pas le contenu
  // Événement "error" uniquement
  errorType?: "timeout" | "rate_limit" | "overloaded" | "auth" | "credit" | "empty_query" | "unknown";
  httpStatus?: number;
  // Événement "session_ended"
  reason?: "USER_INITIATED" | "ERROR" | "EXCEEDED_MAX_REPROMPTS";
};
```

## 7. Évolution prévue (V2, pour mémoire)

Quand viendront les réponses différées et l'objectif B, une table DynamoDB sera nécessaire. Esquisse, **non implémentée en V1** :

| Table | Clé de partition | Clé de tri | Usage |
|---|---|---|---|
| `alexa-claude` | `pk` = `USER#<alexaUserId>` | `sk` = `JOB#<id>` | Questions longues traitées en arrière-plan, puis annoncées |
| `alexa-claude` | `pk` = `PERM#<id>` | `sk` = `META` | Demandes de permission Claude Code en attente d'une réponse vocale (avec TTL) |
