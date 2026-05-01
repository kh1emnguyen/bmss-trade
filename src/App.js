import React, { useMemo, useState, useEffect, useRef } from 'react';
import data from './data.json';
import CategoryDrillDown from './CategoryDrillDown';
import OpportunitiesPage from './OpportunitiesPage';
import MarketPicks from './MarketPicks';
import { fmtMoney, fmt2, safeStr, safeNum } from './utils';

const TAB_LABELS = { all: '1 · All SKUs', categories: '2 · Category Drill-Down', market: '3 · Trade Opportunities' };

export default function App() {
  const [tab, setTab] = useState('all');
  const [printing, setPrinting] = useState(false);
  const printTimestamp = useRef('');

  // Listen for browser afterprint event to restore normal state.
  useEffect(() => {
    const handler = () => setPrinting(false);
    window.addEventListener('afterprint', handler);
    return () => window.removeEventListener('afterprint', handler);
  }, []);

  const handleExportPdf = () => {
    printTimestamp.current = new Date().toLocaleString('en-AU', {
      dateStyle: 'medium', timeStyle: 'short',
    });
    setPrinting(true);
    // Two animation frames: first lets React re-render with all rows,
    // second lets the browser paint, then we open the print dialog.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => window.print())
    );
  };

  // Defensive: ensure data is an array of well-shaped rows.
  const rows = useMemo(() => {
    const src = Array.isArray(data) ? data : [];
    return src.map((r) => ({
      code: safeStr(r && r.code),
      desc: safeStr(r && r.desc),
      supplier: safeStr(r && r.supplier),
      category: safeStr(r && r.category) || 'OTHER',
      subcategory: safeStr(r && r.subcategory) || 'OTHER',
      cs: safeNum(r && r.cs),
      bm: safeNum(r && r.bm),
      dc: safeNum(r && r.dc),
      diff_pct: safeNum(r && r.diff_pct),
      diff_abs: safeNum(r && r.diff_abs),
      sv_carton: safeNum(r && r.sv_carton),
      disc_price: safeNum(r && r.disc_price),
    }));
  }, []);

  const summary = useMemo(() => {
    const total = rows.length;
    if (!total) {
      return { total: 0, cheaper: 0, avgDisc: 0, totalSave: 0, top: null, cats: 0 };
    }
    const cheaper = rows.filter((r) => r.diff_pct < 0).length;
    const avgDisc = rows.reduce((s, r) => s + r.diff_pct, 0) / total;
    const totalSave = rows.reduce((s, r) => s + r.sv_carton, 0);
    const top = [...rows].sort((a, b) => b.sv_carton - a.sv_carton)[0];
    const cats = new Set(rows.map((r) => r.category));
    return { total, cheaper, avgDisc, totalSave, top, cats: cats.size };
  }, [rows]);

  return (
    <div className="app">
      <div className="app-header-row">
        <div>
          <h1>BMSS Trade Opportunity Dashboard — BM vs DC</h1>
          <div className="subtitle">
            All-SKU comparison · DC ≤ BM × 1.05 · ≥ $10/unit on Wine &amp; Spirits · Discount Price = DC ÷ 1.1 ÷ 1.29 × 1.145 × 1.05
          </div>
        </div>
        <button className="btn-export" onClick={handleExportPdf} title="Export current view to PDF">
          Export PDF
        </button>
      </div>

      {/* Shown only in print — timestamp + active tab label */}
      <div className="print-meta">
        <span>BMSS Trade Dashboard — {TAB_LABELS[tab]}</span>
        <span>Exported {printTimestamp.current}</span>
      </div>

      {summary.top && (
        <div className="banner">
          <b>{summary.total.toLocaleString()}</b> SKUs qualify across <b>{summary.cats}</b> categories.
          DC averages <b>{summary.avgDisc.toFixed(1)}%</b> vs BM. Total per-carton savings: <b>{fmtMoney(summary.totalSave)}</b>.
          Biggest single line: <b>{summary.top.desc.trim() || '—'}</b>{' '}
          ({fmt2(Math.abs(summary.top.diff_abs))}/unit, {fmtMoney(summary.top.sv_carton)}/carton).
        </div>
      )}

      <div className="summary-grid">
        <div className="summary-card">
          <div className="label">Qualifying SKUs</div>
          <div className="value">{summary.total.toLocaleString()}</div>
          <div className="sub">DC ≤ BM × 1.05</div>
        </div>
        <div className="summary-card">
          <div className="label">DC strictly cheaper</div>
          <div className="value">{summary.cheaper.toLocaleString()}</div>
          <div className="sub">
            {summary.total ? ((summary.cheaper / summary.total) * 100).toFixed(1) : '0'}% of matched lines
          </div>
        </div>
        <div className="summary-card">
          <div className="label">Avg DC vs BM</div>
          <div className="value">{summary.avgDisc.toFixed(1)}%</div>
          <div className="sub">structural account-tier gap</div>
        </div>
        <div className="summary-card">
          <div className="label">Total save / carton</div>
          <div className="value">{fmtMoney(summary.totalSave)}</div>
          <div className="sub">summed across all qualifying SKUs</div>
        </div>
      </div>

      <div className="tabs">
        <button
          className={'tab' + (tab === 'all' ? ' active' : '')}
          onClick={() => setTab('all')}
        >
          1 · All SKUs
        </button>
        <button
          className={'tab' + (tab === 'categories' ? ' active' : '')}
          onClick={() => setTab('categories')}
        >
          2 · Category Drill-Down
        </button>
        <button
          className={'tab' + (tab === 'market' ? ' active' : '')}
          onClick={() => setTab('market')}
        >
          3 · Trade Opportunities
        </button>
      </div>

      {tab === 'all' && <OpportunitiesPage rows={rows} printing={printing} />}
      {tab === 'categories' && <CategoryDrillDown rows={rows} printing={printing} />}
      {tab === 'market' && <MarketPicks rows={rows} printing={printing} />}

      <div className="methodology">
        <b>Methodology.</b> Unit price = Carton Cost (incl. taxes + allowance) ÷ Carton Size.
        SKUs matched by exact Item Code across both pricelists. Filters: DC unit price ≤ BM × 1.05 (DC cheaper, at par, or up to 5% pricier);
        ≥ $10/unit on WINE and SPIRITS only; ALM Warehouse rows only.
        Save / carton = (BM − DC) × DC carton size.
        <br /><br />
        <b>Discount Price.</b> <code>DC ÷ 1.1 ÷ 1.29 × 1.145 × 1.05 ≈ DC × 0.847</code>.
        Strips 10% GST and the 29% wholesale markup off the DC purchase price, then layers a 14.5% trade margin and a 5% buffer
        to give the quotable trade price. The 29% wholesale markup is wine-specific, so the column is shown <b>only for WINE rows</b>;
        spirits, beer, cider, RTDs, and liqueurs use different markup structures and aren't comparable through this formula.
      </div>
    </div>
  );
}
