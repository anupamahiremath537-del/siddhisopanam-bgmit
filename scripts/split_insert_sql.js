const fs = require('fs');
const path = require('path');

const sqlFile = path.join(__dirname, '../firestore-export/__insert_data.sql');
const sql = fs.readFileSync(sqlFile, 'utf-8');

// Split by table (each table's statements are grouped)
const tables = ['events', 'manual_certificates', 'otps', 'registrations', 'reminders', 'users'];
const statements = {};

for (const table of tables) {
  statements[table] = [];
}

// Extract statements by finding INSERT INTO {table}
let currentPos = 0;
for (const table of tables) {
  const pattern = new RegExp(`INSERT INTO ${table}\\s*\\(`, 'g');
  let match;
  while ((match = pattern.exec(sql)) !== null) {
    // Find the end of this statement (; followed by newline or end)
    const start = match.index;
    let end = sql.indexOf(';', start);
    if (end !== -1) {
      end += 1; // Include the semicolon
      statements[table].push(sql.substring(start, end));
    }
  }
}

// Output split SQL for each table
for (const [table, stmts] of Object.entries(statements)) {
  if (stmts.length > 0) {
    const outputPath = path.join(__dirname, `../firestore-export/${table}_insert.sql`);
    fs.writeFileSync(outputPath, stmts.join('\n'));
    console.log(`${table}: ${stmts.length} statements (${(stmts.join('\n').length / 1024).toFixed(2)} KB) -> ${outputPath}`);
  }
}
