"""One-use, hash-bound memory integration. No network or Git writes."""
import hashlib
import re

P = 'f6b04e43fec5a243b938cc6f3d01a00450288f87'
M = '8de2e96c8604f12da2ec14c39b187db04dfb61cf'
HASHES = ('ed04159d13e4bf82c5733294d03e3f92cace166e', '0bf35a9843c13c32336d2c1f2ab5a5cce79d4235', 'aa29736c8d051ed5654ce9245114d62cb25f9c85')

def blob(b):
    return hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()

def normalized(b):
    t = b.decode('utf-8')
    if not t.startswith('# memory.md\n') or not t.endswith('\n') or '\r' in t:
        raise ValueError('unexpected memory format')
    t, n = re.subn(r'^version: \d+\.\d+$', 'version: HEADER', t, count=1, flags=re.M)
    t, d = re.subn(r'^date: \d{4}-\d{2}-\d{2}$', 'date: HEADER', t, count=1, flags=re.M)
    if (n, d) != (1, 1): raise ValueError('unexpected header')
    return t.splitlines(keepends=True)

def subsequence(a,b):
    it = iter(b)
    return all(any(x == y for y in it) for x in a)

def resolve(base, product, main):
    if tuple(map(blob,(base,product,main))) != HASHES:
        raise ValueError('source hash drift')
    if not main.startswith(base): raise ValueError('main was not append-only')
    suffix = main[len(base):]
    if suffix.count(b'\n') != 27: raise ValueError('unexpected main delta')
    if not subsequence(normalized(base), normalized(product)):
        raise ValueError('product lost common history')
    t = product.decode('utf-8').replace('version: 5.394\n', 'version: 5.395\n', 1).replace('date: 2026-09-20\n', 'date: 2026-09-21\n', 1)
    t += '\n## Übernommener main-Nachtrag: technischer Übergang\n\n'
    t += f'Quelle: `{M}`. Der folgende Betriebsbericht bleibt unverändert; seine historische Version 5.393 ist vom Produkt-Eintrag 5.393 getrennt. Kein neuer Live-Nachweis dieses Produktstrangs.\n'
    t += suffix.decode('utf-8')
    t += '\n### 5.395 - 2026-09-21 — PR682 main-Abgleich\n\n'
    t += f'- Begrenzte Zusammenführung von Produkt `{P}` und main `{M}`; vollständige Memory-Historien und ursprüngliche Versionsnummern mit getrennter Herkunft erhalten. Kein Reset auf main, keine erneute Übernahme von #694.\n'
    t += '- Der unveränderte Produktelternstand bestand den gezielten Actions-Lauf 35540397099: Typecheck/Build und 169 Tests in vier Dateien. Dies ersetzt keine reguläre CI des neuen Integrationsbaums; deren Ergebnis bleibt bis zum tatsächlichen Abschluss offen.\n'
    t += '- Versionierte Fortsetzung und Quellenbindung: `docs/agent-memory/2026-09-21-gate-c-main-integration.md`. Eingehende Betriebsdokumentation aus #697 wird nur als Quellenstand erhalten, nicht als neuer Serverzugriff oder Produktdeployment ausgegeben.\n'
    t += '- Vor Merge von #682 nach main weiterhin HALT. Weder Alt- noch Zielserver aktualisieren. Alter `Deploy production`-Weg mit `zeiterfassung_default`/alter Compose-Kette nicht für den neuen Server freigegeben; eigenständigen Updateweg vor erstem Produktdeployment gesondert prüfen und DB-, Netzwerk-, Zugangs- und Backupkonfiguration erhalten. Kein Gate-C-Gesamt-GO, Echtdaten- oder kostenpflichtiger Providerlauf.\n'
    t += '- Vier npm-Advisories bleiben paketbezogen ungeprüft. Reale Küchenprüfung und fachliche Freigaben bleiben offen. Kein separater Dokumentations-PR, keine zusätzliche Vollsuite allein für Dokumentation und kein behaupteter lokaler Hub-Writeback.\n'
    result=t.encode('utf-8')
    if not all(subsequence(normalized(x),normalized(result)) for x in (base,product,main)):
        raise ValueError('history conservation failed')
    if any(re.match(r'^(<<<<<<<|=======|>>>>>>>)',line) for line in t.splitlines()):
        raise ValueError('conflict marker')
    return result
