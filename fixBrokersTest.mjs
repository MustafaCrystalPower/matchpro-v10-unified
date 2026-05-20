// The issue: input is undefined when no input is provided
// Solution: Make input optional with .optional()

const API_BASE = 'http://localhost:3000/api/trpc';

// Test 1: With explicit empty object
console.log('Test 1: brokers.topBrokers with empty object');
const res1 = await fetch(`${API_BASE}/brokers.topBrokers?input=%7B%7D`);
const data1 = await res1.json();
console.log('Result:', data1.error ? '❌ FAIL' : '✅ PASS');
if (data1.error) console.log('Error:', data1.error.json?.message);

// Test 2: With limit parameter
console.log('\nTest 2: brokers.topBrokers with limit=10');
const res2 = await fetch(`${API_BASE}/brokers.topBrokers?input=%7B%22limit%22%3A10%7D`);
const data2 = await res2.json();
console.log('Result:', data2.error ? '❌ FAIL' : '✅ PASS');
if (data2.error) console.log('Error:', data2.error.json?.message);
if (data2.result?.data) console.log('Data:', data2.result.data);

// Test 3: Without input parameter at all
console.log('\nTest 3: brokers.topBrokers without input');
const res3 = await fetch(`${API_BASE}/brokers.topBrokers`);
const data3 = await res3.json();
console.log('Result:', data3.error ? '❌ FAIL' : '✅ PASS');
if (data3.error) console.log('Error:', data3.error.json?.message);
