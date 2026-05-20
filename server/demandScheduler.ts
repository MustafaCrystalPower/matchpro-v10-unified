/**
 * 3-Day Demand Report Scheduler
 * Sends demand-only reports via email every 3 days
 * Automatically archives processed demands
 */

import cron from 'node-cron';
import nodemailer from 'nodemailer';
import { generateDemandReport } from './demandReportGenerator';

let scheduledTask: any = null;

// Email transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_PORT === '465',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

/**
 * Initialize the 3-day scheduler
 * Runs at 9 AM Cairo time every 3 days
 */
export function initializeDemandScheduler() {
  // Schedule: Every 3 days at 9 AM Cairo time (6 AM UTC)
  // Using cron: 0 6 */3 * * * (every 3 days at 6 AM UTC)
  const cronExpression = '0 6 */3 * * *';
  
  console.log('\n📅 جاري تهيئة جدولة تقارير الطلبات (كل 3 أيام)...');
  console.log(`   ⏰ الجدول: ${cronExpression} (كل 3 أيام الساعة 9 صباحاً بتوقيت القاهرة)`);
  
  scheduledTask = cron.schedule(cronExpression, async () => {
    console.log('\n🚀 جاري تنفيذ مهمة إرسال تقرير الطلبات...\n');
    
    try {
      // Generate demand report (with archiving)
      const result = await generateDemandReport(true);
      
      if (result.demandCount === 0) {
        console.log('⚠️  لا توجد طلبات جديدة للإرسال');
        return;
      }
      
      // Send email
      const emailSubject = `MatchPro Demand Report - ${new Date().toLocaleDateString('ar-EG')}`;
      const emailBody = `
        <h2>MatchPro - تقرير الطلبات</h2>
        <p>تم إنشاء تقرير الطلبات الجديد بنجاح</p>
        <ul>
          <li><strong>عدد الطلبات:</strong> ${result.demandCount}</li>
          <li><strong>التاريخ:</strong> ${new Date().toLocaleDateString('ar-EG')}</li>
          <li><strong>الوقت:</strong> ${new Date().toLocaleTimeString('ar-EG')}</li>
        </ul>
        <p><a href="${result.url}">تحميل التقرير</a></p>
      `;
      
      await transporter.sendMail({
        from: process.env.SMTP_USER,
        to: process.env.REPORT_TO_EMAIL || 'mmaisara@crystalpowerinvestment.com',
        subject: emailSubject,
        html: emailBody
      });
      
      console.log(`✅ تم إرسال التقرير بنجاح!`);
      console.log(`   📧 إلى: ${process.env.REPORT_TO_EMAIL}`);
      console.log(`   📥 الطلبات المرسلة: ${result.demandCount}`);
      console.log(`   🔗 الرابط: ${result.url}\n`);
      
    } catch (error) {
      console.error('❌ خطأ في إرسال التقرير:', error);
    }
  });
  
  console.log('✅ تم تهيئة الجدولة بنجاح!\n');
  
  return scheduledTask;
}

/**
 * Stop the scheduler
 */
export function stopDemandScheduler() {
  if (scheduledTask) {
    scheduledTask.stop();
    console.log('⏹️  تم إيقاف جدولة تقارير الطلبات');
  }
}

/**
 * Manually trigger demand report (for testing)
 */
export async function triggerDemandReportNow() {
  console.log('\n🔔 جاري تشغيل تقرير الطلبات يدويًا...\n');
  
  try {
    const result = await generateDemandReport(true);
    
    if (result.demandCount === 0) {
      console.log('⚠️  لا توجد طلبات جديدة');
      return result;
    }
    
    // Send email
    const emailSubject = `MatchPro Demand Report (Manual) - ${new Date().toLocaleDateString('ar-EG')}`;
    const emailBody = `
      <h2>MatchPro - تقرير الطلبات (يدوي)</h2>
      <p>تم إنشاء تقرير الطلبات بناءً على طلب يدوي</p>
      <ul>
        <li><strong>عدد الطلبات:</strong> ${result.demandCount}</li>
        <li><strong>التاريخ:</strong> ${new Date().toLocaleDateString('ar-EG')}</li>
        <li><strong>الوقت:</strong> ${new Date().toLocaleTimeString('ar-EG')}</li>
      </ul>
      <p><a href="${result.url}">تحميل التقرير</a></p>
    `;
    
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: process.env.REPORT_TO_EMAIL || 'mmaisara@crystalpowerinvestment.com',
      subject: emailSubject,
      html: emailBody
    });
    
    console.log(`✅ تم إرسال التقرير بنجاح!`);
    console.log(`   📧 إلى: ${process.env.REPORT_TO_EMAIL}`);
    console.log(`   📥 الطلبات المرسلة: ${result.demandCount}`);
    console.log(`   🔗 الرابط: ${result.url}\n`);
    
    return result;
  } catch (error) {
    console.error('❌ خطأ:', error);
    throw error;
  }
}
