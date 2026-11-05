import Link from "next/link";
import { ContactUsLink } from "@/components/contact/ContactUsLink";
import { Logo } from "@/components/ui/Logo";
import { container } from "./Section";

export const navLink =
  "inline-flex min-h-11 items-center px-2 text-ui font-semibold text-ink underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jellyDeep";

export function Header() {
  return (
    <header className={`${container} flex items-center justify-between py-3`}>
      <Link href="/" className={navLink} aria-label="Rank1">
        <Logo />
      </Link>
      <nav className="flex items-center gap-1 md:gap-4">
        <a href="#pricing" className={navLink}>Pricing</a>
        <a href="#faq" className={navLink}>FAQ</a>
        <ContactUsLink className={navLink}>Contact us</ContactUsLink>
      </nav>
    </header>
  );
}
