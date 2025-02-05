const { Client } = require('pg');

// Create a new client instance
const client = new Client({
  user: '', // replace with your PostgreSQL username
  host: 'localhost',
  database: '', // replace with your database name
  password: '', // replace with your PostgreSQL password
  port: 5432, // default PostgreSQL port
});

// Connect to the database
client.connect()
  .then(() => {
    console.log('Connected to the database');

    // Example: Create a table
    return client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100),
        email VARCHAR(100) UNIQUE
      )
    `);
  })
  .then(() => {
    console.log('Table created');

    // Example: Insert a record
    return client.query('INSERT INTO users (name, email) VALUES ($1, $2)', ['John Doe', 'john@example.com']);
  })
  .then(() => {
    console.log('Record inserted');

    // Example: Query the records
    return client.query('SELECT * FROM users');
  })
  .then(res => {
    console.log('Users:', res.rows);
  })
  .catch(err => {
    console.error('Error executing query', err.stack);
  })
  .finally(() => {
    // Close the database connection
    client.end();
  });