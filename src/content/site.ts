/**
 * All website copy lives here.
 *
 * To publish information for a section, replace `body: null` with an array of
 * paragraphs. Any section (or item) whose body is `null` shows the
 * "Information is not complete yet." notice instead.
 */

export const PLACEHOLDER = "Information is not complete yet.";

export type Item = {
  title: string;
  body: string[] | null;
};

export type Section = {
  id: string;
  index: string;
  label: string;
  title: string;
  body: string[] | null;
  items?: Item[];
};

/** Page anchor for a section, or for one of its items (cards). */
export function anchorFor(section: Section, item?: Item): string {
  if (!item) return section.id;
  return `${section.id}-${item.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

export const site = {
  name: "WZORA",
  tagline: "The parent company.",
  description: "WZORA — official company information.",
};

export const sections: Section[] = [
  {
    id: "about",
    index: "01",
    label: "About",
    title: "About WZORA",
    body: null,
  },
  {
    id: "mission",
    index: "02",
    label: "Mission",
    title: "Mission & Vision",
    body: null,
    items: [
      { title: "Mission", body: null },
      { title: "Vision", body: null },
      { title: "Values", body: null },
    ],
  },
  {
    id: "companies",
    index: "03",
    label: "Companies",
    title: "Our Companies",
    body: null,
  },
  {
    id: "leadership",
    index: "04",
    label: "Leadership",
    title: "Leadership",
    body: null,
  },
  {
    id: "news",
    index: "05",
    label: "News",
    title: "News & Updates",
    body: null,
  },
  {
    id: "contact",
    index: "06",
    label: "Contact",
    title: "Contact",
    body: null,
  },
  {
    id: "legal",
    index: "07",
    label: "Legal",
    title: "Legal",
    body: null,
    items: [
      { title: "Company Registration", body: null },
      { title: "Privacy Policy", body: null },
      { title: "Terms of Use", body: null },
      { title: "Cookie Policy", body: null },
    ],
  },
];
