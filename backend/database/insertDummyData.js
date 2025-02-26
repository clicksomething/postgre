const { Client } = require('pg');
const bcrypt = require('bcrypt');
const { registerUser } = require('../src/controllers/authController');
require('dotenv').config();

async function hashPassword(password) {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
}

async function isTableEmpty(client, tableName) {
  const result = await client.query(`SELECT COUNT(*) FROM ${tableName}`);
  return result.rows[0].count === '0';
}

async function insertDummyData() {
  const client = new Client({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
  });

  try {
    await client.connect();

    // Check if UserInfo table is empty
    const usersEmpty = await isTableEmpty(client, 'UserInfo');

    if (!usersEmpty) {
      console.log('UserInfo table is not empty, skipping dummy data insertion.');
      return;
    }

    // Hash passwords
    const adminPassword = await hashPassword('admin123');
    const observerPassword = await hashPassword('observer123');
    const userPassword = await hashPassword('user123');

    // Insert dummy data
    await client.query('BEGIN');

    // Insert Admin User
    await registerUser({
      body: {
        name: 'Admin User',
        email: 'admin@example.com',
        phoneNum: '1234567890',
        password: adminPassword,
        role: 'admin'
      }
    }, {
      status: (code) => ({
        json: (data) => {
          if (code !== 201) {
            throw new Error(`Failed to register admin user: ${data.message}`);
          }
        }
      })
    });

    // Insert Observer User
    await registerUser({
      body: {
        name: 'Observer User',
        email: 'observer@example.com',
        phoneNum: '0987654321',
        password: observerPassword,
        role: 'observer'
      }
    }, {
      status: (code) => ({
        json: (data) => {
          if (code !== 201) {
            throw new Error(`Failed to register observer user: ${data.message}`);
          }
        }
      })
    });

    // Insert Normal User
    await registerUser({
      body: {
        name: 'Normal User',
        email: 'user@example.com',
        phoneNum: '1122334455',
        password: userPassword,
        role: 'normal_user'
      }
    }, {
      status: (code) => ({
        json: (data) => {
          if (code !== 201) {
            throw new Error(`Failed to register normal user: ${data.message}`);
          }
        }
      })
    });

    await client.query('COMMIT');
    console.log('Dummy data inserted successfully!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error inserting dummy data:', error);
  } finally {
    await client.end();
  }
}

module.exports = insertDummyData;