# Résultats du spike — phase 0

| | |
|---|---|
| **Date** | 27/10/2026 (simulateur) · appareils : à faire |
| **Procédure** | [spike/README.md](../spike/README.md) |
| **Skill ID** | `amzn1.ask.skill.a6e4da86-3eea-494f-adc8-9bbf139ca059` |
| **Décision** | En cours : simulateur ✅ · latence Claude ✅ · appareils ⬜ · Alexa+ ⬜ |

## 1. Nom d'appel

| Test | Résultat |
|---|---|
| La console accepte `claude` au build | ✅ Build réussi du premier coup, 0 erreur, 0 avertissement |
| Message d'erreur ou avertissement éventuel | À la création, sous le nom de la skill : « Brand names are only allowed if you provide proof of rights in the testing instructions or if you use the brand name in a referential manner that doesn't imply ownership (…) ». Ne concerne que la certification : sans conséquence en mode développement |
| « Alexa, demande à Claude… » ouvre la skill (simulateur) | ✅ |
| « Alexa, demande à Claude… » ouvre la skill (Echo Dot) | ⬜ |
| « Alexa, demande à Claude… » ouvre la skill (Sonos Arc) | ⬜ |
| « Alexa, ouvre Claude » ouvre la skill | ✅ (simulateur) |
| Nom retenu | **`claude`** |

## 2. Alexa+

| Test | Résultat |
|---|---|
| Alexa+ est-il actif sur le compte ? | ⬜ |
| La phrase atteint-elle la skill, ou Alexa+ répond-il à sa place ? | ⬜ |
| Relance sans redire « Alexa » : fonctionne ? | ⬜ |

## 3. Capture de la question (mode écho, simulateur)

| # | Phrase tapée | Intention reçue | `query` reçu | Question reconstruite | OK ? |
|---|---|---|---|---|---|
| 1 | ouvre claude | `LaunchRequest` | — | — | ✅ |
| 2 | demande à claude pourquoi le ciel est bleu | `AskPourquoiIntent` | `le ciel est bleu` | pourquoi le ciel est bleu | ✅ (2ᵉ essai, voir incident) |
| 3 | demande à claude comment on fait une pâte à crêpes | `AskCommentIntent` | `on fait une pâte à crêpes` | comment on fait une pâte à crêpes | ✅ |
| 4 | demande à claude qui a inventé l'imprimerie | `AskQuiIntent` | `a inventé l' imprimerie` | qui a inventé l'imprimerie | ✅ après correctif |
| 5 | demande à claude c'est quoi l'inflation | `AskQuoiIntent` | `l' inflation` | qu'est-ce que l'inflation | ✅ après correctif |

**Constats**

- **Élisions découpées** : Alexa renvoie `l' imprimerie`, `c' est`. Corrigé dans la Lambda (l'apostrophe est recollée au mot suivant), vérifié sur la fonction déployée. À reprendre en V1 dans `speech/` ou `handlers/ask.ts`.
- **Formulation d'origine perdue** : « c'est quoi » devient « qu'est-ce que », car le préfixe vient de l'intention et non des mots prononcés. Sans conséquence sur le sens.
- **Phrases réelles à tester sur appareil** : les dictées vocales seront moins propres que le texte tapé.

**Incident « No Content »** : le premier essai de la question n° 2, juste après « ouvre claude », n'a donné aucune réponse (« No Content » dans le simulateur, 503 sur `avs-alexa-eu.amazon.com/v20160207/events`). Les logs CloudWatch montrent que **la Lambda n'a reçu aucune requête** entre le lancement (01:25:15) et l'essai réussi après rechargement (01:26:51). Le problème est donc côté Alexa ou simulateur, pas dans notre code. À surveiller : relances dans une session déjà ouverte, à tester sur appareil.

## 4. Latence

| Mesure | Valeur |
|---|---|
| Démarrage à froid Lambda (`Init Duration`, SDK Anthropic chargé, sans lecture SSM) | ≈ 950 ms : au-dessus du budget de 800 ms du TRD, à réduire en V1 (bundle esbuild) |
| Traitement d'une requête à chaud, mode écho | 2 à 85 ms |

Latence de Claude (`bench.sh`, depuis la Lambda en eu-west-1, 27/10/2026, 10 questions, `max_tokens` = 300) :

| Réglage | p50 | p95 | max | `stop_reason` = `max_tokens` | Tokens sortie |
|---|---|---|---|---|---|
| Haiku 5.5, réflexion désactivée, effort `low` | 1 578 ms | 2 189 ms | 2 189 ms | 0 / 10 | 65 à 153 |
| Haiku 5.5, réflexion adaptative, effort `low` | 1 229 ms | 1 726 ms | 1 726 ms | 0 / 10 | 84 à 125 |

- **Large marge** : même le pire cas (2,2 s) laisse plus de 4 s sous le délai de 6,5 s.
- **Pas d'écart significatif entre les deux réglages** sur 10 questions simples : en effort `low`, la réflexion adaptative ne se déclenche pratiquement pas (même nombre de tokens en sortie). L'écart de p50 tient du bruit réseau.
- **Recommandation V1 : garder la réflexion désactivée**, pour un temps de réponse prévisible et pour éviter qu'une question complexe ne consomme les 300 tokens en réflexion.
- **Réponses** : 2 phrases, environ 40 à 60 mots, sans mise en forme. Exemple : « Le ciel est bleu parce que la lumière du soleil, en traversant l'atmosphère, est diffusée par les molécules d'air. Les longueurs d'onde bleues sont dispersées beaucoup plus que les rouges, et c'est cette lumière bleue qui nous arrive de partout dans le ciel. »
- **Coût mesuré** : environ 230 tokens en entrée et 110 en sortie par question, soit moins de 0,0001 $ par question avec Haiku 5.5.

## 5. Mode Claude sur appareil

| Test | Résultat |
|---|---|
| Réponse lue sans timeout Alexa (Echo Dot) | ⬜ |
| Réponse lue sans timeout Alexa (Sonos Arc) | ⬜ |
| Longueur et ton des réponses | ⬜ |
| Symboles ou mise en forme lus à voix haute | ⬜ |

## 6. Conséquences pour la V1

- Nom d'appel `claude` confirmé (reste à valider à la voix sur les appareils).
- La stratégie « une intention par mot porteur » fonctionne : 4 intentions sur 4 correctement routées, préfixe correctement remis.
- Ajouter la normalisation des élisions au nettoyage de la question.
- Haiku 5.5, réflexion désactivée, effort `low`, délai 6,5 s : confirmé, avec une large marge sous la limite d'Alexa.
- Le démarrage à froid doit être réduit (bundle unique, éviter de charger des modules inutiles).
- Avertissement « brand names » : à traiter seulement si la skill doit un jour être publiée.
