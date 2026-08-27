// Cloudflare D1 REST API Helper
const axios = require('axios');

const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
const CF_DATABASE_ID = process.env.CF_DATABASE_ID;
const CF_API_TOKEN = process.env.CF_API_TOKEN;

const BASE_URL = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/d1/database/${CF_DATABASE_ID}`;

const headers = () => ({
  'Authorization': `Bearer ${CF_API_TOKEN}`,
  'Content-Type': 'application/json',
});

/**
 * Execute a SQL query on Cloudflare D1
 * @param {string} sql - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Array>} - Results
 */
async function query(sql, params = []) {
  try {
    const response = await axios.post(
      `${BASE_URL}/query`,
      { sql, params },
      { headers: headers() }
    );

    if (!response.data.success) {
      throw new Error(`D1 Query Error: ${JSON.stringify(response.data.errors)}`);
    }

    const result = response.data.result;
    if (result && result.length > 0) {
      return result[0].results || [];
    }
    return [];
  } catch (error) {
    console.error('Cloudflare D1 Error:', error.message);
    throw error;
  }
}

/**
 * Execute a SQL query and return first row
 */
async function queryFirst(sql, params = []) {
  const results = await query(sql, params);
  return results.length > 0 ? results[0] : null;
}

/**
 * Execute a write query (INSERT, UPDATE, DELETE)
 */
async function execute(sql, params = []) {
  try {
    const response = await axios.post(
      `${BASE_URL}/query`,
      { sql, params },
      { headers: headers() }
    );

    if (!response.data.success) {
      throw new Error(`D1 Execute Error: ${JSON.stringify(response.data.errors)}`);
    }

    return response.data.result[0];
  } catch (error) {
    console.error('Cloudflare D1 Execute Error:', error.message);
    throw error;
  }
}

/**
 * Execute multiple SQL statements (batch)
 */
async function batch(statements) {
  try {
    const response = await axios.post(
      `${BASE_URL}/query`,
      statements.map(s => ({ sql: s.sql, params: s.params || [] })),
      { headers: headers() }
    );

    if (!response.data.success) {
      throw new Error(`D1 Batch Error: ${JSON.stringify(response.data.errors)}`);
    }

    return response.data.result;
  } catch (error) {
    console.error('Cloudflare D1 Batch Error:', error.message);
    throw error;
  }
}

module.exports = { query, queryFirst, execute, batch };
