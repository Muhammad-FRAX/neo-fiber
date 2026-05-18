// Import the alarm service
const alarmService = require('./alarm.service');

// Test function
async function testAlarmService() {
    try {
        // Test getting first page of alarms
        console.log('Fetching first page of alarms...');
        const alarms = await alarmService.getAlarms(1, 5);
        console.log('First page alarms:', alarms);

        // Test getting total count
        console.log('\nFetching total alarm count...');
        const total = await alarmService.getTotalAlarms();
        console.log('Total alarms:', total);
    } catch (error) {
        console.error('Error testing alarm service:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            code: error.code
        });
    } finally {
        // End the pool
        process.exit();
    }
}

// Run the test
console.log('Starting test...');
testAlarmService(); 