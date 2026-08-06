const cron = require('node-cron');
const SystemConfig = require('../models/system-config/SystemConfig');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const backupDir = path.join(__dirname, '../../../vision-tech-backup');

// ─────────────────────────────────────────────
// Parse folder name → { year, month, day }
// Folder format: backup-YYYY-MM-DD
// ─────────────────────────────────────────────
function parseFolderDate(folderName) {
  const match = folderName.match(/^backup-(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return {
    year:  parseInt(match[1]),
    month: parseInt(match[2]),
    day:   parseInt(match[3]),
    full:  `${match[1]}-${match[2]}`,       // "YYYY-MM"
    folder: folderName,
  };
}

// ─────────────────────────────────────────────
// Cleanup logic
// ─────────────────────────────────────────────
function cleanOldBackups(todayDate) {
  if (!fs.existsSync(backupDir)) return;

  const folders = fs.readdirSync(backupDir).filter(f =>
    fs.statSync(path.join(backupDir, f)).isDirectory()
  );

  const today     = parseFolderDate(`backup-${todayDate}`);
  const thisMonth = today.full; // "YYYY-MM"

  // Get all parsed folders
  const parsed = folders.map(parseFolderDate).filter(Boolean);

  // ── Within this month: keep only today, delete everything else ──
  const thisMonthFolders = parsed.filter(p => p.full === thisMonth && p.folder !== `backup-${todayDate}`);
  
  for (const p of thisMonthFolders) {
    const folderPath = path.join(backupDir, p.folder);
    fs.rmSync(folderPath, { recursive: true, force: true });
    console.log(`[Cron] Deleted old backup: ${p.folder}`);
  }

  // ── Previous months: keep only the LAST backup of each month ──
  const prevMonthFolders = parsed.filter(p => p.full !== thisMonth);

  // Group by month
  const byMonth = {};
  for (const p of prevMonthFolders) {
    if (!byMonth[p.full]) byMonth[p.full] = [];
    byMonth[p.full].push(p);
  }

  for (const [month, items] of Object.entries(byMonth)) {
    // Sort ascending → last item is the latest of that month
    items.sort((a, b) => a.day - b.day);
    const keepFolder = items[items.length - 1].folder; // keep latest

    // Delete all others from that month
    for (const item of items) {
      if (item.folder !== keepFolder) {
        const folderPath = path.join(backupDir, item.folder);
        fs.rmSync(folderPath, { recursive: true, force: true });
        console.log(`[Cron] Deleted ${month} old backup: ${item.folder} (kept: ${keepFolder})`);
      }
    }
  }
}

// ─────────────────────────────────────────────
// Backup runner
// ─────────────────────────────────────────────
async function runBackup() {
  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();

  // Use date-only folder name for easy parsing
  const now       = new Date();
  const datestamp = now.toISOString().slice(0, 10); // "YYYY-MM-DD"
  const timestamp = now.toISOString().replace(/[:.]/g, '-');
  const sessionDir = path.join(backupDir, `backup-${datestamp}-${timestamp.slice(11)}`);

  fs.mkdirSync(sessionDir, { recursive: true });

  for (const col of collections) {
    const name = col.name;
    const docs = await db.collection(name).find({}).toArray();
    fs.writeFileSync(
      path.join(sessionDir, `${name}.json`),
      JSON.stringify(docs, null, 2)
    );
  }

  return { sessionDir, datestamp };
}

// ─────────────────────────────────────────────
// Cron Job
// ─────────────────────────────────────────────
cron.schedule('55 10 * * *', async () => {
  console.log('[Cron] Job started at:', new Date().toLocaleString());

  try {
    const config = await SystemConfig.findOne().lean();

    if (!config?.general?.autoBackup) {
      console.log('[Cron] Auto backup is disabled, skipping.');
      return;
    }

    // 1. Run today's backup
    console.log('[Cron] Starting backup...');
    const { sessionDir, datestamp } = await runBackup();
    console.log('[Cron] Backup saved at:', sessionDir);

    // 2. Clean up old backups
    cleanOldBackups(datestamp);
    console.log('[Cron] Cleanup done.');

  } catch (err) {
    console.error('[Cron] Backup failed:', err.message);
  }
}, {
  timezone: "Asia/Kolkata"
});

module.exports = { runBackup };