import { describe, expect, it, vi } from "vitest";
import { auditEmail, notifyFreeAudits, type NotifyDeps, type UnnotifiedFreeAudit } from "@/lib/audit/notify";
import type { MetricAnswer } from "@/lib/metrics";

const ENV = { NEXT_PUBLIC_SITE_URL: "https://rank1.us", CONTACT_FROM_EMAIL: "audits@example.test" };
const audit = (p: Partial<UnnotifiedFreeAudit> = {}): UnnotifiedFreeAudit => ({
  run_id: "run-1",
  lead_id: "lead-1",
  token: "tok-secret",
  domain: "example-ramen-house.test",
  email: "owner@example.test",
  run_status: "complete",
  ...p,
});
const answer = (status: MetricAnswer["status"]): MetricAnswer => ({
  id: Math.random().toString(),
  question_id: null,
  question_text_used: "q",
  engine: "chatgpt",
  run_index: 1,
  status,
  mentioned: status === "ok" ? false : null,
  first_position: null,
  brands: null,
  location_used: "US",
  location_supported: "fallback_country",
  checked_at: "2026-11-05T12:00:00.000Z",
});

const base = (list: UnnotifiedFreeAudit[]) => ({
  listUnnotified: vi.fn<NotifyDeps["listUnnotified"]>(async () => list),
  answers: vi.fn<NotifyDeps["answers"]>(async () => [
    answer("ok"),
    answer("ok"),
    answer("failed"),
    answer("no_overview"),
  ]),
  send: vi.fn<NotifyDeps["send"]>(async () => true),
  markNotified: vi.fn<NotifyDeps["markNotified"]>(async () => {}),
  bumpAttempts: vi.fn<NotifyDeps["bumpAttempts"]>(async () => {}),
  env: ENV as Record<string, string | undefined>,
  log: vi.fn<(line: string) => void>(),
});
const deps = (list: UnnotifiedFreeAudit[], p: Partial<ReturnType<typeof base>> = {}) => ({ ...base(list), ...p });

describe("auditEmail", () => {
  it("uses the COPY.md strings exactly", () => {
    expect(auditEmail(audit(), 230, "https://rank1.us/", "audits@example.test")).toEqual({
      from: "audits@example.test",
      to: "owner@example.test",
      reply_to: "audits@example.test",
      subject: "Your Rank1 audit is ready",
      text: "Your free audit for example-ramen-house.test is ready: https://rank1.us/audit/tok-secret\n\nAPI-measured, directional. Results are based on 230 AI answers.",
    });
  });
});

describe("notifyFreeAudits", () => {
  it.each(["complete", "partial"] as const)(
    "%s run → one email (n = ok answers, free audit counts all), idempotency key = lead id, marked sent",
    async (run_status) => {
      const d = deps([audit({ run_status })]);
      expect(await notifyFreeAudits(d)).toEqual({ sent: 1, failedRuns: 0, sendErrors: 0, skipped: false });
      const [email, key] = d.send.mock.calls[0];
      expect(key).toBe("lead-1");
      expect(email.text).toContain("Results are based on 2 AI answers.");
      expect(d.markNotified).toHaveBeenCalledWith("run-1", true);
      expect(d.bumpAttempts).not.toHaveBeenCalled();
    },
  );

  it("failed run → no email, marked handled with sent=false, logged", async () => {
    const d = deps([audit({ run_status: "failed" })]);
    expect(await notifyFreeAudits(d)).toMatchObject({ sent: 0, failedRuns: 1 });
    expect(d.send).not.toHaveBeenCalled();
    expect(d.markNotified).toHaveBeenCalledWith("run-1", false);
    expect(d.log).toHaveBeenCalledWith("free audit notify: run run-1 failed, not emailed");
  });

  it("send failure → attempts bumped, not marked, the next audit still goes", async () => {
    const d = deps([audit(), audit({ run_id: "run-2", lead_id: "lead-2" })]);
    d.send.mockResolvedValueOnce(false);
    expect(await notifyFreeAudits(d)).toMatchObject({ sent: 1, sendErrors: 1 });
    expect(d.bumpAttempts).toHaveBeenCalledWith("run-1");
    expect(d.markNotified).toHaveBeenCalledTimes(1);
    expect(d.markNotified).toHaveBeenCalledWith("run-2", true);
  });

  it.each([[{ CONTACT_FROM_EMAIL: "audits@example.test" }], [{ NEXT_PUBLIC_SITE_URL: "https://rank1.us" }], [{}]])(
    "missing env %j → skips, one log line, no attempts",
    async (env) => {
      const d = deps([audit()], { env });
      expect(await notifyFreeAudits(d)).toMatchObject({ skipped: true, sent: 0 });
      expect(d.listUnnotified).not.toHaveBeenCalled();
      expect(d.bumpAttempts).not.toHaveBeenCalled();
      expect(d.log).toHaveBeenCalledTimes(1);
    },
  );

  it("a throwing query doesn't stop the loop or throw", async () => {
    const d = deps([audit(), audit({ run_id: "run-2", lead_id: "lead-2" })]);
    d.answers.mockRejectedValueOnce(new Error("db"));
    expect(await notifyFreeAudits(d)).toMatchObject({ sent: 1, sendErrors: 1 });
  });

  it("log lines never contain the email, token or domain", async () => {
    const d = deps([audit({ run_status: "failed" }), audit({ run_id: "run-2" })]);
    d.send.mockResolvedValue(false);
    await notifyFreeAudits(d);
    for (const [line] of d.log.mock.calls) {
      expect(String(line)).not.toMatch(/owner@example\.test|tok-secret|example-ramen-house\.test/);
    }
  });
});
