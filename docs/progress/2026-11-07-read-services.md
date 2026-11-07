# Onboarding v2 DP2: readServices (data-pipeline, branch feat/read-services, on top of DP1 #202)

Spec: share/ux-plan/onboarding-welcome/README.md §4 (Services row) and §5 DP2.

- `readServices(domain)` in `src/lib/onboarding/site-profile.ts` (stage 4) returns `{ status, services, source }`, where source is `schema | nav | sitemap | null`. The first signal with any services wins.
  - JSON-LD `makesOffer` / `hasOfferCatalog.itemListElement` (itemOffered.name, else name).
  - `<nav>` link labels minus a stoplist (Home, About, Contact, Blog, Careers, Login, Cart, FAQ, Menu, Services…).
  - Sitemap paths exactly one level under `/services/`, `/menu/`, `/treatments/`, this site only, with slugs turned into labels.
- Fetch budget: robots + home + at most one sitemap. That's robots' `Sitemap:` line, else `/sitemap.xml`, robots respected, an index never followed, and other hosts refused by the fetcher. The sitemap is fetched only when schema and nav found nothing.
- The home page is fetched again, because readServices is its own server action after readHome (no client-sent HTML).
- Services go through the same normalise step as DP1's profile (one CAP table for #199's CHECK, lead's review): non-blank, each trimmed to 100 chars, deduped case-insensitively, at most 30. DP2's earlier 12-chip cap is dropped, so the DB cap is the only one.
- Fixtures: tests/fixtures/sites/services-{nav,none}.html and services-sitemap.xml. The "both" and "schema" cases are composed in the test. No network.
