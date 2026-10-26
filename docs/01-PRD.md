# PRD — Alexa × Claude (V1 : « Alexa, demande à Claude »)

| | |
|---|---|
| **Statut** | Brouillon v0.1 |
| **Date** | 27/10/2026 |
| **Auteur** | Evans |
| **Source** | [Étude de faisabilité — Alexa × Claude](https://claude.ai/artifact/KKUo6mLi8EoVxueMWcC9tD) |

## 1. Problème

Les appareils Alexa de la maison (Sonos Arc, Echo Dot) sont pratiques pour poser une question à la voix, mais leurs réponses restent limitées. Claude répond mieux, mais il faut sortir un téléphone ou un ordinateur pour lui parler. Il n'existe pas d'intégration officielle « Claude dans Alexa » en France.

## 2. Objectif de la V1

Pouvoir dire **« Alexa, demande à Claude… »** suivi d'une question, entendre la réponse de Claude lue à voix haute, et enchaîner des relances dans la même conversation, sans toucher à un écran.

La V1 correspond à l'**objectif A** de l'étude de faisabilité. L'objectif B (Claude Code qui t'appelle par Alexa) est hors périmètre de cette version.

## 3. Utilisateur cible

Un seul utilisateur : Evans, propriétaire du compte Amazon et du compte API Claude. La skill reste en **mode développement** : elle n'est pas publiée sur le store Alexa et n'est disponible que sur les appareils du compte (et des éventuels bêta-testeurs invités).

## 4. Cas d'usage

| # | Situation | Phrase | Résultat attendu |
|---|---|---|---|
| U1 | Question ponctuelle | « Alexa, demande à Claude pourquoi le ciel est bleu » | Réponse en 2 à 3 phrases, puis Alexa propose une relance |
| U2 | Relance | (session ouverte) « Et la nuit, pourquoi il est noir ? » | Réponse qui tient compte de la question précédente |
| U3 | Ouverture sans question | « Alexa, ouvre Claude » | « Je t'écoute. » puis attente de la question |
| U4 | Fin de conversation | « Merci », « Stop », « C'est tout » | Alexa clôt poliment la session |
| U5 | Nouvelle conversation | « Nouvelle conversation » | L'historique est effacé, Alexa reste à l'écoute |
| U6 | Claude trop lent | Question complexe | Message d'excuse clair et invitation à reformuler plus court |
| U7 | Aide | « Aide » | Explication courte de ce qu'on peut demander |

## 5. Exigences fonctionnelles

| ID | Exigence | Priorité |
|---|---|---|
| F1 | La skill répond au nom d'appel « Claude » en français (fr-FR) | Must |
| F2 | La phrase libre qui suit l'appel est transmise telle quelle à Claude | Must |
| F3 | La réponse de Claude est lue par Alexa, sans Markdown ni caractères parasites | Must |
| F4 | La session reste ouverte après une réponse pour permettre une relance | Must |
| F5 | Les relances conservent l'historique de la conversation en cours (fenêtre limitée) | Must |
| F6 | Les commandes Stop / Annuler / Merci ferment la session | Must |
| F7 | Une commande « nouvelle conversation » efface l'historique | Should |
| F8 | En cas de délai dépassé ou d'erreur API, Alexa donne un message compréhensible, jamais un silence | Must |
| F9 | Ouverture sans question (« ouvre Claude ») possible | Should |
| F10 | Le modèle, la longueur maximale et la consigne système sont configurables sans modifier le code | Should |

## 6. Exigences non fonctionnelles

| ID | Exigence | Cible |
|---|---|---|
| NF1 | Temps de réponse total perçu | < 8 s (limite Alexa), cible p95 < 5 s |
| NF2 | Coût de fonctionnement | < 1 $/mois pour 20 questions/jour (Haiku 5.5) |
| NF3 | Sécurité des secrets | Clé API jamais dans le code ni dans Git |
| NF4 | Contrôle du budget | Plafond de dépense configuré dans la Console Claude |
| NF5 | Accès | Seule la skill identifiée peut appeler la fonction (vérification du skill ID) |
| NF6 | Compatibilité | Fonctionne sur Echo Dot et Sonos Arc |
| NF7 | Observabilité | Chaque requête est journalisée (latence, tokens, erreurs) sans stocker le contenu des questions |

## 7. Hors périmètre V1

- Objectif B : annonces et validations vocales depuis Claude Code (Voice Monkey, hooks, relais).
- Réponses différées (« je cherche et je te rappelle ») pour les questions longues.
- Recherche web via l'API Claude.
- Mémoire persistante entre deux sessions Alexa.
- Accès aux conversations ou projets claude.ai (l'API est séparée de l'abonnement).
- Publication sur le store Alexa et certification Amazon.
- Remplacer le « cerveau » d'Alexa : la phrase d'appel reste obligatoire.

## 8. Critères de succès

1. Sur un Echo Dot et sur la Sonos Arc, « Alexa, demande à Claude [question] » donne une réponse lue dans 95 % des essais sur une série de 20 questions variées.
2. Au moins 3 relances successives fonctionnent en gardant le contexte.
3. Aucun timeout Alexa (« la skill demandée n'a pas répondu ») sur la série de test.
4. Coût mesuré sur une semaine d'usage réel inférieur à 1 $.

## 9. Risques produit

| Risque | Impact | Parade |
|---|---|---|
| « Claude » refusé ou mal reconnu comme nom d'appel (nom d'une seule syllabe, nom de marque, conflit avec une skill publique homonyme) | Bloquant | Valider en phase 0 ; repli sur « assistant Claude » ou « mon Claude » |
| Alexa+ actif sur le compte intercepte la phrase au lieu d'ouvrir la skill | Bloquant | Tester en phase 0 sur les deux appareils |
| Réponses trop longues ou trop lentes | Expérience dégradée | Modèle rapide, `max_tokens` bas, consigne « oral, 2 à 3 phrases » |
| Questions captées partiellement par Alexa | Réponses à côté | Phrases porteuses multiples dans le modèle d'interaction (voir TRD) |

## 10. Évolutions prévues (après V1)

Dans l'ordre de l'étude de faisabilité : annonce Claude Code → Alexa (phase 1 de l'étude), réponses différées via Voice Monkey, validation vocale des permissions Claude Code, réponses libres via Claude Code Channels.
