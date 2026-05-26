type ProductionComponentDetailFieldsProps = {
  purchasedElements: string;
  notes: string;
  onPurchasedElementsChange: (purchasedElements: string) => void;
  onNotesChange: (notes: string) => void;
};

export function ProductionComponentDetailFields({
  purchasedElements,
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
      <label className="field-block">
        <span>Interne Notiz</span>
        <input value={notes} onChange={(event) => onNotesChange(event.target.value)} placeholder="optional" />
      </label>
    </>
  );
}
