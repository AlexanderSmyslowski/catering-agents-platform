export const priceColumnLabels = {
  article: "Artikelnummer",
  description: "Artikelbezeichnung",
  quantity: "Menge im Preisbezug",
  unit: "Einheit",
  price: "Nettopreis in Euro",
} as const;

export type PriceColumns = Record<keyof typeof priceColumnLabels, string>;
export const emptyColumns: PriceColumns = {
  article: "",
  description: "",
  quantity: "",
  unit: "",
  price: "",
};

const labelMatches: Record<keyof PriceColumns, RegExp> = {
  article: /^(artikel[- .]?(nr|nummer)\.?|sku)$/i,
  description: /^(produkt|bezeichnung|artikelname|beschreibung)$/i,
  quantity: /^(inhalt|bezugsmenge|menge)$/i,
  unit: /^(einheit|mengeneinheit)$/i,
  price: /^(preis neu|nettopreis|preis netto|netto eur)$/i,
};
export function suggestColumns(headers: Record<string, string>): PriceColumns {
  const result = { ...emptyColumns };
  for (const field of Object.keys(result) as (keyof PriceColumns)[]) {
    const matches = Object.entries(headers).filter(([, title]) =>
      labelMatches[field].test(title.trim()),
    );
    if (matches.length === 1) result[field] = matches[0][0];
  }
  return result;
}

export function PriceSourceColumns({
  headers,
  columns,
  onChange,
}: {
  headers: Record<string, string>;
  columns: PriceColumns;
  onChange: (columns: PriceColumns) => void;
}) {
  return (
    <fieldset>
      <legend>Spalten der Preisliste</legend>
      {(Object.keys(priceColumnLabels) as Array<keyof PriceColumns>).map(
        (field) => (
          <label key={field}>
            {priceColumnLabels[field]}
            <select
              value={columns[field]}
              onChange={(event) =>
                onChange({ ...columns, [field]: event.target.value })
              }
            >
              <option value="">Spalte auswählen</option>
              {Object.entries(headers).map(([letter, title]) => (
                <option key={letter} value={letter}>
                  {title} ({letter})
                </option>
              ))}
            </select>
          </label>
        ),
      )}
    </fieldset>
  );
}
