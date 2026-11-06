import { describe, expect, it } from "vitest";
import { ensureSelfServeWorkspace } from "@/lib/queries/auth";
import { listFixes } from "@/lib/queries/fixes";
import { createBusinessOnboarding } from "@/lib/queries/onboarding";
import { getRunResults } from "@/lib/queries/results";
import { listRunSummaries } from "@/lib/queries/shell";
import { must, newUser, serviceClient } from "./helpers";

// The monthly report renderer reads with the service client (no auth.uid): these queries must not
// depend on the caller.
describe("report data reads with the service client", () => {
  it("getRunResults, listRunSummaries and listFixes return the business's data", async () => {
    const user = await newUser("svc-reads");
    const workspaceId = (await ensureSelfServeWorkspace(user.db))!;
    const businessId = await createBusinessOnboarding(user.db, {
      business: {
        name: "Example Ramen House",
        domain: "example-ramen.test",
        cuisine: "ramen",
        city: "Irvine",
        state: "CA",
        country: "US",
        aliases: [],
      },
      competitors: [{ name: "Example Noodle Bar", source: "manual" }],
      questions: [
        {
          short_text: "best ramen in Irvine",
          long_text: "Where is great ramen in Irvine?",
          active_form: "short",
          active: true,
          location_level: "city",
          country: "US",
          state: "CA",
          city: "Irvine",
          template_key: "1",
        },
      ],
    });
    const s = serviceClient();
    must(await s.from("workspaces").update({ subscription_status: "active" }).eq("id", workspaceId));
    const [q] = must(await s.from("questions").select("id").eq("business_id", businessId));
    const run = must(
      await s
        .from("runs")
        .insert({
          business_id: businessId,
          kind: "weekly",
          status: "complete",
          jobs_total: 1,
          jobs_ok: 1,
          started_at: new Date(Date.now() - 7200_000).toISOString(),
          finished_at: new Date(Date.now() - 3600_000).toISOString(),
        })
        .select("id")
        .single(),
    );
    const answer = must(
      await s
        .from("answers")
        .insert({
          run_id: run.id,
          question_id: q.id,
          engine: "chatgpt",
          run_index: 1,
          status: "ok",
          question_text_used: "best ramen in Irvine",
          mentioned: true,
          brands: [{ name: "Example Ramen House", kind: "business", mentioned: true, position: 1 }],
        })
        .select("id")
        .single(),
    );
    must(
      await s.from("citations").insert({
        answer_id: answer.id,
        url: "https://www.yelp.com/biz/example",
        domain: "yelp.com",
        position: 1,
        category: "review_directory",
      }),
    );
    must(
      await s.from("fix_rules").upsert(
        {
          key: "R10",
          grp: "restaurant",
          title: "Rule R10",
          size: "M-L",
          cadence: "weekly",
          customer_copy: "Copy",
          enabled: true,
        },
        { onConflict: "key", ignoreDuplicates: true },
      ),
    );
    must(
      await s.from("fixes").insert({
        business_id: businessId,
        rule_key: "R10",
        size: "M-L",
        title: "Rule R10",
        detail: "Your menu is a PDF.",
      }),
    );

    const results = (await getRunResults(s, run.id))!;
    expect(results.label).toBe("Example Ramen House");
    expect(results.brands.map((b) => b.name)).toEqual(["Example Ramen House", "Example Noodle Bar"]);
    expect(results.answers).toHaveLength(1);
    expect(results.citations.map((c) => c.domain)).toEqual(["yelp.com"]);

    const summaries = await listRunSummaries(s, businessId, 20, ["complete", "partial"]);
    expect(summaries.map((r) => r.id)).toEqual([run.id]);
    expect(summaries[0].visibility).toEqual({ value: 1, numerator: 1, denominator: 1 });

    const fixes = await listFixes(s, businessId);
    expect(fixes.ranked.map((f) => f.title)).toEqual(["Rule R10"]);
  });
});
