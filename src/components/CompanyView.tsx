import { Body } from "@/components/Placeholder";
import { Reveal } from "@/components/Reveal";
import { companyHref, type Company, type Section } from "@/content/site";

/** A WZORA company: its website and its information. */
export function CompanyView({
  company: c,
  section,
  index,
  prev,
  next,
}: {
  company: Company;
  section: Section;
  index: number;
  prev?: Company;
  next?: Company;
}) {
  return (
    <main className="page">
      <section className="section" aria-labelledby={`${c.id}-title`}>
        <div className="section-head reveal">
          <span className="section-index">
            {section.index}.{index + 1}
          </span>
          <span className="section-label">{section.label}</span>
        </div>
        <div className="section-main">
          <p className="crumbs reveal">
            <a href={`/${section.id}`}>{section.title}</a>
            <span aria-hidden="true"> / </span>
            {c.name}
          </p>
          <h1 id={`${c.id}-title`} className="section-title reveal">
            {c.name}
          </h1>

          <dl className="company-facts reveal">
            <div>
              <dt>Website</dt>
              <dd>
                <a href={`https://${c.website}`} target="_blank" rel="noopener noreferrer">
                  {c.website} ↗
                </a>
              </dd>
            </div>
          </dl>

          <div className="reveal">
            <Body body={c.body} />
          </div>
        </div>
      </section>

      <nav className="page-steps" aria-label="More companies">
        <a href={prev ? companyHref(prev) : `/${section.id}`} className="page-step">
          <span className="page-step-dir">← {prev ? "Previous company" : "All companies"}</span>
          <span className="page-step-title">{prev ? prev.name : section.title}</span>
        </a>
        {next && (
          <a href={companyHref(next)} className="page-step is-next">
            <span className="page-step-dir">Next company →</span>
            <span className="page-step-title">{next.name}</span>
          </a>
        )}
      </nav>

      <Reveal />
    </main>
  );
}
