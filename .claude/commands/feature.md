Du koordinierst die Entwicklung eines neuen Features end-to-end.

## ANALYZE: Vor dem Start (IMMER!)

**Bevor du den Workflow startest, prüfe:**

### 1. Feature-Anfrage verstanden?
- [ ] WAS soll das Feature tun?
- [ ] WER ist die Zielgruppe?
- [ ] WARUM wird es gebraucht?
→ Wenn unklar: **NACHFRAGEN, nicht raten!**

### 2. Scope klar?
- [ ] Was gehört DAZU?
- [ ] Was gehört NICHT dazu?
- [ ] Gibt es Abhängigkeiten zu anderen Features?

### 3. Machbarkeit geprüft?
```bash
# Betroffene Bereiche identifizieren
ls src/resolvers/ src/frontend/components/
grep -r "<keyword>" src/ --include="*.ts" --include="*.tsx" -l
```
- [ ] Welche Module sind betroffen?
- [ ] Braucht es neue Forge Scopes?
- [ ] Externe Dependencies nötig?
- [ ] Forge-Limits beachtet?

**Erst wenn alles ✓ → Phase 1 starten!**

---

## Workflow: 7 Phasen

```
/po → /architect → /developer → /reviewer + /security → /tester → /docs
```

Rufe jeden Agenten mit dem `Skill`-Tool auf. Übergib komprimierten Kontext.

---

## Phase 1: Requirements → `/po`

```
Skill: po
Args: $ARGUMENTS
```

**Speichere komprimiert:**
```
PO: [Feature] | Prio: [M/S/C] | AK: [N]
Story: Als [Rolle] will ich [Funktion]
```

---

## Phase 2: Architektur → `/architect`

```
Skill: architect
Args: [PO-Kompakt einfügen]
```

**Speichere komprimiert:**
```
ARCH: [Feature] | Tasks: [N] | Dateien: [N]
1. [Task] - [Datei]
2. ...
```

---

## Phase 3: Entwicklung → `/developer`

```
Skill: developer
Args: Tasks: [ARCH-Tasks]
AK: [PO-Kriterien]
```

**Speichere komprimiert:**
```
DEV: Dateien: [N] | Neue Resolver: [ja/nein]
Geändert: [Liste]
Neue Resolver: [Liste]
```

---

## Phase 4: Review → `/reviewer` + `/security`

Parallel aufrufen:

```
Skill: reviewer
Args: Dateien: [DEV-Dateien] | Feature: [PO-Story]
```

```
Skill: security
Args: Dateien: [DEV-Dateien] | Resolver: [DEV-Resolver]
```

**Bei Critical/High → zurück zu Phase 3**

---

## Phase 5: Tests → `/tester` (PFLICHT!)

```
Skill: tester
Args: Dateien: [DEV-Dateien]
AK: [PO-Kriterien]
Edge Cases: [Review-Findings]
```

**NICHT ÜBERSPRINGEN!**

---

## Phase 6: Dokumentation → `/docs`

```
Skill: docs
Args: Neu: [DEV-Resolver]
Feature: [PO-Story]
Ansatz: [ARCH-Ansatz]
```

---

## Phase 7: VERIFY gegen Spec (PFLICHT!)

> "Give Claude a way to verify its work → 2-3x quality" - Boris Cherny

**Prüfe JEDE Akzeptanzkriterium aus Phase 1:**

```
## Spec-Review

### Akzeptanzkriterien aus Phase 1
- [ ] AK1: [Kriterium] → [PASS/FAIL] - [Nachweis]
- [ ] AK2: [Kriterium] → [PASS/FAIL] - [Nachweis]
- [ ] AK3: [Kriterium] → [PASS/FAIL] - [Nachweis]

### Automatische Checks
```bash
# 1. Alle Tests grün
npm test

# 2. Coverage für neue Dateien
npm test -- --coverage --collectCoverageFrom="src/<neuer_bereich>/**"

# 3. Forge Lint
forge lint

# 4. TypeScript Build
npm run build
```

### Status
- Spec erfüllt: [JA/NEIN]
- Tests: [PASS/FAIL]
- Coverage: [X%]
```

**Feature ist erst FERTIG wenn ALLE AKs erfüllt sind!**

---

## Regeln

1. Jeden Agenten mit Skill-Tool aufrufen
2. **Kompakt-Kontext** übergeben (nicht alles wiederholen)
3. Alle 7 Phasen durchlaufen
4. Critical/High Findings sofort beheben
5. Nach jeder Phase committen

## Abbruch bei

- Unklaren Requirements (Phase 1)
- Architektur-Konflikten (Phase 2)
- Critical Security Findings (Phase 4)
- Unfixbare Test-Failures (Phase 5)

---

## Feature-Anfrage

$ARGUMENTS
