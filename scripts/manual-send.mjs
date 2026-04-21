import { sendDailySummaryEmail, hasEmailBeenSentToday } from '../server/emailSummary.js';
import { generateAutoWhatsAppText, getTodayAutoSend, markAutoSendComplete } from '../server/whatsappAutoGenerator.js';
import { sendMorningCallWhatsApp } from '../server/whatsappService.js';

async function run() {
  console.log('=== Manual Send for Today ===');
  
  // Send WhatsApp
  console.log('\n--- WhatsApp ---');
  try {
    const autoSend = await getTodayAutoSend();
    console.log('Existing auto-send:', autoSend ? `status=${autoSend.status}` : 'none');
    
    let result;
    if (autoSend?.generatedText) {
      console.log('Using existing generated text...');
      result = await sendMorningCallWhatsApp(undefined, autoSend.generatedText);
      if (autoSend.status === 'pending') {
        const dateStr = autoSend.sendDate instanceof Date
          ? autoSend.sendDate.toISOString().slice(0, 10)
          : String(autoSend.sendDate).slice(0, 10);
        await markAutoSendComplete(dateStr, { sent: result.sent, failed: result.failed, skipped: result.skipped });
      }
    } else {
      console.log('Generating new WhatsApp text via AI...');
      const genResult = await generateAutoWhatsAppText();
      console.log('Generation result:', genResult.message);
      if (genResult.success) {
        const freshAutoSend = await getTodayAutoSend();
        result = await sendMorningCallWhatsApp(undefined, freshAutoSend?.generatedText);
        await markAutoSendComplete(genResult.sendDate, { sent: result.sent, failed: result.failed, skipped: result.skipped });
      } else {
        result = await sendMorningCallWhatsApp();
      }
    }
    console.log(`WhatsApp result: sent=${result.sent}, failed=${result.failed}, skipped=${result.skipped}`);
  } catch (err) {
    console.error('WhatsApp error:', err.message);
  }

  // Send Email
  console.log('\n--- Email ---');
  try {
    const alreadySent = hasEmailBeenSentToday();
    console.log('Email already sent today?', alreadySent);
    if (alreadySent) {
      console.log('Skipping email (already sent today)');
    } else {
      console.log('Sending email now...');
      const result = await sendDailySummaryEmail();
      console.log('Email result:', result.message);
    }
  } catch (err) {
    console.error('Email error:', err.message);
  }
  
  console.log('\n=== Done ===');
  process.exit(0);
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
