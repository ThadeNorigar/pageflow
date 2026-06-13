# PageFlow — Current State

## Recent Context
- **2026-06-13**: Großes Funktions-Update. PDF-Export neu gebaut (htmlparser2 + pdfmake, Briefpapier-Hybrid), Word-Export (.docx) ergänzt, OneNote-Cloud-Bilder implementiert, Security S-1..S-4 gefixt, Hilfe-Boxen dauerhaft sichtbar, 3 UX-Fixes. 3 Production-Deploys → **v2.8.0 ist PUBLIC im Marketplace**. 257 Tests grün.
- **2026-03-28**: v2.1.0 Release vorbereitet, Repo-Rename ConfluenceImporter → PageFlow.

## Active
- Optional: OneNote-Bild-Upload mit echter Bild-Seite live testen (bisher nur Unit-getestet)

## Known Issues
- bd dolt pull: CLONE_ADMIN access denied on adrianphilipp.de remote
- 3 moderate Dev-only-Vulns (webpack-dev-server) — Fix nur via Breaking-Upgrade
- Marketplace-Listing (Typ "Marketplace Hub") hat keine Screenshot-Galerie — nur UPM-Banner; Galerie nur via Atlassian-Support
