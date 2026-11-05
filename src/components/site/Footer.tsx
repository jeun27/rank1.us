import { navLink } from "./Header";
import { container } from "./Section";

// The contact email is never shown: Contact us is the form.
export function Footer() {
  return (
    <footer className={`${container} flex flex-col gap-4 border-t border-border py-8 md:flex-row md:items-center md:justify-between`}>
      <p className="font-display text-wordmark font-semibold">Rank1</p>
      <nav aria-label="Footer" className="flex flex-wrap gap-x-4">
        <a href="#pricing" className={navLink}>Pricing</a>
        <a href="#faq" className={navLink}>FAQ</a>
        <a href="/contact" className={navLink}>Contact us</a>
        <a href="/privacy" className={navLink}>Privacy</a>
        <a href="/terms" className={navLink}>Terms</a>
      </nav>
    </footer>
  );
}
