"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { Body } from "@/components/Placeholder";
import { Logo3D } from "@/components/Logo3D";
import { Polytope4D, type ShapeId } from "@/components/Polytope4D";
import { SolarSystem } from "@/components/SolarSystem";
import { companies, hrefFor, site, type Item, type Section } from "@/content/site";

/*
 * The front page's pinned stage. Scene 0 is the hero: the 4D shape fills the
 * screen behind WZORA. Each scroll step after that is one section's scene
 * ("WZORA.about", "WZORA.mission", …): the shape glides into a central frame
 * and morphs into a different polytope, the section's text sits inside the
 * frame, and its highlights sit in boxes around it.
 *
 * WZORA.companies is the exception: there the frame holds WZORA's solar
 * system, the companies orbiting the W/Z mark. That mark spins in 3D in the
 * top-right corner of every other scene, and on WZORA.companies it grows out
 * of the corner into the sun. The shapes keep turning the whole time;
 * scrolling changes the scene.
 */

// The hero is a tesseract, the shape the first-visit start-up builds.
const SCENE_SHAPES: ShapeId[] = ["tesseract", "24-cell", "16-cell", "5-cell"];

// The section whose scene shows the solar system.
const SOLAR_SECTION = "companies";

const EMPTY_BOXES: Item[] = [
  { title: "", body: null },
  { title: "", body: null },
  { title: "", body: null },
];

export function HeroScenes({ sections }: { sections: Section[] }) {
  const [scene, setScene] = useState(0); // 0 = hero, 1… = sections
  const stageRef = useRef<HTMLDivElement>(null);
  const sun = useRef({ x: 0, y: 0, w: 0 });

  // The spinning mark sits in the top-right corner, just inside the corner
  // bracket, and on the sun in the solar scene. Both places go into CSS
  // variables so the move between them is a single transform.
  const place = useCallback(() => {
    const stage = stageRef.current;
    const bracket = stage?.querySelector<HTMLElement>(".hero-corner.tr");
    const { x, y, w } = sun.current;
    if (!stage || !bracket || !w) return;
    const corner = window.innerWidth <= 820 ? 52 : 88;
    const st = stage.getBoundingClientRect();
    const br = bracket.getBoundingClientRect();
    const cx = br.right - st.left - 6 - corner / 2;
    const cy = br.top - st.top + corner * 0.42;
    stage.style.setProperty("--sun-x", `${x}px`);
    stage.style.setProperty("--sun-y", `${y}px`);
    stage.style.setProperty("--sun-w", `${w}px`);
    stage.style.setProperty("--corner-dx", `${cx - x}px`);
    stage.style.setProperty("--corner-dy", `${cy - y}px`);
    stage.style.setProperty("--corner-scale", `${corner / w}`);
  }, []);

  const onSun = useCallback(
    (x: number, y: number, w: number) => {
      sun.current = { x, y, w };
      place();
    },
    [place],
  );

  useEffect(() => {
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [place]);

  // One scene per screen height of scrolling through the track.
  useEffect(() => {
    const track = document.querySelector<HTMLElement>("[data-scroll-track]");
    if (!track) return;
    const update = () => {
      const i = Math.round(-track.getBoundingClientRect().top / window.innerHeight);
      setScene(Math.max(0, Math.min(sections.length, i)));
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [sections.length]);

  const s = scene > 0 ? sections[scene - 1] : null;
  const solar = s?.id === SOLAR_SECTION;
  // The scene has room for four boxes around its frame.
  const boxes = s ? (s.highlights ?? s.items ?? EMPTY_BOXES).slice(0, 4) : [];

  return (
    <div
      className="hero-stage"
      data-scene={scene === 0 ? "hero" : "section"}
      data-solar={solar ? "" : undefined}
      ref={stageRef}
    >
      <span className="hero-corner tl" aria-hidden="true" />
      <span className="hero-corner tr" aria-hidden="true" />
      <span className="hero-corner bl" aria-hidden="true" />
      <span className="hero-corner br" aria-hidden="true" />

      <SolarSystem className="solar" companies={companies} active={solar} onSun={onSun} />
      <button
        type="button"
        className="logo3d"
        aria-label="Back to the start"
        tabIndex={scene > 0 && !solar ? 0 : -1}
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      >
        <Logo3D className="logo3d-canvas" />
      </button>

      <Polytope4D
        className="hero-shape"
        shape={SCENE_SHAPES[scene % SCENE_SHAPES.length]}
        fitSelector={s ? ".scene-frame" : undefined}
        revealSelector=".hero-word-solid"
        fitTop={64}
        active={!solar}
        build
      />
      <div className="scene-frame" aria-hidden="true" />

      <div className="hero-center">
        <h1 className="hero-word" aria-label={site.name}>
          {/* Two identical layers: wire outlines, and a solid copy on top that
              the 4D shape reveals wherever a white region passes behind it. */}
          {(["outline", "solid"] as const).map((layer) => (
            <span key={layer} className={`hero-word-layer hero-word-${layer}`} aria-hidden="true">
              {site.name.split("").map((ch, i) => (
                <span key={i} style={{ "--i": i } as CSSProperties}>
                  {ch}
                </span>
              ))}
            </span>
          ))}
        </h1>
        <p className="hero-tagline">{site.tagline}</p>
      </div>

      <p className="scroll-cue" aria-hidden="true">
        <span>Scroll</span>
        <span className="scroll-line" />
      </p>

      {s && (
        <p className="scene-title" key={`title-${s.id}`}>
          {site.name}.{s.id}
          <span className="scene-count">
            {s.index} / {String(sections.length).padStart(2, "0")}
          </span>
        </p>
      )}

      {s && (
        <div className="scene" key={s.id} data-boxes={boxes.length}>
          <div className="scene-intro">
            <h2>{s.title}</h2>
            <Body body={s.body} />
            <a href={hrefFor(s)} className="scene-open">
              Open {site.name}.{s.id} →
            </a>
          </div>

          {boxes.map((box, i) => (
            <article key={i} className={`scene-box at-${i}`} style={{ animationDelay: `${0.15 + i * 0.08}s` }}>
              <h3>
                <span className="scene-box-index">
                  {s.index}.{i + 1}
                </span>
                {box.href ? <a href={box.href}>{box.title} →</a> : box.title}
              </h3>
              {box.meta && <p className="card-meta">{box.meta}</p>}
              <Body body={box.body} />
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
