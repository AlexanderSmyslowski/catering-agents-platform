import { useEffect, useRef, useState } from "react";
import { PriceSourceReview } from "./price-source-review.js";
import {
  emptyColumns,
  suggestColumns,
  PriceSourceColumns,
  type PriceColumns,
} from "./price-source-columns.js";
import {
  priceSourceApi as api,
  type PriceSource,
  type Preview,
  type SampleMessage,
} from "./price-source-api.js";

function messageFor(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Die Preisquelle konnte nicht geladen werden. Bitte erneut versuchen.";
}

export function PriceSourceSettings() {
  const [open, setOpen] = useState(false);
  return (
    <section className="panel">
      <h2>Einstellungen</h2>
      <button
        type="button"
        className="secondary-button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        E-Mail-Preisquellen
      </button>
      {open && <SourceList />}
    </section>
  );
}

function SourceList() {
  const [sources, setSources] = useState<PriceSource[]>([]);
  const [notice, setNotice] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<PriceSource>();
  const [pending, setPending] = useState<{
    source: PriceSource;
    preview: Preview;
  }>();
  const [working, setWorking] = useState(false);
  async function act(fn: () => Promise<void>) {
    setWorking(true);
    setNotice("");
    try {
      await fn();
    } catch (error) {
      setNotice(messageFor(error));
    } finally {
      setWorking(false);
    }
  }
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let current = true;
    api
      .sources()
      .then((data) => {
        if (current) setSources(data.sources);
      })
      .catch((error) => {
        if (current) setNotice(messageFor(error));
      });
    return () => {
      current = false;
    };
  }, [version]);
  return (
    <div className="supplier-settings">
      <ul className="item-list">
        {sources.map((source) => (
          <li key={source.id}>
            <strong>{source.config.name}</strong> ·{" "}
            {source.active ? "Aktiv" : "Inaktiv"}
            <p>{source.config.sender}</p>
            {(source.pollStatus === "stalled" || source.poll?.status === "stalled") && (
              <p role="status">
                Der Abruf ist unterbrochen. Die zuletzt übernommenen Preise
                bleiben verfügbar.
              </p>
            )}
            <button
              type="button"
              className="secondary-button"
              disabled={working || adding || !!pending}
              onClick={() => {
                setEditing(source);
                setAdding(true);
              }}
            >
              Quelle bearbeiten
            </button>
            {source.active && (
              <button
                type="button"
                className="secondary-button"
                disabled={working || adding || !!pending}
                onClick={() =>
                  void act(async () => {
                    await api.pause(source.id);
                    setVersion((v) => v + 1);
                    setNotice("Preisquelle pausiert.");
                  })
                }
              >
                Pausieren
              </button>
            )}
            {source.pendingCount > 0 && (
              <button
                type="button"
                disabled={working || adding || !!pending}
                onClick={() =>
                  void act(async () => {
                    const next = (await api.pending(source.id)).previews[0];
                    if (next)
                      setPending({
                        source,
                        preview: (await api.pendingPreview(source.id, next.id))
                          .preview,
                      });
                  })
                }
              >
                Preisliste prüfen ({source.pendingCount})
              </button>
            )}
          </li>
        ))}
      </ul>
      {pending && (
        <fieldset disabled={working}>
          <PriceSourceReview
            key={pending.preview.id}
            preview={pending.preview}
            initial={pending.source.config.articleMappings ?? []}
            action="Geprüfte Preise übernehmen"
            onSave={(mappings, removedArticles) =>
              void act(async () => {
                await api.activate(
                  pending.source.id,
                  pending.preview.id,
                  mappings,
                  removedArticles,
                  pending.preview.configVersion ?? pending.source.configVersion,
                  pending.preview.sourceVersion,
                );
                setPending(undefined);
                setVersion((v) => v + 1);
                setNotice("Preise übernommen.");
              })
            }
          />
          <button
            type="button"
            className="secondary-button"
            onClick={() =>
              void act(async () => {
                await api.discard(
                  pending.source.id,
                  pending.preview.id,
                  pending.preview.configVersion ?? pending.source.configVersion,
                  pending.preview.sourceVersion,
                );
                setPending(undefined);
                setVersion((v) => v + 1);
                setNotice(
                  "Prüfung abgeschlossen. Die offenen Preise wurden ausgelassen.",
                );
              })
            }
          >
            Offene Preise auslassen
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => setPending(undefined)}
          >
            Zurück
          </button>
        </fieldset>
      )}
      {!adding && !pending && (
        <button
          type="button"
          onClick={() => {
            setEditing(undefined);
            setAdding(true);
            setNotice("");
          }}
        >
          Preisquelle hinzufügen
        </button>
      )}
      {adding && (
        <SourceWizard
          editing={editing}
          cancel={() => {
            setAdding(false);
            setVersion(version + 1);
          }}
          complete={(name) => {
            setAdding(false);
            setNotice(name + " ist als Preisquelle eingerichtet.");
            setVersion(version + 1);
          }}
        />
      )}
      <p role="status">{notice}</p>
    </div>
  );
}

function SourceWizard({
  editing,
  cancel,
  complete,
}: {
  editing?: PriceSource;
  cancel: () => void;
  complete: (name: string) => void;
}) {
  const [mailboxes, setMailboxes] = useState<{ id: string; label: string }[]>(
    [],
  );
  const [mailbox, setMailbox] = useState("");
  const [messages, setMessages] = useState<SampleMessage[]>([]);
  const [sampleKey, setSampleKey] = useState("");
  const [sheetRows, setSheetRows] = useState<
    Array<{ row: number; cells: Record<string, string> }>
  >([]);
  const [headerRow, setHeaderRow] = useState(0);
  const headers = sheetRows.find((row) => row.row === headerRow)?.cells ?? {};
  const [dateCell, setDateCell] = useState("");
  const dates = sheetRows.flatMap((r) =>
    Object.entries(r.cells).flatMap(([column, text]) => {
      const format = /^(?:gilt|gültig) ab\s+\d{2}\.\d{2}\.\d{4}$/i.test(text)
        ? "schwan"
        : /^\d{4}-\d{2}-\d{2}$/.test(text)
          ? "iso"
          : /^\d{2}\.\d{2}\.\d{4}$/.test(text)
            ? "german"
            : undefined;
      return format
        ? [{ key: column + r.row, row: r.row, column, format, text }]
        : [];
    }),
  );
  const validity = dates.find((cell) => cell.key === dateCell);
  const [columns, setColumns] = useState<PriceColumns>(emptyColumns);
  const [name, setName] = useState("");
  const [sender, setSender] = useState(editing?.config.sender ?? "");
  const [subject, setSubject] = useState("");
  const [auto, setAuto] = useState(editing?.config.autoApply ?? false);
  const [sourceId, setSourceId] = useState(editing?.id ?? "");
  const [configVersion, setConfigVersion] = useState(
    editing?.configVersion ?? 0,
  );
  const [preview, setPreview] = useState<Preview>();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    let current = true;
    api
      .mailboxes()
      .then((data) => {
        if (current) {
          setMailboxes(data.mailboxes);
          setMailbox(
            editing?.config.mailboxId ??
              (data.mailboxes.length === 1 ? data.mailboxes[0].id : ""),
          );
          if (!data.mailboxes.length)
            setError("Für diesen Betrieb ist noch kein Postfach verbunden.");
        }
      })
      .catch((reason) => {
        if (current) setError(messageFor(reason));
      });
    return () => {
      mounted.current = false;
      current = false;
    };
  }, []);
  const samples = messages.flatMap((mail) =>
    mail.attachments
      .filter((a) => /\.xlsx$/i.test(a.filename))
      .map((attachment) => ({
        key: [mail.uidValidity, mail.uid, attachment.part].join("/"),
        mail,
        attachment,
        selector: {
          uidValidity: mail.uidValidity,
          uid: mail.uid,
          part: attachment.part,
        },
      })),
  );
  const selected = samples.find((sample) => sample.key === sampleKey);
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (reason) {
      if (mounted.current) setError(messageFor(reason));
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <div>
      <fieldset disabled={busy}>
        <legend>Preisquelle einrichten</legend>
        {!preview && (
          <>
            {editing && (
              <p>
                Wähle eine Beispielmail für die neue Zuordnung. Eine geänderte
                Quelle wird nach ihrer Prüfung wieder aktiv.
              </p>
            )}
            <label>
              Postfach
              <select
                aria-label="Postfach"
                value={mailbox}
                onChange={(event) => {
                  const id = event.target.value;
                  setMailbox(id);
                  setSampleKey("");
                  setMessages([]);
                  setSheetRows([]);
                  setDateCell("");
                  setHeaderRow(0);
                  setColumns(emptyColumns);
                }}
              >
                <option value="">Postfach wählen</option>
                {mailboxes.map((box) => (
                  <option key={box.id} value={box.id}>
                    {box.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              E-Mail-Adresse des Lieferanten
              <input
                type="email"
                value={sender}
                onChange={(event) => {
                  setSender(event.target.value);
                  setMessages([]);
                  setSampleKey("");
                  setSheetRows([]);
                  setHeaderRow(0);
                  setDateCell("");
                  setColumns(emptyColumns);
                  setError("");
                }}
              />
            </label>
            <button
              type="button"
              disabled={
                !mailbox || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sender.trim())
              }
              onClick={() =>
                void run(async () => {
                  const data = await api.messages(mailbox, sender.trim());
                  setMessages(data.messages);
                  if (
                    !data.messages.some((m) =>
                      m.attachments.some((a) => /\.xlsx$/i.test(a.filename)),
                    )
                  ) {
                    setError(
                      "Keine Excel-Preisliste von dieser Adresse gefunden. Prüfe die Absenderadresse einer Lieferantenmail.",
                    );
                  }
                })
              }
            >
              Preislisten suchen
            </button>
            {samples.length > 0 && (
              <label>
                Beispiel-E-Mail und Preisliste
                <select
                  value={sampleKey}
                  onChange={(event) => {
                    const sample = samples.find(
                      (s) => s.key === event.target.value,
                    );
                    setSampleKey(event.target.value);
                    setSheetRows([]);
                    setDateCell("");
                    setHeaderRow(0);
                    setColumns(emptyColumns);
                    if (!sample) return;
                    setSubject(editing?.config.subject ?? "");
                    setName(
                      editing?.config.name ??
                        sample.mail.from.split("@")[1] ??
                        "",
                    );
                    void run(async () => {
                      const data = await api.headers(
                        mailbox,
                        sample.selector,
                        sender.trim(),
                      );
                      setSheetRows(data.rows);
                      const suggested = data.rows.find((row) =>
                        Object.values(row.cells).some((value) =>
                          /^(artikel.?nr|artikelnummer|sku)$/i.test(value),
                        ),
                      );
                      if (suggested) {
                        setHeaderRow(suggested.row);
                        setColumns(suggestColumns(suggested.cells));
                      }
                      const explicit = data.rows.flatMap((r) =>
                        Object.entries(r.cells)
                          .filter(([, text]) =>
                            /^(gilt|gültig) ab /i.test(text),
                          )
                          .map(([column]) => column + r.row),
                      );
                      if (explicit.length === 1) setDateCell(explicit[0]);
                    });
                  }}
                >
                  <option value="">Preisliste wählen</option>
                  {samples.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.mail.from} · {s.mail.subject} · {s.attachment.filename}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {sheetRows.length > 0 && (
              <label>
                Zeile mit Spaltennamen
                <select
                  value={headerRow}
                  onChange={(event) => {
                    const row = Number(event.target.value);
                    setHeaderRow(row);
                    setColumns(
                      suggestColumns(
                        sheetRows.find((r) => r.row === row)?.cells ?? {},
                      ),
                    );
                  }}
                >
                  <option value="0">Zeile wählen</option>
                  {sheetRows.map((row) => (
                    <option key={row.row} value={row.row}>
                      Zeile {row.row} ·{" "}
                      {Object.values(row.cells).slice(0, 5).join(" · ")}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {headerRow > 0 && (
              <>
                <fieldset>
                  <legend>Lieferant und Auswahl</legend>
                  <label>
                    Lieferant
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </label>

                  <label>
                    Betreff enthält (optional)
                    <input
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                    />
                  </label>
                  <PriceSourceColumns
                    headers={headers}
                    columns={columns}
                    onChange={setColumns}
                  />
                  <label>
                    Gültig ab laut Liste
                    <select
                      value={dateCell}
                      onChange={(e) => {
                        setDateCell(e.target.value);
                        if (!e.target.value) setAuto(false);
                      }}
                    >
                      <option value="">Kein bestätigtes Datum</option>
                      {dates.map((cell) => (
                        <option key={cell.key} value={cell.key}>
                          {cell.text} · {cell.key}
                        </option>
                      ))}
                    </select>
                  </label>
                  {!validity && (
                    <p>
                      Ohne Gültigkeitsdatum legst du neue Listen persönlich zur
                      Kalkulation frei.
                    </p>
                  )}
                  <p>
                    Ändern sich Gebinde oder Einheit, oder weicht der Preis um
                    mehr als 25 % ab, bleibt die Liste zur Prüfung offen.
                  </p>
                  <label>
                    <input
                      type="checkbox"
                      disabled={!validity}
                      checked={auto && !!validity}
                      onChange={(e) => setAuto(e.target.checked)}
                    />
                    Preise bekannter Artikel aus bestätigten Lieferantenmails
                    automatisch aktualisieren
                  </label>
                </fieldset>
                <button
                  type="button"
                  disabled={
                    !name.trim() ||
                    !sender.trim() ||
                    !selected ||
                    Object.values(columns).some((c) => !c)
                  }
                  onClick={() =>
                    void run(async () => {
                      if (!selected) return;
                      let id = sourceId;
                      {
                        const config = {
                          name: name.trim(),
                          mailboxId: mailbox,
                          sender: sender.trim(),
                          subject: subject.trim() || undefined,
                          columns: {
                            headerRow,
                            columns,
                            ...(validity
                              ? {
                                  validFrom: {
                                    row: validity.row,
                                    column: validity.column,
                                    format: validity.format,
                                  },
                                }
                              : {}),
                            headers: Object.fromEntries(
                              Object.entries(columns).map(([field, letter]) => [
                                field,
                                headers[letter],
                              ]),
                            ) as PriceColumns,
                          },
                          autoApply: auto && !!validity,
                        };
                        const data = id
                          ? await api.configure(id, config, configVersion)
                          : await api.create(config);
                        id = data.source.id;
                        setSourceId(id);
                        setConfigVersion(data.source.configVersion);
                      }
                      setPreview(
                        (await api.preview(id, selected.selector)).preview,
                      );
                    })
                  }
                >
                  Preise prüfen
                </button>
              </>
            )}
          </>
        )}
        {preview && (
          <PriceSourceReview
            preview={preview}
            initial={editing?.config.articleMappings ?? []}
            action="Preisquelle aktivieren"
            onSave={(mappings, removedArticles) =>
              void run(async () => {
                await api.activate(
                  sourceId,
                  preview.id,
                  mappings,
                  removedArticles,
                  configVersion,
                  preview.sourceVersion,
                );
                complete(name);
              })
            }
          />
        )}
      </fieldset>
      {busy && <p role="status">Wird geladen …</p>}
      {error && <p role="alert">{error}</p>}
      <button
        type="button"
        className="secondary-button"
        disabled={busy}
        onClick={cancel}
      >
        Schließen
      </button>
    </div>
  );
}
