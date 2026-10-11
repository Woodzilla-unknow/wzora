import { Polytope4D } from "@/components/Polytope4D";
import { site } from "@/content/site";

/*
 * The front page is one scroll-driven scene. The hero is several screens tall
 * (the scroll track); its stage stays pinned while you scroll through it, and
 * the scroll position drives the 4D shape: it assembles, then turns.
 */
export default function Home() {
  return (
    <main>
      <section className="hero" aria-label={site.name} data-scroll-track>
        <div className="hero-stage">
          <span className="hero-corner tl" aria-hidden="true" />
          <span className="hero-corner tr" aria-hidden="true" />
          <span className="hero-corner bl" aria-hidden="true" />
          <span className="hero-corner br" aria-hidden="true" />

          <Polytope4D className="hero-shape" revealSelector=".hero-word-solid" fitTop={64} />
          <h1 className="hero-word" aria-label={site.name}>
            {/* Two identical layers: wire outlines, and a solid copy on top that
                the 4D shape reveals wherever a white region passes behind it. */}
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

          <p className="scroll-cue" aria-hidden="true">
            <span>Scroll to begin</span>
            <span className="scroll-line" />
          </p>
        </div>
      </section>
    </main>
  );
}
