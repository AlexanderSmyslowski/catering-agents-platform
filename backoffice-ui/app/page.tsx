import { DashboardShell } from "../components/dashboard-shell.js";
import { StatusCard } from "../components/status-card.js";

export default function Page() {
  return (
    <DashboardShell title="Catering Operations Backoffice">
      <StatusCard
        title="Intake Review"
        body="Prueft PDFs, E-Mails und Formulare, zeigt Unsicherheiten und promoted sie in den operativen Event-Standard."
      />
      <StatusCard
        title="Offer Workspace"
        body="Erzeugt Varianten, dokumentiert Annahmen und macht den strukturierten OfferDraft fuer Vertrieb und Produktion sichtbar."
      />
      <StatusCard
        title="Production Control"
        body="Zeigt Rezeptquellen, automatische Internet-Fallbacks, Skalierungen, GN-Hinweise und die gruppierte Einkaufsliste."
      />
    </DashboardShell>
  );
}

