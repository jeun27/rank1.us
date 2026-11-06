"use client";
import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Status } from "./ui";

// Every done-for-you edit: diff → confirm → apply → change log (product rule). Example data, nothing is sent.
export function EditFlow({
  where,
  before,
  after,
  mono = false,
  onApplied,
  onCancel,
}: {
  where: string;
  before: string;
  after: string;
  mono?: boolean;
  onApplied: () => void;
  onCancel: () => void;
}) {
  const id = useId();
  const [step, setStep] = useState<"diff" | "confirm" | "applying" | "applied">("diff");
  if (step === "applied") return <Status tone="success">{`Applied to ${where}. Added to the change log.`}</Status>;
  return (
    <div className="flex flex-col gap-3 rounded-card border border-borderStrong bg-paper p-3">
      <p className="text-caption font-medium">
        Change in <span className="text-text2">{where}</span>
      </p>
      <div className="grid gap-2 md:grid-cols-2">
        <Diff label="Before" tone="error" text={before} mono={mono} />
        <Diff label="After" tone="success" text={after} mono={mono} />
      </div>
      {step === "diff" ? (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setStep("confirm")}>Apply this change</Button>
          <Button variant="alt" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      ) : (
        <div role="group" aria-labelledby={`${id}-c`} className="flex flex-col gap-2 border-t border-border pt-3">
          <p id={`${id}-c`} className="text-caption">
            {`Apply to ${where}? Customers will see the new version right away.`}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              loading={step === "applying"}
              onClick={() => {
                setStep("applying");
                setTimeout(() => {
                  setStep("applied");
                  onApplied();
                }, 700);
              }}
            >
              {step === "applying" ? "Applying…" : "Yes, apply"}
            </Button>
            <Button variant="alt" disabled={step === "applying"} onClick={() => setStep("diff")}>
              Back
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Diff({ label, tone, text, mono }: { label: string; tone: "error" | "success"; text: string; mono: boolean }) {
  const edge = tone === "error" ? "border-brick/30 bg-errorBg" : "border-moss/30 bg-successBg";
  return (
    <figure className={`flex min-w-0 flex-col gap-1 rounded-card border p-2.5 ${edge}`}>
      <figcaption className={`text-[11px] font-medium ${tone === "error" ? "text-brick" : "text-moss"}`}>
        {label}
      </figcaption>
      <pre className={`text-caption whitespace-pre-wrap text-ink ${mono ? "font-mono" : "font-sans"}`}>{text}</pre>
    </figure>
  );
}
