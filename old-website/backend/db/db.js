// Import required packages
const { Pool } = require('pg');
require('dotenv').config();

// Create a new pool instance with retry logic
const createPool = () => {
    const pool = new Pool({
        host: process.env.PG_HOST,
        port: process.env.PG_PORT,
        user: process.env.PG_USER,
        password: process.env.PG_PASSWORD,
        database: process.env.PG_DATABASE,
        schema: process.env.PG_SCHEMA,
        // Maximum number of clients in the pool
        max: 20,
        // How long a client is allowed to remain idle before being closed
        idleTimeoutMillis: 30000,
        // How long to wait before timing out when connecting a new client
        connectionTimeoutMillis: 5000,
        // Add retry logic
        retry_strategy: function(options) {
            if (options.error && options.error.code === 'ENETUNREACH') {
                console.error('Network unreachable. Please check your connection and server status.');
                return new Error('Network unreachable');
            }
            if (options.attempt > 3) {
                return new Error('Max retry attempts reached');
            }
            return Math.min(options.attempt * 100, 3000);
        }
    });

    // Test the connection
    pool.connect((err, client, release) => {
        if (err) {
            console.error('Error connecting to the database:', err.stack);
            console.error('Connection details:', {
                host: process.env.PG_HOST,
                port: process.env.PG_PORT,
                database: process.env.PG_DATABASE,
                user: process.env.PG_USER
            });
        } else {
            console.log('Successfully connected to PostgreSQL database!');
            // Test query to verify schema access
            client.query(`SELECT current_schema();`, (err, result) => {
                release(); // Release the client back to the pool
                if (err) {
                    console.error('Error executing test query:', err.stack);
                } else {
                    console.log('Current schema:', result.rows[0].current_schema);
                }
            });
        }
    });

    // Handle pool errors
    pool.on('error', (err, client) => {
        console.error('Unexpected error on idle client', err);
    });

    return pool;
};

const pool = createPool();

// Export the pool for use in other files
module.exports = {
    query: (text, params) => pool.query(text, params),
    pool,
    // Add a function to check connection
    checkConnection: async () => {
        try {
            const client = await pool.connect();
            client.release();
            return true;
        } catch (err) {
            console.error('Database connection check failed:', err);
            return false;
        }
    }
}; 