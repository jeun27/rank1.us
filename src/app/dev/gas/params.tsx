import { Suspense, type ComponentType } from "react";

export type Query = Record<string, string | undefined>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

// Every /dev/gas page reads ?state= (and friends) on the server, so each state has its own URL and
// renders without JavaScript. searchParams needs a Suspense boundary under cacheComponents.
export function gasPage(View: ComponentType<{ q: Query }>) {
  async function Read({ searchParams }: { searchParams: SearchParams }) {
    const p = await searchParams;
    const q: Query = {};
    for (const [k, v] of Object.entries(p)) if (typeof v === "string") q[k] = v;
    return <View q={q} />;
  }
  return function GasPage({ searchParams }: { searchParams: SearchParams }) {
    return (
      <Suspense>
        <Read searchParams={searchParams} />
      </Suspense>
    );
  };
}
