function translateExtractedFieldStatus(value?: string): string {
  const labels: Record<string, string> = {
    extracted: "extrahiert",
    uncertain: "unsicher",
    missing: "fehlt"
  };
  return value ? labels[value] ?? value : "-";
}

function formatExtractedFieldValue(value: unknown): string {
  if (value === undefined || value === null) {
    return "—";
  }
  if (Array.isArray(value)) {
    const parts = value
      .map((entry) => String(entry).trim())
      .filter((entry) => entry.length > 0);
    return parts.length > 0 ? parts.join(", ") : "—";
  }
  if (typeof value === "object") {
    const amount = (value as { amount?: unknown }).amount;
    const currency = (value as { currency?: unknown }).currency;
    if (typeof amount === "number" || typeof amount === "string") {
      return typeof currency === "string" ? `${amount} ${currency}` : String(amount);
    }
    return JSON.stringify(value);
  }
  return String(value);
}

const EXTRACTED_CONTEXT_FIELD_LABELS: Array<{ key: string; label: string }> = [
  { key: "pax", label: "Teilnehmerzahl" },
  { key: "serviceForm", label: "Serviceform" },
  { key: "menuOrServiceWish", label: "Menü- oder Servicewunsch" },
  { key: "budgetTarget", label: "Budgetziel" },
  { key: "eventType", label: "Veranstaltungstyp" },
  { key: "date", label: "Datum" },
  { key: "restrictions", label: "Einschränkungen" }
];

export function ExtractedContextPanel({
  extractedContext
}: {
  extractedContext: Record<string, unknown>;
}) {
  return (
    <>
      <div className="divider" />
      <header>
        <p className="eyebrow">Extraktionsentwurf</p>
        <h4 className="subsection-title">Dokumenthinweise aus dem Import</h4>
      </header>
      <p className="helper-text">
        Dieser Entwurf zeigt, was aus dem Dokument gelesen wurde. Er ist ein Hinweisobjekt und ersetzt
        nicht die operative Spezifikation.
      </p>
      <ul className="item-list compact">
        {EXTRACTED_CONTEXT_FIELD_LABELS.map(({ key, label }) => {
          const field = ((extractedContext.fields as Record<string, unknown> | undefined)?.[key] as
            | Record<string, unknown>
            | undefined);
          const status = String(field?.status ?? "missing");
          const note = typeof field?.note === "string" ? field.note : undefined;
          return (
            <li key={key}>
              <strong>{label}</strong>
              <p className="helper-text">Status: {translateExtractedFieldStatus(status)}</p>
              <p>{formatExtractedFieldValue(field?.value)}</p>
              {note ? <p className="helper-text">{note}</p> : null}
            </li>
          );
        })}
      </ul>
      {Array.isArray(extractedContext.uncertainties) && extractedContext.uncertainties.length > 0 ? (
        <>
          <p className="eyebrow">Unsicherheiten im Entwurf</p>
          <ul className="item-list compact">
            {extractedContext.uncertainties.map((entry) => (
              <li key={String(entry)}>{String(entry)}</li>
            ))}
          </ul>
        </>
      ) : null}
      {Array.isArray(extractedContext.missingFields) && extractedContext.missingFields.length > 0 ? (
        <>
          <p className="eyebrow">Noch fehlend</p>
          <ul className="item-list compact">
            {extractedContext.missingFields.map((entry) => (
              <li key={String(entry)}>{String(entry)}</li>
            ))}
          </ul>
        </>
      ) : null}
    </>
  );
}
