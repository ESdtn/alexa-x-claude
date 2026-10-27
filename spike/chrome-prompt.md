# Prompt pour Claude dans Chrome — création de la skill du spike

Copie tout ce qui se trouve sous la ligne ci-dessous dans le panneau Claude de l'extension Chrome.

---

Tu vas m'accompagner pas à pas dans la création d'une skill Alexa dans la console développeur Amazon. C'est la phase 0 (spike) de mon projet « Alexa × Claude » : je veux pouvoir dire « Alexa, demande à Claude… » et que la question parte vers une fonction AWS Lambda déjà déployée.

## Règles de travail

- Je me connecte moi-même à mon compte Amazon. Si une page de connexion, un code de vérification ou un captcha apparaît, arrête-toi et dis-moi de m'en occuper.
- Avant tout clic qui crée, enregistre, accepte des conditions ou lance un build, dis-moi ce que tu vas faire et attends mon « ok ».
- Si l'interface ne correspond pas à ce que je décris (libellés différents, étapes réorganisées), décris-moi ce que tu vois et propose l'équivalent plutôt que de deviner.
- Ne modifie aucune autre skill que celle-ci, et aucun réglage de mon compte.
- À chaque étape terminée, dis-moi en une phrase ce qui a été fait.
- Note tout message d'erreur ou d'avertissement **mot pour mot** : j'en ai besoin pour mes résultats de test.

## Étapes

### 1. Créer la skill

1. Va sur https://developer.amazon.com/alexa/console/ask et vérifie que je suis connecté.
2. Clique sur **Create Skill** et remplis :
   - Nom de la skill : `Claude Spike`
   - Langue principale : **French (FR)**
   - Type d'expérience : **Other**, modèle : **Custom**
   - Hébergement du backend : **Provision your own**
   - Modèle de départ : **Start from scratch**
3. Valide la création (attends mon ok).

### 2. Charger le modèle d'interaction

1. Dans **Build → Interaction Model**, ouvre le **JSON Editor**.
2. Remplace tout le contenu par le JSON de l'annexe ci-dessous, sans rien modifier.
3. **Save**, puis **Build skill** (attends mon ok). Attends la fin du build.
4. Si le build échoue à cause du nom d'appel `claude` :
   - recopie-moi l'erreur exacte ;
   - remplace dans le JSON `"invocationName": "claude"` par `"invocationName": "assistant claude"` ;
   - sauvegarde et relance le build.
5. Dis-moi aussi s'il y a des avertissements, même si le build réussit.

### 3. Relier la fonction Lambda

1. Va dans **Build → Endpoint**, choisis **AWS Lambda ARN**.
2. Récupère le **Skill ID** affiché sur cette page (`amzn1.ask.skill.…`) et donne-le-moi : je dois l'ajouter côté AWS avant d'enregistrer l'endpoint.
3. Attends que je te confirme que c'est fait côté AWS.
4. Dans **Default Region**, colle cet ARN :
   `arn:aws:lambda:eu-west-1:178973333166:function:alexa-claude-spike`
5. **Save Endpoints** (attends mon ok). Si un message dit que la skill n'a pas la permission d'appeler la fonction, recopie-le-moi.

### 4. Premier test dans le simulateur

1. Onglet **Test** : passe le sélecteur de **Off** à **Development**.
2. Dans le champ de saisie, tape successivement :
   - `ouvre claude`
   - `demande à claude pourquoi le ciel est bleu`
   - `demande à claude comment on fait une pâte à crêpes`
   - `demande à claude qui a inventé l'imprimerie`
   - `demande à claude c'est quoi l'inflation`
3. Pour chaque phrase, relève : la réponse d'Alexa, et dans le panneau **JSON Input**, le nom de l'intention (`request.intent.name`) et la valeur du slot `query`.
4. Présente-moi les résultats dans un tableau : phrase tapée · intention · valeur de `query` · réponse d'Alexa.

Le mode actuel de la Lambda est « écho » : une réponse attendue ressemble à « J'ai entendu : pourquoi le ciel est bleu. Intention AskPourquoi. »

### 5. Récapitulatif final

Termine par un résumé :
- nom d'appel retenu (`claude` ou `assistant claude`) ;
- Skill ID ;
- erreurs ou avertissements rencontrés, mot pour mot ;
- le tableau de l'étape 4.

## Annexe — modèle d'interaction (JSON Editor)

```json
{
  "interactionModel": {
    "languageModel": {
      "invocationName": "claude",
      "intents": [
        {
          "name": "AMAZON.CancelIntent",
          "samples": []
        },
        {
          "name": "AMAZON.HelpIntent",
          "samples": []
        },
        {
          "name": "AMAZON.StopIntent",
          "samples": [
            "merci",
            "c'est tout",
            "c'est bon merci"
          ]
        },
        {
          "name": "AMAZON.NavigateHomeIntent",
          "samples": []
        },
        {
          "name": "AMAZON.FallbackIntent",
          "samples": []
        },
        {
          "name": "AskClaudeIntent",
          "slots": [
            {
              "name": "query",
              "type": "AMAZON.SearchQuery"
            }
          ],
          "samples": [
            "question {query}",
            "dis moi {query}",
            "je me demande {query}",
            "de {query}",
            "réponds {query}",
            "j'ai une question {query}",
            "aide moi à {query}"
          ]
        },
        {
          "name": "AskPourquoiIntent",
          "slots": [
            {
              "name": "query",
              "type": "AMAZON.SearchQuery"
            }
          ],
          "samples": [
            "pourquoi {query}"
          ]
        },
        {
          "name": "AskCommentIntent",
          "slots": [
            {
              "name": "query",
              "type": "AMAZON.SearchQuery"
            }
          ],
          "samples": [
            "comment {query}"
          ]
        },
        {
          "name": "AskQuiIntent",
          "slots": [
            {
              "name": "query",
              "type": "AMAZON.SearchQuery"
            }
          ],
          "samples": [
            "qui {query}"
          ]
        },
        {
          "name": "AskQuelIntent",
          "slots": [
            {
              "name": "query",
              "type": "AMAZON.SearchQuery"
            }
          ],
          "samples": [
            "quel {query}",
            "quelle {query}",
            "quels {query}",
            "quelles {query}"
          ]
        },
        {
          "name": "AskCombienIntent",
          "slots": [
            {
              "name": "query",
              "type": "AMAZON.SearchQuery"
            }
          ],
          "samples": [
            "combien {query}"
          ]
        },
        {
          "name": "AskQuandIntent",
          "slots": [
            {
              "name": "query",
              "type": "AMAZON.SearchQuery"
            }
          ],
          "samples": [
            "quand {query}"
          ]
        },
        {
          "name": "AskOuIntent",
          "slots": [
            {
              "name": "query",
              "type": "AMAZON.SearchQuery"
            }
          ],
          "samples": [
            "où {query}"
          ]
        },
        {
          "name": "AskQuoiIntent",
          "slots": [
            {
              "name": "query",
              "type": "AMAZON.SearchQuery"
            }
          ],
          "samples": [
            "c'est quoi {query}",
            "qu'est ce que {query}",
            "que {query}"
          ]
        },
        {
          "name": "AskEstCeQueIntent",
          "slots": [
            {
              "name": "query",
              "type": "AMAZON.SearchQuery"
            }
          ],
          "samples": [
            "est ce que {query}"
          ]
        },
        {
          "name": "AskExpliqueIntent",
          "slots": [
            {
              "name": "query",
              "type": "AMAZON.SearchQuery"
            }
          ],
          "samples": [
            "explique moi {query}",
            "explique {query}"
          ]
        },
        {
          "name": "AskDonneIntent",
          "slots": [
            {
              "name": "query",
              "type": "AMAZON.SearchQuery"
            }
          ],
          "samples": [
            "donne moi {query}"
          ]
        },
        {
          "name": "AskRaconteIntent",
          "slots": [
            {
              "name": "query",
              "type": "AMAZON.SearchQuery"
            }
          ],
          "samples": [
            "raconte moi {query}"
          ]
        },
        {
          "name": "AskPeuxTuIntent",
          "slots": [
            {
              "name": "query",
              "type": "AMAZON.SearchQuery"
            }
          ],
          "samples": [
            "peux tu {query}",
            "tu peux {query}"
          ]
        }
      ],
      "types": []
    }
  }
}
```
