import React, { useState, useEffect } from 'react';
import '../../styles/components/activealarms.css';
import UserTop from '../../assets/icons/user_top_icon.png';
import NotificationBell from '../../assets/icons/notifications_top_icon.png';
import RecentAlarms from '../../assets/icons/recent_alarms_icon.png';

const ActiveAlarms = ({ user, onLogout }) => {
  const [showMenu, setShowMenu] = useState(false);
  const [alarms, setAlarms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAlarms = async () => {
      try {
        setLoading(true);
        const response = await fetch('http://localhost:5000/api/alarms/active');

        if (!response.ok) {
          throw new Error('Failed to fetch active alarms');
        }

        const data = await response.json();
        if (data.success) {
          setAlarms(data.data.alarms);
        } else {
          throw new Error(data.error || 'Failed to fetch active alarms');
        }
      } catch (error) {
        console.error('Error fetching active alarms:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAlarms();
    const interval = setInterval(fetchAlarms, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${day}/${month}/${year}, ${hours}:${minutes}`;
  };

  const getAlarmType = (severity) => {
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

  const toggleMenu = () => setShowMenu(!showMenu);

  return (
    <div className="active-alarms">
      <div className="icons-container">
        <div className="user-menu" onClick={toggleMenu}>
          <span>{user?.username} ▼</span>
          {showMenu && (
            <div className="dropdown-menu">
              <button onClick={onLogout}>Logout</button>
              <button>Settings</button>
            </div>
          )}
        </div>
        <img src={NotificationBell} alt='notibell' className="icon" />
        <img src={UserTop} alt='user' className="icon" />
      </div>
      <div className='current-notifications'>
        <h3>Recent Alarms</h3>
        <ul className="alarms-list">
          {loading ? (
            <li className="alarm-item">Loading alarms...</li>
          ) : error ? (
            <li className="alarm-item error">{error}</li>
          ) : alarms.length === 0 ? (
            <li className="alarm-item">No active alarms</li>
          ) : (
            alarms.map((alarm) => (
              <li key={alarm.Log_Serial_Number} className={`alarm-item ${getAlarmType(alarm.Alarm_Severity)}`}>
                <span className="timestamp">{formatTimestamp(alarm.OccurrenceTime)}</span>
                <span className="message">{alarm.Alarm_Name}</span>
                <span className="device-info">
                  Source: {alarm.Alarm_Source || 'Unknown'}
                  {alarm.FiberLinkSite_Name && (
                    <span className="location">
                      Location: {alarm.FiberLinkSite_Name}
                    </span>
                  )}
                </span>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
};

export default ActiveAlarms;