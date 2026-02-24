Du behebst einen Bug mit strukturiertem Vorgehen.

> Zwischen /hotfix (kritisch, sofort) und /feature (komplex, lang).

## ANALYZE: Vor dem Start (IMMER!)

**Bevor du fixst, prüfe:**

### 1. Bug-Report verstanden?
- [ ] WAS ist das Symptom?
- [ ] WIE reproduziert man den Bug?
- [ ] WANN tritt er auf? (immer/manchmal/nach X)
→ Wenn unklar: **NACHFRAGEN, nicht raten!**

### 2. Kontext bekannt?
```bash
# Betroffene Dateien finden
grep -r "<fehlermeldung>" src/ --include="*.ts" --include="*.tsx"
grep -r "<funktion>" src/ --include="*.ts" --include="*.tsx" -l
```
- [ ] Welche Datei(en) sind betroffen?
- [ ] Resolver oder Frontend?
- [ ] Gibt es verwandte Bugs/Beads?

### 3. Reproduzierbar?
- [ ] Kann ich den Bug via `forge tunnel` reproduzieren?
- [ ] Habe ich Test-Daten dafür?

**Erst wenn alles ✓ → Triage starten!**

---

## Workflow (4 Phasen)

### Phase 1: Triage

```
BUG-TRIAGE:
- Symptom: [Was passiert]
- Erwartet: [Was sollte passieren]
- Reproduktion: [Schritte]
- Betroffene User: [Alle/Einige/Admin]
- Priorität: [HIGH/MEDIUM/LOW]
```

### Phase 2: Analyse

1. Bug reproduzieren
2. Root Cause finden
3. Scope eingrenzen

```
ROOT-CAUSE:
- Datei: [Pfad:Zeile]
- Ursache: [1-2 Sätze]
- Seit wann: [Commit/Release wenn bekannt]
```

### Phase 3: Fix + Test

1. Minimalen Fix implementieren
2. **Regression-Test schreiben** (PFLICHT!)
3. Manuell verifizieren

```typescript
// tests/<bereich>/<name>.test.ts
describe('Bug: <kurzbeschreibung>', () => {
  it('should <korrektes verhalten> after fix', async () => {
    // Arrange: Setup der Bug-Situation
    // Act: Auslösen des früheren Bugs
    // Assert: Korrektes Verhalten
  });
});
```

### Phase 4: VERIFY (PFLICHT!)

> "Give Claude a way to verify its work → 2-3x quality" - Boris Cherny

```bash
# 1. Regression-Test muss grün sein
npm test -- --testPathPattern="<test_datei>"

# 2. ALLE Tests müssen weiterhin grün sein
npm test

# 3. TypeScript Build
npm run build

# 4. Forge Lint
forge lint
```

**Bug ist erst GEFIXT wenn:**
- [ ] Fix implementiert
- [ ] Regression-Test geschrieben
- [ ] ALLE Tests grün
- [ ] Commit mit `fix:` Prefix

---

## Commit-Format

```
fix(<scope>): <kurze Beschreibung>

Problem: <Was war kaputt>
Ursache: <Warum>
Fix: <Was wurde geändert>

Fixes bd-<Bead-ID>
```

---

## LEARN: Agenten-Learnings

### Forge-spezifisch
- **NICHT**: Bugs nur lokal testen
- **RICHTIG**: Via `forge tunnel` im echten Confluence testen

### Async Bugs
- **NICHT**: Race Conditions ignorieren
- **RICHTIG**: Async/await korrekt verwenden, Promises nicht vergessen

<!-- NEUE LEARNINGS HIER EINFÜGEN -->

---

## Bug-Report

$ARGUMENTS
