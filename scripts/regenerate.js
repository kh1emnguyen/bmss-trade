#!/usr/bin/env node
/**
 * regenerate.js — BMSS Trade dataset refresh + auto-publish
 *
 * ─── WHAT IT DOES ────────────────────────────────────────────────────────────
 *   1. Finds the two most-recent ALM Product Export CSVs in export list/
 *      (BM = account 4420, DC = account 2088).
 *   2. Applies all filter rules from PARTNER_BRIEF.md §3–4.
 *   3. Overwrites src/data.json with the fresh dataset.
 *   4. Pushes src/data.json to GitHub via the REST API — NO git CLI needed.
 *      GitHub Actions then rebuilds and redeploys the live app automatically.
 *
 * ─── FIRST-TIME SETUP (partner, one-off) ────────────────────────────────────
 *   a) Copy scripts/config.example.json → scripts/config.json
 *   b) Fill in three values:
 *        github_token  — a GitHub Fine-Grained PAT with "Contents: Read & Write"
 *                        on the bmss-trade repo. Create at:
 *                        github.com → Settings → Developer Settings →
 *                        Personal access tokens → Fine-grained tokens
 *        github_repo   — e.g. "khiem/bmss-trade"
 *        github_branch — "main" (leave as-is)
 *   config.json is gitignored — it never gets committed or shared.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────
 *   node scripts/regenerate.js
 *   node scripts/regenerate.js [BM_CSV_PATH] [DC_CSV_PATH]   # override auto-detect
 *   node scripts/regenerate.js --no-push                      # skip GitHub push
 *
 * ─── DEPENDENCIES ────────────────────────────────────────────────────────────
 *   None — uses only Node.js built-ins (fs, path, os, https).
 */

'use strict';

const fs    = require('fs');
const path  = require('path');
const https = require('https');

// ─── Config ───────────────────────────────────────────────────────────────────

const ROOT        = path.join(__dirname, '..');
const OUT_PATH    = path.join(ROOT, 'src', 'data.json');
const CONFIG_PATH = path.join(__dirname, 'config.json');
const EXPORT_DIR  = path.join(ROOT, 'export list');

const ACCOUNT_BM = '4420';
const ACCOUNT_DC = '2088';

const ALLOWED_CATS        = new Set(['WINE', 'SPIRITS', 'RTDS', 'CIDER', 'LIQUEURS', 'BEER']);
const MIN_PRICE_CATS      = new Set(['WINE', 'SPIRITS']);
const MIN_UNIT_PRICE      = 10;
const DC_MAX_RATIO        = 1.05;

// ─── CLI flags ────────────────────────────────────────────────────────────────

const args    = process.argv.slice(2);
const noPush  = args.includes('--no-push');
const csvArgs = args.filter((a) => !a.startsWith('--'));
let [bmPath, dcPath] = csvArgs;

// ─── CSV Parser ───────────────────────────────────────────────────────────────

function parseCsv(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  if (!lines.length) return [];

  const parseRow = (line) => {
    const fields = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (ch === ',' && !inQ) {
        fields.push(cur.trim()); cur = '';
      } else {
        cur += ch;
      }
    }
    fields.push(cur.trim());
    return fields;
  };

  const headers = parseRow(lines[0]).map((h) => h.replace(/^﻿/, '').trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const vals = parseRow(lines[i]);
    const obj  = {};
    headers.forEach((h, idx) => { obj[h] = vals[idx] ?? ''; });
    rows.push(obj);
  }
  return rows;
}

// ─── Auto-detect CSVs from Downloads ─────────────────────────────────────────

function findLatestExport(account) {
  // Look in the project's "export list/" subfolder (gitignored — never committed).
  // Drop your Monday ALM exports there each week before running this script.
  const dir = EXPORT_DIR;
  if (!fs.existsSync(dir)) {
    console.error(`ERROR: "${dir}" does not exist. Create the folder and drop your CSVs in it.`);
    return null;
  }
  // Pattern: ProductExport_<account>-user_DD-MM-YY HH-MM-SS.csv
  const re  = new RegExp(
    `^ProductExport_${account}-user_\\d{2}-\\d{2}-\\d{2}[\\s_]\\d{2}-\\d{2}-\\d{2}\\.csv$`,
    'i'
  );
  let best = null, bestMtime = 0;
  for (const f of fs.readdirSync(dir)) {
    if (!re.test(f)) continue;
    const full  = path.join(dir, f);
    const mtime = fs.statSync(full).mtimeMs;
    if (mtime > bestMtime) { bestMtime = mtime; best = full; }
  }
  return best;
}

// ─── Data processing ──────────────────────────────────────────────────────────

function safeFloat(s) {
  const n = parseFloat((s || '').replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? 0 : n;
}

function buildIndex(rows) {
  const idx = new Map();
  for (const r of rows) {
    if ((r['Warehouse / Connect Item'] || '').trim() !== 'ALM Warehouse') continue;
    const code = (r['Item code'] || r['Item Code'] || '').trim();
    if (code) idx.set(code, r);
  }
  return idx;
}

function processRows(bmRows, dcRows) {
  const bmIdx = buildIndex(bmRows);
  const dcIdx = buildIndex(dcRows);
  const results = [];

  for (const [code, bmRow] of bmIdx) {
    const dcRow = dcIdx.get(code);
    if (!dcRow) continue;

    const cs       = safeFloat(bmRow['Carton Size']) || 1;
    const bmCarton = safeFloat(bmRow['Carton Cost (Incl Taxes & Allowance)']);
    const dcCarton = safeFloat(dcRow['Carton Cost (Incl Taxes & Allowance)']);
    const bmUnit   = bmCarton / cs;
    const dcUnit   = dcCarton / cs;

    if (dcUnit > bmUnit * DC_MAX_RATIO) continue;

    const catPath  = (bmRow['Category'] || '').trim();
    const catParts = catPath.split('/').map((s) => s.trim());
    const topCat   = catParts[0].toUpperCase();
    const subCat   = (catParts[2] || catParts[1] || topCat).toUpperCase();

    if (!ALLOWED_CATS.has(topCat)) continue;
    if (MIN_PRICE_CATS.has(topCat) && bmUnit < MIN_UNIT_PRICE) continue;

    const diffAbs  = bmUnit - dcUnit;
    const diffPct  = bmUnit > 0 ? ((dcUnit - bmUnit) / bmUnit) * 100 : 0;
    const svCarton = diffAbs * cs;
    const discPrice = topCat === 'WINE' ? (dcCarton / 1.1 / 1.29) * 1.145 * 1.05 : null;

    results.push({
      code,
      desc:        (bmRow['Description'] || '').trim(),
      supplier:    (bmRow['Supplier']    || '').trim(),
      category:    topCat,
      subcategory: subCat,
      cs,
      bm:          +bmUnit.toFixed(4),
      dc:          +dcUnit.toFixed(4),
      diff_pct:    +diffPct.toFixed(4),
      diff_abs:    +diffAbs.toFixed(4),
      sv_carton:   +svCarton.toFixed(4),
      disc_price:  discPrice !== null ? +discPrice.toFixed(4) : null,
    });
  }

  results.sort((a, b) => a.diff_pct - b.diff_pct);
  return results;
}

// ─── GitHub API push (no git CLI) ─────────────────────────────────────────────

function httpsRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function pushToGitHub(config, jsonContent) {
  const { github_token: token, github_repo: repo, github_branch: branch = 'main' } = config;
  const filePath = 'src/data.json';
  const encoded  = Buffer.from(jsonContent).toString('base64');

  const commonHeaders = {
    'Authorization': `Bearer ${token}`,
    'Accept':        'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent':    'bmss-regenerate-script',
    'Content-Type':  'application/json',
  };

  // 1. Get current file SHA (needed for the update call)
  console.log('  Fetching current file SHA from GitHub…');
  const getRes = await httpsRequest({
    hostname: 'api.github.com',
    path:     `/repos/${repo}/contents/${filePath}?ref=${branch}`,
    method:   'GET',
    headers:  commonHeaders,
  });

  if (getRes.status !== 200) {
    throw new Error(`GitHub GET failed (${getRes.status}): ${JSON.stringify(getRes.body)}`);
  }
  const sha = getRes.body.sha;
  console.log(`  Current SHA: ${sha.slice(0, 8)}…`);

  // 2. Push updated file
  console.log('  Pushing updated src/data.json…');
  const timestamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const putBody = JSON.stringify({
    message: `data: refresh ${timestamp} (${getRes.body.size ? Math.round(getRes.body.size / 1024) + 'kb → ' : ''}auto)`,
    content: encoded,
    sha,
    branch,
  });

  const putRes = await httpsRequest({
    hostname: 'api.github.com',
    path:     `/repos/${repo}/contents/${filePath}`,
    method:   'PUT',
    headers:  { ...commonHeaders, 'Content-Length': Buffer.byteLength(putBody) },
  }, putBody);

  if (putRes.status !== 200 && putRes.status !== 201) {
    throw new Error(`GitHub PUT failed (${putRes.status}): ${JSON.stringify(putRes.body)}`);
  }

  const newSha = putRes.body.content?.sha?.slice(0, 8) ?? '?';
  console.log(`  Pushed. New SHA: ${newSha}… — GitHub Actions will now rebuild the app.`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // Resolve CSV paths
  if (!bmPath || !dcPath) {
    console.log('Auto-detecting CSVs in export list/…');
    bmPath = findLatestExport(ACCOUNT_BM);
    dcPath = findLatestExport(ACCOUNT_DC);
  }

  if (!bmPath) { console.error(`ERROR: No BM export (account ${ACCOUNT_BM}) found in export list/.`); process.exit(1); }
  if (!dcPath) { console.error(`ERROR: No DC export (account ${ACCOUNT_DC}) found in export list/.`); process.exit(1); }

  console.log(`BM → ${path.basename(bmPath)}`);
  console.log(`DC → ${path.basename(dcPath)}`);

  // Parse + process
  const bmRows  = parseCsv(fs.readFileSync(bmPath, 'utf8'));
  const dcRows  = parseCsv(fs.readFileSync(dcPath, 'utf8'));
  console.log(`Rows: BM ${bmRows.length} | DC ${dcRows.length}`);

  const results = processRows(bmRows, dcRows);

  // Category summary
  const catCounts = {};
  for (const r of results) catCounts[r.category] = (catCounts[r.category] || 0) + 1;
  console.log('\nCategory breakdown:');
  Object.entries(catCounts).sort((a, b) => b[1] - a[1]).forEach(([c, n]) => console.log(`  ${c}: ${n}`));
  console.log(`Total qualifying SKUs: ${results.length}\n`);

  // Write local file
  const jsonContent = JSON.stringify(results, null, 2);
  fs.writeFileSync(OUT_PATH, jsonContent, 'utf8');
  console.log(`Wrote ${results.length} rows → src/data.json`);

  // Push to GitHub (unless --no-push)
  if (noPush) {
    console.log('--no-push flag set — skipping GitHub upload.');
    return;
  }

  if (!fs.existsSync(CONFIG_PATH)) {
    console.log(`\nNo scripts/config.json found — skipping GitHub push.`);
    console.log(`Copy scripts/config.example.json → scripts/config.json and fill in your PAT to enable auto-publish.`);
    return;
  }

  let config;
  try {
    config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch (e) {
    console.error(`ERROR reading config.json: ${e.message}`);
    process.exit(1);
  }

  if (!config.github_token || config.github_token.startsWith('ghp_YOUR')) {
    console.error('ERROR: github_token in config.json is still the placeholder. Fill it in first.');
    process.exit(1);
  }

  console.log('\nPushing to GitHub…');
  try {
    await pushToGitHub(config, jsonContent);
    console.log('Done. Live app will update in ~2 minutes.');
  } catch (e) {
    console.error(`GitHub push failed: ${e.message}`);
    console.log('The local src/data.json was updated — push manually if needed.');
    process.exit(1);
  }
}

main();
