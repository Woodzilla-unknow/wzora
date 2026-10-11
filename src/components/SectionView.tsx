import { Body } from "@/components/Placeholder";
import { HashHighlight } from "@/components/HashHighlight";
import { Reveal } from "@/components/Reveal";
import { anchorFor, type Section } from "@/content/site";

/** A section's own page: its title, its information, and its cards. */
export function SectionView({ section: s, prev, next }: { section: Section; prev?: Section; next?: Section }) {
  return (
    <main className="page">
      <section className="section" aria-labelledby={`${s.id}-title`}>
        <div className="section-head reveal">
          <span className="section-index">{s.index}</span>
          <span className="section-label">{s.label}</span>
        </div>
        <div className="section-main">
          <h1 id={`${s.id}-title`} className="section-title reveal">
            {s.title}
          </h1>
          {(s.body || !s.items) && (
            <div className="reveal">
              <Body body={s.body} />
            </div>
          )}
          {s.items && (
            <div className="cards">
              {s.items.map((item) => (
                <article key={item.title} id={anchorFor(s, item)} className="card reveal">
                  <h2>{item.title}</h2>
                  <Body body={item.body} />
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <nav className="page-steps" aria-label="More sections">
        {prev ? (
          <a href={`/${prev.id}`} className="page-step">
            <span className="page-step-dir">← Previous</span>
            <span className="page-step-title">
              <span className="section-index">{prev.index}</span> {prev.title}
            </span>
          </a>
        ) : (
          <span />
        )}
        {next && (
          <a href={`/${next.id}`} className="page-step is-next">
            <span className="page-step-dir">Next →</span>
            <span className="page-step-title">
              <span className="section-index">{next.index}</span> {next.title}
            </span>
          </a>
        )}
      </nav>

      <Reveal />
      <HashHighlight />
    </main>
  );
}
