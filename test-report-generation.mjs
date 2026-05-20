import { runReport } from './server/reportingService.ts';

console.log('Testing report generation...');

try {
  const result = await runReport('10PM');
  console.log('\n✅ Report generated successfully:');
  console.log(`   Status: ${result.status}`);
  console.log(`   Rows: ${result.rowCount}`);
  console.log(`   Email: ${result.emailDelivered}`);
  console.log(`   Duration: ${result.durationMs}ms`);
} catch (err) {
  console.error('❌ Report generation failed:', err);
}
