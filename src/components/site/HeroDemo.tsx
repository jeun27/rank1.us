"use client";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Jelly } from "@/components/ui/Jelly";
import { formatPercent } from "@/components/ui/StatNumber";
import { pointsChange } from "@/app/dev/ui/example-data";
import { DEMO_MS, demoBoard, demoEngines, demoFrame, demoLastWeek, demoThisWeek } from "./demo-data";

type State = "final" | "running";

// The landing's one focal moment (D26, D37): type the question, fill the engine bars, count up, and the You
// row climbs past a rival. The server renders the final state (also what no-JS and reduced motion show).
// With motion allowed its moving parts stay hidden (globals.css) until it scrolls into view, then it runs
// once; requestAnimationFrame stops while the tab is
// hidden, and each step is capped, so a hidden tab pauses the run instead of skipping it.
export function HeroDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<State>("final");
  const [ran, setRan] = useState(false);
  const [t, setT] = useState(0);

  useEffect(() => {
    if (typeof matchMedia === "undefined" || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    let last = 0;
    let elapsed = 0;
    const tick = (now: number) => {
      elapsed += Math.min(50, now - last);
      last = now;
      if (elapsed >= DEMO_MS) {
        setState("final");
        setRan(true);
        return;
      }
      setT(elapsed);
      raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        setState("running");
        last = performance.now();
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    io.observe(ref.current!);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  const f = demoFrame(state === "final" ? Infinity : t);
  const board = demoBoard(demoThisWeek);
  const before = demoBoard(demoLastWeek);

  return (
    <div
      ref={ref}
      data-demo
      data-hero-card
      data-demo-state={state}
      data-demo-ran={ran ? "" : undefined}
      className="relative rounded-frame border border-border bg-white p-4 shadow-window md:p-6"
    >
      <Badge tone="info">Example data</Badge>
      <p className="mt-4 flex min-h-10 items-center rounded-control border border-border bg-paper px-3 font-mono text-ui text-ink">
        <span data-demo-question data-demo-anim data-computed>
          {f.typed}
        </span>
        <span aria-hidden className="ml-0.5 h-4 w-px bg-accent" />
      </p>

      <div className="mt-5 grid gap-6 md:grid-cols-2">
        <div>
          <ul className="flex flex-col gap-3">
            {demoEngines.map((e) => (
              <li
                key={e.engine}
                data-demo-bar={e.engine}
                className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-caption"
              >
                <span className="truncate text-text2">{e.engine}</span>
                <span className="h-1.5 overflow-hidden rounded-full bg-overlay">
                  <span
                    data-demo-fill
                    data-demo-anim
                    className="block h-full origin-left rounded-full bg-accent"
                    style={{ transform: `scaleX(${(e.named.value ?? 0) * f.bars})` }}
                  />
                </span>
                <span data-computed className="font-mono text-text2 tabular-nums">
                  {`${e.named.numerator} of ${e.named.denominator}`}
                </span>
              </li>
            ))}
          </ul>
          {/* Reads "named in 34% of 160 answers, +6 pts"; the numbers come from the demo fixture. */}
          <p className="mt-5 text-body" data-hero-text>
            named in{" "}
            <span data-demo-anim className="font-mono text-h3 font-semibold text-ink tabular-nums">
              {formatPercent(f.visibility)}
            </span>{" "}
            of <span className="font-mono tabular-nums">{f.visibility.denominator}</span> answers,{" "}
            <span className="font-mono font-semibold text-moss tabular-nums">
              {pointsChange(f.visibility, demoLastWeek)}
            </span>
          </p>
        </div>

        <div className="self-start">
          <ol className="flex flex-col overflow-hidden rounded-card border border-border">
            {board.map((r, i) => {
              const from = before.findIndex((b) => b.brand === r.brand);
              // Before the climb, rows sit where last week put them; the climb slides them into place.
              const shift = f.climbed ? 0 : from - i;
              return (
                <li
                  key={r.brand}
                  data-demo-row={r.brand}
                  data-you={r.you ? "" : undefined}
                  data-demo-anim
                  style={{ transform: `translateY(${shift * 100}%)` }}
                  className={`flex h-9 items-center gap-3 border-border px-3 text-caption transition-transform duration-300 ease-[cubic-bezier(.16,1,.3,1)] motion-reduce:transition-none [&+li]:border-t ${
                    r.you ? "bg-infoBg" : "bg-white"
                  }`}
                >
                  <span data-computed className="w-4 font-mono text-inkMuted tabular-nums">
                    {f.climbed ? r.rank : before[from].rank}
                  </span>
                  <span data-computed className="min-w-0 flex-1 truncate text-ink">
                    {r.brand}
                  </span>
                  {r.you && <Badge tone="info">You</Badge>}
                  <span data-computed className="font-mono text-text2 tabular-nums">
                    {formatPercent(r.you ? f.visibility : r.named)}
                  </span>
                </li>
              );
            })}
          </ol>
          {/* The n rule: every number shows its sample size (lead copy "From {n} answers"). */}
          <p data-demo-sample className="mt-2 text-caption text-inkMuted">
            From <span className="font-mono tabular-nums">{demoThisWeek.denominator}</span> answers
          </p>
        </div>
      </div>

      {/* 72px on the corner (60px below 1220px), hidden on phones. Static until jelly.svg has an eye layer. */}
      <Jelly size={72} className="absolute -right-5 -bottom-6 hidden h-auto w-[60px] md:block min-[1220px]:w-[72px]" />
    </div>
  );
}
