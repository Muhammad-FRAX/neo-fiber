const fetch = require('node-fetch');

async function testAlarmAPI() {
    try {
        // Test getting alarms with filters
        console.log('Testing alarm API with filters...');
        const response = await fetch('http://localhost:5000/api/alarms?page=1&limit=5&severity=Critical&status=Not Clear');
        const data = await response.json();
        
        console.log('API Response:', JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error testing API:', error);
    }
}

testAlarmAPI(); 