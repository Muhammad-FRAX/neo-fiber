// Import the database connection
const db = require('../db/db');

class AlarmService {
    // Get paginated alarms with filters
    async getAlarms(page = 1, limit = 20, filters = {}) {
        try {
            // Calculate offset for pagination
            const offset = (page - 1) * limit;
            
            // Start building the query
            let query = `
                SELECT 
                    "Log_Serial_Number",
                    "Alarm_Name",
                    "Alarm_Severity",
                    "Alarm_Source",
                    "Status",
                    "OccurrenceTime",
                    "ClearanceTime",
                    "FiberlinkSite_ID",
                    "FiberLinkSite_Name",
                    "Site_A_ID",
                    "Site_B_ID",
                    "Source_NE",
                    "Sink_NE",
                    "State",
                    "LocationInformation"
                FROM dwh.fibergis_alarm_log
                WHERE 1=1
            `;
            
            const queryParams = [];
            let paramCount = 1;

            // Add filters if they exist
            if (filters.alarmName) {
                query += ` AND "Alarm_Name" ILIKE $${paramCount}`;
                queryParams.push(`%${filters.alarmName}%`);
                paramCount++;
            }

            if (filters.severity) {
                query += ` AND "Alarm_Severity" = $${paramCount}`;
                queryParams.push(filters.severity);
                paramCount++;
            }

            if (filters.status) {
                query += ` AND "Status" = $${paramCount}`;
                queryParams.push(filters.status);
                paramCount++;
            }

            if (filters.source) {
                query += ` AND "Alarm_Source" ILIKE $${paramCount}`;
                queryParams.push(`%${filters.source}%`);
                paramCount++;
            }

            if (filters.FiberLinkSite_Name) {
                query += ` AND "FiberLinkSite_Name" ILIKE $${paramCount}`;
                queryParams.push(`%${filters.FiberLinkSite_Name}%`);
                paramCount++;
            }

            // Add ordering and pagination
            query += `
                ORDER BY "OccurrenceTime" DESC
                LIMIT $${paramCount} OFFSET $${paramCount + 1}
            `;
            queryParams.push(limit, offset);
            
            // Execute query with parameters
            const result = await db.query(query, queryParams);
            return result.rows;
        } catch (error) {
            console.error('Error in getAlarms:', error);
            throw error;
        }
    }

    // Get total count of alarms with filters
    async getTotalAlarms(filters = {}) {
        try {
            let query = `
                SELECT COUNT(*)
                FROM dwh.fibergis_alarm_log
                WHERE 1=1
            `;
            
            const queryParams = [];
            let paramCount = 1;

            // Add the same filters as in getAlarms
            if (filters.alarmName) {
                query += ` AND "Alarm_Name" ILIKE $${paramCount}`;
                queryParams.push(`%${filters.alarmName}%`);
                paramCount++;
            }

            if (filters.severity) {
                query += ` AND "Alarm_Severity" = $${paramCount}`;
                queryParams.push(filters.severity);
                paramCount++;
            }

            if (filters.status) {
                query += ` AND "Status" = $${paramCount}`;
                queryParams.push(filters.status);
                paramCount++;
            }

            if (filters.source) {
                query += ` AND "Alarm_Source" ILIKE $${paramCount}`;
                queryParams.push(`%${filters.source}%`);
                paramCount++;
            }

            if (filters.FiberLinkSite_Name) {
                query += ` AND "FiberLinkSite_Name" ILIKE $${paramCount}`;
                queryParams.push(`%${filters.FiberLinkSite_Name}%`);
                paramCount++;
            }
            
            const result = await db.query(query, queryParams);
            return parseInt(result.rows[0].count);
        } catch (error) {
            console.error('Error in getTotalAlarms:', error);
            throw error;
        }
    }

    // Get active alarms (Not Clear status) ordered by severity and time
    async getActiveAlarms(limit = 10) {
        try {
            const query = `
                SELECT 
                    "Log_Serial_Number",
                    "Alarm_Name",
                    "Alarm_Severity",
                    "Alarm_Source",
                    "Status",
                    "OccurrenceTime",
                    "FiberLinkSite_Name",
                    "LocationInformation"
                FROM dwh.fibergis_alarm_log
                WHERE "Status" = 'Not Clear'
                ORDER BY 
                    CASE "Alarm_Severity"
                        WHEN 'Critical' THEN 1
                        WHEN 'Major' THEN 2
                        WHEN 'Minor' THEN 3
                        ELSE 4
                    END,
                    "OccurrenceTime" DESC
                LIMIT $1
            `;
            
            const result = await db.query(query, [limit]);
            return result.rows;
        } catch (error) {
            console.error('Error in getActiveAlarms:', error);
            throw error;
        }
    }
}

// Export the service
module.exports = new AlarmService(); 