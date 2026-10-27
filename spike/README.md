# Spike — phase 0

Code jetable pour lever les inconnues bloquantes avant la V1 (voir [Implementation Plan](../docs/06-IMPLEMENTATION-PLAN.md#phase-0--spike-de-validation-2-à-3-h--go--no-go)). Les résultats vont dans [docs/spike-results.md](../docs/spike-results.md).

| Fichier | Rôle |
|---|---|
| `lambda/index.mjs` | Lambda : mode `echo` (répète la question captée) ou `claude` (lit la réponse ; la durée de l'appel est dans les logs) ; mode mesure via `{ "bench": … }` |
| `lambda/carriers.mjs` | Intentions et mots porteurs (préfixe rajouté devant la question) |
| `build-model.mjs` | Génère `interaction-model.fr-FR.json` à partir de `carriers.mjs` |
| `deploy.sh [SKILL_ID]` | Crée ou met à jour le rôle IAM et la Lambda `alexa-claude-spike` (eu-west-1) |
| `mode.sh echo\|claude` | Bascule le mode de la Lambda |
| `bench.sh [disabled\|adaptive]` | 10 questions envoyées à Claude depuis la Lambda, p50/p95 |

## Procédure

### 1. Créer la skill (console, ~10 min)

1. Sur [developer.amazon.com/alexa/console/ask](https://developer.amazon.com/alexa/console/ask), connecte-toi avec **le même compte Amazon que tes appareils**.
2. **Create Skill** → nom `Claude Spike`, langue **French (FR)**, type **Other → Custom**, hébergement **Provision your own**, modèle **Start from scratch**.
3. **Build → Interaction Model → JSON Editor** : colle le contenu de `spike/interaction-model.fr-FR.json`, puis **Save** et **Build skill**.
   - Si le nom d'appel `claude` est refusé, note le message exact, remplace par `assistant claude` et rebuild.
4. Copie le **Skill ID** (`amzn1.ask.skill.…`, visible dans la liste des skills ou dans **Endpoint**).

### 2. Relier la Lambda (~2 min)

```bash
./spike/deploy.sh amzn1.ask.skill.XXXX
```

Puis dans la console : **Build → Endpoint → AWS Lambda ARN**, colle l'ARN affiché dans **Default Region**, **Save Endpoints**.

### 3. Tester en mode écho

1. Onglet **Test** → active **Development**, tape ou dis « demande à claude pourquoi le ciel est bleu ».
2. Sur l'**Echo Dot** puis la **Sonos Arc** : « Alexa, demande à Claude pourquoi le ciel est bleu », puis 10 questions variées.
3. Lire ce qui a été capté :

```bash
aws logs tail /aws/lambda/alexa-claude-spike --region eu-west-1 --since 30m --format short | grep '"event"'
```

### 4. Brancher Claude

1. Crée une clé API dédiée dans la [Console Claude](https://platform.claude.com/settings/keys) et règle un **plafond de dépense** (ex. 5 $/mois).
2. Enregistre-la dans SSM (dans ton terminal ; la clé ne doit passer ni par le chat ni par Git) :

```bash
read -rs ANTHROPIC_KEY && aws ssm put-parameter --region eu-west-1 --name /alexa-claude/anthropic-api-key --type SecureString --value "$ANTHROPIC_KEY" && unset ANTHROPIC_KEY
```

3. Mesure la latence, sans et avec réflexion :

```bash
./spike/bench.sh disabled
```

```bash
./spike/bench.sh adaptive
```

4. Passe en mode Claude et refais les tests vocaux :

```bash
./spike/mode.sh claude
```

## Nettoyage (après la phase 0)

```bash
aws lambda delete-function --region eu-west-1 --function-name alexa-claude-spike
```

Puis supprimer le rôle IAM `alexa-claude-spike` et la skill « Claude Spike » dans la console. Le paramètre SSM est réutilisé par la V1.
