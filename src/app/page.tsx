import { Logo } from "@/components/Logo";
import { Polytope4D } from "@/components/Polytope4D";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Reveal } from "@/components/Reveal";
import { Body } from "@/components/Placeholder";
import { sections, site } from "@/content/site";

export default function Home() {
  const year = new Date().getFullYear();

  return (
    <>
      <header className="site-header">
        <a href="#top" className="brand" aria-label={`${site.name} — back to top`}>
          <Logo className="brand-mark" />
        </a>
        <nav className="site-nav" aria-label="Sections">
          {sections.map((s) => (
            <a key={s.id} href={`#${s.id}`}>
              {s.label}
            </a>
          ))}
        </nav>
        <ThemeToggle />
      </header>

      <main id="top">
        <section className="hero" aria-label={site.name}>
          <span className="hero-corner tl" aria-hidden="true" />
          <span className="hero-corner tr" aria-hidden="true" />
          <span className="hero-corner bl" aria-hidden="true" />
          <span className="hero-corner br" aria-hidden="true" />

          <Polytope4D className="hero-shape" revealSelector=".hero-word-solid" fitTop={64} />
          <h1 className="hero-word" aria-label={site.name}>
            {/* Two identical layers: wire outlines, and a solid copy on top that
                the 4D shape reveals wherever a lit surface passes behind it. */}
            {(["outline", "solid"] as const).map((layer) => (
              <span key={layer} className={`hero-word-layer hero-word-${layer}`} aria-hidden="true">
                {site.name.split("").map((ch, i) => (
                  <span key={i} style={{ animationDelay: `${0.5 + i * 0.08}s` }}>
                    {ch}
                  </span>
                ))}
              </span>
            ))}
          </h1>
          <p className="hero-tagline">{site.tagline}</p>

          <a href="#about" className="scroll-cue" aria-label="Scroll to content">
            <span>Scroll</span>
            <span className="scroll-line" aria-hidden="true" />
          </a>
        </section>

        {sections.map((s) => (
          <section key={s.id} id={s.id} className="section">
            <div className="section-head reveal">
              <span className="section-index">{s.index}</span>
              <span className="section-label">{s.label}</span>
            </div>
            <div className="section-main">
              <h2 className="section-title reveal">{s.title}</h2>
              {(s.body || !s.items) && (
                <div className="reveal">
                  <Body body={s.body} />
                </div>
              )}
              {s.items && (
                <div className="cards">
                  {s.items.map((item) => (
                    <article key={item.title} className="card reveal">
                      <h3>{item.title}</h3>
                      <Body body={item.body} />
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>
        ))}
      </main>

      <footer className="site-footer">
        <div className="footer-word" aria-hidden="true">
          {site.name}
        </div>
        <div className="footer-row">
          <Logo className="footer-mark" />
          <nav aria-label="Footer">
            {sections.map((s) => (
              <a key={s.id} href={`#${s.id}`}>
                {s.label}
              </a>
            ))}
          </nav>
          <p>
            © {year} {site.name}. All rights reserved.
          </p>
        </div>
      </footer>

      <Reveal />
    </>
  );
}
