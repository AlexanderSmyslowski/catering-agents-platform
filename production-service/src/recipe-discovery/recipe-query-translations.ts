const germanToEnglishRecipeLabelReplacements: Array<[RegExp, string]> = [
  [/\bschokoladenkuchen\b/g, "chocolate cake"],
  [/\bkuchen\b/g, "cake"],
  [/\bschokolade\b/g, "chocolate"],
  [/\btomatensuppe\b/g, "tomato soup"],
  [/\blinseneintopf\b/g, "lentil stew"],
  [/\blinsen\b/g, "lentils"],
  [/\beintopf\b/g, "stew"],
  [/\bsuppe\b/g, "soup"],
  [/\bkartoffelsalat\b/g, "potato salad"],
  [/\bkartoffelgratin\b/g, "potato gratin"],
  [/\bnudelsalat\b/g, "pasta salad"],
  [/\bkrautsalat\b/g, "coleslaw"],
  [/\bkarottensalat\b/g, "carrot salad"],
  [/\bkraut\b/g, "cabbage"],
  [/\bkarotten\b/g, "carrot"],
  [/\bkarotte\b/g, "carrot"],
  [/\bmöhren\b/g, "carrot"],
  [/\bmöhre\b/g, "carrot"],
  [/\bmandeln\b/g, "almonds"],
  [/\bmandel\b/g, "almond"],
  [/\bnuss-toppping\b/g, "nut topping"],
  [/\bnuss-topping\b/g, "nut topping"],
  [/\bkraut-karottensalat\b/g, "cabbage carrot salad"],
  [/\bsalat\b/g, "salad"],
  [/\bbrot\b/g, "bread"],
  [/\bbaguette\b/g, "baguette"],
  [/\bkalbsbuletten\b/g, "veal meatballs"],
  [/\bkalbsfrikadellen\b/g, "veal meatballs"],
  [/\bbuletten\b/g, "meatballs"],
  [/\bfrikadellen\b/g, "meatballs"],
  [/\bschmorzwiebeln\b/g, "braised onions"],
  [/\bblaubeeren\b/g, "blueberry"],
  [/\bblaubeere\b/g, "blueberry"],
  [/\bobstspieße\b/g, "fruit skewers"],
  [/\bobstspiesse\b/g, "fruit skewers"],
  [/\bobstspieß\b/g, "fruit skewer"],
  [/\bobstspiess\b/g, "fruit skewer"],
  [/\bobst\b/g, "fruit"],
  [/\bbasmatireis\b/g, "basmati rice"],
  [/\bkoriander\b/g, "coriander"],
  [/\bwildkräutersalat\b/g, "wild herb salad"],
  [/\bwildkraeutersalat\b/g, "wild herb salad"],
  [/\bwildkräuter\b/g, "wild herbs"],
  [/\bpetersilien-vinaigrette\b/g, "parsley vinaigrette"],
  [/\bzuckerschoten\b/g, "snow peas"],
  [/\bpilze\b/g, "mushrooms"],
  [/\bpilz\b/g, "mushroom"],
  [/\bbaby-pak-choi\b/g, "baby pak choi"],
  [/\bpak-choi\b/g, "pak choi"],
  [/\bgemüsepfanne\b/g, "vegetable stir fry"],
  [/\bgemuesepfanne\b/g, "vegetable stir fry"]
];

export function translateLabelForLocale(label: string, locale: "de" | "en"): string {
  if (locale !== "en") {
    return label;
  }

  let translated = label.toLowerCase();
  for (const [pattern, replacement] of germanToEnglishRecipeLabelReplacements) {
    translated = translated.replace(pattern, replacement);
  }

  return translated.replace(/\s+/g, " ").trim();
}
