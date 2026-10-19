import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CompanyView } from "@/components/CompanyView";
import { companies, sections, site } from "@/content/site";

// Pages below a section. For now only companies have their own pages: /companies/<id>.
type Props = { params: Promise<{ section: string; item: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return companies.map((c) => ({ section: "companies", item: c.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { item } = await params;
  const c = companies.find((x) => x.id === item);
  return c ? { title: `${c.name} — ${site.name}` } : {};
}

export default async function CompanyPage({ params }: Props) {
  const { section, item } = await params;
  const i = companies.findIndex((x) => x.id === item);
  const s = sections.find((x) => x.id === section);
  if (section !== "companies" || i < 0 || !s) notFound();
  return <CompanyView company={companies[i]} section={s} index={i} prev={companies[i - 1]} next={companies[i + 1]} />;
}
