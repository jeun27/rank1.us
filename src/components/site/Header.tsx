import Link from "next/link";
import { ContactUsLink } from "@/components/contact/ContactUsLink";
import { Logo } from "@/components/ui/Logo";
import { authCopy } from "@/lib/auth/copy";
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
        <a href="#pricing" className={navLink}>
          Pricing
        </a>
        <a href="#faq" className={navLink}>
          FAQ
        </a>
        {/* X20: the phone header keeps Pricing, FAQ and Log in; pricing and the footer keep Contact us. */}
        <ContactUsLink className={`${navLink} max-md:hidden`}>Contact us</ContactUsLink>
        <Link href="/signin" className={navLink}>
          {authCopy.logIn}
        </Link>
      </nav>
    </header>
  );
}
