# Goal: Kontextgerechter nächster Produktionsschritt

- Grundlage ist die reale Subscription-Probe nach PR #586.
- Ein offener KI-Entwurf darf nicht gleichzeitig zum neuen Upload auffordern.
- Der Eingabebereich besitzt den Entwurfs- und Leerzustand.
- Der globale nächste Schritt erscheint nur bei aktivem Produktionskontext.
- Aktive Rückfragen, Pläne und Einkaufslisten behalten ihre Handlungshinweise.
- Keine neue Zustandsheuristik, kein neuer Service und kein Providerlauf.

## Abnahme

1. Leerer Kontext zeigt keine doppelte oder widersprüchliche Folgeaktion.
2. Offener Entwurf bleibt die einzige sichtbare nächste Arbeit.
3. Aktiver Produktionskontext zeigt weiterhin seinen nächsten Schritt.
