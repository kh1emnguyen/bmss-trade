# Trade Opportunity Brief — BM vs DC Pricelists (v2)

**Hand-off note for the partner.** This brief gives Claude (or any LLM) enough context to spin the project back up, understand the numbers, regenerate the dataset from a fresh export, and answer questions about what to import/export. Drop the whole document into a new Claude conversation and attach the React project + the two CSV pricelists when relevant.

---

## 1. The two ALM accounts

| Code in the app | Real account | What it is |
| --- | --- | --- |
| **BM** | ALM account 4420 | Bottlemart Sunshine (BMSS) — family-owned cafe / pub / alcohol retail venue in Sunshine, Melbourne. |
| **DC** | ALM account 2088 | Duncans — a separate ALM-supplied retailer that historically prices below BM across the catalogue. |

Both accounts pull from the same supplier (ALM Warehouse), so the line-by-line price difference reflects account-tier discounting plus line-specific promotions. The app uses **BM/DC** throughout — the underlying retailers are not surfaced.

The trade opportunity: leverage the cheaper DC pricing as the buy-cost when re-exporting.

## 2. Source data

Both files are direct CSV exports from the ALM portal's "Product Export" function. Columns we care about:

- `Warehouse / Connect Item` — keep only `ALM Warehouse` rows.
- `Category` — three-level path, e.g. `WINE / WINE, ALL STILL / WINE STILL RED`.
- `Item code` — the matching key across the two files.
- `Description` — product name + size suffix.
- `Carton Size` — units per carton.
- `Carton Cost (Incl Taxes & Allowance)` — the actual per-carton buy cost. Per-unit price = carton cost ÷ carton size.

## 3. Filter rules baked into the dataset

1. ALM Warehouse rows only.
2. Match SKUs by exact Item Code.
3. Keep lines where DC unit price ≤ BM unit price × 1.05 (DC cheaper, at par, or up to 5% pricier).
4. Drop wine/spirits lines under $10/unit. Other categories keep all matched lines.
5. **Restrict to alcohol categories only**: WINE, SPIRITS, RTDS, CIDER, LIQUEURS, BEER. Non-alcohol SKUs are excluded.

Final qualifying set (29-Apr-26 exports): **3,865 SKUs**.

| Category | SKUs |
| --- | --- |
| WINE | 1,290 |
| SPIRITS | 904 |
| RTDS | 704 |
| BEER | 643 |
| LIQUEURS | 224 |
| CIDER | 100 |

## 4. The Discount Price formula (WINE only)

The Discount Price is a headline number quotable to trade clients. It is computed **client-side in the browser** using a four-parameter formula that the operator can adjust at any time via the formula panel in the app header. The formula is not exposed in PDF exports.

The general structure is:

```
Discount Price = DC Carton ÷ D1 ÷ D2 × M1 × M2
```

| Parameter | Default | Meaning |
| --- | --- | --- |
| D1 | 1.1 | Strip GST (DC price is GST-inclusive; export pricing is ex-GST) |
| D2 | 1.29 | Strip wholesale markup baked into the ALM-listed price |
| M1 | 1.145 | Apply trade margin |
| M2 | 1.05 | Apply buffer (freight / FX / disputes) |

The operator can change any of the four values in-app to reflect current deal terms. The updated Disc Price recalculates instantly across all tabs.

**Important — wine only.** The formula assumes a wine-specific 29% wholesale markup (D2 default). Spirits, liqueurs, beer, cider, and RTDs use different markup structures and excise treatments. The Discount Price column therefore shows a value **only for WINE rows**; all other categories display "—". If trade pricing is needed for non-wine categories, a separate formula reflecting their cost structure would need to be built.

## 5. The React app — three tabs

The app is a Create React App project (`react-scripts 5.0.1`, React 18). All source files use `.js` extensions. Three tabs in this order:

**Tab 1 — All SKUs** *(default view).* Single filterable, sortable table with all 3,865 SKUs. Default sort: **Diff % ascending** (largest DC discount first). The two columns most relevant to a trade decision — **Diff %** and **Disc Price** — are visually highlighted with subtle green/blue tints. The Disc Price column shows a value only for WINE rows (see §4). Filters: full-text search, category, sub-category, **per-unit price band** (tier-aware — see §5.1), discount band.

**Tab 2 — Category Drill-Down.** Three-level navigation: alcohol category → sub-category → individual SKUs. At every level, sorted by total per-carton savings descending so the highest-dollar opportunities surface first.

**Tab 3 — Trade Opportunities.** Curated commentary with one node per category, scored on fit with overseas trade demand:

- **Lead categories (high priority)**: WINE, SPIRITS — the volume and prestige drivers.
- **Secondary**: LIQUEURS, CIDER — useful fill-ins.
- **Top-up only**: BEER, RTDs — limited fit, only on specific buyer requests.

Each node, when clicked, shows a prose explanation of why the category fits, plus 10–14 emphasized SKUs filtered by brand keyword and price tier (e.g. WINE highlights Penfolds + Champagne + recognised mid-tier; SPIRITS highlights Scotch + Cognac; LIQUEURS highlights Baileys/Cointreau/Kahlúa-class gift items). The picks list has its own **per-unit price band** filter scoped to the selected category's tier. The curation rules live inline in `src/MarketPicks.js` and are easy to tweak.

### 5.1 Per-unit price bands (tier-aware)

The price filter splits into two tiers based on category:

| Tier | Categories | Bands |
| --- | --- | --- |
| Premium | WINE, SPIRITS, LIQUEURS | $0–$20, $20–$40, $40–$60, $60–$80, $80–$100, $100+ |
| Volume | BEER, CIDER, RTDs | $0–$3, $3–$5, $5–$7, $7–$10, $10+ |

Bands are based on **BM unit price** (the standard list reference). On Tab 1 (All SKUs), selecting a band auto-narrows the categories to that tier. On Tabs 2 and 3 the filter only shows the bands relevant to the active category.

## 6. How to read the numbers

- **The structural ~22% DC-vs-BM gap** isn't a deal — it's an account-tier difference. Anything inside that band is "free" arbitrage. Anything **beyond** that band (-30% or worse) is a line-specific promotion and worth reacting to before it expires.
- **WINE dominates the savings pool** ($60k+ per-carton total) and within wine, **STILL RED** is the largest single sub-category. This matches the on-the-ground intuition that premium Australian reds are the cleanest export play.
- **Penfolds Bin / Grange lines** punch above their weight — small SKU count but $150–200/bottle absolute savings. Prioritise for high-net-worth clients where prestige labels carry the deal.
- **BEER** mostly nets to ~zero or slightly negative per carton. Don't waste freight on it unless the client specifically asks.
- **Spirits and Champagne** carry the gifting trade — Lunar New Year, weddings, corporate gifts. Time orders accordingly.

## 7. Regenerating the dataset from a fresh export

Hand the partner two new ALM Product Export CSVs (one per account) and ask Claude to:

1. Filter both to ALM Warehouse rows.
2. Compute per-unit price = Carton Cost ÷ Carton Size for both files.
3. Match by Item Code, keep lines where `DC ≤ BM × 1.05`.
4. Drop wine/spirits lines under $10/unit.
5. Restrict to categories: WINE, SPIRITS, RTDS, CIDER, LIQUEURS, BEER.
6. Compute `disc_price = DC / D1 / D2 * M1 * M2` using the current formula panel values (defaults: D1=1.1, D2=1.29, M1=1.145, M2=1.05). Note: disc_price in data.json is stored with defaults; the live app always recalculates client-side from the panel inputs.
7. Compute `sv_carton = (BM − DC) × DC.carton_size`.
8. Output the same JSON shape (one row per SKU with: code, desc, supplier, category, subcategory, cs, bm, dc, diff_pct, diff_abs, sv_carton, disc_price) and overwrite `src/data.json`.

## 8. Project layout

```
bmss-trade-v2/
├── package.json              react-scripts 5.0.1, React 18
├── public/
│   └── index.html            CRA root template
└── src/
    ├── index.js              Entry: ReactDOM.createRoot
    ├── App.js                Top-level shell with three tabs
    ├── OpportunitiesPage.js  Tab 1: All SKUs (default)
    ├── CategoryDrillDown.js  Tab 2: Category → Sub-category → Products
    ├── MarketPicks.js        Tab 3: Curated category nodes + emphasized SKUs
    ├── pricing.js            Per-unit price tiers/bands + tier-aware filter helper
    ├── utils.js              Defensive formatters (safeStr, safeNum, fmt2, fmtMoney, pctClass)
    ├── styles.css            All styling
    └── data.json             3,865 matched alcohol SKUs (precomputed)
```

## 9. Open questions

- Does the 14.5% trade margin and 5% buffer want to flex by category? Premium wine should probably carry a fatter margin than commodity beer; right now the formula is uniform.
- Import duties, WET adjustments, and freight aren't modelled. If the partner wants the Discount Price to be landed-in-destination rather than ex-Australia, those steps need to be added.
- Promo windows aren't tracked. If a SKU's `diff_pct` is materially deeper than the ~22% category baseline, it's likely a flash promo and the price advantage may not last past the next ALM cycle.

---

*Migration brief — bmss-trade-v2. Reach out to Khiem before adjusting the formula or filter rules so we keep one source of truth.*

---

## 10. Cowork Scheduled Task — Monday Data Refresh

This section is read and executed directly by Claude (Cowork). No manual chat input is needed — the prompt below is the task.

### One-time setup before scheduling

**Two steps. No terminal. No git. No GitHub account.**

**Step A — Get a token from Khiem.**
Ask Khiem to send you a GitHub access token (a short string starting with `github_pat_` or `ghp_`). He generates this from his GitHub account — it takes him 2 minutes. You just need to receive it (e.g. via WhatsApp or email).

**Step B — Drop the token into Cowork.**
Import this `bmss-trade` folder into Cowork, then type exactly this into the chat:

> *"Set up my GitHub config using this token: [paste the token Khiem sent]"*

Cowork will create `scripts/config.json` for you automatically. The repo, branch, and everything else are already pre-filled — the token is the only thing that changes per person.

**Step C — Export CSVs on Monday mornings.**
Before the scheduled task runs each Monday, export both pricelists from the ALM portal and save them to your Downloads folder. The filenames must match this pattern exactly:
`ProductExport_<8-digit-ALM-code>-user_DD-MM-YY HH-MM-SS.csv`
- BM account code: **4420**
- DC account code: **2088**

That is the entire setup.

---

### Cowork Scheduled Task Prompt

> Copy this block verbatim into Cowork's "Schedule" skill when creating the Monday task. Claude will execute it without any further input.

---

**BMSS Trade — Monday data refresh**

You are running an automated weekly task. Do not ask clarifying questions — execute all steps in order.

**Context:** The selected workspace folder IS the bmss-trade project. It contains a React dashboard comparing BM (ALM account 4420) and DC (ALM account 2088) pricelists. The data lives in `src/data.json` and is regenerated each week from two ALM Product Export CSVs. GitHub credentials are stored in `scripts/config.json` (already configured — repo: kh1emnguyen/bmss-trade, branch: main).

**Step 1 — Locate the CSV exports.**
Look in the user's Downloads folder for the two most-recent files matching this pattern:
`ProductExport_<8-digit-ALM-code>-user_DD-MM-YY HH-MM-SS.csv`
- The file containing `4420` in the code is the BM export.
- The file containing `2088` in the code is the DC export.
If either file is missing or older than 7 days, stop and write a plain-text note to `scripts/refresh-log.txt` explaining which file was not found, then exit.

**Step 2 — Run the regeneration script.**
From the bmss-trade project folder, run:
```
node scripts/regenerate.js
```
This script auto-detects the CSVs, applies all filter rules (ALM Warehouse rows only; DC ≤ BM × 1.05; WINE/SPIRITS ≥ $10/unit; alcohol categories only), overwrites `src/data.json`, and pushes the updated file to GitHub via the REST API using the token in `scripts/config.json`. No git CLI is required.

**Step 3 — Log the result.**
Append a single line to `scripts/refresh-log.txt` in this format:
`YYYY-MM