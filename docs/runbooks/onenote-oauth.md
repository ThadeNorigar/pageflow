# Runbook: OneNote / Microsoft Graph OAuth

**Betrifft:** Forge External Auth Provider `microsoft-graph` (siehe `manifest.yml`)
**Kritikalität:** Hoch — bei Ausfall ist der OneNote-Cloud-Import bei **allen** Marketplace-Installationen tot. PDF-Import und Export bleiben funktionsfähig.

---

## 0. Status dieser konkreten App-Registrierung

Rekonstruiert aus dem Memory des Vorgaengerprojekts *ConfluenceImporter* (Stand Februar/Maerz 2026). Diese Angaben sind dokumentiert, aber **nicht live verifiziert** — vor dem Fix im Portal gegenpruefen.

| Punkt | Stand |
|---|---|
| App ID | `724d3f03-aef2-46c3-986e-9a92245b1bdb` |
| Angelegt am | 26.02.2026, im Vorgaengerprojekt ConfluenceImporter |
| Tenant | Standardverzeichnis eines **persoenlichen Microsoft-Kontos** — kein Azure-Abo noetig, keine Kosten |
| Kontotypen | Multi-Tenant (common endpoint) — dokumentiert als korrekt |
| Redirect URIs | `.../outboundAuth/finish` und `.../outboundAuth/forge/callback` — dokumentiert als gesetzt |
| Berechtigungen | `User.Read`, `Notes.Read` (delegiert) |
| **Client Secret gueltig bis** | **27.08.2026** |

**Zwei getrennte Baustellen:**

1. **Production-Secret.** Der dokumentierte Deploy-Workflow des Vorgaengerprojekts verwendete ausschliesslich `-e development`. Fuer Production ist keine Provider-Konfiguration dokumentiert. Das passt zum Fehlerbild beim Kunden: In Production ist kein gueltiges Secret hinterlegt, waehrend Development funktionierte.
2. **Ablauf des Secrets.** Unabhaengig vom Punkt oben faellt der OneNote-Import zum Ablaufdatum aus der Tabelle oben in **allen** Environments aus. Ein neues Secret loest beide Probleme in einem Durchgang. Das Ablaufdatum wird ausschliesslich in dieser Tabelle gepflegt — steht es an zwei Stellen, ist eine davon irgendwann falsch.

**Nicht gegen einen Business-Tenant getestet.** Die Registrierung wurde fuer persoenliche Microsoft-Konten konfiguriert (`Notes.Read` statt `Notes.Read.All`, Personal-Account-ID-Format). Delegiertes `Notes.Read` funktioniert grundsaetzlich auch in Org-Tenants, aber der Pfad ist unerprobt. Nach dem Secret-Fix ist der Kundenfall gezielt nachzustellen, statt ihn als erledigt zu betrachten.

---

## 1. Wie die Authentifizierung aufgebaut ist

PageFlow nutzt Forge External Authentication. Daraus folgt eine Eigenschaft, die man kennen muss, bevor man irgendetwas debuggt:

- Die **Client ID** steht fest im `manifest.yml` (`providers.auth[].clientId`) und wird mit dem App-Bundle an jeden Kunden ausgeliefert.
- Das **Client Secret** wird pro Environment vom Vendor per CLI gesetzt (`forge providers configure`) und nie ausgeliefert.
- Es gibt **genau eine** Azure-App-Registrierung für alle Kunden. Kunden können keine eigenen Credentials hinterlegen — dafür existiert im Forge-Provider-Modell kein Mechanismus.
- Der Kunde steuert nur seine Seite: Admin-Consent für die Vendor-App in seinem M365-Tenant.

**Konsequenz:** Ein abgelaufenes oder falsches Vendor-Secret ist ein globaler Ausfall, kein Einzelkundenproblem.

### App-Registrierung vs. Enterprise-Anwendung

Haeufigstes Missverstaendnis: Beide heissen umgangssprachlich "die App" und tragen **dieselbe Client ID**. Sie liegen aber in verschiedenen Tenants und haben verschiedene Besitzer.

| | App-Registrierung | Enterprise-Anwendung (Service Principal) |
|---|---|---|
| Liegt in | **Vendor**-Tenant (Home-Tenant) | **Kunden**-Tenant |
| Entsteht durch | einmaliges Anlegen durch den Vendor | automatisch beim Admin-Consent |
| Enthaelt das Client Secret | **ja** | nein |
| Anzahl | genau eine, fuer alle Kunden | eine pro Kunde |

Der Kunde kann in seiner Enterprise-Anwendung Consent erteilen, Zugriff entziehen und Conditional-Access-Policies setzen. **Ein Client Secret kann er dort nicht hinterlegen** — das Feld existiert nicht. Jede Secret-Massnahme in diesem Runbook betrifft ausschliesslich den Vendor-Tenant.

### Voraussetzung fuer jeden Fix

Zugang zum Entra-Tenant, in dem die App-Registrierung liegt. Ohne diesen Zugang ist der OneNote-Cloud-Import **nicht reparierbar** — weder ueber Forge noch ueber Confluence noch ueber den Kunden.

Ist der Zugang endgueltig verloren, bleibt nur die Neuanlage: neue App-Registrierung im eigenen Tenant, neue Client ID in `manifest.yml`, `forge deploy -e production`, danach `forge providers configure -e production`. Das ist eine Manifest-Aenderung und erzwingt ein Major-Version-Upgrade bei allen Kunden (siehe Abschnitt 5).

**Besitzer der Registrierung dokumentieren:** Tenant, verantwortliches Konto und Ablaufdatum des Secrets gehoeren festgehalten. Fehlt diese Information, ist die Marketplace-App von einem Zugang abhaengig, den niemand benennen kann.

---

## 2. Fehlerbilder und ihre Bedeutung

Alle Fehler erscheinen dem Kunden als `could not retrieve access token from the provider 401` mit eingebetteter Azure-Fehlermeldung. Der **AADSTS-Code** ist die eigentliche Diagnose.

| Code | Bedeutung | Wer muss handeln |
|------|-----------|------------------|
| `AADSTS7000215` | Ungültiges Client Secret — Secret-**ID** statt Secret-**Wert** gesetzt, oder Secret abgelaufen | Vendor |
| `AADSTS7000222` | Client Secret ist abgelaufen (expliziter Ablauf) | Vendor |
| `AADSTS700016` | App-Registrierung im Tenant nicht gefunden — App ist **Single-Tenant** statt Multi-Tenant | Vendor |
| `AADSTS50020` | User aus fremdem Tenant, App nicht für Multi-Tenant freigegeben | Vendor |
| `AADSTS65001` | Kein Admin-Consent im Kunden-Tenant erteilt | Kunde (M365-Admin) |
| `AADSTS50011` | Redirect-URI stimmt nicht mit Azure-Registrierung überein | Vendor |

Seit `src/resolvers/onenote/authErrors.ts` klassifiziert die App diese Codes selbst: der Kunde sieht Klartext statt eines rohen 401, und in den Forge-App-Logs erscheint eine Zeile der Form `[PageFlow][onenote-auth] kind=... code=AADSTS... owner=...`. Dieses Praefix ist der Anker der Alert-Regel (Abschnitt 7) und darf sich nicht aendern.

Merksatz: **7000215 heißt, Azure hat ein Secret bekommen und es war falsch.** Wäre gar keins gesetzt, käme ein anderer Fehler. Der Fehler beweist also, dass die Provider-Config existiert, aber falsche Daten enthält.

---

## 3. Akut-Fix bei 7000215 / 7000222

### 3.1 Neues Secret in Azure erzeugen

1. [Azure Portal](https://portal.azure.com) → **App-Registrierungen** → App-ID aus `manifest.yml` suchen
2. **Zertifikate & Geheimnisse** → **Neuer geheimer Clientschlüssel**
3. Beschreibung setzen, Gültigkeit **24 Monate** (Azure-Maximum)
4. **Spalte „Wert" kopieren — nicht „Geheimnis-ID"**

Das ist die mit Abstand häufigste Fehlerquelle. Unterscheidung:

- **Geheimnis-ID:** GUID-Form, `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` → **falsch**
- **Wert:** ca. 40 Zeichen, gemischt, enthält typischerweise `~`, `.`, `-` → **richtig**

Der Wert ist nur unmittelbar nach dem Anlegen sichtbar. Nach dem Verlassen der Seite ist er unwiederbringlich weg — dann neues Secret erzeugen.

### 3.2 Secret in Forge setzen

```bash
forge providers configure microsoft-graph -e production
```

Das Secret wird interaktiv abgefragt. **Niemals** in Chat, Ticket, Commit oder Screenshot einfügen.

Environments sind getrennt. Development und Production brauchen jeweils eine eigene Konfiguration:

```bash
forge providers configure microsoft-graph                 # Development
forge providers configure microsoft-graph -e production   # Production
```

### 3.3 Verifizieren

Ein Fix gilt erst als erledigt, wenn er **in Production gegen einen echten M365-Tenant** nachgewiesen wurde:

1. PageFlow in einer Confluence-Instanz mit **Production**-Installation öffnen
2. Tab **OneNote** → **Configure access**
3. Microsoft-Login durchlaufen, Consent bestätigen
4. Erwartung: Notebook-Liste wird geladen
5. Gegencheck in Azure: **App-Registrierung → Anmeldungen** — der Eintrag muss `Erfolg` zeigen

Ein Test in Development beweist für Production nichts, weil beide Environments getrennte Secrets haben.

---

## 4. Vorab-Checkliste der Azure-App-Registrierung

Diese Punkte sind nur einmal zu prüfen, aber jeder einzelne bricht die Integration für **alle** Kunden. Sie sind bei einer nie gegen echtes M365 getesteten App die wahrscheinlichsten Folgefehler nach dem Secret.

- [ ] **Kontotypen:** „Konten in einem beliebigen Organisationsverzeichnis" (Multi-Tenant). Bei „Nur dieses Organisationsverzeichnis" funktioniert die App bei keinem einzigen Kunden.
- [ ] **Redirect-URI:** Plattform „Web", URI exakt `https://id.atlassian.com/outboundAuth/finish`
- [ ] **API-Berechtigungen:** `openid`, `profile`, `offline_access`, `User.Read`, `Notes.Read` als **delegierte** Berechtigungen — identisch zur `scopes`-Liste im `manifest.yml`
- [ ] **Publisher Verification:** Ohne verifizierten Herausgeber zeigt Microsoft dem Kunden eine „nicht verifizierter Herausgeber"-Warnung. Für eine Marketplace-App ein Vertriebshindernis.
- [ ] **Secret-Ablaufdatum** dokumentiert und mit Erinnerung hinterlegt

---

## 5. Rotation ohne Ausfall

Azure-Secrets laufen **maximal nach 24 Monaten** ab; "laeuft nie ab" gibt es seit Jahren nicht mehr. Der Ablauf ist ein garantierter Totalausfall zu einem **vorhersehbaren** Zeitpunkt. Er gehoert terminiert, nicht abgewartet.

**Microsoft warnt nicht.** Ablaufmails verschickt Entra nur fuer SAML-Zertifikate (60/30/7 Tage), **nicht** fuer Client Secrets. Der Kalendereintrag ist die einzige Warnung, die existiert.

### 5.1 Ablauf (null Downtime)

Azure erlaubt mehrere Secrets parallel. Genau das macht die Rotation unterbrechungsfrei — das neue wird gesetzt, bevor das alte verschwindet.

1. Neues Secret in Azure anlegen, Laufzeit 24 Monate. **Altes Secret stehen lassen.**
2. `forge providers configure microsoft-graph -e production`
3. `forge providers configure microsoft-graph -e staging`
4. `forge providers configure microsoft-graph -e development`
5. Prod-Flow real durchlaufen (Abschnitt 3.3). Erst dieser Test beweist, dass das neue Secret wirkt.
6. **Erst jetzt** das alte Secret in Azure loeschen.
7. Neues Ablaufdatum in der Tabelle in Abschnitt 0 eintragen, Termine aus 5.3 neu setzen.

Kein Redeploy, kein Downtime-Fenster, keine erneute Anmeldung der Kunden — die `clientId` bleibt unveraendert und bestehende Refresh-Tokens gelten weiter.

### 5.2 Harte Grenze: zwei Secrets

Apps, die **persoenliche Microsoft-Konten** unterstuetzen — wie diese hier —, duerfen nur **zwei** Client Secrets gleichzeitig haben. Fuer die Ueberlappung reicht das exakt. Es bedeutet aber: ein vergessenes altes Secret blockiert die naechste Rotation. Schritt 6 ist deshalb nicht optional.

### 5.3 Termine

| Zeitpunkt | Handlung |
|---|---|
| T-60 Tage | Rotation planen, Kontozugang pruefen (Abschnitt 6) |
| T-14 Tage | Rotation durchfuehren (5.1) |

Beide Termine verweisen auf dieses Dokument.

### 5.4 Ausnahme: Wechsel der Client ID

Wird die **Client ID** gewechselt, aendert sich `manifest.yml`. Das erzwingt ein `forge deploy` und einen Major-Version-Upgrade beim Kunden. Zwischen Deploy und `forge providers configure` existiert ein Fenster, in dem Kunden auf der neuen Version **kein** Secret haben. Beide Schritte unmittelbar nacheinander ausfuehren.

---

## 6. Kontozugang und Bus-Faktor

Die App-Registrierung liegt im Standardverzeichnis eines **persoenlichen Microsoft-Kontos**. Damit haengt die OneNote-Funktion **aller** Marketplace-Installationen an genau einem Konto.

### 6.1 Warum ein Umzug das nicht loest

App-Registrierungen lassen sich **nicht** zwischen Tenants verschieben. Eine Neuanlage in einem anderen Verzeichnis erzeugt zwingend eine **neue Client ID** — und damit Manifest-Aenderung, Deploy, Major-Version-Upgrade und erneute Zustimmung jedes einzelnen Kunden. Der Umzug in ein sauberes Firmenverzeichnis ist also **kein Wartungsvorgang, sondern ein Breaking Change**.

Konsequenz: Das Konto bleibt auf absehbare Zeit ein Single Point of Failure. Geht es verloren, ist die OneNote-Funktion nicht reparierbar.

### 6.2 Was stattdessen abzusichern ist

- [ ] Verantwortliches Konto ist benannt und im Passwortmanager hinterlegt
- [ ] Recovery-Mail und Recovery-Telefon sind gesetzt und aktuell
- [ ] MFA-Backup-Codes existieren und liegen ausserhalb des Kontos
- [ ] Zweiter Owner ist auf der Registrierung eingetragen — oder die Entscheidung dagegen ist hier begruendet

**Keine Zugangsdaten in dieses Dokument.** Es liegt im Repository. Hier steht, *wo* der Zugang liegt, nie *wie* er lautet.

---

## 7. Monitoring

Bis zum Ausfall im August 2026 war der zahlende Kunde das Monitoring. Zwei Ebenen ersetzen das — mit unterschiedlichen Staerken.

### 7.1 Forge-Alerts (plattform-nativ, reaktiv)

Die Developer Console bietet Metrics, Logs und Alert-Regeln mit Respondern. Eine Regel auf Invocation-Errors der OneNote-Funktion greift auf die Log-Zeile aus Abschnitt 2.

**Grenze:** reaktiv. Der Alert feuert erst, wenn ein Nutzer bereits auf den Fehler gelaufen ist.

### 7.2 Externe Probe (proaktiv)

Ein taeglicher Job ausserhalb von Forge ruft den Microsoft-Token-Endpoint mit `client_id` und Secret sowie einem absichtlich ungueltigen `refresh_token` auf:

- Antwort `invalid_grant` → Secret ist gueltig
- Antwort `AADSTS7000215` / `AADSTS7000222` → Alarm

**Grenzen:** Der Job prueft das Secret **in Azure**, nicht ob Forge Production es korrekt gespeichert hat — diese Luecke schliesst nur der E2E-Test aus 3.3. Ausserdem existiert das Secret dadurch an einem zweiten Ort. Vor dem Bau ist zu verifizieren, dass Entra die Client-Authentifizierung tatsaechlich **vor** dem Grant prueft; andernfalls traegt der Ansatz nicht.

### 7.3 Warum Forge das nicht selbst kann

- `forge providers` kennt nur `configure` — kein `list`, kein `status`. Der Konfigurationszustand ist **nicht auslesbar**.
- Ein Forge Scheduled Trigger laeuft ohne Nutzerkontext und hat damit kein Token, das er pruefen koennte.

Deshalb bleibt der End-to-End-Test in Production der einzige echte Beweis.

---

## 8. Bekannte Grenze dieses Modells

Das Vendor-Secret ist ein Single Point of Failure für alle Kunden gleichzeitig, und Kunden mit eigenen Compliance-Anforderungen können weder eigene Azure-App noch eigene Conditional-Access-Policies einbringen. Das ist eine Eigenschaft von Forge External Auth, kein Konfigurationsfehler. Ein Wechsel auf kundeneigene Credentials erfordert, den Forge-Provider-Mechanismus zu verlassen und den OAuth-Flow selbst zu implementieren.

---

## 9. Referenzen

- [Providers — Manifest-Referenz](https://developer.atlassian.com/platform/forge/manifest-reference/providers/)
- [Command: providers configure](https://developer.atlassian.com/platform/forge/cli-reference/providers-configure/)
- [Rotating an OAuth 2.0 client ID and secret](https://developer.atlassian.com/platform/forge/rotating-an-oauth-2.0-client-id-and-secret/)
- [Common issues with external authentication](https://developer.atlassian.com/platform/forge/common-issues-with-external-authentication/)
- [Microsoft: AADSTS-Fehlercodes](https://learn.microsoft.com/en-us/entra/identity-platform/reference-error-codes)
- [Forge: Alerts](https://developer.atlassian.com/platform/forge/alerts/)
- [Forge: Monitor invocation metrics](https://developer.atlassian.com/platform/forge/monitor-invocation-metrics/)
- [Microsoft: Ablaufmails nur fuer SAML-Zertifikate](https://learn.microsoft.com/en-us/entra/identity/enterprise-apps/application-management-certs-faq)
- [Microsoft: Maximale Anzahl Client Secrets](https://learn.microsoft.com/en-au/answers/questions/5655092/clarification-on-maximum-allowed-client-secrets-fo)
- [Microsoft: App-Registrierungen sind nicht zwischen Tenants verschiebbar](https://learn.microsoft.com/en-us/answers/questions/2259370/can-we-migrate-applications-under-app-registration)
