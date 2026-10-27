import { useEffect, useId, useRef, useState } from "react";
import type { AcceptedEventSpec } from "@catering/shared-core";
import { eventTypeLabels, formatEventTypeLabel, formatServiceFormLabel, serviceFormLabels } from "../../shared-core/src/taxonomies/labels.js";
import { reviseOfferMenu } from "./api.js";

type EventInput = { eventDate: string; eventType: string; serviceForm: string; attendeeCount: string; eventSchedule: NonNullable<AcceptedEventSpec["event"]["schedule"]> };
type FieldErrors = Record<string, string>;

function fieldErrors(event: EventInput): FieldErrors {
  const errors: FieldErrors = {};
  if (!event.eventType.trim()) errors.eventType = "Bitte den Veranstaltungstyp eintragen.";
  const date = new Date(event.eventDate + "T00:00:00Z");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(event.eventDate) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== event.eventDate) errors.eventDate = "Bitte ein gültiges Veranstaltungsdatum wählen.";
  if (!/^\d+$/.test(event.attendeeCount) || Number(event.attendeeCount) < 1 || Number(event.attendeeCount) > 100000) errors.attendeeCount = "Bitte eine ganze Gästezahl zwischen 1 und 100.000 eintragen.";
  if (!event.serviceForm.trim()) errors.serviceForm = "Bitte eine Serviceform wählen.";
  event.eventSchedule.forEach((slot, i) => {
    if (!slot.label.trim()) errors[`slot-${i}-label`] = "Bitte benennen, zum Beispiel Empfang, oder diesen Abschnitt entfernen.";
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(slot.start ?? "")) errors[`slot-${i}-start`] = "Bitte die Beginnzeit eintragen.";
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(slot.end ?? "")) errors[`slot-${i}-end`] = "Bitte die Endzeit eintragen.";
    else if (slot.start && slot.end! <= slot.start) errors[`slot-${i}-end`] = "Das Ende muss am selben Tag nach dem Beginn liegen. Termine über Mitternacht bitte separat klären.";
  });
  return errors;
}

export function OfferEventEditor({ draftId, revision, spec, disabled, onSaved, onEditingChange }: {
  draftId: string; revision: number; spec: AcceptedEventSpec; disabled: boolean;
  onSaved: (draftId: string) => Promise<void>; onEditingChange: (editing: boolean) => void;
}) {
  const live = useRef(true);
  const inFlight = useRef(false);
  const savedDraft = useRef<string | undefined>(undefined);
  const awaitingSavedReload = useRef(false);
  const form = useRef<HTMLFormElement>(null);
  const id = useId();
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  const [event, setEvent] = useState<EventInput>();
  const [saving, setSaving] = useState(false);
  const [pendingSavedDraft, setPendingSavedDraft] = useState<string>();
  const frozen = saving || Boolean(pendingSavedDraft);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState("");
  useEffect(() => {
    setEvent(undefined); setError(""); setErrors({}); setPendingSavedDraft(undefined);
    if (savedDraft.current !== draftId || awaitingSavedReload.current) setNotice("");
    awaitingSavedReload.current = false;
  }, [draftId, revision]);
  useEffect(() => {
    if (Object.keys(errors).length) form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [errors]);
  function begin() {
    setEvent({ eventDate: spec.event.date ?? "", eventType: formatEventTypeLabel(spec.event.type) ?? "", serviceForm: spec.event.serviceForm ?? spec.servicePlan.serviceForm,
      attendeeCount: String(spec.attendees.expected ?? ""), eventSchedule: structuredClone(spec.event.schedule ?? []) });
    setError(""); setErrors({}); setNotice(""); onEditingChange(true);
  }
  async function save() {
    if (!event || inFlight.current || disabled || pendingSavedDraft) return;
    const invalid = fieldErrors(event);
    setErrors(invalid); setError("");
    if (Object.keys(invalid).length) {
      return;
    }
    inFlight.current = true; setSaving(true);
    let postedDraftId: string | undefined;
    try {
      const draft = await reviseOfferMenu(draftId, revision, spec.menuPlan.map(({ componentId, label, servings, menuCategory, dietaryTags }) => {
        if (!servings) throw new Error("Bitte zuerst die Portionszahlen im Menü ergänzen.");
        return { componentId, label, servings, menuCategory, dietaryTags };
      }), { ...event, attendeeCount: Number(event.attendeeCount),
        eventType: event.eventType === formatEventTypeLabel(spec.event.type) ? spec.event.type : Object.entries(eventTypeLabels).find(([, label]) => label === event.eventType.trim())?.[0] ?? event.eventType });
      if (!live.current) return;
      // The new draft replaces the current view; keep its acknowledgement through that refresh.
      postedDraftId = draft.draftId;
      savedDraft.current = draft.draftId;
      setPendingSavedDraft(draft.draftId);
      await onSaved(draft.draftId);
      if (!live.current) return;
      setEvent(undefined); setPendingSavedDraft(undefined); onEditingChange(false);
      setNotice("Gespeichert als neue Fassung. Die bisherige Fassung bleibt im Verlauf. Bitte Menü und Kalkulation prüfen.");
    } catch (cause) {
      if (live.current) setError(postedDraftId
        ? "Die neue Fassung wurde gespeichert. Die Ansicht konnte nicht aktualisiert werden. Deine Eingaben bleiben sichtbar. Bitte die gespeicherte Fassung laden."
        : `Speichern nicht bestätigt: ${cause instanceof Error ? cause.message : "Verbindung prüfen."} Deine Eingaben sind noch da – bitte prüfen und erneut speichern.`);
    } finally { inFlight.current = false; if (live.current) setSaving(false); }
  }
  async function reloadSaved() {
    if (!pendingSavedDraft || inFlight.current) return;
    inFlight.current = true; setSaving(true);
    try {
      await onSaved(pendingSavedDraft);
      if (!live.current) return;
      setEvent(undefined); setPendingSavedDraft(undefined); setError(""); onEditingChange(false);
      setNotice("Gespeichert als neue Fassung. Die bisherige Fassung bleibt im Verlauf. Bitte Menü und Kalkulation prüfen.");
    } catch {
      if (live.current) setError("Die Fassung bleibt gespeichert. Sie konnte noch nicht geladen werden. Bitte später erneut versuchen oder den Zugriff auf den Auftrag prüfen.");
    } finally { inFlight.current = false; if (live.current) setSaving(false); }
  }
  function validation(key: string) {
    return { "aria-invalid": Boolean(errors[key]), "aria-describedby": errors[key] ? `${id}-${key}-error` : undefined };
  }
  function message(key: string) {
    return errors[key] ? <span className="event-editor__error" id={`${id}-${key}-error`} role="alert">{errors[key]}</span> : null;
  }
  function changeSlot(index: number, key: "label" | "start" | "end", value: string) {
    if (event) setEvent({ ...event, eventSchedule: event.eventSchedule.map((slot, i) => i === index ? { ...slot, [key]: value } : slot) });
  }
  return <section className="offer-event-editor" aria-label="Veranstaltungsdaten des Angebots">
    <h3>Veranstaltungsdaten</h3>
    {notice ? <p role="status" className="event-editor__saved">{notice}</p> : null}
    {event ? <form ref={form} noValidate onSubmit={e => { e.preventDefault(); void save(); }}>
      <div className="event-editor__fields">
        <label>Veranstaltungstyp<input className="operator-input" value={event.eventType} maxLength={200} list={`${id}-types`} disabled={frozen} {...validation("eventType")} onChange={e => setEvent({ ...event, eventType: e.target.value })} />{message("eventType")}</label>
        <datalist id={`${id}-types`}>{Object.entries(eventTypeLabels).map(([value, label]) => <option key={value} value={label} />)}</datalist>
        <label>Veranstaltungsdatum<input className="operator-input" type="date" value={event.eventDate} disabled={frozen} {...validation("eventDate")} onChange={e => setEvent({ ...event, eventDate: e.target.value })} />{message("eventDate")}</label>
        <label>Gästezahl<input className="operator-input" type="number" min="1" max="100000" step="1" value={event.attendeeCount} disabled={frozen} {...validation("attendeeCount")} onChange={e => setEvent({ ...event, attendeeCount: e.target.value })} />{message("attendeeCount")}</label>
        <label>Serviceform<select className="operator-input" value={event.serviceForm} disabled={frozen} {...validation("serviceForm")} onChange={e => setEvent({ ...event, serviceForm: e.target.value })}>
          <option value="">Bitte wählen</option>{Object.entries(serviceFormLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          {event.serviceForm && !Object.hasOwn(serviceFormLabels, event.serviceForm) ? <option value={event.serviceForm}>{event.serviceForm}</option> : null}
        </select>{message("serviceForm")}</label>
      </div>
      <h4>Zeitplan</h4>
      {!event.eventSchedule.length ? <p className="helper-text">Keine Uhrzeiten eingetragen. Bitte vor der Produktion klären.</p> : null}
      {event.eventSchedule.map((slot, index) => <fieldset className="event-editor__slot" key={index} disabled={frozen}>
        <legend>Zeitabschnitt {index + 1}</legend>
        <div className="event-editor__times">
          <label>Bezeichnung<input className="operator-input" placeholder="z. B. Empfang" value={slot.label} maxLength={200} {...validation(`slot-${index}-label`)} onChange={e => changeSlot(index, "label", e.target.value)} />{message(`slot-${index}-label`)}</label>
          <label>Beginn<input className="operator-input" type="time" value={slot.start ?? ""} {...validation(`slot-${index}-start`)} onChange={e => changeSlot(index, "start", e.target.value)} />{message(`slot-${index}-start`)}</label>
          <label>Ende<input className="operator-input" type="time" value={slot.end ?? ""} {...validation(`slot-${index}-end`)} onChange={e => changeSlot(index, "end", e.target.value)} />{message(`slot-${index}-end`)}</label>
        </div>
        <button type="button" className="secondary-button" aria-label={`Zeitabschnitt ${index + 1} entfernen`} onClick={() => { setEvent({ ...event, eventSchedule: event.eventSchedule.filter((_, i) => i !== index) }); setErrors({}); }}>Entfernen</button>
      </fieldset>)}
      <button type="button" className="secondary-button" disabled={frozen || event.eventSchedule.length >= 20} onClick={() => { setEvent({ ...event, eventSchedule: [...event.eventSchedule, { label: "", start: "", end: "" }] }); setErrors({}); }}>Zeitabschnitt ergänzen</button>
      <p className="helper-text">Die Portionen je Gericht bleiben auch bei geänderter Gästezahl erhalten. Bitte Menü und Kalkulation anschließend prüfen. Die bisherige Fassung bleibt im Verlauf.</p>
      {error ? <p role="alert" className="event-editor__error">{error}</p> : null}
      <div className="quiet-action-row">
        {pendingSavedDraft
          ? <button type="button" disabled={saving} onClick={() => void reloadSaved()}>{saving ? "Wird geladen …" : "Gespeicherte Fassung laden"}</button>
          : <button type="submit" disabled={disabled || saving}>{saving ? "Wird gespeichert …" : "Änderungen speichern"}</button>}
        {pendingSavedDraft ? <button type="button" className="secondary-button" disabled={saving} onClick={() => {
          awaitingSavedReload.current = true;
          setEvent(undefined); setPendingSavedDraft(undefined); setError(""); setErrors({}); onEditingChange(false);
          setNotice("Die Fassung bleibt gespeichert. Bitte den Auftrag später erneut laden.");
        }}>Bearbeitung schließen</button> : <button type="button" className="secondary-button" disabled={frozen} onClick={() => { setEvent(undefined); setError(""); setErrors({}); onEditingChange(false); }}>Abbrechen</button>}
      </div>
    </form> : <>
      <p>{spec.customer?.name ?? "Kunde offen"}</p>
      <p>{formatEventTypeLabel(spec.event.type) ?? "Veranstaltung"} · {spec.event.date ? spec.event.date.split("-").reverse().join(".") : "Datum offen"} · {spec.attendees.expected ?? "offene"} Gäste · {formatServiceFormLabel(spec.event.serviceForm ?? spec.servicePlan.serviceForm)}</p>
      {spec.event.schedule?.map((slot, index) => <p key={index}>{slot.label}: {slot.start ?? "offen"}–{slot.end ?? "offen"}</p>)}
      <button type="button" className="secondary-button" disabled={disabled} onClick={begin}>Veranstaltungsdaten bearbeiten</button>
    </>}
  </section>;
}
