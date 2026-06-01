const culinaryTokenExpansions: Record<string, string[]> = {
  schokoladenkuchen: ["chocolate", "cake"],
  kuchen: ["cake"],
  schokolade: ["chocolate"],
  schokokuchen: ["chocolate", "cake"],
  tomatensuppe: ["tomato", "soup"],
  suppe: ["soup"],
  linseneintopf: ["lentil", "lentils", "stew"],
  linsen: ["lentil", "lentils"],
  linse: ["lentil"],
  lentil: ["linse", "linsen"],
  lentils: ["linse", "linsen"],
  eintopf: ["stew"],
  stew: ["eintopf"],
  kartoffelsalat: ["potato", "salad"],
  kartoffelgratin: ["potato", "gratin"],
  nudelsalat: ["pasta", "salad"],
  salat: ["salad"],
  krautsalat: ["coleslaw", "salad", "kraut"],
  karottensalat: ["carrot", "salad", "krautsalat"],
  kraut: ["cabbage", "krautsalat"],
  karotte: ["carrot"],
  karotten: ["carrot"],
  möhre: ["carrot"],
  möhren: ["carrot"],
  mandel: ["almond"],
  mandeln: ["almond", "almonds"],
  almond: ["mandel", "mandeln"],
  almonds: ["mandel", "mandeln"],
  basmatireis: ["basmati", "rice"],
  basmati: ["basmatireis"],
  rice: ["reis", "basmatireis"],
  koriander: ["coriander", "cilantro"],
  coriander: ["koriander"],
  cilantro: ["koriander"],
  nuss: ["nut"],
  nüsse: ["nuts"],
  wildkräutersalat: ["herb", "salad"],
  wildkraeutersalat: ["herb", "salad"],
  wildkrautersalat: ["wild", "herb", "salad"],
  wildkräuter: ["herbs"],
  wildkrauter: ["wild", "herbs"],
  petersilie: ["parsley"],
  petersilien: ["parsley"],
  vinaigrette: ["vinaigrette"],
  brot: ["bread"],
  baguette: ["baguette"],
  hummus: ["humus"],
  humus: ["hummus"],
  kalbsbuletten: ["veal", "meatballs"],
  kalbsfrikadellen: ["veal", "meatballs"],
  buletten: ["meatballs"],
  frikadellen: ["meatballs"],
  aubergine: ["eggplant"],
  auberginen: ["eggplant"],
  auberginenröllchen: ["eggplant", "rolls", "auberginen"],
  auberginenroellchen: ["eggplant", "rolls", "auberginen"],
  auberginenrollchen: ["eggplant", "rolls", "auberginen"],
  rollchen: ["rolls"],
  röllchen: ["rolls"],
  roellchen: ["rolls"],
  eggplant: ["aubergine", "auberginen"],
  rolls: ["rollchen", "röllchen", "roellchen"],
  blaubeere: ["blueberry"],
  blaubeeren: ["blueberry"],
  blueberry: ["blaubeere", "blaubeeren"],
  obst: ["fruit"],
  obstspiess: ["fruit", "skewers"],
  obstspieß: ["fruit", "skewers"],
  obstspiesse: ["fruit", "skewers"],
  obstspieße: ["fruit", "skewers"],
  fruit: ["obst"],
  spiess: ["skewer"],
  spieß: ["skewer"],
  spiesse: ["skewers"],
  spieße: ["skewers"],
  skewer: ["spiess", "spieß"],
  skewers: ["spiesse", "spieße"],
  curry: ["curry"],
  reis: ["rice"],
  schmorzwiebeln: ["braised", "onions"],
  zucchini: ["zucchini"],
  pilz: ["mushroom"],
  pilze: ["mushrooms"],
  zuckerschoten: ["snow", "peas"],
  pak: ["pak"],
  choi: ["choi"],
  gemüsepfanne: ["vegetable", "stir", "fry"],
  gemuesepfanne: ["vegetable", "stir", "fry"],
  gemusepfanne: ["vegetable", "stir", "fry"]
};

const specificTokenAliases: Record<string, string[]> = {
  schokoladenkuchen: ["chocolate", "cake"],
  schokokuchen: ["chocolate", "cake"],
  chocolate: ["schokoladenkuchen", "schokokuchen"],
  cake: ["schokoladenkuchen", "schokokuchen"],
  nudelsalat: ["pastasalat"],
  pastasalat: ["nudelsalat"],
  kartoffelsalat: ["potatosalad"],
  potatosalad: ["kartoffelsalat"],
  kartoffelgratin: ["potatogratin"],
  potatogratin: ["kartoffelgratin"],
  hummus: ["humus"],
  humus: ["hummus"],
  linseneintopf: ["lentil", "lentils", "stew"],
  linsen: ["lentil", "lentils"],
  lentil: ["linse", "linsen"],
  lentils: ["linse", "linsen"],
  eintopf: ["stew"],
  stew: ["eintopf"],
  kalbsbuletten: ["veal", "meatballs", "buletten"],
  kalbsfrikadellen: ["veal", "meatballs", "frikadellen"],
  buletten: ["meatballs"],
  frikadellen: ["meatballs"],
  meatballs: ["buletten", "frikadellen"],
  auberginenrollchen: ["eggplant", "rolls"],
  auberginenroellchen: ["eggplant", "rolls"],
  eggplant: ["auberginenrollchen", "auberginenroellchen"],
  rolls: ["auberginenrollchen", "auberginenroellchen"],
  blaubeere: ["blueberry"],
  blaubeeren: ["blueberry"],
  blueberry: ["blaubeere", "blaubeeren"],
  obstspiess: ["fruit", "skewers"],
  obstspiesse: ["fruit", "skewers"],
  fruit: ["obst", "obstspiess", "obstspiesse"],
  skewer: ["spiess"],
  skewers: ["spiesse", "obstspiess", "obstspiesse"],
  spiess: ["skewer"],
  spiesse: ["skewers"],
  mandel: ["almond", "almonds"],
  mandeln: ["almond", "almonds"],
  almond: ["mandel", "mandeln"],
  almonds: ["mandel", "mandeln"],
  basmatireis: ["basmati", "rice"],
  basmati: ["basmatireis"],
  rice: ["reis", "basmatireis"],
  koriander: ["coriander", "cilantro"],
  coriander: ["koriander"],
  cilantro: ["koriander"],
  gemuesepfanne: ["gemusepfanne", "stirfry"],
  gemusepfanne: ["gemuesepfanne", "stirfry"],
  stirfry: ["gemuesepfanne", "gemusepfanne"]
};

export function normalizeTokens(value: string): string[] {
  const baseTokens = value
    .toLowerCase()
    .split(/[^a-z0-9äöüß]+/i)
    .filter(Boolean);
  const expanded = new Set<string>();

  for (const token of baseTokens) {
    expanded.add(token);
    for (const extra of culinaryTokenExpansions[token] ?? []) {
      expanded.add(extra);
    }
  }

  return [...expanded];
}

export function culinaryExpansionsForToken(token: string): string[] {
  return [...(culinaryTokenExpansions[token] ?? [])];
}

export function normalizeComparableText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .toLowerCase();
}

export function rawComparableTokens(value: string): string[] {
  return normalizeComparableText(value).split(/[^a-z0-9]+/i).filter(Boolean);
}

export function deriveCompoundStemTokens(token: string): string[] {
  const stems: string[] = [];
  const suffixes = ["kuchen", "salat", "suppe", "curry", "quiche"];

  for (const suffix of suffixes) {
    if (token.length > suffix.length + 3 && token.endsWith(suffix)) {
      const stem = token.slice(0, -suffix.length);
      if (stem.length >= 4) {
        stems.push(stem);
      }
    }
  }

  return stems;
}

export function searchableSpecificTokens(value: string): string[] {
  const tokens = rawComparableTokens(value);
  const expanded = new Set<string>();

  tokens.forEach((token, index) => {
    expanded.add(token);
    for (const stem of deriveCompoundStemTokens(token)) {
      expanded.add(stem);
    }
    const nextToken = tokens[index + 1];
    if (nextToken) {
      expanded.add(`${token}${nextToken}`);
    }
  });

  return [...expanded];
}

function commonPrefixLength(left: string, right: string): number {
  const max = Math.min(left.length, right.length);
  let index = 0;
  while (index < max && left[index] === right[index]) {
    index += 1;
  }
  return index;
}

export function tokensRoughlyMatch(left: string, right: string): boolean {
  if (left === right) {
    return true;
  }

  if (left.length >= 4 && right.length >= 4 && (left.includes(right) || right.includes(left))) {
    return true;
  }

  return commonPrefixLength(left, right) >= 5;
}

export function tokensSpecificallyMatch(left: string, right: string): boolean {
  if (left === right) {
    return true;
  }

  if (
    (specificTokenAliases[left] ?? []).includes(right) ||
    (specificTokenAliases[right] ?? []).includes(left)
  ) {
    return true;
  }

  return commonPrefixLength(left, right) >= 5;
}
