import { runReport } from './server/reportingService';

async function testReport() {
  console.log('🧪 TEST 3: MANUAL REPORT TRIGGER (10 PM)\n');
  try {
    console.log('Triggering 10 PM report...');
    const result = await runReport('10PM');
    
    console.log(`\n✅ Report generated`);
    console.log(`   Status: ${result.status}`);
    console.log(`   Matches found: ${result.rowCount}`);
    console.log(`   Email sent: ${result.emailDelivered}`);
    console.log(`   Duration: ${result.durationMs}ms`);
    
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
    
    return result.status === 'success';
  } catch (error) {
    console.error(`❌ FAILED: ${(error as Error).message}`);
    return false;
  }
}

testReport().then(success => process.exit(success ? 0 : 1));
