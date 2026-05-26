type ProductionEventAnswerFieldsProps = {
  editingEventType: string;
  editingEventDate: string;
  editingAttendeeCount: string;
  editingServiceForm: string;
  editingMenuItems: string;
  setEditingEventType: (value: string) => void;
  setEditingEventDate: (value: string) => void;
  setEditingAttendeeCount: (value: string) => void;
  setEditingServiceForm: (value: string) => void;
  setEditingMenuItems: (value: string) => void;
};

export function ProductionEventAnswerFields({
  editingEventType,
  editingEventDate,
  editingAttendeeCount,
  editingServiceForm,
  editingMenuItems,
  setEditingEventType,
  setEditingEventDate,
  setEditingAttendeeCount,
  setEditingServiceForm,
  setEditingMenuItems
}: ProductionEventAnswerFieldsProps) {
  return (
    <>
      <div className="answer-grid">
        <label className="field-block">
          <span>Veranstaltungstyp</span>
          <select value={editingEventType} onChange={(event) => setEditingEventType(event.target.value)}>
            <option value="">Bitte wählen</option>
            <option value="meeting">Besprechung</option>
            <option value="conference">Konferenz</option>
            <option value="lunch">Lunch</option>
            <option value="reception">Empfang</option>
            <option value="dinner">Abendessen</option>
            <option value="trade_fair">Messe</option>
          </select>
        </label>
        <label className="field-block">
          <span>Datum</span>
          <input
            value={editingEventDate}
            onChange={(event) => setEditingEventDate(event.target.value)}
            placeholder="2026-06-18"
          />
        </label>
        <label className="field-block">
          <span>Teilnehmerzahl</span>
          <input
            value={editingAttendeeCount}
            onChange={(event) => setEditingAttendeeCount(event.target.value)}
            inputMode="numeric"
            placeholder="120"
          />
        </label>
        <label className="field-block">
          <span>Serviceform</span>
          <select value={editingServiceForm} onChange={(event) => setEditingServiceForm(event.target.value)}>
            <option value="">Bitte wählen</option>
            <option value="buffet">Buffet</option>
            <option value="plated">Menü am Platz</option>
            <option value="standing_reception">Empfang / Flying</option>
            <option value="grab_and_go">Ausgabe / Grab-and-go</option>
            <option value="coffee_break">Kaffeepause</option>
          </select>
        </label>
      </div>
      <label className="field-block">
        <span>Gerichte und Komponenten</span>
        <textarea
          value={editingMenuItems}
          onChange={(event) => setEditingMenuItems(event.target.value)}
          placeholder="Kalbsbuletten, Kartoffelsalat, Nudelsalat, Mandel-Curry, Schokoladenkuchen"
        />
      </label>
      <p className="helper-text">
        Mehrere Gerichte bitte durch Komma trennen. Diese Angaben aktualisieren direkt die operative Spezifikation.
      </p>
    </>
  );
}
