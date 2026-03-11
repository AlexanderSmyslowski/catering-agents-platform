import { DashboardShell } from "../components/dashboard-shell.js";
import { StatusCard } from "../components/status-card.js";

export default function Page() {
  return (
    <DashboardShell title="Catering-Arbeitsoberfläche">
      <StatusCard
        title="Erfassungsprüfung"
        body="Prüft PDFs, E-Mails und Formulare, zeigt Unsicherheiten und überführt sie in den operativen Veranstaltungsstandard."
      />
      <StatusCard
        title="Angebotsbereich"
        body="Erzeugt Varianten, dokumentiert Annahmen und macht den strukturierten Angebotsentwurf für Vertrieb und Produktion sichtbar."
      />
      <StatusCard
        title="Produktionssteuerung"
        body="Zeigt Rezeptquellen, automatische Internet-Ausweichquellen, Skalierungen, GN-Hinweise und die gruppierte Einkaufsliste."
      />
    </DashboardShell>
  );
}
