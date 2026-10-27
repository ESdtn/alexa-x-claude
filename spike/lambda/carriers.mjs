// Une intention par mot porteur : AMAZON.SearchQuery retire le mot porteur de la valeur du slot,
// le préfixe permet de le remettre devant la question.
export const CARRIER_INTENTS = [
  {
    name: "AskClaudeIntent",
    prefix: "",
    carriers: ["question", "dis moi", "je me demande", "de", "réponds", "j'ai une question", "aide moi à"],
  },
  { name: "AskPourquoiIntent", prefix: "pourquoi", carriers: ["pourquoi"] },
  { name: "AskCommentIntent", prefix: "comment", carriers: ["comment"] },
  { name: "AskQuiIntent", prefix: "qui", carriers: ["qui"] },
  { name: "AskQuelIntent", prefix: "quel", carriers: ["quel", "quelle", "quels", "quelles"] },
  { name: "AskCombienIntent", prefix: "combien", carriers: ["combien"] },
  { name: "AskQuandIntent", prefix: "quand", carriers: ["quand"] },
  { name: "AskOuIntent", prefix: "où", carriers: ["où"] },
  { name: "AskQuoiIntent", prefix: "qu'est-ce que", carriers: ["c'est quoi", "qu'est ce que", "que"] },
  { name: "AskEstCeQueIntent", prefix: "est-ce que", carriers: ["est ce que"] },
  { name: "AskExpliqueIntent", prefix: "explique-moi", carriers: ["explique moi", "explique"] },
  { name: "AskDonneIntent", prefix: "donne-moi", carriers: ["donne moi"] },
  { name: "AskRaconteIntent", prefix: "raconte-moi", carriers: ["raconte moi"] },
  { name: "AskPeuxTuIntent", prefix: "peux-tu", carriers: ["peux tu", "tu peux"] },
];

export const PREFIXES = Object.fromEntries(CARRIER_INTENTS.map((i) => [i.name, i.prefix]));
