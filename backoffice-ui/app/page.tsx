import { DashboardShell } from "../components/dashboard-shell.js";
import { StatusCard } from "../components/status-card.js";

export default function Page() {
  return (
    <DashboardShell title="Catering Backoffice">
      <StatusCard
        title="Intake-Pruefung"
        body="Prueft PDFs, E-Mails und Formulare, zeigt Unsicherheiten und ueberfuehrt sie in den operativen Event-Standard."
      />
      <StatusCard
        title="Angebotsbereich"
        body="Erzeugt Varianten, dokumentiert Annahmen und macht den strukturierten OfferDraft fuer Vertrieb und Produktion sichtbar."
      />
      <StatusCard
        title="Produktionssteuerung"
        body="Zeigt Rezeptquellen, automatische Internet-Fallbacks, Skalierungen, GN-Hinweise und die gruppierte Einkaufsliste."
      />
    </DashboardShell>
  );
}
