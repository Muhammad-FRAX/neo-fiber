// Import the alarm service
const alarmService = require('../services/alarm.service');

class AlarmController {
    // Get paginated alarms with filters
    async getAlarms(req, res) {
        try {
            // Get query parameters
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            
            // Get filter parameters
            const filters = {
                alarmName: req.query.alarmName,
                severity: req.query.severity,
                status: req.query.status,
                source: req.query.source,
                FiberLinkSite_Name: req.query.FiberLinkSite_Name
            };

            // Remove undefined filters
            Object.keys(filters).forEach(key => 
                filters[key] === undefined && delete filters[key]
            );

            // Get alarms and total count
            const [alarms, total] = await Promise.all([
                alarmService.getAlarms(page, limit, filters),
                alarmService.getTotalAlarms(filters)
            ]);

            // Calculate total pages
            const totalPages = Math.ceil(total / limit);

            // Send response in the format expected by the frontend
            res.json({
                success: true,
                data: {
                    alarms: alarms,
                    pagination: {
                        total,
                        page,
                        limit,
                        totalPages
                    }
                }
            });
        } catch (error) {
            console.error('Error in getAlarms controller:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to fetch alarms'
            });
        }
    }

    // Get active alarms
    async getActiveAlarms(req, res) {
        try {
            const limit = parseInt(req.query.limit) || 10;
            const alarms = await alarmService.getActiveAlarms(limit);
            
            res.json({
                success: true,
                data: {
                    alarms
                }
            });
        } catch (error) {
            console.error('Error in getActiveAlarms controller:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to fetch active alarms'
            });
        }
    }
}

// Export the controller
module.exports = new AlarmController(); 