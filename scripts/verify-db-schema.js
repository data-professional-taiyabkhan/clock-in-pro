import dotenv from "dotenv";
import pkg from "pg";
const { Pool } = pkg;

dotenv.config();

// Color functions
const cyan = (text) => `\x1b[36m${text}\x1b[0m`;
const green = (text) => `\x1b[32m${text}\x1b[0m`;
const yellow = (text) => `\x1b[33m${text}\x1b[0m`;
const red = (text) => `\x1b[31m${text}\x1b[0m`;
const bold = (text) => `\x1b[1m${text}\x1b[0m`;

async function verifySchema() {
  console.log('\n' + '='.repeat(70));
  console.log(bold('🔍 Verifying Database Schema'));
  console.log('='.repeat(70) + '\n');

  // Parse DATABASE_URL
  const dbUrl = process.env.DATABASE_URL?.replace('?sslmode=require', '') || process.env.DATABASE_URL;
  
  if (!dbUrl) {
    console.log(red('❌ DATABASE_URL not found in .env'));
    return false;
  }

  const url = new URL(dbUrl);
  console.log(cyan(`📊 Database: ${url.pathname.slice(1)}`));
  console.log(cyan(`🏠 Host: ${url.hostname}:${url.port || 5432}`));
  console.log(cyan(`👤 User: ${url.username}\n`));

  let pool;
  
  try {
    console.log(yellow('🔌 Connecting to database...'));
    
    pool = new Pool({
      connectionString: dbUrl,
      max: 1,
      ssl: {
        rejectUnauthorized: false // AWS RDS self-signed certificates
      }
    });

    const client = await pool.connect();
    console.log(green('✅ Connected successfully!\n'));

    // Get PostgreSQL version
    const versionResult = await client.query('SELECT version()');
    console.log(cyan('📦 PostgreSQL Version:'));
    console.log(`   ${versionResult.rows[0].version.split(',')[0]}\n`);

    // Get all tables
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    const tables = tablesResult.rows.map(row => row.table_name);
    
    console.log(bold(`📋 Found ${tables.length} tables:\n`));
    
    if (tables.length === 0) {
      console.log(red('❌ No tables found! Schema might not be pushed.'));
      console.log(yellow('💡 Run: npm run db:push'));
      client.release();
      await pool.end();
      return false;
    }

    // Display tables in a nice grid
    const maxLength = Math.max(...tables.map(t => t.length));
    tables.forEach((table, index) => {
      const padding = ' '.repeat(maxLength - table.length + 2);
      const number = (index + 1).toString().padStart(2, ' ');
      console.log(`  ${cyan(number)}. ${green(table)}${padding}${getTableEmoji(table)}`);
    });

    // Expected tables (from schema.ts)
    const expectedTables = [
      'organizations',
      'users',
      'locations',
      'attendance_records',
      'attendance_verification_logs',
      'employee_invitations',
      'employee_locations'
    ];

    console.log('\n' + '='.repeat(70));
    
    const missingTables = expectedTables.filter(table => !tables.includes(table));
    
    if (missingTables.length > 0) {
      console.log(yellow(`⚠️  Missing ${missingTables.length} expected tables:`));
      missingTables.forEach(table => console.log(`   - ${table}`));
    } else {
      console.log(green('✅ All expected tables are present!'));
    }

    // Get some statistics
    console.log('\n' + '='.repeat(70));
    console.log(bold('📊 Table Statistics:\n'));
    
    for (const table of tables.slice(0, 5)) { // Show first 5 tables
      const countResult = await client.query(`SELECT COUNT(*) FROM ${table}`);
      const count = countResult.rows[0].count;
      const emoji = count === '0' ? '🆕' : '📊';
      console.log(`  ${emoji} ${cyan(table.padEnd(30))} ${green(count.padStart(6))} rows`);
    }
    
    if (tables.length > 5) {
      console.log(`\n  ${yellow('... and')} ${tables.length - 5} ${yellow('more tables')}`);
    }

    client.release();
    await pool.end();

    console.log('\n' + '='.repeat(70));
    console.log(green('✅ Schema verification complete!'));
    console.log('='.repeat(70) + '\n');
    
    return true;

  } catch (err) {
    console.log(red(`\n❌ Error: ${err.message}\n`));
    if (pool) {
      await pool.end();
    }
    return false;
  }
}

function getTableEmoji(tableName) {
  const emojiMap = {
    'organizations': '🏢',
    'users': '👥',
    'locations': '📍',
    'attendance_records': '📝',
    'attendance_verification_logs': '🔍',
    'employee_invitations': '✉️',
    'time_records': '⏰',
    'leave_requests': '🏖️',
    'leave_balances': '💰',
    'holidays': '🎉',
    'projects': '📁',
    'teams': '👨‍👩‍👧‍👦',
    'enrollments': '📚',
    'roles': '🎭',
    'departments': '🏛️',
    'sessions': '🔐',
    'password_reset_tokens': '🔑',
    'audit_logs': '📜',
    'face_embeddings': '🤖'
  };
  return emojiMap[tableName] || '📄';
}

// Run verification
verifySchema().then(success => {
  process.exit(success ? 0 : 1);
}).catch(err => {
  console.error(red('Fatal error:'), err);
  process.exit(1);
});

