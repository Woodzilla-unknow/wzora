import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SectionView } from "@/components/SectionView";
import { sections, site } from "@/content/site";

type Props = { params: Promise<{ section: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return sections.map((s) => ({ section: s.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { section } = await params;
  const s = sections.find((x) => x.id === section);
  return s ? { title: `${s.title} — ${site.name}` } : {};
}

export default async function SectionPage({ params }: Props) {
  const { section } = await params;
  const i = sections.findIndex((x) => x.id === section);
  if (i < 0) notFound();
  return <SectionView section={sections[i]} prev={sections[i - 1]} next={sections[i + 1]} />;
}
