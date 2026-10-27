// Génère le modèle d'interaction fr-FR du spike (à coller dans le JSON Editor de la console).
// Usage : node spike/build-model.mjs > spike/interaction-model.fr-FR.json
import { CARRIER_INTENTS } from "./lambda/carriers.mjs";

const askIntents = CARRIER_INTENTS.map(({ name, carriers }) => ({
  name,
  slots: [{ name: "query", type: "AMAZON.SearchQuery" }],
  samples: carriers.map((c) => `${c} {query}`),
}));

const model = {
  interactionModel: {
    languageModel: {
      invocationName: "claude",
      intents: [
        { name: "AMAZON.CancelIntent", samples: [] },
        { name: "AMAZON.HelpIntent", samples: [] },
        { name: "AMAZON.StopIntent", samples: ["merci", "c'est tout", "c'est bon merci"] },
        { name: "AMAZON.NavigateHomeIntent", samples: [] },
        { name: "AMAZON.FallbackIntent", samples: [] },
        ...askIntents,
      ],
      types: [],
    },
  },
};

const seen = new Map();
for (const { name, samples } of askIntents) {
  for (const s of samples) {
    if (seen.has(s)) throw new Error(`Phrase en double : "${s}" (${seen.get(s)} et ${name})`);
    seen.set(s, name);
  }
}

process.stdout.write(JSON.stringify(model, null, 2) + "\n");
