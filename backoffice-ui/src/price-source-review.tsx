import { useState } from "react";
import type { ArticleMapping, Preview } from "./price-source-api.js";
const units = ["kg", "g", "l", "ml", "Stück"];
function complete(mapping: ArticleMapping) {
  return (
    mapping.ingredientKey.trim() &&
    units.includes(mapping.unit) &&
    /^(?:0|[1-9]\d{0,8})([.,]\d{1,6})?$/.test(mapping.quantity) &&
    Number(mapping.quantity.replace(",", ".")) > 0
  );
}

export function PriceSourceReview({
  preview,
  initial,
  onSave,
  action,
}: {
  preview: Preview;
  initial: ArticleMapping[];
  onSave: (selected: ArticleMapping[], removedArticles: string[]) => void;
  action: string;
}) {
  const applied = new Set(preview.appliedArticles ?? []);
  const openRows = preview.rows.filter(row => !applied.has(row.article));
  const [choices, setChoices] = useState<Map<string, ArticleMapping>>(
    () =>
      new Map(
        initial
          .filter((mapping) =>
            openRows.some((row) => row.article === mapping.article),
          )
          .map((mapping) => {
            const row = openRows.find(
              (item) => item.article === mapping.article,
            )!;
            const basisChanged =
              mapping.rawQuantity !== row.quantity ||
              mapping.rawUnit !== row.unit;
            return [
              mapping.article,
              basisChanged ? { ...mapping, quantity: "", unit: "" } : mapping,
            ];
          }),
      ),
  );
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(15);
  const found = openRows.filter((row) =>
    (row.article + " " + row.description)
      .toLocaleLowerCase("de")
      .includes(search.toLocaleLowerCase("de")),
  );
  const selected = Array.from(choices.values()).filter((item) =>
    item.ingredientKey.trim(),
  );
  const removedArticles = initial
    .filter(
      ({ article }) =>
        choices.has(article) && !choices.get(article)?.ingredientKey.trim(),
    )
    .map(({ article }) => article);
  return (
    <section className="price-source-review">
      <h3>Preise und Zutaten prüfen</h3>
      <p>
        {preview.rows.length} Artikel gelesen
        {preview.validFrom
          ? " · Gültig ab " + preview.validFrom.split("-").reverse().join(".")
          : " · Gültigkeit ungeklärt"}
        .
      </p>
      {applied.size > 0 && <p>{applied.size} Artikel bereits übernommen. Hier prüfst du die übrigen Artikel.</p>}
      {preview.senderAuthenticated === false && (
        <p>
          Die Absenderadresse ist technisch unbestätigt. Gleiche die Preise vor
          der Freigabe mit deinem Lieferantenbeleg ab.
        </p>
      )}
      {!!preview.skipped?.length && (
        <p role="status">
          {preview.skipped.length} Zeilen konnten nicht übernommen werden.
        </p>
      )}
      <label>
        Artikel suchen
        <input
          type="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setLimit(15);
          }}
        />
      </label>
      <ul className="item-list">
        {found.slice(0, limit).map((row) => {
          const choice = choices.get(row.article) ?? {
            article: row.article,
            ingredientKey: "",
            quantity: /^\d+(?:[.,]\d+)?$/.test(row.quantity)
              ? row.quantity
              : "",
            unit: units.includes(row.unit) ? row.unit : "",
          };
          function change(patch: Partial<ArticleMapping>) {
            setChoices((prior) =>
              new Map(prior).set(row.article, { ...choice, ...patch }),
            );
          }
          return (
            <li key={row.article}>
              <strong>{row.description}</strong>
              <p>
                Art. {row.article} · {row.price.replace(".", ",")} € netto ·
                laut Liste {row.quantity} {row.unit}
              </p>
              <label>
                Zutat für {row.article}
                <input
                  value={choice.ingredientKey}
                  onChange={(e) => change({ ingredientKey: e.target.value })}
                />
              </label>
              {choice.ingredientKey && (
                <fieldset>
                  <legend>Wofür gilt der Nettopreis?</legend>
                  <label>
                    Menge
                    <input
                      inputMode="decimal"
                      value={choice.quantity}
                      onChange={(e) => change({ quantity: e.target.value })}
                    />
                  </label>
                  <label>
                    Einheit
                    <select
                      value={choice.unit}
                      onChange={(e) => change({ unit: e.target.value })}
                    >
                      <option value="">Einheit wählen</option>
                      {units.map((unit) => (
                        <option key={unit}>{unit}</option>
                      ))}
                    </select>
                  </label>
                </fieldset>
              )}
            </li>
          );
        })}
      </ul>
      {found.length > limit && (
        <button
          type="button"
          className="secondary-button"
          onClick={() => setLimit(limit + 15)}
        >
          Weitere Artikel anzeigen
        </button>
      )}
      <p>{selected.length} Artikel zugeordnet</p>
      {selected.some(item => !complete(item)) && <button type="button" className="secondary-button" onClick={() => {
        const item = selected.find(item => !complete(item));
        if (item) { setSearch(item.article); setLimit(found.length + openRows.length); }
      }}>Fehlenden Preisbezug anzeigen</button>}
      <button
        type="button"
        disabled={
          (!selected.length && !removedArticles.length) ||
          selected.some((item) => !complete(item))
        }
        onClick={() =>
          onSave(
            selected.map((item) => ({
              ...item,
              ingredientKey: item.ingredientKey.trim(),
              quantity: item.quantity.replace(",", "."),
            })),
            removedArticles,
          )
        }
      >
        {action}
      </button>
    </section>
  );
}
