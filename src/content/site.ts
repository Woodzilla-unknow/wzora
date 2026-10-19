/**
 * All website copy lives here.
 *
 * Each section has its own page at /<id> (e.g. /about, /legal). To publish
 * information for a section, replace `body: null` with an array of
 * paragraphs. Any section (or item) whose body is `null` shows the
 * "Information is not complete yet." notice instead. Search and the site map
 * read from this file, so new content shows up there automatically.
 *
 * Companies WZORA owns are listed in `companies`; each one gets its own page
 * at /companies/<id> and appears under Our Companies.
 */

export const PLACEHOLDER = "Information is not complete yet.";

export type Item = {
  title: string;
  body: string[] | null;
  /** Where the item links to, when it has its own page (e.g. a company). */
  href?: string;
  /** A short line shown under the title, such as a website. */
  meta?: string;
};

export type Section = {
  id: string;
  index: string;
  label: string;
  title: string;
  body: string[] | null;
  items?: Item[];
  /**
   * Short blocks for the boxes around the shape in this section's scene on the
   * front page. Defaults to the section's items, or to three empty boxes.
   */
  highlights?: Item[];
};

/** Anchor of a card (item) on its section's page. */
export function anchorFor(section: Section, item: Item): string {
  return `${section.id}-${item.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

/** Link to a section's own page, or to one of its items (its own page, or its card). */
export function hrefFor(section: Section, item?: Item): string {
  if (!item) return `/${section.id}`;
  return item.href ?? `/${section.id}#${anchorFor(section, item)}`;
}

export type Company = {
  id: string;
  name: string;
  /** The company's website, without https:// (e.g. "kairowz.com"). */
  website: string;
  /**
   * How much of the company WZORA owns, in percent. On the front page's solar
   * system, the more WZORA owns, the closer the company orbits.
   */
  ownership: number;
  /** Logo image in /public (e.g. "/logos/kairowz.svg"). Without one, its first letter is shown. */
  logo?: string;
  body: string[] | null;
};

/** Companies WZORA owns. */
export const companies: Company[] = [
  {
    id: "kairowz",
    name: "Kairowz",
    website: "kairowz.com",
    ownership: 100,
    body: null,
  },
];

export const companyHref = (c: Company) => `/companies/${c.id}`;

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
    items: companies.map((c) => ({ title: c.name, body: c.body, href: companyHref(c), meta: c.website })),
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
