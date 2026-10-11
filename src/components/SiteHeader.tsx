import { Logo } from "@/components/Logo";
import { Search } from "@/components/Search";
import { SiteMap } from "@/components/SiteMap";
import { ThemeToggle } from "@/components/ThemeToggle";
import { sections, site } from "@/content/site";

export function SiteHeader() {
  return (
    <header className="site-header">
      <a href="/" className="brand" aria-label={`${site.name} home`}>
        <Logo className="brand-mark" />
      </a>
      <div className="header-center">
        <Search sections={sections} />
        <SiteMap sections={sections} />
      </div>
      <ThemeToggle />
    </header>
  );
}
