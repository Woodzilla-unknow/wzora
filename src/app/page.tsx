import { HeroScenes } from "@/components/HeroScenes";
import { sections, site } from "@/content/site";

/*
 * The front page is one pinned stage with a scene per scroll step: the hero,
 * then one scene per section. The track is one screen tall per scene, with a
 * snap point at each, so every scroll lands cleanly on a scene.
 */
export default function Home() {
  const scenes = sections.length + 1;
  return (
    <main>
      <section className="hero" aria-label={site.name} data-scroll-track style={{ height: `${scenes * 100}svh` }}>
        {Array.from({ length: scenes }, (_, i) => (
          <span key={i} className="scene-snap" style={{ top: `${i * 100}svh` }} aria-hidden="true" />
        ))}
        <HeroScenes sections={sections} />
      </section>
    </main>
  );
}
