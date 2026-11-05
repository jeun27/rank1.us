import { Section } from "./Section";

// Placeholders stay hidden until real logos and a real testimonial (with permission) exist.
export function SocialProof({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <Section id="social-proof" title="Built for businesses that want AI to name them.">
      <ul className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {[1, 2, 3, 4, 5].map((i) => (
          <li key={i} className="rounded-surface border border-border p-4 text-center text-caption text-inkMuted">
            [PLACEHOLDER LOGO]
          </li>
        ))}
      </ul>
      <blockquote className="mt-8 text-body-lg">[PLACEHOLDER TESTIMONIAL - real, with permission]</blockquote>
    </Section>
  );
}
