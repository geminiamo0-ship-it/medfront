import { useMemo, useState } from 'react';
import type { LabValuesByCategory } from '../../types';

interface AmbossLabsPanelProps {
  open: boolean;
  data?: LabValuesByCategory;
  loading: boolean;
  onClose: () => void;
}

export function AmbossLabsPanel({ open, data, loading, onClose }: AmbossLabsPanelProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const categories = useMemo(() => Object.keys(data ?? {}), [data]);
  const activeCategory =
    selectedCategory && categories.includes(selectedCategory)
      ? selectedCategory
      : categories[0] ?? null;

  const rows = useMemo(() => {
    if (!activeCategory || !data) return [];
    const needle = search.trim().toLowerCase();
    if (!needle) return data[activeCategory] ?? [];
    return (data[activeCategory] ?? []).filter((item) =>
      item.name.toLowerCase().includes(needle),
    );
  }, [activeCategory, data, search]);

  return (
    <aside className={open ? 'amboss-labs is-open' : 'amboss-labs'} aria-hidden={!open}>
      <div className="amboss-labs-head">
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search…" />
        <button type="button" onClick={onClose} aria-label="Close lab values">×</button>
      </div>
      <div className="amboss-lab-tabs">
        {categories.map((category) => (
          <button
            type="button"
            key={category}
            className={category === activeCategory ? 'is-active' : ''}
            onClick={() => setSelectedCategory(category)}
          >
            {category}
          </button>
        ))}
      </div>
      <div className="amboss-lab-body">
        <strong>LAB VALUES</strong>
        {loading ? (
          <p>Loading lab values…</p>
        ) : (
          <table>
            <thead>
              <tr><th>{activeCategory ?? 'Category'}</th><th>Reference Range</th><th>SI Reference</th></tr>
            </thead>
            <tbody>
              {rows.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>{item.referenceRange || '—'}</td>
                  <td>{item.siReferenceInterval || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <button type="button" className="amboss-lab-closebar" onClick={onClose}>× &nbsp; CLOSE</button>
    </aside>
  );
}
