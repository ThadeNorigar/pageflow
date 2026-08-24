import {
  classifyGraphError,
  extractGraphErrorCode,
  formatGraphLogLine,
} from '../../../src/resolvers/onenote/graphErrors';

// Originalantwort von Microsoft aus den Production-Logs vom 24.08.2026
const LIBRARY_TOO_LARGE_BODY = JSON.stringify({
  error: {
    code: '10008',
    message:
      'One or more of the document libraries on the user or group\u2019s OneDrive contains more than 5,000 OneNote items (notebooks, sections, section groups) and cannot be queried using the API.',
    innerError: { date: '2026-08-24T13:47:36', 'request-id': '97f2f2fb-9dfc-49d0-a2aa-08e346cfd264' },
  },
});

describe('extractGraphErrorCode', () => {
  it('should read the error code from a Graph response body', () => {
    expect(extractGraphErrorCode(LIBRARY_TOO_LARGE_BODY)).toBe('10008');
  });

  it('should read the error code from an error object carrying the body', () => {
    const err = Object.assign(new Error('Microsoft Graph request failed: 403'), {
      body: LIBRARY_TOO_LARGE_BODY,
    });

    expect(extractGraphErrorCode(err)).toBe('10008');
  });

  it('should return null when no Graph error code is present', () => {
    expect(extractGraphErrorCode('Something went wrong')).toBeNull();
  });

  it('should ignore the request id nested in innerError', () => {
    expect(extractGraphErrorCode(LIBRARY_TOO_LARGE_BODY)).not.toContain('97f2');
  });
});

describe('classifyGraphError', () => {
  it('should classify code 10008 as a library that exceeds the OneNote item limit', () => {
    const info = classifyGraphError(LIBRARY_TOO_LARGE_BODY);

    expect(info).not.toBeNull();
    expect(info!.kind).toBe('onenote-library-too-large');
    expect(info!.code).toBe('10008');
    expect(info!.owner).toBe('tenant-admin');
  });

  it('should point users to the local import when the library is too large', () => {
    const info = classifyGraphError(LIBRARY_TOO_LARGE_BODY);

    expect(info!.message).toContain('Local OneNote');
  });

  it('should never leak the original Microsoft text', () => {
    const info = classifyGraphError(LIBRARY_TOO_LARGE_BODY);

    expect(info!.message).not.toContain('request-id');
    expect(info!.message).not.toContain('97f2f2fb');
  });

  it('should name the code for an unknown Graph error instead of hiding it', () => {
    const info = classifyGraphError(JSON.stringify({ error: { code: '20166', message: 'x' } }));

    expect(info!.kind).toBe('unknown');
    expect(info!.code).toBe('20166');
    expect(info!.message).toContain('20166');
  });

  it('should return null when the payload carries no Graph error code', () => {
    expect(classifyGraphError('connection reset')).toBeNull();
  });
});

describe('formatGraphLogLine', () => {
  it('should emit a stable machine-readable line with the error code', () => {
    const info = classifyGraphError(LIBRARY_TOO_LARGE_BODY)!;

    expect(formatGraphLogLine(info, 'get-sections')).toBe(
      '[PageFlow][onenote-graph] kind=onenote-library-too-large code=10008 owner=tenant-admin context=get-sections'
    );
  });

  it('should omit the context when none is given', () => {
    const info = classifyGraphError(LIBRARY_TOO_LARGE_BODY)!;

    expect(formatGraphLogLine(info)).toBe(
      '[PageFlow][onenote-graph] kind=onenote-library-too-large code=10008 owner=tenant-admin'
    );
  });
});
