import { sendDailyDemandReports } from './server/dailyDemandReportService.ts';

console.log('[Test] Triggering daily demand reports...');
try {
  await sendDailyDemandReports();
  console.log('[Test] Daily reports triggered successfully');
} catch (error) {
  console.error('[Test] Error:', error);
}
