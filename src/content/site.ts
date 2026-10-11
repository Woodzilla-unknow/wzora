/**
 * All website copy lives here.
 *
 * Each section has its own page at /<id> (e.g. /about, /legal). To publish
 * information for a section, replace `body: null` with an array of
 * paragraphs. Any section (or item) whose body is `null` shows the
 * "Information is not complete yet." notice instead. Search and the site map
 * read from this file, so new content shows up there automatically.
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

/** Anchor of a card (item) on its section's page. */
export function anchorFor(section: Section, item: Item): string {
  return `${section.id}-${item.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

/** Link to a section's own page, or to one of its cards on that page. */
export function hrefFor(section: Section, item?: Item): string {
  return item ? `/${section.id}#${anchorFor(section, item)}` : `/${section.id}`;
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
