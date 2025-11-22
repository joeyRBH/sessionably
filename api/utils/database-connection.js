// Database Connection Utility
// Manages PostgreSQL connection with Crunchy Bridge (or any PostgreSQL provider)

let sql = null;
let isConnected = false;

/**
 * Initialize database connection
 * Uses postgres client library with connection pooling
 * Throws error if DATABASE_URL is not configured
 */
async function initDatabase() {
  // If already connected, return true
  if (isConnected && sql) {
    return true;
  }

  // Check if DATABASE_URL is configured
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  try {
    // Lazy load postgres client (only when DATABASE_URL is set)
    const postgres = require('postgres');

    // Create connection with Crunchy Bridge optimized settings
    sql = postgres(process.env.DATABASE_URL, {
      // Connection pooling settings for Vercel serverless
      max: 10,                    // Max connections per instance
      idle_timeout: 20,           // Close idle connections after 20s
      connect_timeout: 10,        // Connection timeout

      // SSL settings (required for Crunchy Bridge)
      ssl: 'require',

      // Automatic reconnection
      connection: {
        application_name: 'sessionably'
      },

      // Transform column names from snake_case to camelCase
      transform: {
        column: {
          to: postgres.toCamel,
          from: postgres.fromCamel
        }
      },

      // Error handling
      onnotice: () => {}, // Suppress notices in production
      debug: process.env.NODE_ENV === 'development'
    });

    // Test connection
    await sql`SELECT 1 as test`;

    isConnected = true;
    console.log('✅ Database connected successfully');
    return true;

  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    sql = null;
    isConnected = false;
    throw error;
  }
}

/**
 * Execute a query with parameters
 * Returns { success, data, error }
 */
async function executeQuery(query, params = []) {
  if (!isConnected || !sql) {
    return {
      success: false,
      data: [],
      error: 'Database not connected'
    };
  }

  try {
    // Convert parameterized query to postgres template literal format
    // This function handles both raw queries and parameterized queries
    const result = await sql.unsafe(query, params);

    return {
      success: true,
      data: Array.isArray(result) ? result : [result],
      error: null
    };

  } catch (error) {
    console.error('Query execution error:', error.message);
    return {
      success: false,
      data: [],
      error: error.message
    };
  }
}

/**
 * Execute a transaction with multiple queries
 * Rolls back automatically if any query fails
 */
async function executeTransaction(queries) {
  if (!isConnected || !sql) {
    return {
      success: false,
      error: 'Database not connected'
    };
  }

  try {
    const result = await sql.begin(async (sql) => {
      const results = [];
      for (const { query, params } of queries) {
        const res = await sql.unsafe(query, params || []);
        results.push(res);
      }
      return results;
    });

    return {
      success: true,
      data: result,
      error: null
    };

  } catch (error) {
    console.error('Transaction error:', error.message);
    return {
      success: false,
      data: [],
      error: error.message
    };
  }
}

/**
 * Check if database is connected
 */
function isDatabaseConnected() {
  return isConnected;
}

/**
 * Get the SQL client instance (for advanced usage)
 */
function getSqlClient() {
  return sql;
}

/**
 * Close database connection (for cleanup)
 */
async function closeDatabase() {
  if (sql) {
    await sql.end();
    sql = null;
    isConnected = false;
    console.log('Database connection closed');
  }
}

module.exports = {
  initDatabase,
  executeQuery,
  executeTransaction,
  isDatabaseConnected,
  getSqlClient,
  closeDatabase
};
