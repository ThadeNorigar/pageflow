import {
  describeError,
  isSessionExpiredError,
  SESSION_EXPIRED_MESSAGE,
} from '../../src/frontend/utils/errorMessages';

describe('isSessionExpiredError', () => {
  it('erkennt die Forge-Bridge-Meldung mit rohen Zeitstempeln', () => {
    expect(isSessionExpiredError(new Error('Token has expired: 1787330314 > 1787330251'))).toBe(true);
  });

  it('bleibt tolerant gegen andere Formulierungen', () => {
    expect(isSessionExpiredError(new Error('The token has expired'))).toBe(true);
    expect(isSessionExpiredError('Auth token expired, please retry')).toBe(true);
  });

  it('meldet den abgelaufenen Microsoft-Schluessel NICHT als Sitzungsablauf', () => {
    const msg =
      "The access key for PageFlow's Microsoft connection has expired and must be " +
      'renewed by the app vendor. Please contact PageFlow support.';
    expect(isSessionExpiredError(new Error(msg))).toBe(false);
  });

  it('laesst gewoehnliche Importfehler unberuehrt', () => {
    expect(isSessionExpiredError(new Error('Upload failed: 413 Payload Too Large'))).toBe(false);
    expect(isSessionExpiredError(new Error('Page limit reached'))).toBe(false);
    expect(isSessionExpiredError(undefined)).toBe(false);
    expect(isSessionExpiredError({ code: 500 })).toBe(false);
  });
});

describe('describeError', () => {
  it('ersetzt den Zeitstempel-Rohtext durch Ursache und Handlung', () => {
    const out = describeError(new Error('Token has expired: 1787330314 > 1787330251'), 'Upload failed');
    expect(out).toBe(SESSION_EXPIRED_MESSAGE);
    expect(out).not.toMatch(/\d{10}/);
    expect(out.toLowerCase()).toContain('reload the page');
  });

  it('reicht andere Fehlermeldungen unveraendert durch', () => {
    expect(describeError(new Error('Page limit reached'), 'Upload failed')).toBe('Page limit reached');
  });

  it('faellt auf den Kontexttext zurueck, wenn kein Text vorliegt', () => {
    expect(describeError(undefined, 'Export failed')).toBe('Export failed');
    expect(describeError(new Error(''), 'Import failed')).toBe('Import failed');
  });
});
