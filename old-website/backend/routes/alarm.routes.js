const express = require('express');
const router = express.Router();
const alarmController = require('../controllers/alarm.controller');

// Get paginated alarms with filters
router.get('/', alarmController.getAlarms);

// Get active alarms
router.get('/active', alarmController.getActiveAlarms);

module.exports = router; 