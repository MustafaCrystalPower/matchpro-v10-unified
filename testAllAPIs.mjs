const API_BASE = 'http://localhost:3000/api/trpc';
const TESTS = [];

async function test(name, fn) {
  try {
    const result = await fn();
    TESTS.push({ name, status: '✅ PASS', details: result });
    console.log(`✅ ${name}`);
  } catch (err) {
    TESTS.push({ name, status: '❌ FAIL', error: err.message });
    console.log(`❌ ${name}: ${err.message}`);
  }
}

// Test 1: Health Check
await test('Health Check', async () => {
  const res = await fetch('http://localhost:3000/health', { timeout: 5000 }).catch(() => ({ ok: false }));
  if (!res.ok) throw new Error('Server not responding');
  return 'Server healthy';
});

// Test 2: Get Messages
await test('Get Messages (messages.recent)', async () => {
  const res = await fetch(`${API_BASE}/messages.recent?input=%7B%7D`);
  const data = await res.json();
  if (data.error) throw new Error(data.error.json?.message || 'Unknown error');
  return `Retrieved ${data.result?.data?.length || 0} messages`;
});

// Test 3: Get Demands
await test('Get Demands (demand.recent)', async () => {
  const res = await fetch(`${API_BASE}/demand.recent?input=%7B%22limit%22%3A10%7D`);
  const data = await res.json();
  if (data.error) throw new Error(data.error.json?.message || 'Unknown error');
  return `Retrieved ${data.result?.data?.length || 0} demands`;
});

// Test 4: Get Supply
await test('Get Supply (supply.recent)', async () => {
  const res = await fetch(`${API_BASE}/supply.recent?input=%7B%22limit%22%3A10%7D`);
  const data = await res.json();
  if (data.error) throw new Error(data.error.json?.message || 'Unknown error');
  return `Retrieved ${data.result?.data?.length || 0} supply items`;
});

// Test 5: Get Matches
await test('Get Matches (matches.recent)', async () => {
  const res = await fetch(`${API_BASE}/matches.recent?input=%7B%22limit%22%3A10%7D`);
  const data = await res.json();
  if (data.error) throw new Error(data.error.json?.message || 'Unknown error');
  return `Retrieved ${data.result?.data?.length || 0} matches`;
});

// Test 6: Get High Confidence Matches
await test('Get High Confidence Matches', async () => {
  const res = await fetch(`${API_BASE}/matches.getHighConfidence?input=%7B%22minScore%22%3A75%7D`);
  const data = await res.json();
  if (data.error) throw new Error(data.error.json?.message || 'Unknown error');
  return `Retrieved ${data.result?.data?.length || 0} high-confidence matches`;
});

// Test 7: Get Broker List
await test('Get Broker List', async () => {
  const res = await fetch(`${API_BASE}/brokers.list?input=%7B%7D`);
  const data = await res.json();
  if (data.error) throw new Error(data.error.json?.message || 'Unknown error');
  return `Retrieved ${data.result?.data?.length || 0} brokers`;
});

// Test 8: Get System Status
await test('Get System Status', async () => {
  const res = await fetch(`${API_BASE}/system.getStatus?input=%7B%7D`);
  const data = await res.json();
  if (data.error) throw new Error(data.error.json?.message || 'Unknown error');
  return `System status: ${JSON.stringify(data.result?.data || 'OK')}`;
});

// Summary
console.log('\n' + '='.repeat(60));
console.log('TEST SUMMARY');
console.log('='.repeat(60));
TESTS.forEach(t => {
  console.log(`${t.status} | ${t.name}`);
  if (t.details) console.log(`   └─ ${t.details}`);
  if (t.error) console.log(`   └─ Error: ${t.error}`);
});

const passed = TESTS.filter(t => t.status.includes('✅')).length;
const total = TESTS.length;
console.log(`\n📊 Results: ${passed}/${total} tests passed (${((passed/total)*100).toFixed(1)}%)`);

if (passed === total) {
  console.log('✅ ALL TESTS PASSED!');
  process.exit(0);
} else {
  console.log('⚠️ SOME TESTS FAILED - See details above');
  process.exit(1);
}
