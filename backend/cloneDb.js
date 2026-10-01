const mysql = require('mysql2/promise');

async function cloneDatabase() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Sabari@5143'
  });

  try {
    const oldDb = 'leetcode_tracker';
    const newDb = 'leetcode_tracker_new';
    
    console.log(`Creating database ${newDb}...`);
    await connection.query(`CREATE DATABASE IF NOT EXISTS ${newDb}`);
    
    // Get all tables from old db
    const [tables] = await connection.query(`SHOW TABLES FROM ${oldDb}`);
    const tableNames = tables.map(row => Object.values(row)[0]);
    
    console.log(`Found ${tableNames.length} tables. Cloning schemas and data...`);
    
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    
    for (const table of tableNames) {
      console.log(`Cloning table ${table}...`);
      
      // Get create table syntax
      const [createTableInfo] = await connection.query(`SHOW CREATE TABLE ${oldDb}.${table}`);
      let createSql = createTableInfo[0]['Create Table'];
      
      // Execute create in new DB
      await connection.query(`USE ${newDb}`);
      await connection.query(`DROP TABLE IF EXISTS ${table}`);
      await connection.query(createSql);
      
      // Copy data
      await connection.query(`INSERT INTO ${newDb}.${table} SELECT * FROM ${oldDb}.${table}`);
    }
    
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('Database cloned successfully!');
  } catch (error) {
    console.error('Error cloning database:', error);
  } finally {
    await connection.end();
  }
}

cloneDatabase();
