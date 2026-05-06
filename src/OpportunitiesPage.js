import React, { useMemo, useState, useEffect } from 'react';
import { fmt2, pctClass, safeStr } from './utils';
import { PREMIUM_BANDS, VOLUME_BANDS, passesPriceBand } from './pricing';

const PAGE = 100;

// Returns total carton disc price (WINE only, else null)
function calcDiscPrice(r, params) {
  if (r.category !== 'WINE') return null;
  const d1 = parseFloat(params.d1) || 1;
  const d2 = parseFloat(params.d2) || 1;
  const m1 = parseFloat(params.m1) || 1;
  const m2 = parseFloat(params.m2) || 1;
  return (r.dc * r.cs) / d1 / d2 * m1 * m2;
}

// Returns per-unit disc price (WINE only, else null)
function calcDiscPricePerUnit(r, params) {
  const carton = calcDiscPrice(r, params);
  if (carton === null || !r.cs) return null;
  return carton / r.cs;
}

// Save per carton = (BM $/U − Disc $/U) × CS  (WINE only, else null)
function calcSavePerCarton(r, params) {
  const dpu = calcDiscPricePerUnit(r, params);
  if (dpu === null) return null;
  return (r.bm - dpu) * r.cs;
}

export default function OpportunitiesPage({ rows, printing = false, printMode = 'database', formulaParams = { d1: '1.1', d2: '1.29', m1: '1.145', m2: '1.05' } }) {
  const isQuotation = printing && printMode === 'quotation';
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [sub, setSub] = useState('');
  const [discFilter, setDiscFilter] = useState('');
  const [priceBand, setPriceBand] = useState('');
  const [sortKey, setSortKey] = useState('diff_pct');
  const [sortDir, setSortDir] = useState('asc');
  const [shown, setShown] = useState(PAGE);

  const cats = useMemo(
    () => Array.from(new Set(rows.map((r) => r.category))).filter(Boolean).sort(),
    [rows]
  );
  const subs = useMemo(() => {
    const filtered = cat ? rows.filter((r) => r.category === cat) : rows;
    return Array.from(new Set(filtered.map((r) => r.subcategory))).filter(Boolean).sort();
  }, [rows, cat]);

  const filtered = useMemo(() => {
    const term = safeStr(q).trim().toLowerCase();
    let out = rows.filter((r) => {
      if (term) {
        const hay = (safeStr(r.desc) + ' ' + safeStr(r.supplier) + ' ' + safeStr(r.subcategory)).toLowerCase();
        if (!hay.includes(term)) return false;
      }
      if (cat && r.category !== cat) return false;
      if (sub && r.subcategory !== sub) return false;
      if (!passesPriceBand(r, priceBand)) return false;
      if (discFilter === 'heavy' && r.diff_pct > -25) return false;
      if (discFilter === 'strong' && (r.diff_pct > -15 || r.diff_pct <= -25)) return false;
      if (discFilter === 'mild' && (r.diff_pct > 0 || r.diff_pct <= -15)) return false;
      if (discFilter === 'parity' && (r.diff_pct < 0 || r.diff_pct > 5)) return false;
      return true;
    });
    out = [...out].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === 'string' || typeof bv === 'string') {
        return sortDir === 'asc'
          ? safeStr(av).localeCompare(safeStr(bv))
          : safeStr(bv).localeCompare(safeStr(av));
      }
      const an = typeof av === 'number' ? av : 0;
      const bn = typeof bv === 'number' ? bv : 0;
      return sortDir === 'asc' ? an - bn : bn - an;
    });
    return out;
  }, [rows, q, cat, sub, discFilter, priceBand, sortKey, sortDir]);

  useEffect(() => {
    setShown(PAGE);
  }, [q, cat, sub, discFilter, priceBand, sortKey, sortDir]);

  const toggleSort = (k) => {
    if (sortKey === k) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(k);
      const textKeys = new Set(['desc', 'category', 'subcategory', 'supplier']);
      setSortDir(textKeys.has(k) ? 'asc' : 'desc');
    }
  };

  const Th = ({ k, children, num, extra }) => {
    const cls = [
      num ? 'num' : '',
      sortKey === k ? (sortDir === 'asc' ? 'sort-asc' : 'sort-desc') : '',
      extra || '',
    ].filter(Boolean).join(' ');
    return (
      <th className={cls} onClick={() => toggleSort(k)}>
        {children}
      </th>
    );
  };

  const onClear = () => {
    setQ(''); setCat(''); setSub(''); setDiscFilter(''); setPriceBand('');
  };

  return (
    <div className="section">
      <h2>All SKUs — {rows.length.toLocaleString()} matched lines</h2>
      <div className="formula-callout">
        Highlighted columns: <b>Diff %</b> (DC vs BM — sorted by largest discount in DC's favour by default) and <b>Disc $/U / Disc $/CS</b> (applied margin, WINE only). Disc price columns show a value <b>only for WINE rows</b>; all other categories display "—". <b>Save $/CS</b> = (BM $/U − Disc $/U) × CS.
      </div>

      <div className="filter-row">
        <input
          type="search"
          placeholder="Search description, supplier, sub-category…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select value={cat} onChange={(e) => { setCat(e.target.value); setSub(''); }}>
          <option value="">All categories</option>
          {cats.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={sub} onChange={(e) => setSub(e.target.value)}>
          <option value="">All sub-categories</option>
          {subs.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={priceBand} onChange={(e) => setPriceBand(e.target.value)} title="Per-unit price band">
          <option value="">Any unit price</option>
          <optgroup label="Wine, Spirits, Liqueurs">
            {PREMIUM_BANDS.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
          </optgroup>
          <optgroup label="Beer, Cider, RTDs">
            {VOLUME_BANDS.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
          </optgroup>
        </select>
        <select value={discFilter} onChange={(e) => setDiscFilter(e.target.value)}>
          <option value="">Any discount</option>
          <option value="heavy">≥ 25% off</option>
          <option value="strong">15–25% off</option>
          <option value="mild">0–15% off</option>
          <option value="parity">Parity to +5%</option>
        </select>
        <button className="clear-btn" onClick={onClear}>Clear</button>
        <span className="count-info">
          {filtered.length.toLocaleString()} of {rows.length.toLocaleString()} lines
        </span>
      </div>

      {printing && (
        <div className="print-filter-summary">
          {cat && <span>Category: {cat}</span>}
          {sub && <span>Sub-category: {sub}</span>}
          {priceBand && <span>Price band: {priceBand}</span>}
          {discFilter && <span>Discount: {discFilter}</span>}
          {q && <span>Search: "{q}"</span>}
          <span>{filtered.length.toLocaleString()} SKUs shown</span>
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <Th k="desc">Product</Th>
              <Th k="category">Cat</Th>
              <Th k="cs" num>CS</Th>
              {!isQuotation && <Th k="bm" num>BM $/U</Th>}
              {!isQuotation && <Th k="dc" num>DC $/U</Th>}
              {!isQuotation && <Th k="diff_pct" num extra="col-pct">Diff %</Th>}
              <Th k="disc_price" num extra="col-disc">Disc $/U</Th>
              <Th k="disc_price_cs" num extra="col-disc">Disc $/CS</Th>
              {!isQuotation && <Th k="sv_carton" num>Save $/CS</Th>}
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, printing ? filtered.length : shown).map((p) => {
              const discPU  = calcDiscPricePerUnit(p, formulaParams);
              const discCS  = calcDiscPrice(p, formulaParams);
              const saveCS  = calcSavePerCarton(p, formulaParams);
              const dash    = <span style={{ color: '#9ca3af' }}>—</span>;
              return (
              <tr key={p.code}>
                <td>
                  <div className="desc">{safeStr(p.desc).trim() || '—'}</div>
                  {!isQuotation && <div className="supplier">{safeStr(p.supplier)} · {safeStr(p.subcategory)}</div>}
                </td>
                <td><span className="cat-tag">{safeStr(p.category)}</span></td>
                <td className="num">{p.cs}</td>
                {!isQuotation && <td className="num">{fmt2(p.bm)}</td>}
                {!isQuotation && <td className="num">{fmt2(p.dc)}</td>}
                {!isQuotation && (
                  <td className={'num pct col-pct ' + pctClass(p.diff_pct)}>
                    {p.diff_pct > 0 ? '+' : ''}{p.diff_pct.toFixed(1)}%
                  </td>
                )}
                <td className="num col-disc">
                  {discPU !== null ? fmt2(discPU) : dash}
                </td>
                <td className="num col-disc">
                  {discCS !== null ? fmt2(discCS) : dash}
                </td>
                {!isQuotation && (
                  <td className="num" style={{ color: '#047857', fontWeight: 600 }}>
                    {saveCS !== null ? fmt2(saveCS) : dash}
                  </td>
                )}
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!printing && shown < filtered.length && (
        <button className="load-more" onClick={() => setShown((s) => s + PAGE)}>
          Load more… ({(filtered.length - shown).toLocaleString()} remaining)
        </button>
      )}
    </div>
  );
}
