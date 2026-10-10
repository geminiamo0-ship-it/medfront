import { useMemo, useState } from 'react';
import type { ExamRunnerController } from '../../core/useExamRunner';

export function UWorldLabs({ controller: c }: { controller: ExamRunnerController }) {
  const [filter, setFilter] = useState('');
  const rows = useMemo(() => Object.entries(c.labs ?? {}).flatMap(([category, values]) =>
    values.map(value => ({ ...value, category }))).filter(x =>
      !filter || (x.category + ' ' + x.name).toLowerCase().includes(filter.toLowerCase())),
    [c.labs, filter]);
  return <div className="uw-labs">
    <input type="search" aria-label="Search lab values" placeholder="Search lab values…"
      value={filter} onChange={e => setFilter(e.target.value)} />
    {c.labsQuery.isFetching ? <p>Loading reference ranges…</p> : null}
    {c.labsQuery.isError ? <p role="alert">Lab values could not be loaded.</p> : null}
    <div className="uw-labs-scroll"><table>
      <thead><tr><th>Test</th><th>Reference range</th><th>SI</th></tr></thead>
      <tbody>{rows.map(v => <tr key={v.id}><td>{v.name}</td><td>{v.referenceRange ?? '—'}</td>
        <td>{v.siReferenceInterval ?? '—'}</td></tr>)}</tbody>
    </table></div>
    {!rows.length && !c.labsQuery.isFetching ? <p>No values to display.</p> : null}
  </div>;
}
