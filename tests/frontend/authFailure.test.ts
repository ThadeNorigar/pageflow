import {
  deriveAuthFailureView,
  HEADLINE_ATTEMPT_FAILED,
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

describe('deriveAuthFailureView mit fehlgeschlagenem Verbindungsversuch', () => {
  it('zeigt einen Fehlerzustand statt der Einladung', () => {
    const view = deriveAuthFailureView({ authenticated: false }, true);

    expect(view.state).toBe('attempt-failed');
    expect(view.isFailure).toBe(true);
    expect(view.headline).toBe(HEADLINE_ATTEMPT_FAILED);
  });

  it('sperrt den Nutzer nicht aus — die Ursache ist unbekannt', () => {
    const view = deriveAuthFailureView({ authenticated: false }, true);

    expect(view.canRetry).toBe(true);
  });

  it('bleibt bei der Einladung, wenn kein Versuch stattfand', () => {
    const view = deriveAuthFailureView({ authenticated: false }, false);

    expect(view.state).toBe('invite');
    expect(view.isFailure).toBe(false);
  });

  it('laesst dem klassifizierten Fehler den Vortritt — der weiss mehr', () => {
    const view = deriveAuthFailureView(
      { authenticated: false, errorKind: 'invalid-client-secret', errorOwner: 'vendor' },
      true
    );

    expect(view.state).toBe('classified');
    expect(view.canRetry).toBe(false);
  });

  it('ist irrelevant, sobald der Nutzer verbunden ist', () => {
    const view = deriveAuthFailureView({ authenticated: true }, true);

    expect(view.state).toBe('invite');
    expect(view.isFailure).toBe(false);
  });
});
