# PageFlow — Current State

## Recent Context
- **2026-08-21**: OneNote-OAuth-Ausfall behoben (Secret war in Production nie gesetzt), Release 2.9.0. Danach Kundenmeldung Euronet: 403 auf geteilten Notebooks — das Manifest forderte nur `Notes.Read` an statt `Notes.Read.All`. Behoben in **2.11.0**. Beads-DB auf `pageflow` umgezogen. Health-Probe, Forge-Alert-Regel und Rotations-Termin 2028 eingerichtet.
- **2026-06-13**: Großes Funktions-Update. PDF-Export neu gebaut (htmlparser2 + pdfmake, Briefpapier-Hybrid), Word-Export (.docx) ergänzt, OneNote-Cloud-Bilder implementiert, Security S-1..S-4 gefixt, Hilfe-Boxen dauerhaft sichtbar, 3 UX-Fixes. 3 Production-Deploys → **v2.8.0 ist PUBLIC im Marketplace**. 257 Tests grün.
- **2026-03-28**: v2.1.0 Release vorbereitet, Repo-Rename ConfluenceImporter → PageFlow.

## Active
- **Wartet auf Euronet**: bestätigt 2.11.0, dass geteilte/Team-Notebooks jetzt aufgehen? Ob Forge bestehende Verbindungen selbst erneuert, ist unbewiesen (Confidence 65 %) — sonst muss der Kunde die Autorisierung manuell widerrufen.
- Release-Notes für 2.11.0 im Marketplace stehen noch auf Atlassians Platzhalter
- Optional: OneNote-Bild-Upload mit echter Bild-Seite live testen (bisher nur Unit-getestet)

## Known Issues
- 3 moderate Dev-only-Vulns (webpack-dev-server → sockjs → uuid). Nicht erreichbar: sockjs ruft nur uuid.v4() ohne buf auf. `npm audit --omit=dev` = 0.
- Marketplace-Listing (Typ "Marketplace Hub") hat keine Screenshot-Galerie — nur UPM-Banner; Galerie nur via Atlassian-Support

## Betriebswissen

- **`deploy dolt-remote` = ~20 Minuten Ausfall** für ALLE Beads-Projekte. Der Container braucht nach dem Rebuild so lange bis erreichbar. Nicht dazwischenfunken, einfach warten.
- **Marketplace-Version zählt Forge selbst hoch**, `package.json` spielt keine Rolle. Jeder Production-Deploy = +1 Minor.
- **`sync.remote` bei neueren bd-Versionen** steht per Default auf `git+<origin>`. Dieses Repo ist öffentlich — der Sync muss beim privaten Dolt-Server bleiben.
