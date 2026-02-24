Du bist jetzt im Hotfix-Modus für kritische Produktions-Bugs.

## Priorität

SCHNELLIGKEIT + SICHERHEIT. Kein Over-Engineering, minimaler Fix.

## ANALYZE: Schnell-Check (30 Sek!)

**Auch bei Hotfixes kurz prüfen:**

- [ ] WAS ist kaputt? (Symptom klar?)
- [ ] WO tritt es auf? (Resolver/Frontend/Manifest?)
- [ ] Reproduzierbar via `forge tunnel`?

→ Wenn KOMPLETT unklar: **30 Sek Nachfrage**, dann los!

---

## Hotfix-Workflow

### 1. Triage (2 Min)
- Was ist kaputt?
- Wer ist betroffen?
- Workaround möglich?

### 2. Reproduzieren (5 Min)
- Bug via `forge tunnel` reproduzieren
- `forge logs` prüfen für Runtime-Errors
- Minimal Case identifizieren

### 3. Fix (10-15 Min)
- Kleinster möglicher Fix
- Keine Refactorings
- Keine "Verbesserungen"

### 4. VERIFY (SCHNELL aber GRÜNDLICH!)

> "Give Claude a way to verify its work → 2-3x quality" - Boris Cherny

```bash
# 1. Fix funktioniert
npm test -- --testPathPattern="<test_für_fix>"

# 2. Keine Regression (KRITISCH!)
npm test

# 3. Build OK
npm run build

# 4. Forge Lint
forge lint
```

**Hotfix ist erst VERIFIZIERT wenn:**
- [ ] Fix lokal getestet
- [ ] KEINE Regression (alle Tests grün!)
- [ ] Build + Lint OK

### 5. Deploy
- `forge deploy` (Staging)
- Verifizieren in Staging
- `forge deploy -e production`

## Regeln

- **NUR den Bug fixen** - nichts anderes
- **Kein Refactoring** - das kommt später
- **Minimale Änderungen** - weniger ist mehr
- **Sofort testen** - nicht erst am Ende

## Hotfix-Commit-Format

```
hotfix: [kurze Beschreibung]

Problem: [Was war kaputt]
Ursache: [Warum]
Fix: [Was wurde geändert]

Fixes bd-<Bead-ID>
```

## TODO-Vermerke

Bei temporären Fixes IMMER TODOs:

```typescript
// TODO(hotfix): [Kurzbeschreibung] - TEMPORÄR
//   Was: [Eigentliche Lösung]
//   Warum: [Warum Workaround]
//   Prio: HIGH
//   Bead: bd-<ID>
```

## Kritischer Bug

$ARGUMENTS
