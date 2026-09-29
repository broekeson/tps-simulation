const { Client } = require('pg');
async function test() {
  const client = new Client({ connectionString: 'postgres://postgres:postgres@localhost:5432/postgres' });
  // Just test parameter parsing
  const query = {
    text: 'SELECT $1::text, $2::text',
    values: ['hello', undefined]
  };
  try {
    // We don't even need to connect if parameter validation fails locally before network
    // but pg does parameter validation inside query()
    await client.connect();
    await client.query(query);
  } catch (err) {
    console.error("PG ERROR:", err.message);
  }
  await client.end();
}
test();
