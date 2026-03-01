import { filterSpaces, FilterableSpace } from '../../src/frontend/utils/spaceFilter';

const SPACES: FilterableSpace[] = [
  { id: '1', key: 'DEV', name: 'Development' },
  { id: '2', key: 'HR', name: 'Human Resources' },
  { id: '3', key: 'MKT', name: 'Marketing' },
  { id: '4', key: 'DEVOPS', name: 'DevOps Team' },
];

describe('filterSpaces', () => {
  it('returns all spaces for empty query', () => {
    expect(filterSpaces(SPACES, '')).toEqual(SPACES);
  });

  it('returns all spaces for whitespace-only query', () => {
    expect(filterSpaces(SPACES, '   ')).toEqual(SPACES);
  });

  it('filters by name (case-insensitive)', () => {
    const result = filterSpaces(SPACES, 'dev');
    expect(result).toHaveLength(2);
    expect(result.map(s => s.key)).toEqual(['DEV', 'DEVOPS']);
  });

  it('filters by space key', () => {
    const result = filterSpaces(SPACES, 'HR');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Human Resources');
  });

  it('returns empty array when no match', () => {
    expect(filterSpaces(SPACES, 'xyz')).toEqual([]);
  });

  it('matches partial name', () => {
    const result = filterSpaces(SPACES, 'market');
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe('MKT');
  });

  it('trims query whitespace', () => {
    const result = filterSpaces(SPACES, '  dev  ');
    expect(result).toHaveLength(2);
  });

  it('handles empty spaces array', () => {
    expect(filterSpaces([], 'test')).toEqual([]);
  });
});
