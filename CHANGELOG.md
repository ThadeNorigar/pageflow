# Changelog

All notable changes to PageFlow are documented here. This file is the source for
the release notes published on the Atlassian Marketplace.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [2.10.0] — 2026-08-21

### Fixed

- **Shared and team OneNote notebooks can now be opened.** Notebooks that belong
  to a Team, a SharePoint site, or someone else who shared them appeared in the
  list but failed with `Microsoft Graph request failed: 403` when opened. The app
  only ever requested `Notes.Read`, which covers a user's own notebooks; it now
  also requests `Notes.Read.All`. **You will be asked to reconnect your Microsoft
  account once** — existing connections still carry the old, narrower permission.

## [Unreleased]

### Fixed

- **An expired session is now explained instead of dumped.** Leaving a tab open
  for hours made the next import fail with `Token has expired: 1787330314 >
  1787330251` — two raw timestamps and no way to act on them. PageFlow now says
  the session expired and to reload the page. Applies to all four tabs.

## [2.9.0] — 2026-08-21

Reliability release. The OneNote cloud import was broken for all installations
because the app's Microsoft credentials had not been configured in the production
environment. That is fixed, and this release makes sure the same failure can never
again go unnoticed until a customer reports it.

### Fixed

- **OneNote cloud import works again.** The Microsoft connection was misconfigured
  on the vendor side, which made every OneNote sign-in fail with an
  `AADSTS7000215` error. Credentials have been rotated and the full sign-in flow
  was verified end to end in production.
- Security: three high-severity vulnerabilities in shipped dependencies were
  closed — most notably a CRLF injection in `form-data` reachable through
  attachment file names. `brace-expansion` and `nanoid` (used by the Word export)
  were also updated. No breaking changes.

### Added

- **Understandable error messages instead of a raw `401`.** When Microsoft
  rejects a sign-in, PageFlow now says what happened and who can fix it — the app
  vendor or your own Microsoft 365 administrator — and shows a reference code you
  can quote to support.
- **A failed connection is now explained rather than repeated.** Previously a
  failed sign-in returned you to the same invitation with no explanation. PageFlow
  now tells you what to check, in the order that costs you the least effort.
- **A way out when OneNote is unavailable.** Both cases now point to the local
  OneNote import, which works without any Microsoft connection, and offer a direct
  switch to it.
- When the cause lies with the app vendor, the connect button is hidden — retrying
  cannot help, and pretending otherwise wastes your time.

### Internal

- Daily automated health check of the Microsoft credentials, so expiry or
  misconfiguration is detected before any customer notices.
- Operations runbook covering diagnosis, zero-downtime credential rotation,
  account recovery and monitoring.
- Frontend component testing enabled; test suite grown from 283 to 315 cases.

## [2.8.0] — 2026-06-13

PDF and Word export, OneNote image import, security hardening and UX fixes.
See the repository history for details — this file was introduced in 2.9.0 and
earlier releases are not reconstructed here.
