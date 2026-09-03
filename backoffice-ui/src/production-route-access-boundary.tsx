import { useEffect, useState } from "react";
import { DashboardShell } from "../components/dashboard-shell.js";
import {
  loadProductionRouteAccessData,
  type ProductionRouteAccessData
} from "./api.js";
import {
  ProductionProductApp,
  type ProductionProductAppProps
} from "./production-product-app.js";
import { ProductionReadOnlyView } from "./production-read-only-view.js";
import { RouteMasthead } from "./route-masthead.js";

/**
 * The server capability is resolved before the interactive production tree is
 * mounted. This prevents hooks inside the workbench from issuing privileged
 * follow-up requests while access is unknown or read-only.
 */
export function ProductionRouteAccessBoundary(props: ProductionProductAppProps) {
  const [data, setData] = useState<ProductionRouteAccessData>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    setData(undefined);
    setError(undefined);

    void loadProductionRouteAccessData()
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((cause) => {
        if (!cancelled) {
          setError(cause instanceof Error
            ? cause.message
            : "Der Produktionszugriff konnte nicht eindeutig bestimmt werden.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (data?.access.canOperateProduction === true) {
    return <ProductionProductApp {...props} />;
  }

  return (
    <DashboardShell {...props.shell}>
      <RouteMasthead {...props.masthead} loading={!data && !error} />
      {data?.access.canOperateProduction === false ? (
        <ProductionReadOnlyView
          productionPlans={data.productionPlans}
          purchaseLists={data.purchaseLists}
        />
      ) : error ? (
        <p role="alert">{error}</p>
      ) : (
        <p>Produktionszugriff wird geprüft.</p>
      )}
    </DashboardShell>
  );
}
