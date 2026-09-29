const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:postgres@localhost:5432/postgres' });
// We just want to see if pg throws when parameter is undefined
pool.query('SELECT $1::text', [undefined]).then(console.log).catch(console.error);
