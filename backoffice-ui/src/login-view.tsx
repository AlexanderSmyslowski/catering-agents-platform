import { useState, type FormEvent } from "react";

export type LoginViewProps = {
  busy: boolean;
  error?: string;
  onSubmit: (input: { loginCode: string; pin: string }) => Promise<void>;
};

export function LoginView({ busy, error, onSubmit }: LoginViewProps) {
  const [loginCode, setLoginCode] = useState("");
  const [pin, setPin] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await onSubmit({ loginCode: loginCode.trim(), pin });
    } finally {
      setPin("");
    }
  }

  return (
    <main className="app-shell" aria-label="Catering-Anmeldung">
      <section className="masthead-card">
        <p className="eyebrow">Catering Backoffice</p>
        <h1>Anmelden</h1>
        <form onSubmit={(event) => void submit(event)}>
          <label>
            Kennung
            <input
              name="loginCode"
              autoComplete="username"
              value={loginCode}
              onChange={(event) => setLoginCode(event.target.value)}
              disabled={busy}
            />
          </label>
          <label>
            PIN
            <input
              name="pin"
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              value={pin}
              onChange={(event) => setPin(event.target.value)}
              disabled={busy}
            />
          </label>
          {error ? <p role="alert">{error}</p> : null}
          <button type="submit" disabled={busy || !loginCode.trim() || !pin}>
            {busy ? "Anmeldung läuft …" : "Anmelden"}
          </button>
        </form>
      </section>
    </main>
  );
}
