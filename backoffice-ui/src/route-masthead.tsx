import type { AppRoute } from "./app-shell-state.js";

type RouteMastheadProps = {
  route: AppRoute;
  baseUrl: string;
  operatorName: string;
  loading: boolean;
  submitting: boolean;
  onOperatorNameChange: (value: string) => void;
  onSeedDemoData: () => Promise<void>;
  onRefreshDashboard: () => Promise<void>;
};

export function RouteMasthead({
  route,
  baseUrl,
  operatorName,
  loading,
  submitting,
  onOperatorNameChange,
  onSeedDemoData,
  onRefreshDashboard
}: RouteMastheadProps) {
  const routeCards = [
    {
      href: "/angebot",
      eyebrow: "Angebotsagent",
      title: "Kundenanfrage zu einem belastbaren Angebot verdichten",
      body: "Erfasst Rahmenbedingungen, schlägt Leistungsbausteine vor, formuliert Varianten und erzeugt operative Spezifikationen für die Übergabe.",
      linkLabel: `${baseUrl}/angebot`
    },
    {
      href: "/produktion",
      eyebrow: "Produktionsagent",
      title: "Küchenvorbereitung mit Rezepten und Einkaufslisten steuern",
      body: "Übernimmt operative Daten auch ohne Angebotsagent, recherchiert fehlende Rezepte, skaliert Mengen und liefert Küchen- sowie Beschaffungsunterlagen.",
      linkLabel: `${baseUrl}/produktion`
    }
  ];

  const agentShortcutButtons = [
    {
      href: "/angebot",
      title: "Angebotsagent öffnen",
      description: "Anfragen strukturieren und Angebote erstellen",
      active: route === "offer"
    },
    {
      href: "/produktion",
      title: "Produktionsagent öffnen",
      description: "Rezepte, Küchenplanung und Einkaufslisten",
      active: route === "production"
    }
  ];

  return (
    <section className="masthead-card">
      <div className="masthead-row">
        <nav className="primary-nav" aria-label="Hauptnavigation">
          <a className={route === "home" ? "nav-link active-nav-link" : "nav-link"} href="/">
            Start
          </a>
          <a className={route === "offer" ? "nav-link active-nav-link" : "nav-link"} href="/angebot">
            Angebotsagent
          </a>
          <a className={route === "production" ? "nav-link active-nav-link" : "nav-link"} href="/produktion">
            Produktionsagent
          </a>
        </nav>
        {route === "home" ? (
          <div className="masthead-actions">
            <input
              className="operator-input"
              placeholder="Bearbeitername"
              value={operatorName}
              onChange={(event) => onOperatorNameChange(event.target.value)}
            />
            <button disabled={loading || submitting} onClick={() => void onSeedDemoData()}>
              Demo-Daten laden
            </button>
            <button className="secondary-button" disabled={loading || submitting} onClick={() => void onRefreshDashboard()}>
              Aktualisieren
            </button>
          </div>
        ) : null}
      </div>
      {route === "home" ? (
        <>
          <div className="agent-shortcuts" aria-label="Direkteinstieg Agenten">
            {agentShortcutButtons.map((button) => (
              <a
                key={button.href}
                className={button.active ? "agent-shortcut agent-shortcut--active" : "agent-shortcut"}
                href={button.href}
              >
                <strong>{button.title}</strong>
                <span>{button.description}</span>
              </a>
            ))}
          </div>
          <p className="helper-text">
            <strong>Internes Beta-Kontrollzentrum:</strong> Demo, Erfassung, Angebot, Produktion, Export und Audit
            aus bestehenden Daten prüfen.
          </p>
          <p className="helper-text">
            <strong>Beta-Weg:</strong> Start → Angebot → Produktion → Rückfragen → Exporte/Audit.
          </p>
          <p className="helper-text">
            <strong>Grenze:</strong> nur synthetischer interner Beta-Durchlauf; keine echten Daten, keine Produktionsfreigabe.
          </p>
          <p className="helper-text">
            <strong>Reviewer-Hinweis:</strong> P7-Szenariokarte nutzen; Evidenz als Route, Erwartung, Beobachtung und Beleg notieren.
          </p>
          <p className="helper-text">
            <strong>Rehearsal-Go:</strong> erst nach grünem Status, lokalem Check, manueller UI-Evidenz und Reibungslog.
          </p>
          <p className="helper-text">
            <strong>Pilot-Preflight:</strong> lokal mit Demo-/synthetischen oder nachweisbar anonymisierten Daten prüfen; kein Pilot-Go, kein Deployment und keine echten Daten.
          </p>
          <p className="helper-text">
            <strong>Nächster Einstieg:</strong> zuerst Angebot prüfen, danach Produktion und offene Rückfragen klären.
          </p>
        </>
      ) : null}

      {route === "home" ? (
        <div className="route-grid">
          {routeCards.map((card) => (
            <article key={card.href} className="route-card">
              <p className="eyebrow">{card.eyebrow}</p>
              <h3>{card.title}</h3>
              <p className="route-card__body">{card.body}</p>
              <p className="route-card__link">{card.linkLabel}</p>
              <a className="button-link" href={card.href}>
                Arbeitsfläche öffnen
              </a>
            </article>
          ))}
        </div>
      ) : route === "production" ? (
        <div className="hero-detail-card">
          <div>
            <p className="eyebrow">Küche und Produktion</p>
            <h2 className="hero-title">Produktionsvorbereitung: Rezepte, Küchenplanung und Einkauf.</h2>
            <p className="lede">Arbeitsroute für Spezifikationen, Pläne, Rezeptfreigaben und Exporte.</p>
          </div>
          <div className="hero-pills">
            <span className="hero-pill">{`${baseUrl}/produktion`}</span>
            <span className="hero-pill">Gemeinsamer Regelkern</span>
            <span className="hero-pill">Persistente Betriebsdaten</span>
          </div>
        </div>
      ) : null}
    </section>
  );
}
