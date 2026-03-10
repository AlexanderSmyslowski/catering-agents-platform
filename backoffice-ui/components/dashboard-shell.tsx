import type { PropsWithChildren } from "react";

export function DashboardShell({
  title,
  children
}: PropsWithChildren<{ title: string }>) {
  return (
    <main
      style={{
        fontFamily: "Georgia, serif",
        padding: "3rem",
        background:
          "linear-gradient(160deg, rgba(241,233,220,1) 0%, rgba(255,250,244,1) 100%)",
        minHeight: "100vh",
        color: "#2d2418"
      }}
    >
      <h1 style={{ fontSize: "2.6rem", marginBottom: "1rem" }}>{title}</h1>
      <section
        style={{
          display: "grid",
          gap: "1rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))"
        }}
      >
        {children}
      </section>
    </main>
  );
}

