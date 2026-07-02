# Production UI Hidden File Input A11y

## Ziel
Im kompakten Eingabemodus soll kein nativer englischer File-Input vor dem sichtbaren deutschen Button in der Accessibility-Struktur erscheinen.

## Umfang
- Versteckten kompakten File-Input aus der Lesereihenfolge nehmen
- Sichtbarer Button bleibt der bedienbare Einstieg
- Bestehenden Panel-Test um die Accessibility-Attribute ergaenzen

## Nicht in dieser Einheit
- Keine Upload-Logik aendern
- Kein Drag-and-drop-Verhalten aendern
- Kein Layout-Redesign

## Abnahme
- Kompakter Hidden-Input hat `aria-hidden`
- Kompakter Hidden-Input hat `tabIndex=-1`
- Upload-Panel-Tests, Build und Gate bleiben gruen
