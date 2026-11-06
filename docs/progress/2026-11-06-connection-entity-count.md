# X30: save each connection's entity count (data-pipeline, branch fix/connection-entity-count)

Backend's #183 (0040) adds connections.entity_count, so the hub shows "Choose …" only when there's more than one entity and never calls Google on render.

- listConnectionEntities saves entities.length with setConnectionEntityCount every time the picker list loads.
- Right after a successful connect, the entities are listed once with the fresh access token and the count is saved. This adds 1–2 Google list calls before the redirect.
- Neither ever fails the caller: a count error, or a failed listing at connect, is logged with its code only.
