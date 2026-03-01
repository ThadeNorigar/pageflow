# Beads Workflow Context — PageFlow

> **Context Recovery**: Run `bd prime` nach Compaction, Clear oder neuer Session.

# SESSION CLOSE PROTOCOL

**CRITICAL**: Vor Session-Ende IMMER diese Checkliste durchgehen:

```
[ ] 1. git status              (was hat sich geändert?)
[ ] 2. git add <files>         (Code-Änderungen stagen — KEINE .env oder Secrets)
[ ] 3. bd sync                 (Beads-Änderungen committen)
[ ] 4. git commit -m "..."     (Code committen)
[ ] 5. bd sync                 (neue Beads-Änderungen committen)
[ ] 6. git push                (zum Remote pushen)
```

**NIEMALS überspringen.** Arbeit ist erst fertig wenn gepusht.

## Core Rules

- **Default**: Beads für ALLES Task-Tracking (`bd create`, `bd ready`, `bd close`)
- **Verboten**: NICHT TodoWrite, TaskCreate oder Markdown-Dateien für Task-Tracking nutzen
- **Workflow**: Bead erstellen VOR dem Coden, `in_progress` setzen beim Start
- **Forge**: `forge tunnel` für lokale Entwicklung, `forge deploy` für Deployment — NICHT direkt Node ausführen
- **Git**: Spezifische Dateien stagen — NICHT `git add -A` oder `git add .`
- **Secrets**: NIEMALS Credentials in Chat-Output — immer Platzhalter (`sk-...`, `***`)

## Essential Commands

### Arbeit finden
- `bd ready` — Issues ohne Blocker anzeigen
- `bd list --status=open` — Alle offenen Issues
- `bd list --status=in_progress` — Aktive Arbeit
- `bd show <id>` — Details mit Dependencies

### Erstellen & Updaten
- `bd create --title="..." --type=task|bug|feature --priority=2` — Neues Issue
  - Priority: 0-4 (0=critical, 2=medium, 4=backlog). NICHT "high"/"medium"/"low"
- `bd update <id> --status=in_progress` — Arbeit starten
- `bd update <id> --append-notes="..."` — Fortschritt dokumentieren
- `bd close <id> --reason="..."` — Abschließen mit Begründung
- `bd close <id1> <id2> ...` — Mehrere auf einmal schließen
- **WARNING**: NICHT `bd edit` nutzen — öffnet $EDITOR und blockiert Agents

## Quality Gate: Bead-Erstellung

**PFLICHT bei jedem `bd create`**: Jeder neue Bead MUSS sofort nach Erstellung angereichert werden. Kein Bead ohne diese 3 Felder:

### 1. Description (--description)
```
## Kontext
Warum wird das gebraucht? Was ist der aktuelle Zustand?

## Anforderung
Was genau soll gebaut werden? (1-3 Sätze)

## Akzeptanzkriterien
- [ ] Konkretes, testbares Kriterium 1
- [ ] Konkretes, testbares Kriterium 2
- [ ] ...
```

### 2. Means of Compliance (MoC) pro AK

**PFLICHT**: Jedes Akzeptanzkriterium MUSS eine Test-Methode angeben.

Erlaubte MoC-Typen:
| MoC | Wann nutzen | Beispiel |
|-----|-------------|---------|
| `Code Review` | Statisch prüfbar (Config, Manifest, Typen) | "manifest.yml hat Scope X" |
| `Unit Test` | Isolierte Logik (Services, Utils, Converter) | "convertHtml() transformiert korrekt" |
| `Integration Test` | API-Endpoints, Forge-Resolver, Storage | "POST /api/pages erstellt Seite" |
| `E2E Test` | UI-Flow, Custom UI Interaktion | "User wählt Space, klickt Import" |
| `Manual Test` | Visuelles Layout, UX-Feeling | "Dashboard zeigt Fortschritt korrekt" |

Format in Bead-Description:
```
## Akzeptanzkriterien
- [ ] Page wird erstellt (MoC: Integration Test)
- [ ] UI zeigt Fortschritt an (MoC: E2E Test)
- [ ] Converter handled Edge Cases (MoC: Unit Test)
```

### 3. Design (--design)
Technischer Ansatz in Stichpunkten:
- Betroffene Module/Resolver/Components
- Neue Dependencies
- Integrationspunkte mit bestehendem Code

### 4. Self-Check nach Erstellung
Nach `bd create` + `bd update --description/--design` prüfen:
- [ ] Hat der Bead mindestens 3 Akzeptanzkriterien?
- [ ] Sind die AK testbar (nicht vage wie "funktioniert gut")?
- [ ] Hat **jedes** AK eine MoC-Angabe?
- [ ] Ist ein technischer Design-Ansatz dokumentiert?
- [ ] Sind Dependencies zu anderen Beads gesetzt (`bd dep add`)?

**Wenn ein Check fehlt → sofort ergänzen, BEVOR weitergearbeitet wird.**

### Dependencies
- `bd dep add <issue> <depends-on>` — Dependency hinzufügen
- `bd blocked` — Blockierte Issues anzeigen

### Sync
- `bd sync` — Mit Git Remote synchronisieren (am Session-Ende)
- `bd stats` — Projekt-Statistiken

## AK-Verifikation vor Closing

**PFLICHT**: Kein Bead wird geschlossen ohne AK-Verifikation.

### Ablauf
1. `bd show <id>` → AK-Liste + MoC lesen
2. **Pro AK die definierte MoC ausführen:**
   - `Code Review` → Grep/Read der relevanten Stelle, Ergebnis dokumentieren
   - `Unit Test` → Jest mit spezifischem Test ausführen
   - `Integration Test` → Jest mit API/Resolver-Test ausführen
   - `E2E Test` → `forge tunnel` starten, Browser-Test
   - `Manual Test` → `forge tunnel` starten, im Browser prüfen
3. **Ergebnis-Tabelle erstellen** mit OK/FAIL pro AK
4. Nur wenn **alle AK bestanden** → `bd close`

### Forge Tunnel nicht verfügbar?
Wenn E2E oder Manual Tests nötig sind und Forge Tunnel nicht läuft:
```
→ User fragen: "Für AK-Verifikation brauche ich forge tunnel. Kannst du `forge tunnel` starten?"
→ NICHT die AK als "bestanden" markieren ohne tatsächlichen Test
→ NICHT den Bead schließen mit ungetesteten E2E/Manual AKs
```

### Lessons Learned
- Code Review allein reicht NICHT für UI/UX-Kriterien
- "Code existiert" ≠ "Feature funktioniert"
- AK-Prüfung ist der letzte Schritt VOR dem Closing, nicht optional

## Closing-Regeln

Gute Reasons:
- `"Converter implementiert, 12 HTML-Tags gemapped, Edge Cases getestet"`
- `"OAuth2 Provider konfiguriert, Token-Refresh verifiziert"`
- `"8/8 AK verifiziert: 4x Unit Test, 2x Integration, 2x E2E (forge tunnel)"`

Schlechte Reasons:
- `"Done"` / `"Closed"` / `"Fixed"` — NIEMALS
- `"AK geprüft per Code Review"` — wenn MoC E2E/Manual vorschreibt

Bei Abweichungen:
```bash
bd update <id> --append-notes="<was anders lief als geplant>"
bd close <id> --reason="<summary>, siehe Notes"
```
