import React, { useMemo, useState } from 'react';
import { fmt2, fmtMoney, pctClass, safeStr } from './utils';
import { bandsForCategory, bandById } from './pricing';

const CATEGORY_BRIEFS = [
  {
    category: 'WINE',
    title: 'Wine',
    tagline: 'Highest-margin export category — premium reds and Champagne carry the volume.',
    priority: 'high',
    insight: (
      <>
        Wine is the single biggest export opportunity. The market favours <b>premium Australian reds</b>{' '}
        — Penfolds Bin and Grange labels are the prestige anchors and carry $150-200/bottle in absolute savings.{' '}
        <b>Champagne</b> moves heavily around Tet, weddings, and corporate gifting; even in this dataset
        it shows the deepest percentage discounts.
        Mid-tier recognised brands (Yalumba, Wolf Blass, Jacob's Creek) cover the broad gifting band where the buyer
        wants something "Australian and known" without committing to icon pricing.
      </>
    ),
    pick: (rows) => {
      const isPenfolds = (r) => /PENFOLDS/i.test(r.desc);
      const isChampagne = (r) => /CHAMPAGNE/i.test(r.subcategory);
      const isPremiumRed = (r) => r.subcategory === 'WINE STILL RED' && r.bm >= 30;
      const isRecognisedBrand = (r) =>
        /(YALUMBA|WOLF BLASS|JACOB.S CREEK|HARDYS|HARDY.S|LINDEMAN|ROSEMOUNT|MCGUIGAN|WYNNS|TAYLOR.?S)/i.test(r.desc) && r.bm >= 18;
      const include = rows.filter((r) => isPenfolds(r) || isChampagne(r) || isPremiumRed(r) || isRecognisedBrand(r));
      return [...include].sort((a, b) => b.sv_carton - a.sv_carton).slice(0, 14);
    },
  },
  {
    category: 'SPIRITS',
    title: 'Spirits',
    tagline: 'Whisky and cognac dominate gifting; status liquor punches above its line count.',
    priority: 'high',
    insight: (
      <>
        Whisky — particularly <b>Scotch</b> (Johnnie Walker, Chivas, Glenfiddich, Macallan) — is the dominant
        professional-gifting and entertainment spirit in the market.{' '}
        <b>Cognac</b> (Hennessy, Martell, Remy Martin) is heavily associated with Lunar New Year and corporate gifting;
        margins are tight at the bottle level but volume on the prestige SKUs is strong.
        Premium gin and aged rums are emerging but not yet anchor categories. Vodka, tequila, and bourbon
        sell mostly at the on-premise level — focus on globally-recognised brands rather than craft.
      </>
    ),
    pick: (rows) => {
      const isScotch = (r) =>
        /(JOHNNIE WALKER|CHIVAS|GLENFIDDICH|MACALLAN|GLENLIVET|SINGLETON|BALLANTINE|DEWAR|MONKEY SHOULDER|TALISKER|LAGAVULIN|JURA|BOWMORE|GLENMORANGIE|HIGHLAND PARK)/i.test(r.desc);
      const isCognac = (r) =>
        /(HENNESSY|MARTELL|REMY MARTIN|COURVOISIER|CAMUS|HINE)/i.test(r.desc) || /COGNAC/i.test(r.subcategory);
      const isPremiumGin = (r) => r.subcategory === 'GIN' && r.bm >= 35;
      const isGlobalVodka = (r) => /(GREY GOOSE|BELVEDERE|ABSOLUT ELYX|KETEL ONE)/i.test(r.desc);
      const include = rows.filter((r) => isScotch(r) || isCognac(r) || isPremiumGin(r) || isGlobalVodka(r));
      return [...include].sort((a, b) => b.sv_carton - a.sv_carton).slice(0, 14);
    },
  },
  {
    category: 'LIQUEURS',
    title: 'Liqueurs',
    tagline: 'Steady gift-pack trade — Western brands with box appeal.',
    priority: 'medium',
    insight: (
      <>
        Liqueurs sell as <b>recognised Western gift items</b> rather than mixology stock. Baileys, Cointreau,
        Kahlua, Grand Marnier and Drambuie all have packaging recognition that survives the import pipeline.
        Margins are modest but the SKU count is small enough that you can ship a curated assortment as part of a
        wider order without committing dedicated freight space.
      </>
    ),
    pick: (rows) => {
      const isCore = (r) =>
        /(BAILEYS|BAILEY.S|COINTREAU|KAHLUA|GRAND MARNIER|DRAMBUIE|GALLIANO|FRANGELICO|DISARONNO|CHARTREUSE|JAGERMEISTER|TIA MARIA|MIDORI|SAMBUCA)/i.test(r.desc);
      const include = rows.filter(isCore);
      return [...include].sort((a, b) => b.sv_carton - a.sv_carton).slice(0, 12);
    },
  },
  {
    category: 'BEER',
    title: 'Beer',
    tagline: 'Tight category — local production dominates; only premium imports compete.',
    priority: 'low',
    insight: (
      <>
        The market is largely served by local breweries (Saigon, 333, Ha Noi, Tiger). Imported beer competes only
        on <b>premium positioning</b> — well-recognised European or Japanese lagers in upscale bars and hotels.
        Discounts here are tight at the unit level and freight cost-per-litre is unfavourable, so don't lead with beer
        unless the buyer specifically requests it for a hospitality account.
      </>
    ),
    pick: (rows) => {
      const isPremiumImport = (r) =>
        /(HEINEKEN|ASAHI|CORONA|STELLA ARTOIS|PERONI|GROLSCH|HOEGAARDEN|KIRIN|SAPPORO|BECK)/i.test(r.desc);
      const include = rows.filter((r) => isPremiumImport(r) && r.diff_pct < 0);
      return [...include].sort((a, b) => a.diff_pct - b.diff_pct).slice(0, 10);
    },
  },
  {
    category: 'CIDER',
    title: 'Cider',
    tagline: 'Niche but growing — younger urban demographic, especially women.',
    priority: 'medium',
    insight: (
      <>
        Cider is still a young category in the target market — most movement is in HCMC and Ha Noi urban bars and
        female-led social occasions. Apple and pear ciders from recognised global brands lead;{' '}
        <b>Strongbow, Somersby, Magners</b> and <b>Rekorderlig</b> have the strongest name recognition.
        Limited volume but a useful fill-in alongside a wine or spirits container.
      </>
    ),
    pick: (rows) => {
      const isCore = (r) =>
        /(STRONGBOW|SOMERSBY|MAGNERS|REKORDERLIG|BULMERS|3 OAKES|LITTLE GREEN|KOPPARBERG)/i.test(r.desc);
      const include = rows.filter((r) => isCore(r) && r.diff_pct < 0);
      const fallback = include.length >= 3 ? include : rows.filter((r) => r.diff_pct < 0);
      return [...fallback].sort((a, b) => a.diff_pct - b.diff_pct).slice(0, 10);
    },
  },
  {
    category: 'RTDS',
    title: 'RTDs',
    tagline: 'Skew to globally-recognised pre-mixes only — local taste is conservative.',
    priority: 'low',
    insight: (
      <>
        RTDs have limited established demand outside the urban under-30 segment. The market
        gravitates to <b>globally-recognised pre-mixes</b> — Smirnoff Ice, Jack Daniel's and Cola, Jim Beam and Cola.
        Smaller-format or craft RTDs don't translate. Treat as a top-up category alongside spirits orders rather
        than a primary import line.
      </>
    ),
    pick: (rows) => {
      const isCore = (r) =>
        /(SMIRNOFF ICE|JACK DANIEL|JIM BEAM|JOHNNIE WALKER|JOSE CUERVO|BACARDI)/i.test(r.desc);
      const include = rows.filter((r) => isCore(r) && r.diff_pct < 0);
      return [...include].sort((a, b) => a.diff_pct - b.diff_pct).slice(0, 10);
    },
  },
];

function calcDiscPrice(r, params) {
  if (r.category !== 'WINE') return null;
  const d1 = parseFloat(params.d1) || 1;
  const d2 = parseFloat(params.d2) || 1;
  const m1 = parseFloat(params.m1) || 1;
  const m2 = parseFloat(params.m2) || 1;
  return (r.dc * r.cs) / d1 / d2 * m1 * m2;
}

export default function MarketPicks({ rows, formulaParams = { d1: '1.1', d2: '1.29', m1: '1.145', m2: '1.05' } }) {
  const [selected, setSelected] = useState('WINE');
  const [priceBand, setPriceBand] = useState('');
  const [q, setQ] = useState('');

  const briefs = useMemo(
    () =>
      CATEGORY_BRIEFS.map((b) => {
        const catRows = rows.filter((r) => r.category === b.category);
        const picks = b.pick(catRows);
        const totalSave = picks.reduce((s, r) => s + r.sv_carton, 0);
        const avgDisc = picks.length ? picks.reduce((s, r) => s + r.diff_pct, 0) / picks.length : 0;
        return { ...b, totalLines: catRows.length, picks, totalSave, avgDisc };
      }),
    [rows]
  );

  const current = briefs.find((b) => b.category === selected) || briefs[0];

  const visiblePicks = useMemo(() => {
    if (!current) return [];
    let out = current.picks;
    if (priceBand) {
      const band = bandById(priceBand);
      if (band) out = out.filter((r) => r.bm >= band.min && r.bm < band.max);
    }
    if (q.trim()) {
      const term = q.trim().toLowerCase();
      out = out.filter((r) => (safeStr(r.desc) + ' ' + safeStr(r.supplier)).toLowerCase().includes(term));
    }
    return out;
  }, [current, priceBand, q]);

  const currentBands = current ? bandsForCategory(current.category) : [];
  const hasFilters = priceBand || q.trim();

  return (
    <div className="section">
      <h2>Trade Opportunities — curated picks per category</h2>
      <div className="subtitle">
        Categories are scored on fit with overseas trade demand: spirits and premium wine carry the
        gifting and prestige weight; beer, cider, and RTDs are top-up plays. Click a category to see the
        emphasized SKUs.
      </div>

      <div className="market-grid">
        {briefs.map((b) => (
          <button
            key={b.category}
            className={'market-node' + (b.category === selected ? ' selected' : '')}
            onClick={() => { setSelected(b.category); setPriceBand(''); setQ(''); }}
          >
            <span className={'market-priority ' + b.priority}>
              {b.priority === 'high' ? 'Lead category' : b.priority === 'medium' ? 'Secondary' : 'Top-up only'}
            </span>
            <div className="market-cat">{b.title}</div>
            <div className="market-tagline">{b.tagline}</div>
            <div className="market-stats">
              <div className="market-stat">Picks<b>{b.picks.length}</b></div>
              <div className="market-stat">Save / carton<b>{fmtMoney(b.totalSave)}</b></div>
              <div className="market-stat">Avg disc.<b>{b.avgDisc.toFixed(1)}%</b></div>
            </div>
          </button>
        ))}
      </div>

      {current && (
        <div className="market-detail">
          <h3>{current.title} — why it works</h3>
          <div className="market-prose">{current.insight}</div>

          <div className="picks-heading">
            Emphasized SKUs ({visiblePicks.length}
            {current.picks.length === 0 ? ' — broaden the curation rule' : ''}
            {hasFilters && current.picks.length !== visiblePicks.length ? ' of ' + current.picks.length : ''})
          </div>

          <div className="filter-row">
            <input
              type="search"
              placeholder="Search description, supplier..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <select value={priceBand} onChange={(e) => setPriceBand(e.target.value)} title="Per-unit price band">
              <option value="">Any unit price</option>
              {currentBands.map((b) => (
                <option key={b.id} value={b.id}>{b.label}</option>
              ))}
            </select>
            {hasFilters && (
              <button className="clear-btn" onClick={() => { setPriceBand(''); setQ(''); }}>Clear</button>
            )}
            <span className="count-info">{visiblePicks.length} of {current.picks.length} picks</span>
          </div>

          {visiblePicks.length === 0 ? (
            <div style={{ fontSize: 13, color: '#6b7280' }}>
              {current.picks.length === 0
                ? 'No SKUs matched the curated rule for this category in the current dataset. Use Tab 1 (All SKUs) to filter manually.'
                : 'No picks match the current filters. Try clearing the search or price band.'}
            </div>
          ) : (
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
                  {visiblePicks.map((p) => (
                    <tr key={p.code}>
                      <td>
                        <div className="desc">{safeStr(p.desc).trim() || '—'}</div>
                        <div className="supplier">{safeStr(p.supplier)} · {safeStr(p.subcategory)}</div>
                      </td>
                      <td className="num">{p.cs}</td>
                      <td className="num">{fmt2(p.bm)}</td>
                      <td className="num">{fmt2(p.dc)}</td>
                      <td className={'num pct col-pct ' + pctClass(p.diff_pct)}>
                        {p.diff_pct > 0 ? '+' : ''}{p.diff_pct.toFixed(1)}%
                      </td>
                      <td className="num col-disc">
                        {p.category === 'WINE'
                          ? fmt2(calcDiscPrice(p, formulaParams))
                          : <span style={{ color: '#9ca3af' }}>—</span>}
                      </td>
                      <td className="num" style={{ color: '#047857', fontWeight: 600 }}>
                        {fmt2(p.sv_carton)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
