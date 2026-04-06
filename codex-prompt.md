Du bist Codex und baust exakt nach den folgenden Vorgaben das komplette Feature **„Operatives Änderungslogbuch mit Impact-Steuerung MVP 1“** in unser bestehendes Catering-Produktions-Harness-Repository ein.

**Verbindliche Projekt-Leitlinien (unverändert und bindend)**
- Produktkern bleibt deterministisch, prüfbar und auditierbar
- Kein Agent-Framework, keine KI zur Laufzeit
- Kleine echte Bausteine, keine Plattformbildung
- Alles bleibt im Operational Runtime Layer

**Grundlage**
Verwende exakt die Lieferung von GPT 5.4 (Prisma-Schema, SPEC_CHANGE_RULES, ImpactClassifier.ts, ApprovalTrigger.ts, SaveFlow.ts und die 5 Unit-Tests).

**Zwingende Korrekturen & Verbesserungen (müssen eingebaut werden):**

1. **Bessere Array-Diff in ImpactClassifier.ts**  
   Ersetze den aktuellen Array-Block in `diffJson` durch folgende Version (damit Rezept-Komponenten, Allergen-Listen etc. korrekt diffed werden):

   ```ts
   if (Array.isArray(before) && Array.isArray(after)) {
     const maxLen = Math.max(before.length, after.length);
     const arrayDiffs: RawDiff[] = [];
     for (let i = 0; i < maxLen; i++) {
       const b = before[i] as JsonValue | undefined;
       const a = after[i] as JsonValue | undefined;
       arrayDiffs.push(...diffJson(b, a, `${basePath}[${i}]`));
     }
     return arrayDiffs;
   }
   ```

2. **Echter UNIQUE-Constraint für einen OPEN ChangeSet pro Spec**  
   Füge im Prisma-Schema folgendes hinzu:

   ```prisma
   model SpecChangeSet {
     // ... alle bestehenden Felder und Relationen

     @@unique([acceptedEventSpecId, status], map: "uq_one_open_changeset_per_spec")
   }
   ```

   Und in der Beispiel-Migration (am Ende der Datei):

   ```sql
   -- Ensure exactly one OPEN change set per AcceptedEventSpec
   CREATE UNIQUE INDEX "uq_one_open_changeset_per_spec"
   ON "SpecChangeSet" ("acceptedEventSpecId")
   WHERE "status" = 'OPEN';
   ```

## Was genau zu bauen ist
- Vollständiges Prisma-Schema (inkl. aller Enums, Modelle, Indizes und der beiden Korrekturen oben) → `prisma/schema.prisma`
- Alle TypeScript-Dateien exakt wie geliefert, jedoch mit der Array-Diff-Korrektur
- Implementierung des `AcceptedEventSpecPersistenceAdapter<TDocument>` für unser aktuelles `AcceptedEventSpec`-Model (du kennst die bestehende Entity-Struktur)
- Die 5 mitgelieferten Unit-Tests + 2 zusätzliche Integrationstests:
  - `Save → FinalizeChangeSet → HardApprove` Flow
  - `Point-of-no-return` Block + Confirmation-Ack
- In der bestehenden Approval-UI (wo bereits die Freigabeblockade und Approval-Requests sichtbar sind) einen klaren Button „Änderungen zusammenfassen & speichern“ einbauen, der `finalizeChangeSet` aufruft und bei L3 automatisch den Re-Approval-Status setzt.

## Technische Anforderungen
- TypeScript strict mode
- Prisma Client vollständig nutzen
- Transaction-Safety und Optimistic Locking (`rowVersion`) beibehalten
- Logging mit dem bestehenden Logger
- Keine zusätzlichen Dependencies außer `deep-diff` ist bereits erlaubt (ansonsten keine neuen Pakete)
- Alle Dateien in sinnvoller Ordnerstruktur ablegen (z. B. `src/features/spec-governance/`)

## Ausgabe
Gib mir:
- Die komplette `prisma/schema.prisma` (mit Korrekturen)
- Die geänderten/ergänzten TypeScript-Dateien als Diff oder vollständigen Code
- Die beiden zusätzlichen Integrationstests
- Kurze Anleitung, wo genau der UI-Button eingebaut werden soll

Baue es so, dass ich es direkt per `prisma migrate dev` und `npm run build` starten kann. Keine weiteren Fragen, kein Gold-Plating.

Los geht’s.
