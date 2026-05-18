const fs = require('fs');
const path = require('path');

const exportDir = path.join(__dirname, '../firestore-export');

function escapeSQL(str) {
  if (str === null || str === undefined) return 'NULL';
  if (str === '') return "''";
  return `'${String(str).replace(/'/g, "''")}'`;
}

function generateInsertSQL(tableName, docs) {
  if (!docs.length) return '';
  
  // Get all unique column names from all docs
  const columns = new Set();
  docs.forEach(doc => {
    Object.keys(doc).forEach(col => columns.add(col));
  });
  
  const columnArray = Array.from(columns);
  const statements = [];
  
  for (const doc of docs) {
    const values = columnArray.map(col => {
      const val = doc[col];
      if (val === null || val === undefined) return 'NULL';
      if (typeof val === 'object') return escapeSQL(JSON.stringify(val));
      return escapeSQL(String(val));
    });
    
    statements.push(
      `INSERT INTO ${tableName} (${columnArray.map(c => `"${c.toLowerCase()}"`).join(', ')}) VALUES (${values.join(', ')}) ON CONFLICT("id") DO UPDATE SET ${columnArray.filter(c => c !== 'id').map(c => `"${c.toLowerCase()}" = EXCLUDED."${c.toLowerCase()}"`).join(', ')};`
    );
  }
  
  return statements.join('\n');
}

function main() {
  const files = fs.readdirSync(exportDir).filter(f => f.endsWith('.json'));
  let allSQL = '';
  
  for (const file of files) {
    const tableName = path.basename(file, '.json');
    const filePath = path.join(exportDir, file);
    const docs = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    
    if (docs.length) {
      console.log(`Generating SQL for ${tableName}...`);
      const sql = generateInsertSQL(tableName, docs);
      allSQL += sql + '\n\n';
    }
  }
  
  const outputPath = path.join(exportDir, '__insert_data.sql');
  fs.writeFileSync(outputPath, allSQL);
  console.log(`\nSQL saved to ${outputPath}`);
  console.log(`Total size: ${(allSQL.length / 1024).toFixed(2)} KB`);
}

main();
