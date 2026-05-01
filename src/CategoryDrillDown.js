import React, { useMemo, useState } from 'react';
import { fmtMoney, fmt2, pctClass, safeStr } from './utils';
import { bandsForCategory, bandById } from './pricing';

function calcDiscPrice(r, params) {
  if (r.category !== 'WINE') return null;
  const d1 = parseFloat(params.d1) || 1;
  const d2 = parseFloat(params.d2) || 1;
  const m1 = parseFloat(params.m1) || 1;
  const m2 = parseFloat(params.m2) || 1;
  return (r.dc * r.cs) / d1 / d2 * m1 * m2;
}

export default function CategoryDrillDown({ rows, formulaParams = { d1: '1.1', d2: '1.29', m1: '1.145', m2: '1.05' } }) {
  const [path, setPath] = useState({ category: null, subcategory: null });
  const [priceBand, setPriceBand] = useState('');

  const categoryNodes = useMemo(() => {
    const by = new Map();
    rows.forEach((r) => {
      const k = r.category;
      if (!by.has(k)) by.set(k, { name: k, n: 0, sv: 0, sub: new Set(), best: 0 });
      const x = by.get(k);
      x.n += 1;
      x.sv += r.sv_carton;
      x.sub.add(r.subcategory);
      if (r.diff_pct < x.best) x.best = r.diff_pct;
    });
    return Array.from(by.values())
      .map((x) => {
        const xrows = rows.filter((r) => r.category === x.name);
        const avg_pct = xrows.length ? xrows.reduce((s, r) => s + r.diff_pct, 0) / xrows.length : 0;
        return { ...x, sub: x.sub.size, avg_pct };
      })
      .sort((a, b) => b.sv - a.sv);
  }, [rows]);

  const subcatNodes = useMemo(() => {
    if (!path.category) return [];
    const filtered = rows.filter((r) => r.category === path.category);
    const by = new Map();
    filtered.forEach((r) => {
      const k = r.subcategory;
      if (!by.has(k)) by.set(k, { name: k, n: 0, sv: 0, best: 0 });
      const x = by.get(k);
      x.n += 1;
      x.sv += r.sv_carton;
      if (r.diff_pct < x.best) x.best = r.diff_pct;
    });
    return Array.from(by.values())
      .map((x) => {
        const xrows = filtered.filter((r) => r.subcategory === x.name);
        const avg_pct = xrows.length ? xrows.reduce((s, r) => s + r.diff_pct, 0) / xrows.length : 0;
        return { ...x, avg_pct };
      })
      .sort((a, b) => b.sv - a.sv);
  }, [rows, path.category]);

  const products = useMemo(() => {
    if (!path.category || !path.subcategory) return [];
    let out = rows
      .filter((r) => r.category === path.category && r.subcategory === path.subcategory);
    if (priceBand) {
      const band = bandById(priceBand);
      if (band) out = out.filter((r) => r.bm >= band.min && r.bm < band.max);
    }
    return out.sort((a, b) => b.sv_carton - a.sv_carton);
  }, [rows, path, priceBand]);

  if (!path.category) {
    const maxSv = Math.max(...categoryNodes.map((c) => c.sv), 1);
    return (
      <div className="section">
        <h2>Step 1 — Pick a category</h2>
        <div className="subtitle">Sorted by total per-carton savings (highest → lowest).</div>
        <div className="node-grid">
          {categoryNodes.map((c) => (
            <button
              key={c.name}
              className="node"
              onClick={() => setPath({ category: c.name, subcategory: null })}
            >
              <div className="node-title">{safeStr(c.name)}</div>
              <div className="node-meta">
                <span>{c.n} SKUs</span>
                <span>{c.sub} sub-categories</span>
                <span>avg {c.avg_pct.toFixed(1)}%</span>
              </div>
              <div className="node-stat">
                <span className="stat-big">{fmtMoney(c.sv)}</span>
                <span className="stat-unit">total save / carton</span>
              </div>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: ((c.sv / maxSv) * 100).toFixed(1) + '%' }} />
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (!path.subcategory) {
    const maxSv = Math.max(...subcatNodes.map((c) => c.sv), 1);
    return (
      <div className="section">
        <Breadcrumb path={path} setPath={setPath} />
        <h2>Step 2 — Pick a sub-category in {safeStr(path.category)}</h2>
        <div className="subtitle">Sorted by total per-carton savings (highest → lowest).</div>
        <div className="node-grid">
          {subcatNodes.map((s) => (
            <button
              key={s.name}
              className="node"
              onClick={() => setPath({ ...path, subcategory: s.name })}
            >
              <div className="node-title">{safeStr(s.name)}</div>
              <div className="node-meta">
                <span>{s.n} SKUs</span>
                <span>avg {s.avg_pct.toFixed(1)}%</span>
                <span>best {s.best.toFixed(1)}%</span>
              </div>
              <div className="node-stat">
                <span className="stat-big">{fmtMoney(s.sv)}</span>
                <span className="stat-unit">total save / carton</span>
              </div>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: ((s.sv / maxSv) * 100).toFixed(1) + '%' }} />
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const bands = bandsForCategory(path.category);
  return (
    <div className="section">
      <Breadcrumb path={path} setPath={setPath} />
      <h2>{safeStr(path.subcategory)} — {products.length} SKUs</h2>
      <div className="formula-callout">
        Highlighted columns: <b>Diff %</b> (DC vs BM) and <b>Disc Price</b> (applied margin). Disc Price is shown <b>only for WINE rows</b>.
      </div>
      <div className="filter-row">
        <select value={priceBand} onChange={(e) => setPriceBand(e.target.value)} title="Per-unit price band">
          <option value="">Any unit price</option>
          {bands.map((b) => (
            <option key={b.id} value={b.id}>{b.label}</option>
          ))}
        </select>
        {priceBand && (
          <button className="clear-btn" onClick={() => setPriceBand('')}>Clear price</button>
        )}
        <span className="count-info">{products.length} SKUs</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th className="num">CS</th>
              <th className="num">BM $</th>
              <th className="num">DC $</th>
              <th className="num col-pct">Diff %</th>
              <th className="num col-disc">Disc Price</th>
              <th className="num">Save / Carton</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.code}>
                <td>
                  <div className="desc">{safeStr(p.desc).trim() || '—'}</div>
                  <div className="supplier">{safeStr(p.supplier)}</div>
                </td>
                <td className="num">{p.cs}</td>
                <td className="num">{fmt2(p.bm)}</td>
                <td className="num">{fmt2(p.dc)}</td>
                <td className={'num pct col-pct ' + pctClass(p.diff_pct)}>
                  {p.diff_pct > 0 ? '+' : ''}{p.diff_pct.toFixed(1)}%
                </td>
                <td className="num col-disc">
                  {p.category === 'WINE' ? fmt2(calcDiscPrice(p, formulaParams)) : <span style={{ color: '#9ca3af' }}>—</span>}
                </td>
                <td className="num" style={{ color: '#047857', fontWeight: 600 }}>
                  {fmt2(p.sv_carton)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Breadcrumb({ path, setPath }) {
  return (
    <div className="breadcrumb">
      <button onClick={() => setPath({ category: null, subcategory: null })}>All categories</button>
      <span className="sep">›</span>
      {path.subcategory ? (
        <>
          <button onClick={() => setPath({ category: path.category, subcategory: 