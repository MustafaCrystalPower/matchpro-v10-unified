/**
 * Backfill canonical location names for existing supply and demand rows.
 * Runs the same LOCATIONS lookup used by enhancedParser.ts.
 */
import mysql from 'mysql2/promise';

const LOCATIONS = [
  { name: 'التجمع الخامس', aliases: ['التجمع الخامس', 'التجمع', '5th settlement', 'fifth settlement', 'tagamoa', 'tagamo3', 'تجمع'] },
  { name: 'القاهرة الجديدة', aliases: ['القاهرة الجديدة', 'new cairo', 'cairo new', 'القاهره الجديده'] },
  { name: 'الرحاب', aliases: ['الرحاب', 'rehab', 'el rehab', 'رحاب'] },
  { name: 'مدينتي', aliases: ['مدينتي', 'madinaty', 'madinty', 'مدينتى'] },
  { name: 'الشيخ زايد', aliases: ['الشيخ زايد', 'sheikh zayed', 'zayed', 'شيخ زايد', 'زايد'] },
  { name: '6 اكتوبر', aliases: ['6 اكتوبر', '6 october', 'october', 'اكتوبر', '٦ اكتوبر', 'sixth october'] },
  { name: 'الحصري', aliases: ['الحصري', 'hosary', 'el hosary'] },
  { name: 'مصر الجديدة', aliases: ['مصر الجديدة', 'heliopolis', 'مصر الجديده'] },
  { name: 'مدينة نصر', aliases: ['مدينة نصر', 'nasr city', 'مدينه نصر', 'نصر'] },
  { name: 'العباسية', aliases: ['العباسية', 'abbasiya', 'عباسية'] },
  { name: 'المعادي', aliases: ['المعادي', 'maadi', 'معادي', 'المعادى'] },
  { name: 'دجلة', aliases: ['دجلة', 'degla', 'دجله'] },
  { name: 'الزهراء', aliases: ['الزهراء', 'zahraa', 'زهراء المعادي'] },
  { name: 'الزمالك', aliases: ['الزمالك', 'zamalek', 'زمالك'] },
  { name: 'وسط البلد', aliases: ['وسط البلد', 'downtown', 'داون تاون'] },
  { name: 'جاردن سيتي', aliases: ['جاردن سيتي', 'garden city'] },
  { name: 'المنيل', aliases: ['المنيل', 'manial', 'منيل'] },
  { name: 'الجيزة', aliases: ['الجيزة', 'giza', 'جيزة'] },
  { name: 'الهرم', aliases: ['الهرم', 'haram', 'هرم'] },
  { name: 'فيصل', aliases: ['فيصل', 'faisal'] },
  { name: 'الدقي', aliases: ['الدقي', 'dokki', 'دقي'] },
  { name: 'المهندسين', aliases: ['المهندسين', 'mohandessin', 'مهندسين'] },
  { name: 'العاصمة الادارية', aliases: ['العاصمة الادارية', 'new capital', 'administrative capital', 'العاصمه الاداريه', 'العاصمة'] },
  { name: 'الشروق', aliases: ['الشروق', 'shorouk', 'el shorouk', 'شروق'] },
  { name: 'بدر', aliases: ['بدر', 'badr', 'badr city'] },
  { name: 'العبور', aliases: ['العبور', 'obour', 'el obour', 'عبور'] },
  { name: 'العاشر من رمضان', aliases: ['العاشر من رمضان', '10th of ramadan', 'عاشر رمضان', 'العاشر'] },
  { name: 'المستقبل', aliases: ['المستقبل', 'mostakbal', 'mustaqbal', 'مستقبل سيتي'] },
  { name: 'الساحل الشمالي', aliases: ['الساحل الشمالي', 'north coast', 'sahel', 'الساحل', 'ساحل'] },
  { name: 'العين السخنة', aliases: ['العين السخنة', 'ain sokhna', 'sokhna', 'السخنة', 'عين السخنه'] },
  { name: 'الاسكندرية', aliases: ['الاسكندرية', 'alexandria', 'alex', 'اسكندرية', 'اسكندريه'] },
  { name: 'المقطم', aliases: ['المقطم', 'mokattam', 'مقطم'] },
  { name: 'حدائق الاهرام', aliases: ['حدائق الاهرام', 'hadayek ahram', 'حدائق الأهرام'] },
  { name: 'حدائق اكتوبر', aliases: ['حدائق اكتوبر', 'hadayek october'] },
  { name: 'بريفادو', aliases: ['بريفادو', 'privado'] },
  { name: 'مفيدا', aliases: ['مفيدا', 'mivida', 'ميفيدا'] },
  { name: 'فيفث سكوير', aliases: ['fifth square', 'فيفث سكوير', '5th square'] },
  { name: 'أليجريا', aliases: ['أليجريا', 'اليجريا', 'allegria', 'sodic west'] },
  { name: 'ليك فيو', aliases: ['ليك فيو', 'lake view', 'lakeview'] },
  { name: 'علي بارك', aliases: ['علي بارك', 'ali park'] },
  { name: 'فوكا باي', aliases: ['فوكا باي', 'fouka bay', 'فوكا'] },
  { name: 'سيدي عبد الرحمن', aliases: ['سيدي عبد الرحمن', 'sidi abdel rahman', 'sidi abd el rahman'] },
  { name: 'بورتو', aliases: ['بورتو', 'porto', 'porto said', 'porto sokhna', 'porto october'] },
  { name: 'ماونتن فيو', aliases: ['ماونتن فيو', 'mountain view', 'mountainview'] },
  { name: 'هايد بارك', aliases: ['هايد بارك', 'hyde park', 'hydepark'] },
  { name: 'ميراكيا', aliases: ['ميراكيا', 'mirakya', 'mirakez'] },
];

// Sort each location's aliases by length descending (longer = more specific)
const sortedLocations = LOCATIONS.map(loc => ({
  ...loc,
  aliases: [...loc.aliases].sort((a, b) => b.length - a.length),
}));

function canonicalize(rawLocation) {
  if (!rawLocation) return null;
  const lower = rawLocation.toLowerCase();
  for (const loc of sortedLocations) {
    for (const alias of loc.aliases) {
      if (lower.includes(alias.toLowerCase())) {
        return loc.name;
      }
    }
  }
  return rawLocation; // keep original if no match
}

async function run() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  // Fetch all supply rows with a location
  const [supplyRows] = await conn.execute(
    'SELECT id, location FROM supply WHERE location IS NOT NULL'
  );
  
  console.log(`Processing ${supplyRows.length} supply rows...`);
  let updated = 0;
  
  for (const row of supplyRows) {
    const canonical = canonicalize(row.location);
    if (canonical !== row.location) {
      await conn.execute(
        'UPDATE supply SET location = ? WHERE id = ?',
        [canonical, row.id]
      );
      updated++;
    }
  }
  console.log(`Supply: updated ${updated} / ${supplyRows.length} rows`);

  // Fetch all demand rows with a location
  const [demandRows] = await conn.execute(
    'SELECT id, location FROM demand WHERE location IS NOT NULL'
  );
  
  console.log(`Processing ${demandRows.length} demand rows...`);
  let demandUpdated = 0;
  
  for (const row of demandRows) {
    const canonical = canonicalize(row.location);
    if (canonical !== row.location) {
      await conn.execute(
        'UPDATE demand SET location = ? WHERE id = ?',
        [canonical, row.id]
      );
      demandUpdated++;
    }
  }
  console.log(`Demand: updated ${demandUpdated} / ${demandRows.length} rows`);

  await conn.end();
  console.log('Done.');
}

run().catch(err => { console.error(err); process.exit(1); });
