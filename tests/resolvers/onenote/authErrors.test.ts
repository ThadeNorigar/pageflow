import {
  classifyAuthError,
  extractAadstsCode,
  formatAuthLogLine,
} from '../../../src/resolvers/onenote/authErrors';

// Originaltext aus dem Produktionsausfall vom 19.08.2026 (Marketplace-Kunde)
const REAL_PROVIDER_ERROR =
  'could not retrieve access token from the provider 401 ' +
  '{"error":"invalid_client","error_description":"AADSTS7000215: Invalid client secret provided. ' +
  "Ensure the secret being sent in the request is the client secret value, not the client secret ID, " +
  "for a secret added to app '724d3f03-aef2-46c3-986e-9a92245b1bdb'.\"}";

describe('extractAadstsCode', () => {
  it('findet den Code im echten Provider-Fehlertext', () => {
    expect(extractAadstsCode(REAL_PROVIDER_ERROR)).toBe('7000215');
  });

  it('findet den Code in der Message eines Error-Objekts', () => {
    expect(extractAadstsCode(new Error('AADSTS65001: consent required'))).toBe('65001');
  });

  it('durchsucht auch das body-Feld eines Fehlerobjekts', () => {
    const err = Object.assign(new Error('Microsoft Graph request failed: 401'), {
      body: '{"error_description":"AADSTS7000222: expired"}',
    });
    expect(extractAadstsCode(err)).toBe('7000222');
  });

  it('gibt null zurück ohne AADSTS-Code', () => {
    expect(extractAadstsCode('Network failure')).toBeNull();
  });

  it.each([[null], [undefined], [42], [{}], [[]]])('stürzt nicht ab bei %p', input => {
    expect(extractAadstsCode(input)).toBeNull();
  });
});

describe('classifyAuthError', () => {
  it.each([
    ['7000215', 'invalid-client-secret', 'vendor'],
    ['7000222', 'expired-client-secret', 'vendor'],
    ['700016', 'app-not-found', 'vendor'],
    ['50020', 'account-type-not-supported', 'vendor'],
    ['65001', 'admin-consent-required', 'tenant-admin'],
    ['50011', 'redirect-uri-mismatch', 'vendor'],
  ])('klassifiziert AADSTS%s als %s mit Verantwortung %s', (code, kind, owner) => {
    const info = classifyAuthError(`AADSTS${code}: irgendein Text von Microsoft`);

    expect(info).not.toBeNull();
    expect(info?.kind).toBe(kind);
    expect(info?.code).toBe(code);
    expect(info?.owner).toBe(owner);
    expect(info?.message.length).toBeGreaterThan(0);
  });

  it('unterscheidet Anbieter- von Administrationsproblemen in der Meldung', () => {
    const vendor = classifyAuthError('AADSTS7000215: Invalid client secret provided.');
    const admin = classifyAuthError('AADSTS65001: consent required');

    expect(vendor?.message).toContain('PageFlow support');
    expect(admin?.message).toContain('administrator');
    expect(admin?.message).not.toContain('PageFlow support');
  });

  it('fällt bei unbekanntem Code auf eine generische Meldung zurück statt zu crashen', () => {
    const info = classifyAuthError('AADSTS999999: irgendwas ganz Neues');

    expect(info).not.toBeNull();
    expect(info?.kind).toBe('unknown');
    expect(info?.code).toBe('999999');
    expect(info?.owner).toBe('unknown');
    expect(info?.message).toContain('AADSTS999999');
  });

  it('gibt null zurück wenn gar kein AADSTS-Code enthalten ist', () => {
    expect(classifyAuthError('Network failure')).toBeNull();
    expect(classifyAuthError(new Error('socket hang up'))).toBeNull();
  });

  it('übernimmt niemals den Originaltext von Microsoft in die Meldung', () => {
    const info = classifyAuthError(REAL_PROVIDER_ERROR);

    expect(info?.message).not.toContain('724d3f03');
    expect(info?.message).not.toContain('client secret');
    expect(info?.message).not.toContain('invalid_client');
  });
});

describe('formatAuthLogLine', () => {
  it('erzeugt eine stabile, maschinenlesbare Zeile mit Code', () => {
    const info = classifyAuthError(REAL_PROVIDER_ERROR);

    expect(formatAuthLogLine(info!)).toBe(
      '[PageFlow][onenote-auth] kind=invalid-client-secret code=AADSTS7000215 owner=vendor'
    );
  });

  it('hängt den Kontext an wenn angegeben', () => {
    const info = classifyAuthError('AADSTS65001: consent required');

    expect(formatAuthLogLine(info!, 'auth-status')).toBe(
      '[PageFlow][onenote-auth] kind=admin-consent-required code=AADSTS65001 owner=tenant-admin context=auth-status'
    );
  });

  it('enthält keine Rohantwort von Microsoft', () => {
    const info = classifyAuthError(REAL_PROVIDER_ERROR);

    expect(formatAuthLogLine(info!, 'graph-request')).not.toContain('724d3f03');
  });
});
