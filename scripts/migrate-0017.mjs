/**
 * Migration 0017 — Apply manually via Node.js
 * Run: node scripts/migrate-0017.mjs
 *
 * Adds 'agro_publisher' plan and 'sending' WhatsApp lock status.
 */

import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';
dotenv.config();

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
  console.error('ERROR: DATABASE_URL not set');
  process.exit(1);
}

async function run() {
  const conn = await mysql.createConnection(DB_URL);
  console.log('Connected to database');

  const migrations = [
    {
      name: 'Add agro_publisher to users.subscriptionPlan',
      sql: `ALTER TABLE \`users\`
        MODIFY COLUMN \`subscriptionPlan\`
          ENUM('morning_call', 'corporativo', 'agro_publisher')`,
    },
    {
      name: 'Add agro_publisher to organizations.plan',
      sql: `ALTER TABLE \`organizations\`
        MODIFY COLUMN \`plan\`
          ENUM('morning_call', 'corporativo', 'agro_publisher')
          NOT NULL DEFAULT 'corporativo'`,
    },
    {
      name: 'Add sending status to whatsapp_auto_sends (DB send lock)',
      sql: `ALTER TABLE \`whatsapp_auto_sends\`
        MODIFY COLUMN \`status\`
          ENUM('pending', 'sending', 'sent', 'failed')
          NOT NULL DEFAULT 'pending'`,
    },
  ];

  for (const m of migrations) {
    try {
      console.log(`\nRunning: ${m.name}`);
      await conn.execute(m.sql);
      console.log(`  ✓ Done`);
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY' || err.message?.includes('already exists')) {
        console.log(`  ✓ Already applied (skipped)`);
      } else {
        console.error(`  ✗ Error: ${err.message}`);
        // Continue with other migrations
      }
    }
  }

  // Verify
  console.log('\nVerifying...');
  const [rows] = await conn.execute(`
    SELECT COLUMN_NAME, COLUMN_TYPE
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME IN ('users', 'organizations', 'whatsapp_auto_sends')
      AND COLUMN_NAME IN ('subscriptionPlan', 'plan', 'status')
    ORDER BY TABLE_NAME, COLUMN_NAME
  `);
  for (const row of rows) {
    console.log(`  ${row.TABLE_NAME ?? ''}.${row.COLUMN_NAME}: ${row.COLUMN_TYPE}`);
  }

  await conn.end();
  console.log('\nMigration 0017 complete.');
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
