#!/usr/bin/env node

/**
 * Test Advanced Report Generation
 * Generates 9-sheet Excel report with real database data
 * Sends email with attachment to configured recipients
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🚀 MatchPro Advanced Report Test');
console.log('═'.repeat(60));

// Run the advanced report generation via tRPC
const command = `
cd ${__dirname} && \
node -e "
import('./server/advancedReportingService.ts').then(async (module) => {
  console.log('[Test] Initializing report generation...');
  const result = await module.runAdvancedReport('10PM');
  console.log('[Test] Report Status:', result.status);
  console.log('[Test] Rows Generated:', result.rowCount);
  console.log('[Test] Email Delivered:', result.emailDelivered);
  console.log('[Test] Duration:', result.durationMs, 'ms');
  if (result.error) console.error('[Test] Error:', result.error);
  process.exit(result.status === 'success' ? 0 : 1);
}).catch(err => {
  console.error('[Test] Fatal Error:', err);
  process.exit(1);
});
"
`;

try {
  console.log('⏳ Generating 9-sheet Excel report...');
  execSync(command, { stdio: 'inherit' });
  console.log('\n✅ Report generation completed successfully!');
} catch (error) {
  console.error('\n❌ Report generation failed');
  process.exit(1);
}
