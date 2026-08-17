# Quantity Recommendation v1 — TDD-Nachweis

Stand: GREEN auf Branch `feature/quantity-recommendation-v1`; PR #622 offen und Draft.

## Zweck

Der Slice ergänzt eine deterministische, evidenzgestützte Mengenempfehlung vor der bestehenden Quantity-Decision-Freigabe. Er erzeugt einen konkreten empfohlenen Wert plus professionellen Mengenkorridor und niemals eine automatische Küchenfreigabe.

Nicht Teil dieses Slices sind User Quantity Override & Bidirectional Recalculation sowie Nonlinear Production Scaling & Experience Learning; diese sind in der Design-Spec als verpflichtende Folgeslices festgehalten.

## RED

RED-Head: `d2a4d4822ba2b5d028a67f9b89bec9d92a0465b3`.
CI Run: `32065102369` (#2495).

`build-and-test` scheiterte im Build erwartungsgemäß am fehlenden öffentlichen `recommendQuantity`-Export. Die beiden `implicit any`-Meldungen in der neuen Testdatei waren Folge des fehlenden Rückgabetyps.

## GREEN

Code-Head: `6cd69f36bb32b19c6e9e6cdce4fd7cf780548350`.
CI Run: `32065314964` (#2497).

Ergebnis:

- Build: SUCCESS;
- `tests/quantity-recommendation.test.ts`: 12/12 grün;
- Vollsuite: 341 Testdateien bestanden, 1 übersprungen;
- 2.064 Tests bestanden, 14 übersprungen;
- 0 fehlgeschlagen;
- `build-and-test`: SUCCESS;
- `browser-rehearsal`: SUCCESS.

## Implementierter Vertrag

- konkrete Empfehlung plus professioneller Korridor;
- kompatible Evidenz wird nach Basis, Gerichtsrolle und Serviceformat gefiltert;
- mehrere kompatible Korridore werden über ihre Schnittmenge zusammengeführt;
- widersprüchliche Korridore liefern `conflicting_evidence` statt erfundener Mittelwerte;
- fehlende Evidenz liefert `evidence_insufficient` ohne Zahl;
- explizite Anpassungen sind benannt, nachvollziehbar und auf den belegten Korridor begrenzt;
- professionelle Referenz- und Operator-Empfehlungen erzeugen ausschließlich `kitchen_review_required`-Kandidaten;
- keine Safety-, Yield-, Shrinkage-, Procurement- oder Overproduction-Multiplikatoren;
- bestehende Quantity Decision-, Quantity→Recipe- und ProductionBatch-Verträge bleiben unverändert.

Nach diesem Dokumentationscommit ist ein frischer CI-Lauf auf dem finalen Head erforderlich.
