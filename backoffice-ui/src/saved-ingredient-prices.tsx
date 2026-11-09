import { useEffect, useState } from "react";
import { priceSourceApi, type SourcePrice } from "./price-source-api.js";

export function SavedIngredientPrices({
  ingredient,
  onSelect,
}: {
  ingredient: string;
  onSelect: (item: SourcePrice) => void;
}) {
  const query = ingredient.trim();
  const [result, setResult] = useState<{
    query: string;
    prices: SourcePrice[];
    failed?: boolean;
  }>();
  useEffect(() => {
    if (query.length < 2) return;
    let current = true;
    const timer = setTimeout(() => {
      priceSourceApi
        .prices(query)
        .then((data) => {
          if (current)
            setResult({
              query,
              prices: data.prices.filter(
                (item) =>
                  item.ingredientKey.normalize("NFC").toLocaleLowerCase("de-DE") ===
                  query.normalize("NFC").toLocaleLowerCase("de-DE"),
              ),
            });
        })
        .catch(() => {
          if (current) setResult({ query, prices: [], failed: true });
        });
    }, 300);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [query]);
  if (result?.query !== query || query.length < 2) return null;
  if (result.failed)
    return (
      <p role="status">
        Lieferantenpreise sind gerade nicht erreichbar. Du kannst den Preis
        selbst eintragen.
      </p>
    );
  if (!result.prices.length) return null;
  return (
    <div>
      <p>Gespeicherte Lieferantenpreise für {query}</p>
      {result.prices.map((item) => (
        <button
          type="button"
          className="secondary-button"
          key={item.sourceId + "/" + item.article}
          onClick={() => onSelect(item)}
        >
          {item.sourceName} · {item.description} ·{" "}
          {item.price.replace(".", ",")} € netto für {item.quantity} {item.unit}{" "}
          ·{" "}
          {item.validFrom
            ? "gültig ab " + item.validFrom
            : "erfasst am " + item.observedAt.slice(0, 10)}
        </button>
      ))}
    </div>
  );
}
