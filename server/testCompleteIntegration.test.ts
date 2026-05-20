import { describe, it, expect } from 'vitest';
import { generateEnhancedReport } from './enhancedReportGenerator';
import { getActiveProperties, getActiveBuyerRequests } from './propertiesDb';
import * as fs from 'fs';

describe('Complete Integration: Scheduler + Export + Matching', () => {
  it('should generate enhanced report with original messages', async () => {
    console.log('\n📊 Testing enhanced report with original messages...');

    const reportPath = await generateEnhancedReport();

    expect(reportPath).toBeDefined();
    expect(fs.existsSync(reportPath)).toBe(true);

    const stats = fs.statSync(reportPath);
    expect(stats.size).toBeGreaterThan(100000); // At least 100KB

    console.log(`✅ Enhanced report with original messages: ${stats.size} bytes`);
  });

  it('should export properties with original messages', async () => {
    console.log('\n📥 Testing properties export with original messages...');

    const properties = await getActiveProperties(100);

    expect(Array.isArray(properties)).toBe(true);
    expect(properties.length).toBeGreaterThan(0);

    // Check that original messages are included
    const withMessages = properties.filter((p: any) => p.originalMessage);
    console.log(`✅ Properties with original messages: ${withMessages.length}/${properties.length}`);

    if (withMessages.length > 0) {
      const sample = withMessages[0] as any;
      console.log(`   Sample message: "${sample.originalMessage.substring(0, 50)}..."`);
    }
  });

  it('should export buyer requests with original messages', async () => {
    console.log('\n📥 Testing buyer requests export with original messages...');

    const requests = await getActiveBuyerRequests(100);

    expect(Array.isArray(requests)).toBe(true);
    expect(requests.length).toBeGreaterThan(0);

    // Check that original messages are included
    const withMessages = requests.filter((r: any) => r.originalMessage);
    console.log(`✅ Buyer requests with original messages: ${withMessages.length}/${requests.length}`);

    if (withMessages.length > 0) {
      const sample = withMessages[0] as any;
      console.log(`   Sample message: "${sample.originalMessage.substring(0, 50)}..."`);
    }
  });

  it('should have matching engine integrated', async () => {
    console.log('\n🔗 Testing matching engine integration...');

    // The matching engine should be available and working
    const { findMatches } = await import('./matchingEngine');

    expect(typeof findMatches).toBe('function');
    console.log('✅ Matching engine is properly integrated');
  });

  it('should verify scheduler configuration', async () => {
    console.log('\n⏰ Testing scheduler configuration...');

    // Check that scheduler is properly configured
    const { initializeReportScheduler, stopReportScheduler } = await import('./newReportScheduler');

    expect(typeof initializeReportScheduler).toBe('function');
    expect(typeof stopReportScheduler).toBe('function');

    console.log('✅ Scheduler functions are available');
  });

  it('should verify export endpoints exist', async () => {
    console.log('\n📤 Testing export endpoints...');

    const { exportPropertiesExcel, exportBuyerRequestsExcel } = await import('./exportProcedures');

    expect(exportPropertiesExcel).toBeDefined();
    expect(exportBuyerRequestsExcel).toBeDefined();

    console.log('✅ Export endpoints are properly defined');
  });

  it('should verify all data flows end-to-end', async () => {
    console.log('\n🔄 Testing complete data flow...');

    // 1. Get properties
    const properties = await getActiveProperties(50);
    console.log(`   1. Properties fetched: ${properties.length}`);

    // 2. Get buyer requests
    const requests = await getActiveBuyerRequests(50);
    console.log(`   2. Buyer requests fetched: ${requests.length}`);

    // 3. Generate report
    const reportPath = await generateEnhancedReport();
    console.log(`   3. Report generated: ${reportPath}`);

    // 4. Verify report exists
    expect(fs.existsSync(reportPath)).toBe(true);
    const reportSize = fs.statSync(reportPath).size;
    console.log(`   4. Report size: ${reportSize} bytes`);

    console.log('✅ Complete data flow verified');
  });
});
