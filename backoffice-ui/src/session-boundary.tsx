import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import { LoginView } from "./login-view.js";
import {
  activateCateringSessionRequests,
  deactivateCateringSessionRequests,
  loginToCatering,
  logoutFromCatering,
  resolveCateringSession,
  subscribeCateringSessionInvalidation,
  type CateringSession
} from "./session-api.js";

type CateringSessionContextValue = {
  session: CateringSession;
  logout: () => void;
};

const CateringSessionContext = createContext<CateringSessionContextValue | undefined>(undefined);

export function useCateringSession(): CateringSessionContextValue | undefined {
  return useContext(CateringSessionContext);
}

export type SessionBoundaryProps = {
  children: ReactNode;
};

type BoundaryState =
  | { kind: "checking" }
  | { kind: "unauthenticated" }
  | { kind: "unavailable" }
  | { kind: "logging_out" }
  | { kind: "logout_failed" }
  | { kind: "authenticated"; session: CateringSession };

export function SessionBoundary({ children }: SessionBoundaryProps) {
  const [state, setState] = useState<BoundaryState>({ kind: "checking" });
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState<string>();
  const requestVersion = useRef(0);

  useEffect(() => subscribeCateringSessionInvalidation(() => {
    requestVersion.current += 1;
    setLoginBusy(false);
    setLoginError(undefined);
    setState({ kind: "unauthenticated" });
  }), []);

  useEffect(() => {
    const version = ++requestVersion.current;
    let mounted = true;
    void resolveCateringSession().then((resolution) => {
      if (!mounted || version !== requestVersion.current) return;
      if (resolution.kind === "authenticated") {
        activateCateringSessionRequests();
        setState({ kind: "authenticated", session: resolution.session });
        return;
      }
      deactivateCateringSessionRequests();
      setState({ kind: resolution.kind });
    });

    return () => {
      mounted = false;
      requestVersion.current += 1;
      deactivateCateringSessionRequests();
    };
  }, []);

  const submitLogin = useCallback(async (input: { loginCode: string; pin: string }) => {
    const version = ++requestVersion.current;
    setLoginBusy(true);
    setLoginError(undefined);
    try {
      await loginToCatering(input);
      const resolution = await resolveCateringSession();
      if (version !== requestVersion.current) return;
      if (resolution.kind !== "authenticated") {
        setLoginError("Anmeldung nicht möglich.");
        return;
      }
      activateCateringSessionRequests();
      setState({ kind: "authenticated", session: resolution.session });
    } catch {
      if (version === requestVersion.current) setLoginError("Anmeldung nicht möglich.");
    } finally {
      if (version === requestVersion.current) setLoginBusy(false);
    }
  }, []);

  const logout = useCallback(() => {
    const version = ++requestVersion.current;
    deactivateCateringSessionRequests();
    setLoginBusy(false);
    setLoginError(undefined);
    setState({ kind: "logging_out" });
    void logoutFromCatering().then(
      () => {
        if (version === requestVersion.current) setState({ kind: "unauthenticated" });
      },
      () => {
        if (version === requestVersion.current) setState({ kind: "logout_failed" });
      }
    );
  }, []);

  const contextValue = useMemo(() => state.kind === "authenticated"
    ? { session: state.session, logout }
    : undefined, [logout, state]);

  if (state.kind === "checking") {
    return <p aria-live="polite">Sitzung wird geprüft.</p>;
  }
  if (state.kind === "unavailable") {
    return (
      <main className="app-shell" role="alert">
        <section className="masthead-card">
          <h1>Anwendung ist derzeit nicht verfügbar.</h1>
          <p>Bitte versuchen Sie es später erneut.</p>
        </section>
      </main>
    );
  }
  if (state.kind === "unauthenticated") {
    return <LoginView busy={loginBusy} error={loginError} onSubmit={submitLogin} />;
  }
  if (state.kind === "logging_out" || state.kind === "logout_failed") {
    return (
      <main className="app-shell" role={state.kind === "logout_failed" ? "alert" : undefined}>
        <section className="masthead-card">
          <h1>{state.kind === "logging_out"
            ? "Abmeldung wird abgeschlossen."
            : "Abmeldung nicht abgeschlossen."}</h1>
          <p>Der Fachzugriff bleibt gesperrt, bis der Server die Abmeldung bestätigt.</p>
          {state.kind === "logout_failed" ? (
            <button className="secondary-button" type="button" onClick={logout}>
              Erneut versuchen
            </button>
          ) : null}
        </section>
      </main>
    );
  }

  return (
    <CateringSessionContext.Provider value={contextValue}>
      {children}
    </CateringSessionContext.Provider>
  );
}
