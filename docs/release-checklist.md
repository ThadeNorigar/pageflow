# Release-Checkliste

> Entstanden aus dem Produktionsausfall vom August 2026: Die OneNote-Integration lief in
> Development, in Production war nie ein Client Secret gesetzt. Der erste echte Test war ein
> zahlender Marketplace-Kunde. Jeder Punkt hier existiert, weil er einmal gefehlt hat.

## 1. Vor dem Deploy

- [ ] `npm test` — alle Tests grün, keine übersprungenen Suites
- [ ] `npm run lint` — Exit-Code 0
- [ ] `npm run build` und `npm run build:frontend` — beide fehlerfrei
- [ ] `npm audit --omit=dev` — **0 High, 0 Critical**. Dev-Findings sind akzeptabel, aber nachverfolgt.
- [ ] `docs/sca-npm-audit-report.txt` und `docs/sast-eslint-report.txt` neu erzeugt (Marketplace-Security-Review)
- [ ] `package.json` Version erhöht
- [ ] `CHANGELOG.md` ergänzt — daraus werden die Marketplace-Release-Notes
- [ ] Alle Beads dieses Releases geschlossen oder bewusst verschoben

## 2. Externe Integrationen

Der teuerste Fehler dieses Projekts. Nicht abkürzen.

- [ ] **Provider-Secret in JEDEM aktiven Environment gesetzt und verifiziert.**
      `forge providers` kennt kein `list` und kein `status` — der Zustand ist **nicht auslesbar**.
      Der End-to-End-Test ist der einzige Beweis.
      - [ ] `development`
      - [ ] `production`
      - [ ] `staging` — derzeit ohne Installation, `configure` scheitert erwartbar (siehe Runbook 5.1)
- [ ] **Der OAuth-Flow wurde in Production gegen das echte Fremdsystem durchlaufen.**
      Nicht Unit-Tests, nicht Development. Ergebnis mit Datum in `docs/runbooks/onenote-oauth.md`
      Abschnitt 3.4 eintragen.
- [ ] Secret-Ablaufdatum geprüft — läuft es vor dem nächsten geplanten Release ab, **jetzt** rotieren
- [ ] Health-Probe (`.github/workflows/onenote-secret-health.yml`) ist grün

**Ist der Test nicht durchführbar** (fehlendes Konto, fehlender Tenant), lautet die Meldung
**„ungetestet in Production, nicht releasen"** — niemals „fertig".

## 3. Smoke-Test der Kernfunktionen

Im Browser, nicht im Kopf. Ein Durchlauf pro Tab:

- [ ] **PDF Import** — Ordner wählen, Import läuft durch, Seite entsteht mit Anhang
- [ ] **OneNote Import** — verbunden, Notebook listet, Abschnitt lädt nach
- [ ] **Local OneNote** — HTML-Export-Ordner wählen, Import läuft durch
- [ ] **PDF Export** — Seiten wählen, PDF entsteht
- [ ] **Word Export** — dasselbe als `.docx`, Datei öffnet sich

## 4. Deploy

```bash
forge lint
forge deploy -e production
forge install --upgrade   # nur falls sich Scopes geändert haben
```

- [ ] Forge CLI ist aktuell (`npm install -g @forge/cli@latest`) — veraltete CLIs erzeugen
      schwer diagnostizierbare Deploy-Fehler
- [ ] `forge lint` läuft durch. **Nichts Generiertes unter `src/` ablegen** — Forge CLI 13
      typ-lintet jede Datei dort gegen die Root-`tsconfig.json` und bricht bei Build-Artefakten
      ab. Der Webpack-Output geht deshalb nach `static/frontend`, nicht nach `src/frontend/build`.
- [ ] Nach einem Wechsel des Build-Pfads: `forge tunnel` neu starten, sonst liefert er das
      alte Verzeichnis aus
- [ ] Nach dem Deploy: Abschnitt 3 erneut, **gegen Production**

## 5. Marketplace

**Die Version wird NICHT eingereicht.** Atlassian erkennt Forge-Deployments automatisch:

> We automatically detect updates to Forge apps when any changes are released to the
> production environment, i.e., deployment to production from Forge CLI.

Nach `forge deploy -e production` erscheint die neue Version innerhalb von Minuten im
Listing. Kein Vendor-Portal-Schritt, keine Atlassian-Review. Nur **Major-Versionen** (bei
zusätzlichen Scopes oder Wechsel free → paid) müssen die **Kunden** in ihrer Instanz
bestätigen, nicht Atlassian.

- [ ] Listing prüfen: zeigt `marketplace.atlassian.com/apps/1601744878` die neue Version?
- [ ] **Release-Notes nachtragen.** Atlassian setzt automatisch den Platzhalter
      „Minor version update" als Summary UND Details — genau das sehen Kunden. Text aus
      `CHANGELOG.md` übernehmen unter
      `marketplace.atlassian.com/manage/apps/1601744878/versions`.
      Achtung: dieser Bereich verlangt eine **Step-up-Authentifizierung** per E-Mail-Code.
- [ ] Screenshots in `docs/marketplace/` prüfen — zeigen sie noch die aktuelle Oberfläche?
- [ ] `docs/privacy.md` und `docs/terms.md` prüfen — noch zutreffend?
- [ ] Nach Freigabe: betroffene Kunden aktiv informieren, wenn das Release einen Ausfall behebt

### Runs on Atlassian: dauerhaft nicht erreichbar

`forge deploy` weist nach jedem Release darauf hin, dass die App nicht fuer das
**Runs on Atlassian**-Programm qualifiziert ist. Begruendung laut `forge eligibility`:

    - App is using remote services
    - App is egressing data

Das ist **keine Konfigurationsluecke, sondern der Zweck der App**: PageFlow spricht mit der
Microsoft Graph API, um OneNote zu lesen. Ohne ausgehende Verbindung gaebe es kein
OneNote-Feature. Das Abzeichen ist damit unerreichbar, solange die Cloud-Anbindung existiert.

Nicht erneut untersuchen. Falls die Marketplace-Sichtbarkeit darunter leidet, waere die
einzige Alternative eine zweite App ohne OneNote-Cloud — eine Produktentscheidung, keine
technische.

## 6. Nach dem Release

- [ ] Kalendereinträge für die nächste Secret-Rotation stehen (T-60 und T-14, siehe Runbook 5.3)
- [ ] Session-Notiz in `sessions/` geschrieben
- [ ] Beads gepusht (`bd dolt push`), Git gepusht
