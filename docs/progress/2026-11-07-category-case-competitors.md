# UI3 fixes F2 + F3 (data-pipeline, branch fix/category-case-competitors)

Found by the implementer in UI3 (#214); lead, 2026-11-07.

- F2: in question text the category reads in lower case ("best plumber in Irvine"). All-caps words (HVAC, CRM) stay as written, because "best hvac contractor" and "best crm software" read wrong. This is a lead-visible judgment call. It lives in buildQuestions' fill, so the preview, step 4 and BE3's save_business_card get the same text. Keys don't include the category, so only the text moves. BE3 switches the old row off with its text byte-identical and adds the new text (db test). Nothing is rewritten.
- F3: findLocalCompetitors searches Maps with `mapsTerm`. Restaurants (or no vertical) keep "{cuisine} restaurant". A local service uses its category in lower case. Software, shops and a local business with no category make no Maps request ({ok, []}), since Maps lists local places only. The cache key is unchanged for restaurants, so existing entries still hit. Other types key on "{vertical}:{category}".
- The UI passes vertical/category through CompetitorQuery (= FindLocalCompetitorsInput), both optional. Until #214 passes them, behaviour is the old restaurant search.
