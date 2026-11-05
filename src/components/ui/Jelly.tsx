import Image from "next/image";

const ALT = "Jelly, the Rank1 mascot: a glossy blue gummy blob with two oval eyes";

// Interim raster from jelly-01-front.jpg (512 x 471). Pass decorative for every Jelly after the first on a screen.
export function Jelly({ size, decorative = false, className }: { size: number; decorative?: boolean; className?: string }) {
  return (
    <Image src="/jelly.png" alt={decorative ? "" : ALT} width={size} height={Math.round((size * 471) / 512)} className={className} />
  );
}
