// Import the database connection
const db = require('./db');

// Simple test query
async function testConnection() {
    try {
        // Test query to get current timestamp
        const result = await db.query('SELECT NOW() as current_time');
        console.log('Database connection successful!');
        console.log('Current database time:', result.rows[0].current_time);
    } catch (error) {
        console.error('Error testing database connection:', error);
    } finally {
        // End the pool
        await db.pool.end();
    }
}

// Run the test
testConnection(); 