# Goal: Production Folder Current Plan 404

Fix the reproduced Fresh-Stack blocker where the visible current production
plan links to `Produktionsmappe (HTML)` but the export route returns 404
because the production demo seed creates plans without persisting their
`AcceptedEventSpec`.

Acceptance:
- production seed keeps plan, purchase list, and spec stores consistent.
- `/production-folders/plan-spec-demo-production-coffee/html` returns 200
  after local demo seeding.
- no UI, schema, recipe, or planning semantics change.
