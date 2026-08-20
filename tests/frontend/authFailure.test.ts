import {
  deriveAuthFailureView,
  HEADLINE_CONNECT,
  HEADLINE_UNAVAILABLE,
} from '../../src/frontend/utils/authFailure';

describe('deriveAuthFailureView', () => {
  it('zeigt die Einladung wenn der Nutzer nur noch nicht verbunden ist', () => {
    const view = deriveAuthFailureView({ authenticated: false });

    expect(view.isFailure).toBe(false);
    expect(view.canRetry).toBe(true);
    expect(view.headline).toBe(HEADLINE_CONNECT);
  });

  it('zeigt einen Fehlerzustand statt der Einladung bei klassifiziertem Fehler', () => {
    const view = deriveAuthFailureView({
      authenticated: false,
      errorKind: 'invalid-client-secret',
      errorOwner: 'vendor',
      errorCode: 'AADSTS7000215',
      error: "PageFlow's Microsoft connection is misconfigured.",
    });

    expect(view.isFailure).toBe(true);
    expect(view.headline).toBe(HEADLINE_UNAVAILABLE);
  });

  it('blendet den Verbinden-Button aus wenn die Ursache beim Anbieter liegt', () => {
    const view = deriveAuthFailureView({
      authenticated: false,
      errorKind: 'invalid-client-secret',
      errorOwner: 'vendor',
    });

    expect(view.canRetry).toBe(false);
  });

  it('bietet einen erneuten Versuch an wenn die Organisation zustimmen muss', () => {
    const view = deriveAuthFailureView({
      authenticated: false,
      errorKind: 'admin-consent-required',
      errorOwner: 'tenant-admin',
    });

    expect(view.isFailure).toBe(true);
    expect(view.canRetry).toBe(true);
  });

  it('bietet einen erneuten Versuch an bei unklarer Verantwortung', () => {
    const view = deriveAuthFailureView({
      authenticated: false,
      errorKind: 'unknown',
      errorOwner: 'unknown',
    });

    expect(view.canRetry).toBe(true);
  });

  it('behandelt einen Fehler ohne Klassifizierung wie fehlende Verbindung', () => {
    const view = deriveAuthFailureView({ authenticated: false, error: 'Network failure' });

    expect(view.isFailure).toBe(false);
    expect(view.canRetry).toBe(true);
    expect(view.headline).toBe(HEADLINE_CONNECT);
  });
});
