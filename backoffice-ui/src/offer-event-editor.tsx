import { useEffect, useRef, useState } from "react";
import type { AcceptedEventSpec } from "@catering/shared-core";
import { reviseOfferMenu } from "./api.js";

export function OfferEventEditor({ draftId, revision, spec, disabled, onSaved, onEditingChange }: {
  draftId: string; revision: number; spec: AcceptedEventSpec; disabled: boolean;
  onSaved: (draftId: string) => Promise<void>; onEditingChange: (editing: boolean) => void;
}) {
  const live = useRef(true);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  const [event, setEvent] = useState<{ eventDate: string; eventType: string; serviceForm: string; attendeeCount: string; eventSchedule: NonNullable<AcceptedEventSpec["event"]["schedule"]> }>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { setEvent(undefined); setError(""); }, [draftId, revision]);
  function begin() {
    setEvent({ eventDate: spec.event.date ?? "", eventType: spec.event.type ?? "", serviceForm: spec.event.serviceForm ?? spec.servicePlan.serviceForm,
      attendeeCount: String(spec.attendees.expected ?? ""), eventSchedule: structuredClone(spec.event.schedule ?? []) });
    setError(""); onEditingChange(true);
  }
  async function save() {
    if (!event || saving) return;
    setSaving(true); setError("");
    try {
      const draft = await reviseOfferMenu(draftId, revision, spec.menuPlan.map(({ componentId, label, servings, menuCategory, dietaryTags }) => {
        if (!servings) throw new Error("Bitte zuerst die Portionszahlen im Menü ergänzen.");
        return { componentId, label, servings, menuCategory, dietaryTags };
      }), { ...event, attendeeCount: Number(event.attendeeCount), eventSchedule: event.eventSchedule.length ? event.eventSchedule : undefined });
      if (!live.current) return;
      await onSaved(draft.draftId);
      if (!live.current) return;
      setEvent(undefined); onEditingChange(false);
    } catch (cause) { if (live.current) setError(cause instanceof Error ? cause.message : "Veranstaltungsdaten konnten nicht gespeichert werden."); }
    finally { if (live.current) setSaving(false); }
  }
  return <section aria-label="Veranstaltungsdaten des Angebots">
    <h3>Veranstaltungsdaten</h3>
    {event ? <>
      <div className="compact-form-grid">
        <label>Veranstaltungstyp<input className="operator-input" value={event.eventType} disabled={saving} onChange={e => setEvent({ ...event, eventType: e.target.value })} /></label>
        <label>Veranstaltungsdatum<input className="operator-input" type="date" value={event.eventDate} disabled={saving} onChange={e => setEvent({ ...event, eventDate: e.target.value })} /></label>
        <label>Gästezahl<input className="operator-input" type="number" min="1" step="1" value={event.attendeeCount} disabled={saving} onChange={e => setEvent({ ...event, attendeeCount: e.target.value })} /></label>
        <label>Serviceform<input className="operator-input" value={event.serviceForm} disabled={saving} onChange={e => setEvent({ ...event, serviceForm: e.target.value })} /></label>
      </div>
      {event.eventSchedule.map((slot, index) => <div className="compact-form-grid" key={index}>
        <label>Zeitabschnitt {index + 1}<input className="operator-input" value={slot.label} disabled={saving} onChange={e => setEvent({ ...event, eventSchedule: event.eventSchedule.map((s, i) => i === index ? { ...s, label: e.target.value } : s) })} /></label>
        <label>Beginn {index + 1}<input className="operator-input" type="time" value={slot.start ?? ""} disabled={saving} onChange={e => setEvent({ ...event, eventSchedule: event.eventSchedule.map((s, i) => i === index ? { ...s, start: e.target.value } : s) })} /></label>
        <label>Ende {index + 1}<input className="operator-input" type="time" value={slot.end ?? ""} disabled={saving} onChange={e => setEvent({ ...event, eventSchedule: event.eventSchedule.map((s, i) => i === index ? { ...s, end: e.target.value } : s) })} /></label>
      </div>)}
      <p className="helper-text">Die Portionen je Gericht bleiben erhalten, auch bei geänderter Gästezahl. Bitte Menü und Kalkulation anschließend prüfen. Die bisherige Fassung bleibt im Verlauf.</p>
      <div className="quiet-action-row">
        <button type="button" className="secondary-button" disabled={saving} onClick={() => setEvent({ ...event, eventSchedule: [...event.eventSchedule, { label: "Service", start: "", end: "" }] })}>Zeitabschnitt ergänzen</button>
        <button type="button" disabled={disabled || saving} onClick={() => void save()}>{saving ? "Wird gespeichert …" : "Veranstaltungsdaten als neue Fassung speichern"}</button>
        <button type="button" className="secondary-button" disabled={saving} onClick={() => { setEvent(undefined); setError(""); onEditingChange(false); }}>Abbrechen</button>
      </div>
    </> : <>
      <p>{spec.customer?.name ?? "Kunde offen"}</p>
      <p>{spec.event.type ?? "Veranstaltung"} · {spec.event.date ?? "Datum offen"} · {spec.attendees.expected ?? "offene"} Gäste · {spec.event.serviceForm ?? spec.servicePlan.serviceForm}</p>
      {spec.event.schedule?.map((slot, index) => <p key={index}>{slot.label}: {slot.start ?? "offen"}–{slot.end ?? "offen"}</p>)}
      <button type="button" className="secondary-button" disabled={disabled} onClick={begin}>Veranstaltungsdaten bearbeiten</button>
    </>}
    {error ? <p role="alert">{error}</p> : null}
  </section>;
}
