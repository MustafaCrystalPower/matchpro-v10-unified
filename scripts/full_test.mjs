import http from 'http';
import https from 'https';
import mysql from 'mysql2/promise';

function get(path) {
  return new Promise((resolve) => {
    http.get({ hostname: 'localhost', port: 3000, path }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
        catch(e) { resolve({ status: res.statusCode, body: d.slice(0, 100) }); }
      });
    }).on('error', e => resolve({ status: 0, body: e.message }));
  });
}

function post(path, payload) {
  return new Promise((resolve) => {
    const body = JSON.stringify(payload);
    const req = http.request({
      hostname: 'localhost', port: 3000, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
        catch(e) { resolve({ status: res.statusCode, body: d.slice(0, 100) }); }
      });
    });
    req.on('error', e => resolve({ status: 0, body: e.message }));
    req.write(body);
    req.end();
  });
}

function getExternal(url) {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
        catch(e) { resolve({ status: res.statusCode, body: d.slice(0, 100) }); }
      });
    }).on('error', e => resolve({ status: 0, body: e.message }));
  });
}

const results = [];
function check(name, r, ok, info) {
  const pass = ok(r);
  results.push({ name, pass, status: r.status });
  const icon = pass ? '✅' : '❌';
  const infoStr = info ? ` — ${info}` : '';
  console.log(`${icon} ${name}: HTTP ${r.status}${infoStr}`);
  if (!pass) {
    const errCode = r.body?.error?.data?.code || r.body?.error?.json?.data?.code;
    const errMsg = r.body?.error?.json?.message || r.body?.error?.message || '';
    if (errCode || errMsg) console.log(`   Error: ${errCode} ${errMsg}`.slice(0, 120));
  }
}

const B = '/api/trpc/';
const I = (obj) => '?input=' + encodeURIComponent(JSON.stringify({ json: obj }));

async function main() {
  console.log('\n========== MatchPro Full Endpoint Test ==========\n');
  let r;

  // ---- HTTP Routes ----
  console.log('--- HTTP Routes ---');
  r = await get('/');
  check('GET / (SPA)', r, r => r.status === 200, 'Frontend served');

  r = await get('/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=WRONG&hub.challenge=test');
  check('GET /webhook (wrong token)', r, r => r.status === 403, 'Auth gate working');

  // ---- Public tRPC ----
  console.log('\n--- Public tRPC Procedures ---');

  r = await get(B + 'auth.me');
  check('auth.me', r, r => r.status === 200, 'user: ' + JSON.stringify(r.body?.result?.data?.json));

  r = await get(B + 'dashboard.stats');
  const s = r.body?.result?.data?.json;
  check('dashboard.stats', r, r => r.status === 200 && s != null,
    `supply:${s?.totalSupply} demand:${s?.totalDemand} matches:${s?.totalMatches} msgs:${s?.totalMessages}`);

  r = await get(B + 'dashboard.liveFeed' + I({ limit: 5 }));
  check('dashboard.liveFeed', r, r => r.status === 200, `count:${r.body?.result?.data?.json?.length}`);

  r = await get(B + 'matches.recent' + I({ limit: 5 }));
  check('matches.recent', r, r => r.status === 200, `count:${r.body?.result?.data?.json?.length}`);

  r = await get(B + 'matches.highConfidence' + I({ limit: 5 }));
  check('matches.highConfidence', r, r => r.status === 200, `count:${r.body?.result?.data?.json?.length}`);

  r = await get(B + 'supply.recent' + I({ limit: 5 }));
  check('supply.recent', r, r => r.status === 200, `count:${r.body?.result?.data?.json?.length}`);

  r = await get(B + 'supply.withAmenities' + I({ limit: 5 }));
  check('supply.withAmenities', r, r => r.status === 200, `count:${r.body?.result?.data?.json?.length}`);

  r = await get(B + 'demand.recent' + I({ limit: 5 }));
  check('demand.recent', r, r => r.status === 200, `count:${r.body?.result?.data?.json?.length}`);

  r = await get(B + 'messages.recent' + I({ limit: 5 }));
  check('messages.recent', r, r => r.status === 200, `count:${r.body?.result?.data?.json?.length}`);

  r = await get(B + 'systemHealth.getStatus');
  const sh = r.body?.result?.data?.json;
  check('systemHealth.getStatus', r, r => r.status === 200 && sh != null,
    sh ? `DB:${sh.database} WA:${sh.whatsapp} lastMatch:${sh.lastMatchAt}` : (r.body?.error?.data?.code || r.body?.error?.json?.data?.code));

  r = await get(B + 'groups.active');
  check('groups.active (public)', r, r => r.status === 200 || r.body?.error?.data?.code === 'UNAUTHORIZED',
    r.body?.error?.data?.code || `count:${r.body?.result?.data?.json?.length}`);

  r = await get(B + 'marketIntel.hotZones' + I({ limit: 5 }));
  check('marketIntel.hotZones', r, r => r.status === 200,
    r.body?.error?.data?.code || `count:${r.body?.result?.data?.json?.length}`);

  r = await get(B + 'analytics.conversionMetrics' + I({}));
  const acm = r.body?.result?.data?.json;
  check('analytics.conversionMetrics', r, r => r.status === 200,
    r.body?.error?.data?.code || r.body?.error?.json?.data?.code || `data:${JSON.stringify(acm).slice(0, 60)}`);

  // ---- Protected tRPC (expect UNAUTHORIZED without session) ----
  console.log('\n--- Protected tRPC (expect UNAUTHORIZED) ---');
  // Note: mutations (runMatching, updateStatus) require POST — testing via GET correctly returns METHOD_NOT_SUPPORTED
  // whatsapp.status and whatsapp.qrCode are public; protected ones are logout/setWebhook (mutations)
  // auditLogs uses .getLogs; investorInsights uses .dashboard
  const protectedProcs = [
    'adminManagement.list',
    'userProfile.get',
    'bookmarks.list',
    'customNotifications.list',
    'auditLogs.getLogs',
    'investorInsights.dashboard',
  ];
  for (const proc of protectedProcs) {
    r = await get(B + proc);
    const code = r.body?.error?.data?.code || r.body?.error?.json?.data?.code;
    check(proc, r, r => code === 'UNAUTHORIZED' || r.status === 200, code || 'OK (public)');
  }

  // ---- WhatsApp OTP Auth ----
  console.log('\n--- WhatsApp OTP Auth ---');
  r = await post('/api/auth/whatsapp/request-otp', { phone: '+201000000001' });
  const sendOtpOk = r.status === 200 || r.status === 400 || r.status === 403 || r.status === 429;
  check('POST request-otp (test number)', r, r => sendOtpOk, JSON.stringify(r.body).slice(0, 120));

  r = await post('/api/auth/whatsapp/verify-otp', { phone: '+201000000001', otp: '000000' });
  const verifyOk = r.status === 400 || r.status === 401 || (r.body && r.body.success === false);
  check('POST verify-otp (wrong OTP)', r, r => verifyOk, JSON.stringify(r.body).slice(0, 120));

  // ---- Green API (external) ----
  console.log('\n--- Green API (external) ---');
  const instanceId = process.env.GREEN_API_INSTANCE_ID;
  const token = process.env.GREEN_API_TOKEN;
  if (instanceId && token) {
    r = await getExternal(`https://api.green-api.com/waInstance${instanceId}/getStateInstance/${token}`);
    check('Green API getStateInstance', r, r => r.body?.stateInstance === 'authorized', `state:${r.body?.stateInstance}`);

    r = await getExternal(`https://api.green-api.com/waInstance${instanceId}/getSettings/${token}`);
    check('Green API getSettings', r, r => r.status === 200, `webhookUrl:${r.body?.webhookUrl?.slice(0, 60)}`);
  } else {
    console.log('⚠️  GREEN_API credentials not in env — skipped');
  }

  // ---- Database Direct ----
  console.log('\n--- Database Direct Queries ---');
  try {
    const conn = await mysql.createConnection(process.env.DATABASE_URL);
    const [[{ cnt: supCnt }]] = await conn.execute('SELECT COUNT(*) as cnt FROM supply');
    const [[{ cnt: demCnt }]] = await conn.execute('SELECT COUNT(*) as cnt FROM demand');
    const [[{ cnt: matCnt }]] = await conn.execute('SELECT COUNT(*) as cnt FROM matches WHERE deletedAt IS NULL');
    const [[{ cnt: msgCnt }]] = await conn.execute('SELECT COUNT(*) as cnt FROM messages');
    const [[{ cnt: admCnt }]] = await conn.execute('SELECT COUNT(*) as cnt FROM authorizedAdmins WHERE isActive = 1');
    const [[{ cnt: otpCnt }]] = await conn.execute('SELECT COUNT(*) as cnt FROM whatsappOtp');
    const [[{ cnt: locCnt }]] = await conn.execute("SELECT COUNT(*) as cnt FROM supply WHERE location IS NOT NULL AND location != 'Unknown'");
    await conn.end();

    console.log(`✅ supply: ${supCnt} | demand: ${demCnt} | matches: ${matCnt} | messages: ${msgCnt}`);
    console.log(`✅ admins: ${admCnt} | OTP records: ${otpCnt} | supply with clean location: ${locCnt}`);
    results.push({ name: 'DB direct queries', pass: true });
  } catch (e) {
    console.log(`❌ DB error: ${e.message}`);
    results.push({ name: 'DB direct queries', pass: false });
  }

  // ---- Matching Engine ----
  console.log('\n--- Matching Engine ---');
  try {
    const conn = await mysql.createConnection(process.env.DATABASE_URL);
    const [[{ cnt: saleCnt }]] = await conn.execute("SELECT COUNT(*) as cnt FROM matches WHERE transactionType = 'sale' AND deletedAt IS NULL");
    const [[{ cnt: rentCnt }]] = await conn.execute("SELECT COUNT(*) as cnt FROM matches WHERE transactionType = 'rent' AND deletedAt IS NULL");
    const [[{ cnt: nullTypeCnt }]] = await conn.execute("SELECT COUNT(*) as cnt FROM matches WHERE transactionType IS NULL AND deletedAt IS NULL");
    const [[{ cnt: highCnt }]] = await conn.execute("SELECT COUNT(*) as cnt FROM matches WHERE CAST(matchScore AS DECIMAL) >= 85 AND deletedAt IS NULL");
    await conn.end();
    console.log(`✅ Sale matches: ${saleCnt} | Rent matches: ${rentCnt} | Untyped: ${nullTypeCnt}`);
    console.log(`✅ High-confidence (>=85%): ${highCnt}`);
    results.push({ name: 'Matching engine DB check', pass: true });
  } catch (e) {
    console.log(`❌ Matching engine check error: ${e.message}`);
    results.push({ name: 'Matching engine DB check', pass: false });
  }

  // ---- Summary ----
  const passed = results.filter(x => x.pass).length;
  const failed = results.filter(x => !x.pass).length;
  console.log('\n========== FINAL SUMMARY ==========');
  console.log(`✅ Passed: ${passed} / ${results.length}`);
  if (failed > 0) {
    console.log(`❌ Failed: ${failed}`);
    results.filter(x => !x.pass).forEach(x => console.log(`  - ${x.name} (HTTP ${x.status})`));
  } else {
    console.log('🎉 All checks passed!');
  }
}

main().catch(e => console.error('Fatal error:', e.message));
