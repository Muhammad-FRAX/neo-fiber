import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Layout/Sidebar';
import '../styles/pages/alarms.css';

const Alarms = () => {
  const [alarms, setAlarms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    severity: '',
    status: '',
    alarmName: '',
    source: '',
    FiberLinkSite_Name: ''
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  });

  const fetchAlarms = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      // Build query string from filters
      const queryParams = new URLSearchParams({
        page: pagination.page,
        limit: pagination.limit,
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => value !== '')
        )
      });

      const response = await fetch(`http://localhost:5000/api/alarms?${queryParams}`, {
        headers: {
          'Authorization': token
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch alarms');
      }

      const data = await response.json();
      if (data.success) {
        setAlarms(data.data.alarms);
        setPagination(prev => ({
          ...prev,
          total: data.data.pagination.total,
          totalPages: data.data.pagination.totalPages
        }));
      } else {
        throw new Error(data.error || 'Failed to fetch alarms');
      }
    } catch (error) {
      console.error('Error fetching alarms:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlarms();
    // Refresh every 30 seconds
    const interval = setInterval(fetchAlarms, 30000);
    return () => clearInterval(interval);
  }, [pagination.page, filters]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
    setPagination(prev => ({ ...prev, page: 1 })); // Reset to first page on filter change
  };

  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const getSeverityClass = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'critical':
        return 'error';
      case 'major':
        return 'warning';
      case 'minor':
        return 'info';
      default:
        return 'info';
    }
  };

  return (
    <div className="alarms-page">
      <Sidebar />
      <div className="alarms-content">
        <div className="alarms-header">
          <h2>Network Alarms</h2>
          
          {/* Filters */}
          <div className="alarms-filters">
            <select 
              name="severity" 
              value={filters.severity} 
              onChange={handleFilterChange}
              className="filter-select"
            >
              <option value="">All Severities</option>
              <option value="Critical">Critical</option>
              <option value="Major">Major</option>
              <option value="Minor">Minor</option>
            </select>

            <select 
              name="status" 
              value={filters.status} 
              onChange={handleFilterChange}
              className="filter-select"
            >
              <option value="">All Statuses</option>
              <option value="Not Clear">Not Clear</option>
              <option value="Clear">Clear</option>
            </select>

            <input
              type="text"
              name="alarmName"
              value={filters.alarmName}
              onChange={handleFilterChange}
              placeholder="Search by Alarm Name"
              className="filter-input"
            />

            <input
              type="text"
              name="source"
              value={filters.source}
              onChange={handleFilterChange}
              placeholder="Search by Source"
              className="filter-input"
            />

            <input
              type="text"
              name="FiberLinkSite_Name"
              value={filters.FiberLinkSite_Name}
              onChange={handleFilterChange}
              placeholder="Search by Site Name"
              className="filter-input"
            />
          </div>
        </div>

        <div className="alarms-container">
          {loading ? (
            <div className="loading">Loading alarms...</div>
          ) : error ? (
            <div className="error-message">{error}</div>
          ) : alarms.length === 0 ? (
            <div className="no-alarms">No alarms found</div>
          ) : (
            <>
              {alarms.map((alarm) => (
                <div key={alarm.Log_Serial_Number} className={`alarm-item ${getSeverityClass(alarm.Alarm_Severity)}`}>
                  <div className="alarm-content">
                    <div className="alarm-info">
                      <div className="alarm-title">
                        <span className="alarm-name">{alarm.Alarm_Name || 'Unnamed Alarm'}</span>
                        <span className="severity-badge">
                          {alarm.Alarm_Severity || 'Unknown'}
                        </span>
                      </div>
                      <div className="alarm-details">
                        <span className="alarm-source">{alarm.Alarm_Source || 'Unknown Source'}</span>
                        <span className="alarm-status">{alarm.Status}</span>
                        <span className="alarm-time">{formatTimestamp(alarm.OccurrenceTime)}</span>
                      </div>
                      <div className="alarm-location">
                        <span className="location-info">{alarm.LocationInformation}</span>
                        {alarm.FiberLinkSite_Name && (
                          <span className="site-name">{alarm.FiberLinkSite_Name}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Pagination */}
              <div className="pagination">
                <button 
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  className="pagination-button"
                >
                  Previous
                </button>
                <span className="page-info">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <button 
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page === pagination.totalPages}
                  className="pagination-button"
                >
                  Next
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Alarms;