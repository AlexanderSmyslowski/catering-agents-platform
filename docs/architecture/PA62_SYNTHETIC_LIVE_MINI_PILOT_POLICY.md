# PA62 Synthetic-Live Mini-Pilot Policy

Status: kleiner Runtime-/Vertragstestanker, keine neue Provider-Runtime,
keine neuen APIs, keine Persistenz, kein Deployment und keine
Produktschreibwirkung
Stand: 2026-06-07
Scope: kleinste codierte Leitplanke fuer den beschlossenen Option-2-Mini-Pilot
oberhalb des vorhandenen `synthetic_live`-Korridors

## 1. Zweck

Nach der Entscheidung fuer einen sehr kleinen echten internen Mini-Pilot reicht
der bestehende lokale `synthetic_live`-Preflight allein nicht mehr aus.

Es braucht eine kleine, maschinenlesbare Grenze dafuer, wann ein Lauf wirklich
im beschlossenen Mini-Pilot-Rahmen liegt:

- nur benannte interne Nutzer,
- nur eng begrenzter Datenrahmen,
- nur Draft-Outputs,
- Human Approval bleibt Pflicht,
- keine Schreibwirkung.

## 2. Was PA62 hinzufuegt

PA62 fuegt eine kleine Policy-Schicht ueber dem vorhandenen Preflight hinzu.

Sie bewertet lokale Env-Hinweise fuer:

- `CATERING_SYNTHETIC_LLM_MINI_PILOT`
- `CATERING_SYNTHETIC_LLM_OPERATOR_SCOPE`
- `CATERING_SYNTHETIC_LLM_DATA_SCOPE`
- `CATERING_SYNTHETIC_LLM_OUTPUT_SCOPE`
- `CATERING_SYNTHETIC_LLM_HUMAN_APPROVAL`

Der Preflight kann dadurch zusaetzlich sagen:

- ob der enge Mini-Pilot aktiv markiert ist,
- ob der Operatorrahmen bei `named_internal_operators` bleibt,
- ob der Datenrahmen bei `synthetic_demo_or_approved_internal` bleibt,
- ob der Output-Rahmen bei `draft_only` bleibt,
- ob Human Approval ausdruecklich weiter als `required` markiert ist,
- dass Write-Effects weiterhin nicht erlaubt sind.

## 3. Bewusste Grenzen

PA62 fuehrt ausdruecklich nicht ein:

- keinen neuen Providerpfad,
- keine echte Datenverarbeitung,
- keine neue Auth- oder Rollenruntime,
- keine Approval-Engine,
- keine Tool-Orchestrierung,
- keine Produktmutation,
- kein Deployment,
- keine Persistenz,
- keine Migration.

## 4. Sicherer Default

Fehlen diese Mini-Pilot-Hinweise, bleibt der vorhandene `synthetic_live`
Preflight technisch nutzbar, aber der Lauf gilt nicht als vollstaendig
mini-pilot-ready.

Der sichere Default bleibt:

- lokaler Korridor,
- produktfreie Drafts,
- Human Approval Pflicht,
- keine Schreibwirkung.
