# Projekt: PageFlow

> Diese Datei ist der zentrale Kontext für Claude Code. Sie wird bei jeder Konversation geladen.

---

## Arbeitsweise (Token-Optimierung)

**WICHTIG: Diese Regeln gelten für alle Interaktionen.**

### Kommunikation
- **Kurz und präzise** - Keine langen Erklärungen, direkt zur Sache
- **Nachfragen statt raten** - Bei Unklarheiten IMMER nachfragen
- **Keine Wiederholungen** - Nicht wiederholen was der User gesagt hat
- **Keine Floskeln** - Kein "Gerne!", "Natürlich!", "Das ist eine gute Frage!"

### Vor jeder Aktion
1. Ist die Anforderung klar? → Wenn nein: **Nachfragen**
2. Gibt es mehrere Wege? → **Nachfragen** welcher gewünscht ist
3. Bin ich unsicher? → **Nachfragen** statt Annahmen treffen

### Code-Ausgabe
- Nur geänderte Teile zeigen, nicht komplette Dateien
- Keine erklärenden Kommentare im Code, außer explizit gewünscht
- Keine Beispiel-Outputs, außer explizit gewünscht

### Subagent-Disziplin
- **Subagent-Output cappen:** Jeder Subagent-Prompt enthält: "Antwort unter 2000 Zeichen. Liste Ergebnisse, nicht den Prozess."
- **Nie TaskOutput doppelt aufrufen.** Timeout → Timeout erhöhen, nicht re-readen.
- **Keine Datei-Inhalte in Subagent-Prompts pasten** — Pfad geben, Subagent liest selbst.
- **Grep vor Read.** Große Dateien (>500 Zeilen) mit offset/limit lesen.
- **Nach jeder Phase committen.** Git History = Gedächtnis zwischen Phasen.
- **Qualitäts-Regeln in den Subagent-Prompt**, nicht nur in den Orchestrator.

### Antwortformat
```
[Kurze Bestätigung was gemacht wird]
[Aktion/Code]
[Nur bei Bedarf: Nächster Schritt oder Frage]
```

---

## Was ist PageFlow?

PageFlow ist eine **Atlassian Forge App** für den Confluence Marketplace, die Content-Migration nach Confluence ermöglicht:

- **OneNote Cloud** → Confluence (via Microsoft Graph API)
- **PDF/Dateien** → Confluence (via Drag&Drop Upload)
- **Ordnerstrukturen** → Confluence-Seitenhierarchien

### Zielgruppe
- Confluence-Administratoren und Teams, die von OneNote/SharePoint nach Confluence migrieren
- Unternehmen mit großen OneNote-Beständen

### Kernfunktionen
1. OneNote Notebooks/Sections/Pages lesen (MS Graph API + OAuth2)
2. Lokaler OneNote-Import (HTML-Export aus OneNote Desktop)
3. Inhalte konvertieren (OneNote HTML → Confluence Storage Format)
4. Confluence-Seiten erstellen mit korrekter Hierarchie
5. Attachments hochladen und verlinken
6. Batch-Migration mit Fortschrittsanzeige
7. PDF-Import mit optionaler Textextraktion

---

## Tech-Stack

- **Runtime**: Node.js 22.x
- **Sprache**: TypeScript (strict mode)
- **Framework**: Atlassian Forge SDK
- **Frontend**: React (Custom UI) + Atlassian Design System (ADS)
- **Backend**: Forge Resolvers (serverless functions)
- **Storage**: Forge Storage API (key-value)
- **APIs**: Confluence REST API, Microsoft Graph API
- **Auth**: Forge OAuth2 Providers (für MS Graph)
- **Testing**: Jest (Resolver, node) + @testing-library/react auf jsdom (Frontend)
- **Linting**: ESLint + Prettier

## Projektstruktur

```
PageFlow/
├── manifest.yml                 # Forge App manifest (Scopes, Modules, Permissions)
├── package.json                 # Root package
├── tsconfig.json                # TypeScript config
├── jest.config.js               # Jest config
├── .eslintrc.js                 # ESLint config
├── .prettierrc                  # Prettier config
├── webpack.config.js            # Webpack config (Frontend build)
├── src/
│   ├── index.ts                 # Forge handler entry (re-exports resolvers)
│   ├── resolvers/               # Forge Backend (Lambda functions)
│   │   ├── index.ts             # Resolver registration
│   │   ├── confluence/          # Confluence API integration
│   │   │   ├── types.ts         # Shared interfaces (Space, Page, etc.)
│   │   │   ├── spaces.ts        # Space listing/selection
│   │   │   ├── pages.ts         # Page browsing/hierarchy
│   │   │   ├── createPage.ts    # Seite erstellen (v2 API)
│   │   │   └── attachments.ts   # Attachment upload
│   │   ├── onenote/             # OneNote/MS Graph integration
│   │   │   ├── auth.ts          # OAuth2 token management
│   │   │   ├── notebooks.ts     # Notebook/Section/Page browsing
│   │   │   ├── import.ts        # OneNote page import (Graph → Confluence)
│   │   │   ├── localImport.ts   # Local OneNote HTML import (Desktop export)
│   │   │   ├── htmlToText.ts    # HTML→text + Storage Format conversion
│   │   │   └── converter.ts     # OneNote HTML → Storage Format (+ local img paths)
│   │   ├── migration/           # Migration engine
│   │   │   ├── engine.ts        # Batch processing + progress
│   │   │   ├── queue.ts         # Job queue management
│   │   │   └── mapping.ts       # Structure mapping logic
│   │   ├── export/              # PDF export
│   │   │   ├── storageParser.ts # Confluence Storage Format → ContentBlocks
│   │   │   └── pageContent.ts   # Page body fetcher (v2 API + parser)
│   │   ├── pdf/                 # PDF processing
│   │   │   └── processor.ts     # PDF attachment + text extraction
│   │   └── storage/             # Forge Storage abstraction
│   │       └── config.ts        # Settings/config persistence
│   └── frontend/                # React Custom UI
│       ├── index.tsx            # App entry point
│       ├── App.tsx              # Main app component
│       ├── types.ts             # Shared frontend types (SpaceSelection)
│       ├── components/          # Reusable UI components
│       │   ├── SpaceDropdown.tsx # Filterable space dropdown
│       │   ├── PageTree.tsx     # Page tree with lazy-loading (target selection)
│       │   ├── Tabs.tsx         # Tab navigation (PDF Import, OneNote, Local OneNote, PDF Export)
│       │   ├── BatchImportPDF.tsx # Folder-based batch PDF import
│       │   ├── LocalOneNoteImport.tsx # Local OneNote HTML export import
│       │   ├── ImportButton.tsx # OneNote import trigger with progress
│       │   ├── BatchExportPDF.tsx # Batch PDF export with stationery
│       │   ├── ExportPageTree.tsx # Checkbox-based page selection tree
│       │   ├── SpaceBrowser.tsx  # Legacy space/page browser (deprecated)
│       │   ├── NotebookBrowser.tsx # OneNote notebook tree
│       │   ├── FileUpload.tsx   # Single-file PDF upload (legacy)
│       │   ├── MigrationDashboard.tsx # Progress overview
│       │   └── Settings.tsx     # Configuration UI
│       ├── hooks/               # Custom React hooks
│       │   ├── useForge.ts      # @forge/bridge wrapper
│       │   └── useMigration.ts  # Migration state management
│       └── utils/               # Frontend utilities
│           ├── folderTree.ts    # Folder tree building from webkitdirectory (.pdf/.htm)
│           ├── colors.ts        # Centralized ADS color constants
│           ├── tabs.ts          # Tab definitions and validation
│           ├── pdfExport.ts     # pdf-lib PDF generation + stationery overlay
│           ├── spaceFilter.ts   # Space search/filter logic
│           └── format.ts        # Formatting helpers
├── tests/                       # Test files (mirror src/ structure)
│   ├── resolvers/
│   └── frontend/
├── agents.json                  # Agent-Definitionen
├── .beads/                      # Beads workflow
│   └── PRIME.md                 # Workflow guide
└── .claude/
    └── commands/                # Agent command files
```

## Wichtige Befehle

```bash
# Forge CLI
forge tunnel                    # Lokale Entwicklung (Hot-Reload)
forge deploy                    # Deployment (Staging)
forge deploy -e production      # Deployment (Production)
forge install                   # App in Confluence installieren
forge install --upgrade         # App-Installation upgraden
forge lint                      # Manifest + Code validieren
forge logs                      # Runtime-Logs anzeigen
forge environments list         # Environments anzeigen

# Development
npm install                     # Dependencies installieren
npm run build                   # TypeScript kompilieren
npm test                        # Jest Tests ausführen
npm run lint                    # ESLint ausführen
npm run format                  # Prettier ausführen

# Beads
bd ready                        # Nächste Tasks anzeigen
bd list --status=open           # Alle offenen Tasks
bd show <id>                    # Task-Details
bd dolt push                    # Beads zum Dolt-Remote pushen (frueher: bd sync)
```

## Forge-Spezifika

### manifest.yml
- Definiert App-Scopes (read:confluence-content.all, read:confluence-space.summary, read:space:confluence, read:page:confluence, read:folder:confluence, write:confluence-file, write:page:confluence, write:attachment:confluence)
- Module: `confluence:globalPage` für Hauptseite, `confluence:spacePage` für Space-Kontext
- Providers: Microsoft Graph OAuth2 für OneNote-Zugriff (`api.asUser().withProvider()`)
- Remotes: microsoft-login (login.microsoftonline.com), microsoft-graph (graph.microsoft.com)
- external.fetch: Backend-Zugriff auf beide Remotes

### Forge Storage
- Key-Value Store für App-Konfiguration
- Max 32KB pro Value, 128 Zeichen pro Key
- Quota: 100MB pro App-Installation

### Forge Limits
- Lambda: 25s Timeout, 128MB Memory
- Custom UI Bundle: 15MB max
- API Rate Limits: ~100 req/s pro Tenant

### Custom UI Bridge
- `@forge/bridge` für Kommunikation Frontend ↔ Resolver
- `invoke()` für Resolver-Aufrufe
- `getContext()` für Confluence-Kontext (Space, Page, etc.)

## Learnings (Fehler vermeiden)

### Forge-spezifisch

- **NICHT**: `fetch()` direkt im Resolver für Atlassian APIs
- **RICHTIG**: `@forge/api` mit `requestConfluence()` / `requestJira()`

- **NICHT**: Secrets im Code oder manifest.yml
- **RICHTIG**: `forge variables set` für Environment Variables

- **NICHT**: `console.log()` im Production-Code
- **RICHTIG**: Forge Logger oder entfernen

### TypeScript

- **NICHT**: `any` Types verwenden
- **RICHTIG**: Strikte Typisierung, Interfaces definieren

- **NICHT**: `// @ts-ignore` ohne Begründung
- **RICHTIG**: Korrekte Type Assertions oder Generics

### Allgemein

- **NICHT**: `git add -A` oder `git add .`
- **RICHTIG**: Spezifische Dateien stagen

- **NICHT**: Secrets/Credentials im Code
- **RICHTIG**: Environment-Variablen via `forge variables`

### Externe Integrationen: kein Release ohne Prod-Beweis

Gelernt aus dem OneNote-OAuth-Ausfall (Aug 2026): Die Integration lief in Development, in Production war nie ein Client Secret gesetzt. Der erste echte Test war ein zahlender Marketplace-Kunde.

- `forge providers` kennt **nur** `configure` — kein `list`, kein `status`. Ob ein Secret in einem Environment gesetzt ist, laesst sich **nicht auslesen**. Der End-to-End-Test ist der einzige Beweis.
- Development beweist nichts fuer Production: Secrets, Installationen und Provider-Config sind pro Environment getrennt.
- Eine externe Integration gilt erst als fertig, wenn der Flow **in Production gegen ein echtes Fremdsystem** durchlaufen wurde. Nicht Unit-Tests, nicht Dev.
- Ist der Test nicht durchfuehrbar (fehlendes Konto, fehlender Tenant), lautet die Meldung **"ungetestet in Production, nicht releasen"** — niemals "fertig".
- Betriebswissen zu externen Providern (Tenant-Besitzer, App-IDs, Secret-Ablaufdaten) gehoert ins Repo unter `docs/runbooks/`, nicht nur ins Session-Memory. Beim Projekt-Rename ging genau diese Information verloren.

### Credentials im Chat (ZERO TOLERANCE)

- **NIEMALS** Credentials/API Keys/Passwörter/Tokens in Chat-Antworten ausgeben
- **IMMER** Platzhalter verwenden: `sk-...`, `***`, `<your-key-here>`

## Commands

Commands kommen aus drei Ebenen (höhere überschreibt niedrigere bei gleichem Namen):

| Ebene | Pfad | Beschreibung |
|-------|------|-------------|
| **User-Global** | `~/.claude/commands/` | Generische Commands für alle Projekte (synced via K2SO) |
| **Projekt** | `.claude/commands/` | Projekt-spezifische Commands (nur hier gültig) |

**Neuen Command anlegen:**
- Für ALLE Projekte nützlich → `K2SO/.claude/commands-global/<name>.md` (wird via Symlink zu User-Global)
- Nur für DIESES Projekt → `.claude/commands/<name>.md`
- **Nie** generische Commands ins Projekt kopieren — die kommen automatisch via User-Global


<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:6cd5cc61 -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/SYNC_CONCEPTS.md for details and anti-patterns.

## Agent Context Profiles

The managed Beads block is task-tracking guidance, not permission to override repository, user, or orchestrator instructions.

- **Conservative (default)**: Use `bd` for task tracking. Do not run git commits, git pushes, or Dolt remote sync unless explicitly asked. At handoff, report changed files, validation, and suggested next commands.
- **Minimal**: Keep tool instruction files as pointers to `bd prime`; use the same conservative git policy unless active instructions say otherwise.
- **Team-maintainer**: Only when the repository explicitly opts in, agents may close beads, run quality gates, commit, and push as part of session close. A current "do not commit" or "do not push" instruction still wins.

## Session Completion

This protocol applies when ending a Beads implementation workflow. It is subordinate to explicit user, repository, and orchestrator instructions.

1. **File issues for remaining work** - Create beads for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **Handle git/sync by active profile**:
   ```bash
   # Conservative/minimal/default: report status and proposed commands; wait for approval.
   git status

   # Team-maintainer opt-in only, unless current instructions forbid it:
   git pull --rebase
   git push
   git status
   ```
5. **Hand off** - Summarize changes, validation, issue status, and any blocked sync/commit/push step

**Critical rules:**
- Explicit user or orchestrator instructions override this Beads block.
- Do not commit or push without clear authority from the active profile or the current user request.
- If a required sync or push is blocked, stop and report the exact command and error.
<!-- END BEADS INTEGRATION -->
