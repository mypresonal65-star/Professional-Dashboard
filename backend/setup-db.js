// Database Setup Script - Run once to initialize Cloudflare D1
// Usage: node setup-db.js
require('dotenv').config();
const axios = require('axios');
const readline = require('readline');

const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
const CF_DATABASE_ID = process.env.CF_DATABASE_ID;
const CF_API_TOKEN = process.env.CF_API_TOKEN;

const BASE_URL = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/d1/database/${CF_DATABASE_ID}`;

async function executeSQL(sql) {
  const response = await axios.post(
    `${BASE_URL}/query`,
    { sql },
    {
      headers: {
        'Authorization': `Bearer ${CF_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    }
  );
  return response.data;
}

async function setupDatabase(adminPassword) {
  console.log('🗄️  Setting up Cloudflare D1 Database...\n');

  const tables = [
    // Users table
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      gmail TEXT UNIQUE NOT NULL,
      special_access INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    )`,

    // Access Keys table
    `CREATE TABLE IF NOT EXISTS access_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key_value TEXT UNIQUE NOT NULL,
      gmail TEXT NOT NULL,
      used INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used_at TEXT
    )`,

    // Key Generation Log (track daily limits)
    `CREATE TABLE IF NOT EXISTS key_generation_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      gmail TEXT NOT NULL,
      date TEXT NOT NULL,
      count INTEGER DEFAULT 0,
      UNIQUE(gmail, date)
    )`,

    // Sessions table
    `CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      gmail TEXT NOT NULL,
      device_token TEXT NOT NULL,
      device_fingerprint TEXT,
      last_active TEXT,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(gmail)
    )`,

    // Sections table
    `CREATE TABLE IF NOT EXISTS sections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      icon TEXT DEFAULT '📚',
      order_index INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    )`,

    // Playlists table
    `CREATE TABLE IF NOT EXISTS playlists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      section_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      youtube_playlist_id TEXT NOT NULL,
      description TEXT DEFAULT '',
      order_index INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (section_id) REFERENCES sections(id)
    )`,

    // Live Stream table
    `CREATE TABLE IF NOT EXISTS live_stream (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hls_url TEXT NOT NULL,
      is_active INTEGER DEFAULT 0,
      title TEXT DEFAULT 'Live Class',
      updated_at TEXT NOT NULL
    )`,

    // Admin Config table
    `CREATE TABLE IF NOT EXISTS admin_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`,
  ];

  for (const sql of tables) {
    try {
      await executeSQL(sql);
      const tableName = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/)?.[1];
      console.log(`  ✅ Table created: ${tableName}`);
    } catch (error) {
      console.error(`  ❌ Error creating table:`, error.message);
    }
  }

  // Insert default sections
  const defaultSections = [
    { name: 'Math', icon: '📐', order: 1 },
    { name: 'Reasoning', icon: '🧠', order: 2 },
    { name: 'Quant', icon: '📊', order: 3 },
    { name: 'Computer', icon: '💻', order: 4 },
    { name: 'English', icon: '📝', order: 5 },
  ];

  for (const section of defaultSections) {
    try {
      await executeSQL(
        `INSERT OR IGNORE INTO sections (name, icon, order_index, created_at) 
         VALUES ('${section.name}', '${section.icon}', ${section.order}, '${new Date().toISOString()}')`
      );
      console.log(`  ✅ Section: ${section.icon} ${section.name}`);
    } catch (error) {
      console.log(`  ⚠️  Section already exists: ${section.name}`);
    }
  }

  // Set admin password
  try {
    await executeSQL(
      `INSERT OR REPLACE INTO admin_config (key, value) VALUES ('admin_password', '${adminPassword}')`
    );
    console.log(`  ✅ Admin password set`);
  } catch (error) {
    console.error(`  ❌ Error setting admin password:`, error.message);
  }

  // Set admin token placeholder
  try {
    await executeSQL(
      `INSERT OR IGNORE INTO admin_config (key, value) VALUES ('admin_token', 'not-set')`
    );
  } catch (error) {}

  console.log('\n🎉 Database setup complete!\n');
  console.log('Next steps:');
  console.log('1. npm install');
  console.log('2. npm start');
  console.log('3. Open http://localhost:3000\n');
}

// Get admin password from command line or prompt
const args = process.argv.slice(2);
if (args[0]) {
  setupDatabase(args[0]);
} else {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question('Enter admin password (default: rohit83077): ', (password) => {
    rl.close();
    setupDatabase(password || 'rohit83077');
  });
}
