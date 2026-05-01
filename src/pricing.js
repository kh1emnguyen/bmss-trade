// Per-unit price tiers and bands.
//
// "Premium" tier (Wine, Spirits, Liqueurs) buckets in $20 increments up to $100.
// "Volume" tier (Beer, Cider, RTDs) buckets in tighter increments topping out at $10+.
// All bands are based on BM unit price (the standard list price reference).

export const TIER_PREMIUM = new Set(['WINE', 'SPIRITS', 'LIQUEURS']);
export const TIER_VOLUME  = new Set(['BEER', 'CIDER', 'RTDS']);

export const PREMIUM_BANDS = [
  { id: 'p0',  label: '$0–$20',   min: 0,   max: 20 },
  { id: 'p1',  label: '$20–$40',  min: 20,  max: 40 },
  { id: 'p2',  label: '$40–$60',  min: 40,  max: 60 },
  { id: 'p3',  label: '$60–$80',  min: 60,  max: 80 },
  { id: 'p4',  label: '$80–$100', min: 80,  max: 100 },
  { id: 'p5',  label: '$100+',    min: 100, max: Infinity },
];

export const VOLUME_BANDS = [
  { id: 'v0',  label: '$0–$3',  min: 0,  max: 3 },
  { id: 'v1',  label: '$3–$5',  min: 3,  max: 5 },
  { id: 'v2',  label: '$5–$7',  min: 5,  max: 7 },
  { id: 'v3',  label: '$7–$10', min: 7,  max: 10 },
  { id: 'v4',  label: '$10+',   min: 10, max: Infinity },
];

export const ALL_BANDS = [...PREMIUM_BANDS, ...VOLUME_BANDS];

// Build a map id -> band for quick lookup.
const BAND_BY_ID = ALL_BANDS.reduce((acc, b) => {
  acc[b.id] = b;
  return acc;
}, {});

export function bandById(id) {
  return BAND_BY_ID[id] || null;
}

export function tierOf(category) {
  if (TIER_PREMIUM.has(category)) return 'premium';
  if (TIER_VOLUME.has(category))  return 'volume';
  return null;
}

export function bandsForTier(tier) {
  return tier === 'premium' ? PREMIUM_BANDS : tier === 'volume' ? VOLUME_BANDS : ALL_BANDS;
}

export function bandsForCategory(category) {
  return bandsForTier(tierOf(category));
}

// Filter helper used by all tabs. `priceBandId` is one of the band ids; the
// filter narrows rows to (a) the tier matching that band, and (b) BM unit price
// inside the band's range.
export function passesPriceBand(row, priceBandId) {
  if (!priceBandId) return true;
  const band = bandById(priceBandId);
  if (!band) return true;
  // Determine which tier the band belongs to.
  const isPremium = PREMIUM_BANDS.includes(band);
  const tier = isPremium ? TIER_PREMIUM : TIER_VOLUME;
  if (!tier.has(row.category)) return false;
  return row.bm >= band.min && row.bm < band.max;
}
