# Empty Purchase Success Honesty

- Reproduced in fresh production probe: after plan generation the success helper claimed Einkaufspositionen were updated while the visible purchase list was empty.
- Fix only presentation copy in the production objects panel.
- Keep the existing success copy when a purchase list has actual positions.
- Do not change planning, recipe matching, purchase calculation, exports, schemas, or services.
- Validate with focused UI/state tests, full suite/build, and diff hygiene.
