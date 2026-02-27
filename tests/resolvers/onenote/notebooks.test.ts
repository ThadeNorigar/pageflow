import { getNotebooks, getSections, getPages } from '../../../src/resolvers/onenote/notebooks';
import { requestMicrosoftGraph } from '../../../src/resolvers/onenote/auth';

jest.mock('../../../src/resolvers/onenote/auth');

const mockRequestGraph = requestMicrosoftGraph as jest.MockedFunction<typeof requestMicrosoftGraph>;

beforeEach(() => {
  mockRequestGraph.mockReset();
});

describe('getNotebooks', () => {
  it('returns notebooks from Graph API', async () => {
    mockRequestGraph.mockResolvedValue({
      value: [
        { id: '0-abc-123', displayName: 'Work', lastModifiedDateTime: '2024-01-01T00:00:00Z' },
        { id: '0-def-456', displayName: 'Personal', lastModifiedDateTime: '2024-02-01T00:00:00Z' },
      ],
    });

    const result = await getNotebooks();

    expect(result).toEqual({
      notebooks: [
        { id: '0-abc-123', displayName: 'Work', lastModifiedDateTime: '2024-01-01T00:00:00Z' },
        { id: '0-def-456', displayName: 'Personal', lastModifiedDateTime: '2024-02-01T00:00:00Z' },
      ],
    });
    expect(mockRequestGraph).toHaveBeenCalledWith('/v1.0/me/onenote/notebooks');
  });

  it('returns empty array when no notebooks', async () => {
    mockRequestGraph.mockResolvedValue({ value: [] });

    const result = await getNotebooks();

    expect(result).toEqual({ notebooks: [] });
  });

  it('throws on Graph API error', async () => {
    mockRequestGraph.mockRejectedValue(new Error('Graph API error: 500'));

    await expect(getNotebooks()).rejects.toThrow('Graph API error: 500');
  });
});

describe('getSections', () => {
  it('returns sections for valid notebookId', async () => {
    mockRequestGraph.mockResolvedValue({
      value: [
        { id: '1-aabb-cc01', displayName: 'Chapter 1' },
        { id: '1-aabb-cc02', displayName: 'Chapter 2' },
      ],
    });

    const result = await getSections('0-abc-123');

    expect(result).toEqual({
      sections: [
        { id: '1-aabb-cc01', displayName: 'Chapter 1' },
        { id: '1-aabb-cc02', displayName: 'Chapter 2' },
      ],
    });
    expect(mockRequestGraph).toHaveBeenCalledWith('/v1.0/me/onenote/notebooks/0-abc-123/sections');
  });

  it('validates notebookId format (reject non-GUID)', async () => {
    await expect(getSections('../evil')).rejects.toThrow('Invalid notebookId');
    await expect(getSections('')).rejects.toThrow('Invalid notebookId');
    await expect(getSections('abc xyz')).rejects.toThrow('Invalid notebookId');
    expect(mockRequestGraph).not.toHaveBeenCalled();
  });
});

describe('getPages', () => {
  it('returns pages for valid sectionId', async () => {
    mockRequestGraph.mockResolvedValue({
      value: [
        { id: '0-aef1-b2c3', title: 'Introduction', lastModifiedDateTime: '2024-03-01T00:00:00Z' },
      ],
    });

    const result = await getPages('1-ab00-def4');

    expect(result).toEqual({
      pages: [
        { id: '0-aef1-b2c3', title: 'Introduction', lastModifiedDateTime: '2024-03-01T00:00:00Z' },
      ],
    });
    expect(mockRequestGraph).toHaveBeenCalledWith('/v1.0/me/onenote/sections/1-ab00-def4/pages');
  });

  it('validates sectionId format (reject non-GUID)', async () => {
    await expect(getPages('../../hack')).rejects.toThrow('Invalid sectionId');
    await expect(getPages('')).rejects.toThrow('Invalid sectionId');
    await expect(getPages('has spaces')).rejects.toThrow('Invalid sectionId');
    expect(mockRequestGraph).not.toHaveBeenCalled();
  });
});
