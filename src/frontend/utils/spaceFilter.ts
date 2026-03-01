export interface FilterableSpace {
  id: string;
  key: string;
  name: string;
}

export function filterSpaces(spaces: FilterableSpace[], query: string): FilterableSpace[] {
  if (!query.trim()) return spaces;
  const q = query.toLowerCase().trim();
  return spaces.filter(s =>
    s.name.toLowerCase().includes(q) || s.key.toLowerCase().includes(q)
  );
}
