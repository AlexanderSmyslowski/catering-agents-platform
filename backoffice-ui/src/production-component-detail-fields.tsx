import type { PurchasedQuantityEdit } from "./production-answer-types.js";

type ProductionComponentDetailFieldsProps = {
  purchasedElements: string;
  purchasedElementNames?: string[];
  purchasedQuantities?: PurchasedQuantityEdit[];
  attendeeCount?: number;
  onPurchasedQuantitiesChange?: (quantities: PurchasedQuantityEdit[]) => void;
  notes: string;
  onPurchasedElementsChange: (purchasedElements: string) => void;
  onNotesChange: (notes: string) => void;
};

export function ProductionComponentDetailFields({
  purchasedElements,
  purchasedElementNames,
  purchasedQuantities,
  attendeeCount,
  onPurchasedQuantitiesChange,
  notes,
  onPurchasedElementsChange,
  onNotesChange
}: ProductionComponentDetailFieldsProps) {
  return (
    <>
      <label className="field-block">
        <span>Zugekaufte Bestandteile</span>
        <input
          value={purchasedElements}
          onChange={(event) => onPurchasedElementsChange(event.target.value)}
          placeholder="z. B. Teig, Blätterteig, fertiger Boden, Saucenbasis"
        />
      </label>
      {onPurchasedQuantitiesChange && purchasedElements.trim() ? (
        <fieldset>
          <legend>Zukaufmengen – Operatorentscheidung</legend>
          <p className="helper-text">Menge pro Person und Einheit für jeden zugekauften Bestandteil festlegen.</p>
          {purchasedQuantities === undefined ? (
            <button type="button" className="secondary-button" onClick={() => onPurchasedQuantitiesChange(
              (purchasedElementNames ?? purchasedElements.split(",").map(element => element.trim()).filter(Boolean)).map(element => ({ element, amountPerPerson: "", unit: "" }))
            )}>Zukaufmengen pro Person festlegen</button>
          ) : purchasedQuantities.map((quantity, index) => {
            const amount = Number(quantity.amountPerPerson);
            const total = amount * (attendeeCount ?? NaN);
            const showTotal = amount > 0 && Number.isFinite(total) && Boolean(quantity.unit.trim());
            const update = (patch: Partial<PurchasedQuantityEdit>) => onPurchasedQuantitiesChange(
              purchasedQuantities.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item)
            );
            return <div key={`${quantity.element}-${index}`}>
              <strong>{quantity.element}</strong>
              <label className="field-block"><span>Menge pro Person</span>
                <input aria-label={`${quantity.element} Menge pro Person`} type="number" step="any" min="0" value={quantity.amountPerPerson} onChange={event => update({ amountPerPerson: event.target.value })} />
              </label>
              <label className="field-block"><span>Einheit</span>
                <input aria-label={`${quantity.element} Einheit`} maxLength={100} value={quantity.unit} onChange={event => update({ unit: event.target.value })} />
              </label>
              <output>{showTotal ? `Gesamt für ${attendeeCount} Personen: ${total} ${quantity.unit}` : "Gesamtmenge: Menge, Einheit und Personenzahl ergänzen"}</output>
            </div>;
          })}
        </fieldset>
      ) : null}
      <label className="field-block">
        <span>Interne Notiz</span>
        <input value={notes} onChange={(event) => onNotesChange(event.target.value)} placeholder="optional" />
      </label>
    </>
  );
}
