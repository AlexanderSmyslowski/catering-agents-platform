export function StatusCard({
  title,
  body
}: {
  title: string;
  body: string;
}) {
  return (
    <article className="status-card">
      <h2>{title}</h2>
      <p>{body}</p>
    </article>
  );
}
