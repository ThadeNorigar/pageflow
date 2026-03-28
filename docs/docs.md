# Documentation — PageFlow

**Last updated:** March 28, 2026

PageFlow is a free Atlassian Forge app that migrates content into Confluence Cloud — from OneNote, PDF files, and local HTML exports.

## Getting Started

### Installation

1. Install PageFlow from the [Atlassian Marketplace](https://marketplace.atlassian.com/)
2. Open any Confluence space
3. Find **PageFlow** in the Apps menu (global page)

### First Import

1. Select a target **Space** from the dropdown
2. Choose a **parent page** for your imported content
3. Switch to the tab matching your source (PDF Import, OneNote, Local OneNote, PDF Export)
4. Follow the tab-specific instructions below

## Features

### PDF Import

Import PDF files as Confluence pages with the original PDF attached.

- **Single file**: Upload a PDF — a new page is created with the PDF as attachment
- **Batch import**: Select a folder to import multiple PDFs at once
- Per-file checkboxes let you pick which files to import
- Optional text extraction creates searchable page content

### OneNote Import (Cloud)

Migrate OneNote notebooks from Microsoft 365 into Confluence.

1. Click **Connect Microsoft Account** to authorize via OAuth 2.0
2. Browse your Notebooks, Section Groups, and Sections
3. Select pages to import
4. Content is converted to Confluence format with images preserved

**Requirements:** Microsoft 365 account with OneNote access.

### Local OneNote Import

Import OneNote pages exported as HTML from the desktop application.

1. In OneNote Desktop: **File → Export → Page → HTML**
2. In PageFlow: Switch to **Local OneNote** tab
3. Select the exported `.htm` file(s) and associated `_files` folder
4. Pages are converted with embedded images uploaded as attachments

### PDF Export

Export Confluence pages as PDF documents with optional custom stationery.

1. Switch to the **PDF Export** tab
2. Select pages from the checkbox tree
3. Optionally upload a stationery PDF (letterhead, watermark)
4. Click **Export** — PDFs are generated client-side

## Permissions

PageFlow requires the following Confluence permissions:

| Permission | Purpose |
|-----------|---------|
| Read spaces & pages | Browse and select import targets |
| Create pages | Create new pages during import |
| Upload attachments | Attach PDFs and images to pages |

For OneNote import, the App requests `Notes.Read` permission via Microsoft OAuth 2.0.

## Limits

- **Function timeout:** 25 seconds per operation (Atlassian Forge limit)
- **Memory:** 128 MB per function invocation
- **Batch import:** Up to 100 files per batch
- **Attachment size:** Subject to Confluence instance limits

## Troubleshooting

### OneNote connection fails

- Ensure you are using a Microsoft 365 account (personal or organizational)
- Try disconnecting and reconnecting your Microsoft account
- Check that your account has OneNote notebooks

### Import seems slow

- Large notebooks are imported page by page — this is expected
- Each page requires multiple API calls (content + images)
- Forge platform limits apply (25s per function call)

### PDF export missing content

- Some Confluence macros may not render in PDF export
- Complex tables and embedded content have limited support

## Support

For questions or issues: [pageflow@adrianphilipp.de](mailto:pageflow@adrianphilipp.de)

## Related

- [Privacy Policy](privacy.md)
- [Terms of Service](terms.md)
- [Security Policy](security.md)
