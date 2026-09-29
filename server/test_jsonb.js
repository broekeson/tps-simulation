const { Client } = require('pg');
async function test() {
  const client = new Client({ connectionString: 'postgres://postgres:postgres@localhost:5432/postgres' });
  try {
    await client.connect();
    // Use an array for a JSONB parameter
    await client.query('SELECT $1::jsonb', [ [{ a: 1 }] ]);
    console.log("SUCCESS array to jsonb");
  } catch(e) {
    console.error("FAIL", e.message);
  }
  await client.end();
}
test();
