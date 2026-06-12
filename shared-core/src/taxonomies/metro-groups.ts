export const metroIngredientGroups = [
  { id: "obst_gemuese", label: "Obst / Gemüse" },
  { id: "kraeuter_salate", label: "Kräuter / Salate" },
  { id: "fleisch", label: "Fleisch" },
  { id: "fisch_meeresfruechte", label: "Fisch / Meeresfrüchte" },
  { id: "molkerei_eier", label: "Molkerei / Eier" },
  { id: "kaese", label: "Käse" },
  { id: "backwaren_zukauf", label: "Backwaren / Zukauf" },
  { id: "feinkost_antipasti", label: "Feinkost / Antipasti" },
  { id: "trockenlager", label: "Trockenlager" },
  { id: "gewuerze_wuerzmittel", label: "Gewürze / Würzmittel" },
  { id: "oele_essige_kochwein", label: "Öle / Essige / Kochwein" },
  { id: "getraenke_als_zutat", label: "Getränke als Speisenzutat" }
] as const;

export type MetroIngredientGroupId = (typeof metroIngredientGroups)[number]["id"];

const metroGroupOrder = new Map<string, number>(
  metroIngredientGroups.map((group, index) => [group.id, index])
);

const metroGroupLabels = new Map<string, string>(
  metroIngredientGroups.map((group) => [group.id, group.label])
);

export function metroGroupSortIndex(groupId: string): number {
  return metroGroupOrder.get(groupId) ?? Number.MAX_SAFE_INTEGER;
}

export function formatMetroGroupLabel(groupId: string): string {
  return metroGroupLabels.get(groupId) ?? groupId;
}

export function isMetroIngredientGroupId(value: string): value is MetroIngredientGroupId {
  return metroGroupOrder.has(value);
}
