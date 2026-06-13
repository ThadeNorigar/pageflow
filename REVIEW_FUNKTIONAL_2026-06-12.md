# PageFlow — Funktionales Review (Live-Test mit Playwright)

**Datum:** 2026-06-12
**Reviewer:** K-2SO (Claude Code)
**Methode:** Live-Test auf `adrianphilipp.atlassian.net` (Development- UND Production-Environment), Code-Analyse, lokale Reproduktion der Fehler.
**Ergänzt:** `REVIEW_2026-06-12.md` (Security/Projekt-Review vom selben Tag).

---

## Executive Summary (30 Sekunden)

1. **PDF-Export-Pipeline ist die Baustelle.** 4 unabhängige Root Causes gefunden, alle reproduziert:
   - Emojis/Pfeile/Sonderzeichen → **kompletter Export crasht** („WinAnsi cannot encode")
   - Jedes Confluence-Makro/Layout → **„[Nicht darstellbarer Inhalt]"** (9× im Test-PDF mit 7 Seiten)
   - HTML-Entities (`&rarr;`, `&eacute;`) **landen wörtlich im PDF**
   - Tabellen werden als `Text | Text`-Zeilen gerendert, Seitentitel fehlen komplett
2. **„Funktioniert in anderer Instanz nicht"** konnte hier NICHT reproduziert werden — Dev- und Prod-App laufen beide auf der eigenen Site. 4 Hypothesen unten; brauche das konkrete Symptom + `forge install list` (Forge-Login ist abgelaufen!).
3. **Keine Bedienungsanleitung in der UI.** Alle 4 Tabs setzen voraus, dass der Nutzer den Workflow kennt. Konkreter Textvorschlag pro Tab unten.
4. **Marketplace-Screenshots erstellt:** `docs/marketplace/marketplace-1..4.png`.

---

## TEIL A — Was das Tool können SOLLTE (Soll-Zustand)

| Tab | Versprechen | Ist-Zustand (Live-Test) |
|-----|-------------|------------------------|
| **PDF Import** | Ordner mit PDFs → Confluence-Seiten mit Attachment + Viewer-Makro | ✅ funktioniert (frühere Tests), ⚠️ Filename-Injection offen (S-2) |
| **OneNote Import** | OneNote Cloud (MS Graph) → Confluence-Seiten inkl. Bilder | ⚠️ Seiten ja, **Bilder fehlen** (bekanntes TODO `import.ts:39`) |
| **Local OneNote** | OneNote-Desktop-HTML-Export → Confluence inkl. lokale Bilder | ✅ funktioniert laut früheren Tests |
| **PDF Export** | Confluence-Seiten → **gut aussehendes** PDF, optional Briefpapier | ❌ **liefert unformatierten Text-Dump, crasht bei Sonderzeichen** |

---

## TEIL B — PDF-Export: Warum es scheitert (4 Root Causes, alle belegt)

Testlauf: 7 Seiten aus Space „KI Knowledge Hub" exportiert → 12-seitiges PDF (`docs/review-evidence/export-2026-06-12.pdf`).

### F-1 (KRITISCH): „Export failed" bei Emojis/Sonderzeichen — reproduziert
- **Datei:** `src/frontend/utils/pdfExport.ts:96` (StandardFonts.Helvetica) + `:78` (drawText)
- **Beweis (lokal reproduziert):**
  ```
  Emoji-FEHLER: WinAnsi cannot encode "✅" (0x2705)
  Pfeil-FEHLER: WinAnsi cannot encode "→" (0x2192)
  ```
- **Mechanik:** pdf-lib Standard-Fonts können nur WinAnsi (≈ Latin-1). EIN Emoji/Pfeil/Häkchen auf EINER von 50 Seiten → Exception → `catch` in `BatchExportPDF.tsx:110` → **gesamter Export weg**. Das ist der „Content konnte nicht exportiert werden"-Fehler.
- **Fix:** Unicode-TTF-Font einbetten (z. B. Noto Sans via `@pdf-lib/fontkit`) ODER mindestens Sanitizer, der nicht-encodierbare Zeichen ersetzt statt zu crashen. **OSS-Check:** `fontkit` + Noto ist der etablierte Weg mit pdf-lib; Eigenbau-Sanitizer nur als Notlösung.
- **Confidence:** 100 % (reproduziert).

### F-2 (KRITISCH): Jedes Makro/Layout → „[Nicht darstellbarer Inhalt]"
- **Datei:** `src/resolvers/export/storageParser.ts:82` + `:74`
- **Mechanik:** Der Regex-Parser kennt nur `h1-6, p, ul, ol, table`. ALLES andere (`ac:structured-macro`, `ac:layout`, `ac:image`, `div`, Code-Blöcke, Info-Panels, Task-Listen, Bilder) wird zu `placeholder`.
- **Verschärfung:** Seiten aus dem **neuen Confluence-Editor** wrappen Inhalt oft in `ac:layout` → der Regex schluckt **die komplette Seite** als EINEN Placeholder. Im Test-PDF: **9× „[Nicht darstellbarer Inhalt]"**, 2 Seiten praktisch leer (siehe `docs/review-evidence/evidence-pdf-page1.png`, Thumbnails Seite 2-3).
- **Bonus-Bug:** Non-greedy Regex bricht bei verschachtelten gleichen Tags (`<div><div>…</div></div>` → schließt beim ersten `</div>`).
- **Fix:** Regex-Parser ersetzen durch echten XML/HTML-Parser (`htmlparser2` — ist klein, läuft im Resolver). Layout-Container (`ac:layout*`, `div`) **durchlaufen** statt verschlucken; bekannte Makros sinnvoll mappen (Code-Makro → monospace Block, Panel → Absatz, Bild → Platzhalter mit Dateiname).
- **Confidence:** 95 %.

### F-3 (HOCH): HTML-Entities landen wörtlich im PDF
- **Datei:** `src/resolvers/export/storageParser.ts:10-17` (`decodeEntities` — handgepflegte 25-Einträge-Liste)
- **Beweis:** Test-PDF enthält wörtlich `Text &rarr; Bild` und `K2SO Caf&eacute;`.
- **Fix:** Lib statt Eigenbau — `entities` (npm, von htmlparser2-Team) decodiert alles inkl. numerischer Refs korrekt (auch > 0xFFFF, was `String.fromCharCode` in Zeile 19-20 falsch macht).
- **Confidence:** 100 % (im PDF sichtbar).

### F-4 (HOCH): Layout-Qualität — „vollkommen unformatiert"
- **Dateien:** `src/frontend/utils/pdfExport.ts`
- **Befunde aus dem Test-PDF:**
  1. **Seitentitel wird nie gerendert** — `generatePdf` ignoriert `p.title` komplett. Seiten ohne eigenes H1 beginnen mit nacktem Fließtext; im Sammel-PDF ist unsichtbar, wo eine Seite anfängt.
  2. **Tabellen als Pipe-Text:** `Space | Z-Image Turbo` als Fließtext-Zeilen (pdfExport.ts:147-152). Keine Spalten, keine Rahmen, Header nicht unterscheidbar.
  3. Kein Inline-Formatting (bold/italic/links gehen verloren — `stripTags`), keine Seitennummern, kein Inhaltsverzeichnis, keine Trennung zwischen Confluence-Seiten.
- **Fix-Empfehlung (OSS-first):** Statt pdf-lib-Eigenbau das Rendering auf **`pdfmake`** oder **`@react-pdf/renderer`** umstellen — beide können Tabellen, Styles, TOC, Unicode-Fonts out of the box. pdf-lib ist ein Low-Level-Tool; das hier ist ein Layout-Problem, das andere schon gelöst haben. Aufwand-Alternative (klein): Titel als H1 rendern + Tabellen mit echten Spaltenbreiten zeichnen + Seitenumbruch pro Confluence-Seite mit Trennlinie.
- **Confidence:** 100 % (PDF liegt vor).

### F-5 (MITTEL): Fehler werden verschluckt → falsche „Erfolg"-Meldung
- **Datei:** `src/frontend/components/BatchExportPDF.tsx:83-90`
- **Mechanik:** Wenn `getPageBody` fehlschlägt (403, Rate-Limit, 25s-Timeout), wird still ein Placeholder eingefügt und am Ende „7 pages exported ✓" gemeldet — obwohl Seiten fehlen. **Genau das maskiert Berechtigungsprobleme in fremden Instanzen.**
- **Fix:** Fehler pro Seite sammeln und im Done-Screen ausweisen („5 exportiert, 2 fehlgeschlagen: <Titel>: <Grund>").

---

## TEIL C — „In anderer Instanz funktioniert es nicht"

**Nicht reproduzierbar auf der eigenen Site:** Dev-App UND Prod-App (`142c1833…`) laden beide, Spaces erscheinen, Export läuft. Das Problem liegt also an der anderen Instanz selbst. Hypothesen nach Wahrscheinlichkeit:

| # | Hypothese | W'keit | Test |
|---|-----------|--------|------|
| 1 | **Veraltetes Deployment/Installation** in der anderen Instanz (Prod-Env älter als Dev, oder Installation nie geupgradet nach Scope-Änderung → 403) | 50 % | `forge login`, dann `forge install list` — zeigt Version pro Site. **Forge-Token ist aktuell abgelaufen!** |
| 2 | **App Access Rules / Data Security Policy** blockiert App-Zugriff: `getSpaces` läuft als `asApp()` (`spaces.ts:31`) — wenn die Org App-Zugriff auf Spaces einschränkt, bleibt der Dropdown leer | 20 % | Admin → Sicherheit → App-Zugriffsregeln prüfen |
| 3 | **User-Berechtigungen:** `getPageBody`/`createPage` laufen `asUser()` — fehlende Space-/Seitenrechte → Fehler, die F-5 dann verschluckt | 15 % | Mit Site-Admin-Account testen |
| 4 | **OneNote-OAuth:** Fremder MS-Tenant verlangt Admin-Consent für die Azure-App → OneNote-Tab scheitert beim Login | 15 % | Fehlermeldung beim MS-Login prüfen |

**Was ich brauche:** Das konkrete Symptom (Spaces leer? Tab tot? Fehlermeldung?) und welche App-Version dort installiert ist. Ohne das ist alles Raterei.

---

## TEIL D — Fehlende Anleitung in den 4 Tabs

Ist-Zustand: Nur Ein-Zeilen-Hints („All PDFs in the folder will be imported…"). Kein Schritt-für-Schritt, keine Voraussetzungen, keine Limits.

**Empfehlung:** Pro Tab eine einklappbare Hilfe-Box (ADS `SectionMessage`) mit exakt diesen Inhalten:

1. **PDF Import:** ① Rechts Ziel-Space + optional Ziel-Seite wählen → ② Links Ordner auswählen (alle PDFs + Unterordner werden importiert, Ordner = Seitenhierarchie) → ③ Import starten. *Limits: max 10 MB/PDF.*
2. **OneNote Import:** ① Einmalig mit Microsoft-Konto verbinden (Button) → ② Notebook → Abschnitt aufklappen, Seiten anhaken → ③ Rechts Ziel wählen → ④ Import. *Hinweis aktuell nötig: Bilder werden noch nicht übernommen!*
3. **Local OneNote:** ① In OneNote Desktop: Datei → Exportieren → als HTML in einen Ordner → ② Diesen Ordner hier auswählen → ③ Ziel wählen → Import. (Die Export-Anleitung MUSS in die UI — kein Nutzer kennt diesen Weg.)
4. **PDF Export:** ① Space wählen → ② Seiten anhaken (Eltern-Checkbox wählt alle Unterseiten mit!) → ③ optional Briefpapier-PDF (max 5 MB, 1. Seite wird Hintergrund) → ④ Export. *Limit: 50 Seiten pro Lauf, Ausgabe ist EINE Sammeldatei.*

**Außerdem im Live-Test gefundene UI-Bugs:**
- „**Alle / Keine**"-Buttons sind noch deutsch (`ExportPageTree`), Platzhaltertext „**[Nicht darstellbarer Inhalt]**" ebenfalls (`pdfExport.ts:155`) — i18n-Reste trotz EN-Umstellung.
- „Alle" wählt z. B. 106 Seiten aus → Export-Button tot wegen 50er-Limit, ohne Hinweis VOR dem Klick. Eltern-Checkbox kaskadiert ohne Erklärung.
- Nach „Start new export" bleibt die alte Auswahl (7) erhalten, Baum ist aber zugeklappt — verwirrend.

---

## TEIL E — Priorisierte Fix-Reihenfolge

1. **F-1 Unicode-Font** (macht Export zuverlässig — Crash weg)
2. **F-2 Parser ersetzen** (htmlparser2; macht Inhalte vollständig)
3. **F-5 Fehler ausweisen** (deckt Instanz-/Rechteprobleme auf statt sie zu verstecken)
4. **F-4 Layout** (Titel, Tabellen, Seitenumbrüche — gern via pdfmake)
5. **F-3 Entities** (Lib `entities`)
6. **Teil D Hilfe-Boxen + i18n-Reste**
7. Instanz-Problem: erst Symptom + `forge install list`, dann fixen

---

## Artefakte

- Test-PDF: `docs/review-evidence/export-2026-06-12.pdf` (12 Seiten, 7 Confluence-Seiten)
- PDF-Screenshots: `docs/review-evidence/evidence-pdf-page1.png`
- Marketplace-Screenshots: `docs/marketplace/marketplace-{1-4}-*.png` (1440er-Viewport, App-iframe)
