# Privacy Policy — PageFlow

**Last updated:** March 2, 2026

PageFlow ("the App") is an Atlassian Forge application that enables content migration into Confluence Cloud. This Privacy Policy explains how the App handles your data.

## 1. Data Controller

PageFlow is developed and maintained by:

Adrian Philipp
Email: [contact email]
Website: [website URL]

## 2. Data We Process

### 2.1 Confluence Data

The App accesses your Confluence Cloud instance to:

- **Read** space and page information (titles, hierarchy, content)
- **Write** new pages and upload attachments during import

This data is processed **in real-time** within Atlassian's Forge runtime environment. **No Confluence data is stored outside of your Atlassian instance.**

### 2.2 OneNote Data (Optional)

If you connect your Microsoft account, the App accesses:

- **Notebook, Section, and Page metadata** (titles, IDs)
- **Page content** (text, images) for conversion and import

OneNote data is:

- Accessed via the Microsoft Graph API using OAuth 2.0
- Processed **in real-time** during import only
- **Not stored** by the App after import is complete
- Written directly to your Confluence instance

### 2.3 PDF Files (Optional)

When using PDF import, files are:

- Uploaded from your local device via the browser
- Sent to the Forge backend for attachment upload
- **Not stored** by the App — files are passed directly to the Confluence attachment API

### 2.4 Authentication Tokens

- Microsoft OAuth 2.0 tokens are managed by the Atlassian Forge platform
- Tokens are stored securely in Forge's encrypted storage
- Tokens are used solely to access your OneNote data
- You can revoke access at any time (see Section 6)

## 3. Data We Do NOT Collect

The App does **not**:

- Collect personal information beyond what Atlassian provides
- Use analytics, tracking, or telemetry
- Share data with third parties
- Store content outside the Atlassian Forge environment
- Use cookies or local storage for tracking

## 4. Third-Party Services

| Service | Purpose | Data Shared |
|---------|---------|-------------|
| Atlassian Forge | App hosting & runtime | Operates within your Atlassian tenant |
| Microsoft Graph API | OneNote access (optional) | OAuth tokens, read-only notebook access |

## 5. Data Security

- The App runs entirely within **Atlassian Forge's sandboxed environment**
- All API communication uses **HTTPS/TLS encryption**
- No external servers or databases are used
- Microsoft tokens are encrypted at rest by the Forge platform

## 6. Your Rights (GDPR)

You have the right to:

- **Access** — View what data the App can access
- **Rectification** — Data is read from source systems; correct it there
- **Erasure** — Uninstall the App to remove all stored tokens and configuration
- **Restrict processing** — Disconnect your Microsoft account to stop OneNote access
- **Data portability** — Exported content is standard Confluence pages
- **Object** — Stop using the App at any time

### Revoking Microsoft Access

1. Go to [Microsoft Account — App Permissions](https://account.live.com/consent/Manage)
2. Find "PageFlow" and click **Remove**
3. Or disconnect within the App's OneNote tab

### Uninstalling the App

Uninstalling PageFlow from your Confluence instance removes:

- All Forge Storage data (OAuth tokens, configuration)
- App permissions and access

Previously imported Confluence pages remain in your instance.

## 7. Data Retention

- **No content is retained** by the App after processing
- **OAuth tokens** are retained in Forge Storage until you disconnect or uninstall
- **App configuration** is retained in Forge Storage until uninstall

## 8. Changes to This Policy

We may update this Privacy Policy. Changes will be noted by updating the "Last updated" date above.

## 9. Contact

For privacy-related questions:

Email: [contact email]
