import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureSelfServeWorkspace } from "@/lib/queries/auth";
import { createBusinessOnboarding, createDfyClient } from "@/lib/queries/onboarding";
import {
  claimReports,
  enqueueMonthlyReports,
  finishReport,
  getLogoUrl,
  getReportDownloadUrl,
  getReportSettings,
  laPreviousMonthStart,
  listReports,
  LOGO_MAX_BYTES,
  REPORTS_BUCKET,
  setReportSettings,
  uploadLogo,
  type ClaimedReport,
} from "@/lib/queries/reports";
import { anonClient, must, newUser, serviceClient, type TestUser } from "./helpers";

const loose = (db: unknown) => db as SupabaseClient;
const month = () => laPreviousMonthStart(new Date());
const business = {
  name: "Example Ramen House",
  domain: "example-ramen.test",
  cuisine: "ramen",
  city: "Irvine",
  state: "CA",
  country: "US",
  aliases: [],
};
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new Array(64).fill(0)]);

async function selfServe(tag: string, status: string | null = "active") {
  const user = await newUser(tag);
  const workspaceId = (await ensureSelfServeWorkspace(user.db))!;
  const businessId = await createBusinessOnboarding(user.db, { business, competitors: [], questions: [] });
  must(await serviceClient().from("workspaces").update({ subscription_status: status }).eq("id", workspaceId));
  return { user, workspaceId, businessId };
}

async function drainReports() {
  const all: ClaimedReport[] = [];
  for (;;) {
    const batch = await claimReports(serviceClient(), 500);
    if (batch.length === 0) return all;
    all.push(...batch);
  }
}

const reportsOf = async (businessId: string) =>
  must(await serviceClient().from("reports").select("*").eq("business_id", businessId));

let team: TestUser;
let client: TestUser;
let dfy: { workspaceId: string; businessId: string };

beforeAll(async () => {
  team = await newUser("rep-team");
  client = await newUser("rep-client");
  must(
    await serviceClient()
      .from("user_roles")
      .insert([
        { user_id: team.id, role: "team" },
        { user_id: client.id, role: "dfy_client" },
      ]),
  );
  dfy = await createDfyClient(team.db, {
    workspace_name: "Example DFY",
    business: { ...business, name: "Example Pho Spot" },
  });
  must(
    await serviceClient()
      .from("workspace_members")
      .insert({ workspace_id: dfy.workspaceId, user_id: client.id, role: "member" }),
  );
});

describe("storage buckets", () => {
  it("reports and logos are private, with size and type limits", async () => {
    const reports = must(await serviceClient().storage.getBucket("reports"));
    const logos = must(await serviceClient().storage.getBucket("logos"));
    expect(reports).toMatchObject({
      public: false,
      file_size_limit: 10485760,
      allowed_mime_types: ["application/pdf"],
    });
    expect(logos).toMatchObject({
      public: false,
      file_size_limit: 524288,
      allowed_mime_types: ["image/png", "image/jpeg"],
    });
  });

  it("signed-in users and anon cannot read or write either bucket directly", async () => {
    const { user, businessId } = await selfServe("rep-direct");
    for (const db of [user.db, anonClient()]) {
      const up = await db.storage.from("logos").upload(`${businessId}/x.png`, PNG, { contentType: "image/png" });
      expect(up.error).not.toBeNull();
      const list = await db.storage.from("reports").list(businessId);
      expect(list.data ?? []).toEqual([]);
    }
  });
});

describe("report settings", () => {
  it("saves color and recipients (trimmed, lowercased, deduped)", async () => {
    const { user, businessId } = await selfServe("rep-settings");
    await setReportSettings(user.db, businessId, {
      brand_color: "#3A6B5C",
      report_recipients: [" Owner@Example.test ", "owner@example.test", "chef@example.test"],
    });
    expect(await getReportSettings(user.db, businessId)).toEqual({
      brand_color: "#3A6B5C",
      report_recipients: ["owner@example.test", "chef@example.test"],
      has_logo: false,
    });
  });

  it("rejects a bad color, more than 10 recipients, or an invalid email (23514)", async () => {
    const { user, businessId } = await selfServe("rep-bad-settings");
    await expect(setReportSettings(user.db, businessId, { brand_color: "green" })).rejects.toMatchObject({
      code: "23514",
    });
    await expect(setReportSettings(user.db, businessId, { brand_color: "#12345" })).rejects.toMatchObject({
      code: "23514",
    });
    const eleven = Array.from({ length: 11 }, (_, i) => `r${i}@example.test`);
    await expect(setReportSettings(user.db, businessId, { report_recipients: eleven })).rejects.toMatchObject({
      code: "23514",
    });
    await expect(setReportSettings(user.db, businessId, { report_recipients: ["not an email"] })).rejects.toMatchObject(
      { code: "23514" },
    );
    const ten = Array.from({ length: 10 }, (_, i) => `r${i}@example.test`);
    await setReportSettings(user.db, businessId, { report_recipients: ten });
  });

  it("logo_path is server-only and must stay under the business id", async () => {
    const { user, businessId } = await selfServe("rep-logo-path");
    const direct = await loose(user.db)
      .from("businesses")
      .update({ logo_path: `${businessId}/x.png` })
      .eq("id", businessId);
    expect(direct.error?.code).toBe("42501");
    const other = await selfServe("rep-logo-other");
    const foreign = await serviceClient()
      .from("businesses")
      .update({ logo_path: `${other.businessId}/logo.png` })
      .eq("id", businessId);
    expect(foreign.error?.code).toBe("23514");
  });

  it("a dfy_client can't change report settings; the team can on a DFY business", async () => {
    await expect(setReportSettings(client.db, dfy.businessId, { brand_color: "#000000" })).rejects.toMatchObject({
      code: "42501",
    });
    await setReportSettings(team.db, dfy.businessId, { brand_color: "#112233" });
    expect((await getReportSettings(team.db, dfy.businessId))?.brand_color).toBe("#112233");
  });
});

describe("logo upload", () => {
  it("stores a PNG under the business id and signs a URL for members only", async () => {
    const { user, businessId } = await selfServe("rep-logo");
    expect(await uploadLogo(user.db, serviceClient(), businessId, PNG)).toEqual({
      status: "saved",
      path: `${businessId}/logo.png`,
    });
    expect((await getReportSettings(user.db, businessId))?.has_logo).toBe(true);
    expect(await getLogoUrl(user.db, serviceClient(), businessId)).toMatch(/^https?:\/\/.+token=/);
    const stranger = await newUser("rep-logo-stranger");
    expect(await getLogoUrl(stranger.db, serviceClient(), businessId)).toBeNull();
  });

  it("refuses SVG and other types, files over 512 KB, and callers who can't change the business", async () => {
    const { user, businessId } = await selfServe("rep-logo-bad");
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    expect(await uploadLogo(user.db, serviceClient(), businessId, svg)).toEqual({ status: "bad_type" });
    const big = new Uint8Array(LOGO_MAX_BYTES + 1);
    big.set(PNG.slice(0, 8));
    expect(await uploadLogo(user.db, serviceClient(), businessId, big)).toEqual({ status: "too_large" });
    expect(await uploadLogo(client.db, serviceClient(), dfy.businessId, PNG)).toEqual({ status: "not_allowed" });
    const stranger = await newUser("rep-logo-x");
    expect(await uploadLogo(stranger.db, serviceClient(), businessId, PNG)).toEqual({ status: "not_allowed" });
  });
});

describe("enqueue_monthly_reports", () => {
  it("queues last month's report for paid, trialing and DFY businesses only; idempotent", async () => {
    const paid = await selfServe("rep-paid");
    const trial = await selfServe("rep-trial", "trialing");
    const unpaid = await selfServe("rep-unpaid", null);
    const archived = await selfServe("rep-archived");
    must(
      await serviceClient()
        .from("businesses")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", archived.businessId),
    );

    const first = await enqueueMonthlyReports(serviceClient(), month());
    expect(first.enqueued).toBeGreaterThanOrEqual(3);
    for (const id of [paid.businessId, trial.businessId, dfy.businessId]) {
      const rows = await reportsOf(id);
      expect(rows, id).toHaveLength(1);
      expect(rows[0]).toMatchObject({ period_start: month(), status: "queued", attempts: 0 });
      expect(rows[0].period_end.slice(0, 7)).toBe(month().slice(0, 7));
    }
    for (const id of [unpaid.businessId, archived.businessId]) expect(await reportsOf(id), id).toEqual([]);

    const second = await enqueueMonthlyReports(serviceClient(), month());
    expect(second.enqueued).toBe(0);
    expect(await reportsOf(paid.businessId)).toHaveLength(1);
  });

  it("rejects any month but the previous LA month (22023), and non-service callers (42501)", async () => {
    const thisMonth = new Date(`${month()}T12:00:00Z`);
    thisMonth.setUTCMonth(thisMonth.getUTCMonth() + 1);
    await expect(enqueueMonthlyReports(serviceClient(), thisMonth.toISOString().slice(0, 10))).rejects.toMatchObject({
      code: "22023",
    });
    const user = (await selfServe("rep-caller")).user;
    for (const db of [user.db, anonClient()]) {
      for (const [fn, args] of [
        ["enqueue_monthly_reports", { p_month: month() }],
        ["claim_reports", { p_limit: 1 }],
        [
          "finish_report",
          { p_report_id: dfy.businessId, p_status: "failed", p_pdf_path: null, p_sent_to: [], p_error: null },
        ],
      ] as const) {
        expect((await loose(db).rpc(fn, args)).error?.code, fn).toBe("42501");
      }
    }
  });
});

describe("claim_reports and finish_report", () => {
  it("claims are exclusive under parallel calls", async () => {
    await drainReports();
    const a = await selfServe("rep-claim-a");
    const b = await selfServe("rep-claim-b");
    await enqueueMonthlyReports(serviceClient(), month());
    const batches = await Promise.all([claimReports(serviceClient(), 50), claimReports(serviceClient(), 50)]);
    const mine = batches.flat().filter((r) => [a.businessId, b.businessId].includes(r.business_id));
    expect(mine).toHaveLength(2);
    expect(new Set(mine.map((r) => r.report_id)).size).toBe(2);
    expect(mine.every((r) => r.attempt === 1 && r.period_start === month())).toBe(true);
  });

  it("re-claims a stale report and fails it after 3 attempts", async () => {
    await drainReports();
    const { businessId } = await selfServe("rep-stale");
    await enqueueMonthlyReports(serviceClient(), month());
    const [claimed] = (await claimReports(serviceClient(), 500)).filter((r) => r.business_id === businessId);
    const s = serviceClient();
    const stale = new Date(Date.now() - 11 * 60 * 1000).toISOString();
    must(await s.from("reports").update({ locked_at: stale }).eq("id", claimed.report_id));
    expect((await claimReports(s, 500)).find((r) => r.report_id === claimed.report_id)?.attempt).toBe(2);
    must(await s.from("reports").update({ locked_at: stale, attempts: 3 }).eq("id", claimed.report_id));
    expect((await claimReports(s, 500)).find((r) => r.report_id === claimed.report_id)).toBeUndefined();
    expect(must(await s.from("reports").select("status, last_error").eq("id", claimed.report_id).single())).toEqual({
      status: "failed",
      last_error: "Gave up after 3 attempts",
    });
  });

  it("finishes generated, sent and failed reports once, and validates path and recipients", async () => {
    await drainReports();
    const sent = await selfServe("rep-sent");
    const generated = await selfServe("rep-generated");
    const failedOne = await selfServe("rep-failed");
    await enqueueMonthlyReports(serviceClient(), month());
    const claimed = await claimReports(serviceClient(), 500);
    const idOf = (b: string) => claimed.find((r) => r.business_id === b)!.report_id;
    const s = serviceClient();

    const sentId = idOf(sent.businessId);
    await expect(
      finishReport(s, {
        reportId: sentId,
        status: "sent",
        pdfPath: `${dfy.businessId}/${sentId}.pdf`,
        sentTo: ["a@example.test"],
      }),
    ).rejects.toMatchObject({ code: "22023" });
    await expect(
      finishReport(s, { reportId: sentId, status: "sent", pdfPath: `${sent.businessId}/${sentId}.pdf`, sentTo: [] }),
    ).rejects.toMatchObject({ code: "22023" });
    expect(
      await finishReport(s, {
        reportId: sentId,
        status: "sent",
        pdfPath: `${sent.businessId}/${sentId}.pdf`,
        sentTo: ["owner@example.test"],
      }),
    ).toBe(true);
    expect(
      await finishReport(s, { reportId: sentId, status: "failed", pdfPath: null, sentTo: [], error: "late" }),
    ).toBe(false);
    expect(
      must(await s.from("reports").select("status, sent_to, sent_at, locked_at").eq("id", sentId).single()),
    ).toMatchObject({
      status: "sent",
      sent_to: ["owner@example.test"],
      sent_at: expect.any(String),
      locked_at: null,
    });

    const genId = idOf(generated.businessId);
    expect(
      await finishReport(s, {
        reportId: genId,
        status: "generated",
        pdfPath: `${generated.businessId}/${genId}.pdf`,
        sentTo: [],
      }),
    ).toBe(true);
    expect(must(await s.from("reports").select("status, sent_at").eq("id", genId).single())).toEqual({
      status: "generated",
      sent_at: null,
    });

    const failId = idOf(failedOne.businessId);
    expect(
      await finishReport(s, { reportId: failId, status: "failed", pdfPath: null, sentTo: [], error: "Resend 500" }),
    ).toBe(true);
    expect(must(await s.from("reports").select("status, last_error").eq("id", failId).single())).toEqual({
      status: "failed",
      last_error: "Resend 500",
    });
  });
});

describe("reports access", () => {
  let owner: Awaited<ReturnType<typeof selfServe>>;
  let reportId: string;

  beforeAll(async () => {
    await drainReports();
    owner = await selfServe("rep-access");
    await enqueueMonthlyReports(serviceClient(), month());
    const claimed = (await claimReports(serviceClient(), 500)).find((r) => r.business_id === owner.businessId)!;
    reportId = claimed.report_id;
    const path = `${owner.businessId}/${reportId}.pdf`;
    must(
      await serviceClient()
        .storage.from(REPORTS_BUCKET)
        .upload(path, new TextEncoder().encode("%PDF-1.4 example"), { contentType: "application/pdf" }),
    );
    await finishReport(serviceClient(), { reportId, status: "generated", pdfPath: path, sentTo: [] });
  });

  it("members list reports and get a signed download URL; strangers get nothing", async () => {
    expect(await listReports(owner.user.db, owner.businessId)).toEqual([
      expect.objectContaining({
        id: reportId,
        period_start: month(),
        status: "generated",
        recipients: 0,
        has_pdf: true,
      }),
    ]);
    expect(await getReportDownloadUrl(owner.user.db, serviceClient(), reportId)).toMatch(/^https?:\/\/.+token=/);
    const stranger = await newUser("rep-access-stranger");
    expect(await listReports(stranger.db, owner.businessId)).toEqual([]);
    expect(await getReportDownloadUrl(stranger.db, serviceClient(), reportId)).toBeNull();
  });

  it("members can't insert, update or delete reports", async () => {
    const insert = await loose(owner.user.db)
      .from("reports")
      .insert({ business_id: owner.businessId, period_start: "2020-01-01", period_end: "2020-01-31" });
    expect(insert.error?.code).toBe("42501");
    const update = await owner.user.db.from("reports").update({ status: "sent" }).eq("id", reportId).select();
    expect(update.data ?? []).toEqual([]);
    const del = await owner.user.db.from("reports").delete().eq("id", reportId).select();
    expect(del.data ?? []).toEqual([]);
    expect((await reportsOf(owner.businessId))[0].status).toBe("generated");
  });

  it("the team reads DFY reports but not self-serve ones; a dfy_client reads its own", async () => {
    expect(await listReports(team.db, owner.businessId)).toEqual([]);
    expect((await listReports(team.db, dfy.businessId)).length).toBeGreaterThanOrEqual(1);
    expect((await listReports(client.db, dfy.businessId)).length).toBeGreaterThanOrEqual(1);
    expect(await listReports(client.db, owner.businessId)).toEqual([]);
  });
});
