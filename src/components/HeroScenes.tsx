"use client";

import { useEffect, useState } from "react";
import { Body } from "@/components/Placeholder";
import { Polytope4D, type ShapeId } from "@/components/Polytope4D";
import { hrefFor, site, type Item, type Section } from "@/content/site";

/*
 * The front page's pinned stage. Scene 0 is the hero: the 4D shape fills the
 * screen behind WZORA. Each scroll step after that is one section's scene
 * ("WZORA.about", "WZORA.mission", …): the shape glides into a central frame
 * and morphs into a different polytope, the section's text sits inside the
 * frame, and its highlights sit in boxes around it. The shape keeps turning
 * the whole time; scrolling changes the scene.
 */

const SCENE_SHAPES: ShapeId[] = ["24-cell", "tesseract", "16-cell", "5-cell"];

const EMPTY_BOXES: Item[] = [
  { title: "", body: null },
  { title: "", body: null },
  { title: "", body: null },
];

export function HeroScenes({ sections }: { sections: Section[] }) {
  const [scene, setScene] = useState(0); // 0 = hero, 1… = sections

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
  // The scene has room for four boxes around its frame.
  const boxes = s ? (s.highlights ?? s.items ?? EMPTY_BOXES).slice(0, 4) : [];

  return (
    <div className="hero-stage" data-scene={scene === 0 ? "hero" : "section"}>
      <span className="hero-corner tl" aria-hidden="true" />
      <span className="hero-corner tr" aria-hidden="true" />
      <span className="hero-corner bl" aria-hidden="true" />
      <span className="hero-corner br" aria-hidden="true" />

      <Polytope4D
        className="hero-shape"
        shape={SCENE_SHAPES[scene % SCENE_SHAPES.length]}
        fitSelector={s ? ".scene-frame" : undefined}
        revealSelector=".hero-word-solid"
        fitTop={64}
      />
      <div className="scene-frame" aria-hidden="true" />

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
