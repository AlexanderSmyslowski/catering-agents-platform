export function StatusCard({
  title,
  body
}: {
  title: string;
  body: string;
}) {
  return (
    <article
      style={{
        background: "rgba(255,255,255,0.75)",
        border: "1px solid rgba(70,52,33,0.15)",
        borderRadius: "1rem",
        padding: "1.25rem",
        boxShadow: "0 10px 30px rgba(70,52,33,0.08)"
      }}
    >
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      <p style={{ lineHeight: 1.5 }}>{body}</p>
    </article>
  );
}

