import { Logo } from "@/components/Logo";
import { sections, site } from "@/content/site";

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer">
      <div className="footer-word" aria-hidden="true">
        {site.name}
      </div>
      <div className="footer-row">
        <a href="/" aria-label={`${site.name} home`}>
          <Logo className="footer-mark" />
        </a>
        <nav aria-label="Footer">
          {sections.map((s) => (
            <a key={s.id} href={`/${s.id}`}>
              {s.label}
            </a>
          ))}
        </nav>
        <p>
          © {year} {site.name}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
