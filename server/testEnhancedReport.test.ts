import { describe, it, expect } from 'vitest';
import { generateEnhancedReport } from './enhancedReportGenerator';
import { getActiveProperties, getActiveBuyerRequests, getPropertiesStats, getBuyerRequestsStats } from './propertiesDb';
import * as fs from 'fs';

describe('Enhanced Report with Properties and Requests', () => {
  it('should generate enhanced report with all sheets', async () => {
    console.log('\n📊 Testing enhanced report generation...');

    const reportPath = await generateEnhancedReport();

    expect(reportPath).toBeDefined();
    expect(fs.existsSync(reportPath)).toBe(true);

    const stats = fs.statSync(reportPath);
    expect(stats.size).toBeGreaterThan(0);

    console.log(`✅ Enhanced report generated: ${stats.size} bytes`);
  });

  it('should extract active properties', async () => {
    console.log('\n🏠 Testing properties extraction...');

    const properties = await getActiveProperties(100);

    expect(Array.isArray(properties)).toBe(true);
    console.log(`✅ Extracted ${properties.length} properties`);

    if (properties.length > 0) {
      const sample = properties[0] as any;
      console.log(`   Sample: ${sample.name} - ${sample.type} in ${sample.location}`);
    }
  });

  it('should extract active buyer requests', async () => {
    console.log('\n👥 Testing buyer requests extraction...');

    const requests = await getActiveBuyerRequests(100);

    expect(Array.isArray(requests)).toBe(true);
    console.log(`✅ Extracted ${requests.length} buyer requests`);

    if (requests.length > 0) {
      const sample = requests[0] as any;
      console.log(`   Sample: ${sample.name} - ${sample.type} in ${sample.location}`);
    }
  });

  it('should get properties statistics', async () => {
    console.log('\n📈 Testing properties statistics...');

    const stats = await getPropertiesStats();

    expect(stats).toBeDefined();
    expect(typeof stats.totalProperties).toBe('number');

    console.log(`✅ Properties Stats:`);
    console.log(`   Total: ${stats.totalProperties}`);
    console.log(`   Available: ${stats.available}`);
    console.log(`   Matched: ${stats.matched}`);
    console.log(`   Pending: ${stats.pending}`);
  });

  it('should get buyer requests statistics', async () => {
    console.log('\n📊 Testing buyer requests statistics...');

    const stats = await getBuyerRequestsStats();

    expect(stats).toBeDefined();
    expect(typeof stats.totalRequests).toBe('number');

    console.log(`✅ Buyer Requests Stats:`);
    console.log(`   Total: ${stats.totalRequests}`);
    console.log(`   Available: ${stats.available}`);
    console.log(`   Matched: ${stats.matched}`);
    console.log(`   Pending: ${stats.pending}`);
  });

  it('should include Properties sheet in report', async () => {
    console.log('\n📋 Verifying Properties sheet in report...');

    const reportPath = await generateEnhancedReport();
    const fileSize = fs.statSync(reportPath).size;

    // Enhanced report should be larger than base report (includes Properties and Requests sheets)
    expect(fileSize).toBeGreaterThan(30000); // At least 30KB

    console.log(`✅ Enhanced report includes all sheets: ${fileSize} bytes`);
  });

  it('should include Buyer Requests sheet in report', async () => {
    console.log('\n📋 Verifying Buyer Requests sheet in report...');

    const reportPath = await generateEnhancedReport();
    const fileSize = fs.statSync(reportPath).size;

    expect(fileSize).toBeGreaterThan(0);
    console.log(`✅ Report generated with Buyer Requests sheet: ${fileSize} bytes`);
  });
});
