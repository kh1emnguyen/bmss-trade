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
  const [q, setQ] = useState('');

  // Navigate helpers that also clear the search
  const goToCategory = (cat) => { setPath({ category: cat, subcategory: null }); setQ(''); setPriceBand(''); };
  const goToSubcat   = (sub) => { setPath((p) => ({ ...p, subcategory: sub })); setQ(''); setPriceBand(''); };
  const goBack       = (level) => {
    if (level === 'root') setPath({ category: null, subcategory: null });
    else setPath((p) => ({ ...p, subcategory: null }));
    setQ('');
    setPriceBand('');
  };

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
    let out = rows.filter((r) => r.category === path.category && r.subcategory === path.subcategory);
    if (priceBand) {
      const band = bandById(priceBand);
      if (band) out = out.filter((r) => r.bm >= band.min && r.bm < band.max);
    }
    return out.sort((a, b) => b.sv_carton - a.sv_carton);
  }, [rows, path, priceBand]);

  // ── Level 1: category tiles ──────────────────────────────────────────────
  if (!path.category) {
    const term = q.trim().toLowerCase();
    const visible = term
      ? categoryNodes.filter((c) => c.name.toLowerCase().includes(term))
      : categoryNodes;
    const maxSv = Math.max(...visible.map((c) => c.sv), 1);
    return (
      <div className="section">
        <h2>Step 1 — Pick a category</h2>
        <div className="subtitle">Sorted by total per-carton savings (highest → lowest).</div>
        <div className="filter-row">
          <input
            type="search"
            placeholder="Search categories…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {q && <button className="clear-btn" onClick={() => setQ('')}>Clear</button>}
          <span className="count-info">{visible.length} of {categoryNodes.length} categories</span>
        </div>
        <div className="node-grid">
          {visible.map((c) => (
            <button
              key={c.name}
              className="node"
              onClick={() => goToCategory(c.name)}
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

  // ── Level 2: sub-category tiles ──────────────────────────────────────────
  if (!path.subcategory) {
    const term = q.trim().toLowerCase();
    const visible = term
      ? subcatNodes.filter((s) => s.name.toLowerCase().includes(term))
      : subcatNodes;
    const maxSv = Math.max(...visible.map((c) => c.sv), 1);
    return (
      <div className="section">
        <Breadcrumb path={path} goBack={goBack} />
        <h2>Step 2 — Pick a sub-category in {safeStr(path.category)}</h2>
        <div className="subtitle">Sorted by total per-carton savings (highest → lowest).</div>
        <div className="filter-row">
          <input
            type="search"
            placeholder="Search sub-categories…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {q && <button className="clear-btn" onClick={() => setQ('')}>Clear</button>}
          <span className="count-info">{visible.length} of {subcatNodes.length} sub-categories</span>
        </div>
        <div className="node-grid">
          {visible.map((s) => (
            <button
              key={s.name}
              className="node"
              onClick={() => goToSubcat(s.name)}
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

  // ── Level 3: product table ───────────────────────────────────────────────
  const term = q.trim().toLowerCase();
  const filteredProducts = term
    ? products.filter((p) => (safeStr(p.desc) + ' ' + safeStr(p.supplier)).toLowerCase().includes(term))
    : products;

  const bands = bandsForCategory(path.category);
  return (
    <div className="section">
      <Breadcrumb path={path} goBack={goBack} />
      <h2>{safeStr(path.subcategory)} — {filteredProducts.length}{filteredProducts.length !== products.length ? ` of ${products.length}` : ''} SKUs</h2>
      <div className="formula-callout">
        Highlighted columns: <b>Diff %</b> (DC vs BM) and <b>Disc Price</b> (applied margin). Disc Price is shown <b>only for WINE rows</b>.
 