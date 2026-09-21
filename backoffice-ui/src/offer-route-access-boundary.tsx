import { DashboardShell } from "../components/dashboard-shell.js";
import {
  OfferProductApp,
  type OfferProductAppProps
} from "./offer-product-app.js";
import { RouteMasthead } from "./route-masthead.js";
import { useCateringSession } from "./session-boundary.js";

/**
 * Check the server-validated session capability before the offer hook tree is
 * mounted, so a routed URL cannot start loaders or expose write controls.
 */
export function OfferRouteAccessBoundary(props: OfferProductAppProps) {
  const session = useCateringSession();

  if (session?.session.access.capabilities.includes("offer") === true) {
    return <OfferProductApp {...props} />;
  }

  return (
    <DashboardShell {...props.shell}>
      <RouteMasthead {...props.masthead} loading={false} />
      <p role="alert">Kein Zugriff auf Angebote.</p>
    </DashboardShell>
  );
}
