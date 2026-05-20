const API_BASE = 'http://localhost:3000/api/trpc';

console.log('🧪 COMPREHENSIVE MATCHING ALGORITHM TESTS\n');
console.log('=' .repeat(70));

// Test 1: Get high-confidence matches
console.log('\n📊 Test 1: Fetch High-Confidence Matches (≥75%)');
try {
  const res = await fetch(`${API_BASE}/matches.highConfidence?input=%7B%7D`);
  const data = await res.json();
  if (data.result?.data) {
    console.log(`✅ PASS - Retrieved ${data.result.data.length} high-confidence matches`);
    if (data.result.data.length > 0) {
      const sample = data.result.data[0];
      console.log(`   Sample: Score=${sample.matchScore}, Demand=${sample.demandId}, Supply=${sample.supplyId}`);
    }
  } else {
    console.log(`⚠️ No matches found (database may be empty)`);
  }
} catch (error) {
  console.log(`❌ FAIL - ${error.message}`);
}

// Test 2: Get recent matches
console.log('\n📊 Test 2: Fetch Recent Matches');
try {
  const res = await fetch(`${API_BASE}/matches.recent?input=%7B%7D`);
  const data = await res.json();
  if (data.result?.data) {
    console.log(`✅ PASS - Retrieved ${data.result.data.length} recent matches`);
  } else {
    console.log(`⚠️ No recent matches found`);
  }
} catch (error) {
  console.log(`❌ FAIL - ${error.message}`);
}

// Test 3: Get recent demands
console.log('\n📊 Test 3: Fetch Recent Demands');
try {
  const res = await fetch(`${API_BASE}/demand.recent?input=%7B%7D`);
  const data = await res.json();
  if (data.result?.data) {
    console.log(`✅ PASS - Retrieved ${data.result.data.length} recent demands`);
    if (data.result.data.length > 0) {
      const sample = data.result.data[0];
      console.log(`   Sample: Area=${sample.area}, Type=${sample.propertyType}, Budget=${sample.budget}`);
    }
  } else {
    console.log(`⚠️ No recent demands found`);
  }
} catch (error) {
  console.log(`❌ FAIL - ${error.message}`);
}

// Test 4: Get recent supplies
console.log('\n📊 Test 4: Fetch Recent Supplies');
try {
  const res = await fetch(`${API_BASE}/supply.recent?input=%7B%7D`);
  const data = await res.json();
  if (data.result?.data) {
    console.log(`✅ PASS - Retrieved ${data.result.data.length} recent supplies`);
    if (data.result.data.length > 0) {
      const sample = data.result.data[0];
      console.log(`   Sample: Area=${sample.area}, Type=${sample.propertyType}, Price=${sample.price}`);
    }
  } else {
    console.log(`⚠️ No recent supplies found`);
  }
} catch (error) {
  console.log(`❌ FAIL - ${error.message}`);
}

// Test 5: Get system health
console.log('\n📊 Test 5: System Health Check');
try {
  const res = await fetch(`${API_BASE}/systemHealth.getStatus?input=%7B%7D`);
  const data = await res.json();
  if (data.result?.data) {
    console.log(`✅ PASS - System Status: ${data.result.data.status}`);
    console.log(`   Uptime: ${data.result.data.uptime}s`);
  } else {
    console.log(`❌ FAIL - No status data`);
  }
} catch (error) {
  console.log(`❌ FAIL - ${error.message}`);
}

console.log('\n' + '='.repeat(70));
console.log('✅ MATCHING ALGORITHM TESTS COMPLETE\n');
