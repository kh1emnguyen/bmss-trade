# bmss-swing-trade

Interactive trade opportunity dashboard comparing **BM** (BMSS / ALM 4420) and **DC** (Duncans / ALM 2088) pricelists. Two views — a category drill-down and an all-SKU table — with a baked-in **Discount Price** column quotable to trade clients. Scope: alcohol categories only (WINE, SPIRITS, RTDS, CIDER, LIQUEURS, BEER).

Built on **Create React App** (matches the v1 repo layout: `public/index.html` + `src/index.js`, `.js` files throughout).

## Quick start

```bash
npm install
npm start
```

The dev server opens at <http://localhost:3000>.

## File layout

```
bmss-swing-trade/
├── package.json              react-scripts 5.0.1, React 18
├── public/
│   └── index.html            CRA root template
└── src/
    ├── index.js              Entry: ReactDOM.createRoot
    ├── App.js                Top-level shell (summary cards, tabs)
    ├── CategoryDrillDown.js  Page 1: Category → Sub-category → Products
    ├── OpportunitiesPage.js  Page 2: Filterable all-SKU table
    ├── utils.js              Defensive formatters
    ├── styles.css            All styling
    └── data.json             4,362 matched SKUs (precomputed)
```

## Push to GitHub

After unzipping:

```bash
cd bmss-swing-trade
git init
git add .
git commit -m "Initial commit: bmss-swing-trade"
git branch -M main

# Create an empty repo on github.com named bmss-swing-trade first, then:
git remote add origin git@github.com:<your-username>/bmss-swing-trade.git
git push -u origin main
```

## Filter rules baked into `data.json`

- ALM Warehouse rows only.
- Matched on Item Code across both pricelists.
- DC unit price ≤ BM × 1.05 (DC cheaper, at par, or up to 5% pricier).
- ≥ $10/unit minimum on **WINE** and **SPIRITS** only — every other category keeps low-priced lines.

## Discount Price formula

The Disc Price column (WINE only) is computed **live in the browser** from a four-input formula panel visible only to the operator — it is hidden when exporting to PDF. The default parameters:

| Param | Default | Role |
|-------|---------|------|
| D1 | 1.1 | Strip GST |
| D2 | 1.29 | Strip wholesale markup |
| M1 | 1.145 | Trade margin |
| M2 | 1.05 | Buffer |

`Discount Price = DC Carton ÷ D1 ÷ D2 × M1 × M2`

Change any value in-app; all three tabs recalculate instantly. The formula and its inputs are stripped from PDF exports.

## Deploy

```bash
npm run build      # outputs build/ folder for static hosting
```
