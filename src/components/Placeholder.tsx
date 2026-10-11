import { PLACEHOLDER } from "@/content/site";

export function Placeholder() {
  return (
    <p className="placeholder">
      <span className="placeholder-dot" aria-hidden="true" />
      {PLACEHOLDER}
    </p>
  );
}

export function Body({ body }: { body: string[] | null }) {
  if (!body || body.length === 0) return <Placeholder />;
  return (
    <div className="prose">
      {body.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </div>
  );
}
