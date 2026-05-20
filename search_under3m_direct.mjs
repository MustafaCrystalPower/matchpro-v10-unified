/**
 * Direct DB query for all properties ≤ EGP 3,000,000
 * With investment scoring and analysis
 */
import { createConnection } from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const conn = await createConnection(process.env.DATABASE_URL);

// Query all supply records ≤ 3M, for sale only
const [rows] = await conn.execute(`
  SELECT 
    id, location, size, price, contact, purpose, floor,
    rawMessageText as rawMsg,
    propertyType as propType,
    bedrooms, bathrooms,
    createdAt,
    sourceGroup,
    downPayment,
    installmentAmount,
    installmentYears,
    priceType,
    reviewStatus
  FROM supply
  WHERE price <= 3000000
    AND price >= 500000
    AND (purpose = 'sale' OR purpose IS NULL OR purpose != 'rent')
  ORDER BY price ASC
  LIMIT 500
`);

await conn.end();

console.log(`Found ${rows.length} properties ≤ EGP 3,000,000\n`);

// Investment scoring
function score(r) {
  let s = 0, notes = [];
  const raw = (r.rawMsg || '').toLowerCase();
  const loc = (r.location || '').toLowerCase();
  const combined = raw + ' ' + loc;

  // Location
  const prime = ['b11','b12','b10','b9','b8','madinaty','مدينتي','fifth square','mountain view'];
  const good  = ['b7','b6','b5','b4','b3','الرحاب','rehab','new cairo','القاهرة الجديدة','b14','b13'];
  if (prime.some(l => combined.includes(l))) { s += 3; notes.push('Prime location'); }
  else if (good.some(l => combined.includes(l))) { s += 2; notes.push('Good location'); }
  else { s += 1; }

  // Immediate delivery
  if (/جاهز|استلام|immediate|ready|خالص|مسلم|استلم|تسليم فوري|جاهزة|تسليم|خالصة/.test(combined)) {
    s += 2; notes.push('Immediate delivery');
  }

  // Size
  const sz = parseFloat(r.size);
  if (!isNaN(sz)) {
    if (sz >= 100) { s += 3; notes.push(`${sz}m² (large)`); }
    else if (sz >= 70) { s += 2; notes.push(`${sz}m² (medium)`); }
    else { s += 1; notes.push(`${sz}m² (small)`); }
  }

  // Price per m²
  const pr = parseFloat(r.price);
  if (!isNaN(sz) && !isNaN(pr) && sz > 0) {
    const ppm2 = pr / sz;
    if (ppm2 < 20000) { s += 3; notes.push(`EGP ${ppm2.toLocaleString('en',{maximumFractionDigits:0})}/m² (exceptional value)`); }
    else if (ppm2 < 28000) { s += 2; notes.push(`EGP ${ppm2.toLocaleString('en',{maximumFractionDigits:0})}/m² (excellent value)`); }
    else if (ppm2 < 38000) { s += 1; notes.push(`EGP ${ppm2.toLocaleString('en',{maximumFractionDigits:0})}/m² (good value)`); }
    else { notes.push(`EGP ${ppm2.toLocaleString('en',{maximumFractionDigits:0})}/m²`); }
  }

  // Talaat Mostafa
  if (/طلعت مصطفى|طلعت مصطفي|talaat mostafa/.test(combined)) { s += 2; notes.push('Talaat Mostafa direct'); }

  // Takhsis penalty
  if (/تخصيص|takhsis|شرطة|صحفي|police|journalist/.test(combined)) { s -= 2; notes.push('⚠ Takhsis'); }

  // Garden/view
  if (/جاردن|garden|فيو|view|حديقة/.test(combined)) { s += 1; notes.push('Garden/view'); }

  // Finishing
  if (/تشطيب|super lux|سوبر لوكس|furnished|مفروش/.test(combined)) { s += 1; notes.push('Finished'); }

  // Rental yield estimate
  let yieldPct = null;
  if (!isNaN(sz) && !isNaN(pr) && sz > 0 && pr > 0) {
    let rentPerM2 = 200; // default
    if (prime.some(l => combined.includes(l))) rentPerM2 = 270;
    else if (good.some(l => combined.includes(l))) rentPerM2 = 220;
    const annualRent = sz * rentPerM2 * 12;
    yieldPct = (annualRent / pr * 100).toFixed(1);
  }

  return { score: s, notes, yieldPct };
}

// Score all
const scored = rows.map(r => ({ ...r, ...score(r) }));
scored.sort((a, b) => b.score - a.score || parseFloat(a.price) - parseFloat(b.price));

// Deduplicate
const seen = new Set();
const unique = [];
for (const r of scored) {
  const key = `${r.contact}_${r.price}_${r.size}`;
  if (!seen.has(key)) { seen.add(key); unique.push(r); }
}

console.log(`Unique properties after dedup: ${unique.length}`);
console.log('='.repeat(70));

for (let i = 0; i < Math.min(unique.length, 25); i++) {
  const r = unique[i];
  const pr = parseFloat(r.price);
  const ry = r.yieldPct ? ` | Est. Rental Yield: ${r.yieldPct}%/yr` : '';
  console.log(`\n${'='.repeat(60)}`);
  console.log(`OPTION #${i+1} | Score: ${r.score}/15 | Price: EGP ${pr.toLocaleString('en')}${ry}`);
  console.log(`Location: ${r.location || 'N/A'}`);
  console.log(`Size: ${r.size || 'N/A'}m² | Beds: ${r.bedrooms || '?'} | Baths: ${r.bathrooms || '?'} | Floor: ${r.floor || '?'}`);
  console.log(`Contact: ${r.contact || 'N/A'}`);
  console.log(`Investment: ${r.notes.join(' | ')}`);
  console.log(`Message: ${(r.rawMsg || '').substring(0, 350)}`);
}

console.log(`\n\nTOTAL UNIQUE UNDER EGP 3M: ${unique.length}`);

// Summary stats
const prices = unique.map(r => parseFloat(r.price)).filter(p => !isNaN(p));
const sizes = unique.map(r => parseFloat(r.size)).filter(s => !isNaN(s));
console.log('\n--- MARKET SUMMARY ---');
console.log(`Price range: EGP ${Math.min(...prices).toLocaleString('en')} – EGP ${Math.max(...prices).toLocaleString('en')}`);
console.log(`Avg price: EGP ${(prices.reduce((a,b)=>a+b,0)/prices.length).toLocaleString('en',{maximumFractionDigits:0})}`);
if (sizes.length > 0) {
  console.log(`Size range: ${Math.min(...sizes)}m² – ${Math.max(...sizes)}m²`);
  console.log(`Avg size: ${(sizes.reduce((a,b)=>a+b,0)/sizes.length).toFixed(0)}m²`);
}
