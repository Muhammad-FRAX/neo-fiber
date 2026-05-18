import React, { useState } from 'react';
import Sidebar from '../components/Layout/Sidebar';
import '../styles/pages/dashboard.css';

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState('node-status');

  return (
    <div className="dashboard-page">
      <Sidebar />
      
      <div className="dashboard-content">
        <div className="dashboard-header">
        <h2>Dashboard</h2>
          <div className="header-status">
            <span className="status-indicator">
              <span className="status-dot"></span>
              
            </span>
            <span className="last-update">Live Data</span>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-header">
              <h3>Total Active Nodes</h3>
              <div className="kpi-icon blue">
                <i className="ri-radar-line"></i>
              </div>
            </div>
            <div className="kpi-content">
              <div className="kpi-value">67</div>
              <div className="kpi-trend positive">
                <i className="ri-arrow-up-s-line"></i>
                <span>+3 since last week</span>
              </div>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-header">
              <h3>Network Availability</h3>
              <div className="kpi-icon green">
                <i className="ri-wifi-line"></i>
              </div>
            </div>
            <div className="kpi-content">
              <div className="kpi-value">78.31%</div>
              <div className="kpi-trend negative">
                <i className="ri-arrow-up-s-line"></i>
                <span>-21.69% from target</span>
              </div>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-header">
              <h3>Active Alarms</h3>
              <div className="kpi-icon red">
                <i className="ri-alarm-warning-line"></i>
              </div>
            </div>
            <div className="kpi-content">
              <div className="kpi-value">7</div>
              <div className="kpi-trend negative">
                <i className="ri-arrow-up-s-line"></i>
                <span>+7 in last 24h</span>
              </div>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-header">
              <h3>Avg. MTTR</h3>
              <div className="kpi-icon orange">
                <i className="ri-time-line"></i>
              </div>
            </div>
            <div className="kpi-content">
              <div className="kpi-value">6m</div>
              <div className="kpi-trend positive">
                <i className="ri-arrow-down-s-line"></i>
                <span>-0.8m from last week</span>
              </div>
            </div>
          </div>
        </div>

        {/* Dashboard Tabs */}
        <div className="dashboard-tabs">
          <div className="tabs-header">
            <button 
              className={`tab-button ${activeTab === 'node-status' ? 'active' : ''}`}
              onClick={() => setActiveTab('node-status')}
            >
              Node Status
            </button>
            <button 
              className={`tab-button ${activeTab === 'link-performance' ? 'active' : ''}`}
              onClick={() => setActiveTab('link-performance')}
            >
              Link Performance
            </button>
            <button 
              className={`tab-button ${activeTab === 'maintenance' ? 'active' : ''}`}
              onClick={() => setActiveTab('maintenance')}
            >
              Maintenance
            </button>
            <button 
              className={`tab-button ${activeTab === 'management-kpi' ? 'active' : ''}`}
              onClick={() => setActiveTab('management-kpi')}
            >
              Management KPIs
            </button>
          </div>

          {/* Node Status Tab */}
          <div className={`tab-content ${activeTab === 'node-status' ? 'active' : ''}`}>
            <div className="content-grid">
              {/* Alarm Summary */}
              <div className="content-card">
                <div className="card-header">
                  <h3>Alarm Summary by Severity</h3>
                  <button className="view-all-btn">View All</button>
                </div>
                <div className="alarm-severity-grid">
                  <div className="severity-item critical">
                    <div className="severity-label">Critical</div>
                    <div className="severity-value">7</div>
                  </div>
                  <div className="severity-item major">
                    <div className="severity-label">Major</div>
                    <div className="severity-value">12</div>
                  </div>
                  <div className="severity-item minor">
                    <div className="severity-label">Minor</div>
                    <div className="severity-value">8</div>
                  </div>
                  <div className="severity-item warning">
                    <div className="severity-label">Warning</div>
                    <div className="severity-value">5</div>
                  </div>
                </div>
              </div>

              {/* Power Levels */}
              <div className="content-card">
                <div className="card-header">
                  <h3>Power Levels (Tx/Rx)</h3>
                  <div className="card-actions">
                    <button className="icon-btn">
                      <i className="ri-download-line"></i>
                    </button>
                    <button className="view-all-btn">View All</button>
                  </div>
                </div>
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Node</th>
                        <th>Tx Power</th>
                        <th>Rx Power</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Khartoum North #5</td>
                        <td>-2.3 dBm</td>
                        <td>-18.7 dBm</td>
                        <td><span className="status-badge normal">Normal</span></td>
                      </tr>
                      <tr>
                        <td>Port Sudan #12</td>
                        <td>-3.1 dBm</td>
                        <td>-22.4 dBm</td>
                        <td><span className="status-badge warning">Warning</span></td>
                      </tr>
                      <tr>
                        <td>Kassala #8</td>
                        <td>-1.8 dBm</td>
                        <td>-17.2 dBm</td>
                        <td><span className="status-badge normal">Normal</span></td>
                      </tr>
                      <tr>
                        <td>El Obeid #3</td>
                        <td>-4.2 dBm</td>
                        <td>-25.8 dBm</td>
                        <td><span className="status-badge critical">Critical</span></td>
                      </tr>
                      <tr>
                        <td>Wad Madani #7</td>
                        <td>-2.5 dBm</td>
                        <td>-19.3 dBm</td>
                        <td><span className="status-badge normal">Normal</span></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Repeated Alarms */}
              <div className="content-card">
                <div className="card-header">
                  <h3>Repeated Alarms (Last 7 Days)</h3>
                  <button className="view-all-btn">View Details</button>
                </div>
                <div className="repeated-alarms-chart">
                  <div className="chart-legend">
                    <div className="legend-item">
                      <span className="legend-color" style={{ backgroundColor: '#EF4444' }}></span>
                      <span>Critical</span>
                    </div>
                    <div className="legend-item">
                      <span className="legend-color" style={{ backgroundColor: '#F97316' }}></span>
                      <span>Major</span>
                    </div>
                  </div>
                  <div className="chart-data">
                    <div className="data-point" style={{ height: '70%', backgroundColor: '#EF4444' }}></div>
                    <div className="data-point" style={{ height: '50%', backgroundColor: '#F97316' }}></div>
                  </div>
                  <div className="chart-labels">
                    <span>Mon</span>
                    <span>Tue</span>
                  </div>
                </div>
              </div>

              {/* Node Status Overview */}
              <div className="content-card">
                <div className="card-header">
                  <h3>Node Status Overview</h3>
                </div>
                <div className="status-overview">
                  <div className="status-distribution">
                    <h4>Status by Region</h4>
                    <div className="region-progress">
                      <div className="progress-item">
                        <div className="progress-header">
                          <span>Khartoum</span>
                          <span>98.2%</span>
                        </div>
                        <div className="progress-bar">
                          <div className="progress-fill" style={{ width: '98.2%' }}></div>
                        </div>
                      </div>
                      <div className="progress-item">
                        <div className="progress-header">
                          <span>Eastern</span>
                          <span>92.7%</span>
                        </div>
                        <div className="progress-bar">
                          <div className="progress-fill" style={{ width: '92.7%' }}></div>
                        </div>
                      </div>
                      <div className="progress-item">
                        <div className="progress-header">
                          <span>Northern</span>
                          <span>95.4%</span>
                        </div>
                        <div className="progress-bar">
                          <div className="progress-fill" style={{ width: '95.4%' }}></div>
                        </div>
                      </div>
                      <div className="progress-item">
                        <div className="progress-header">
                          <span>Western</span>
                          <span>89.1%</span>
                        </div>
                        <div className="progress-bar">
                          <div className="progress-fill" style={{ width: '89.1%' }}></div>
                        </div>
                      </div>
                      <div className="progress-item">
                        <div className="progress-header">
                          <span>Southern</span>
                          <span>85.3%</span>
                        </div>
                        <div className="progress-bar">
                          <div className="progress-fill" style={{ width: '85.3%' }}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Link Performance Tab */}
          <div className={`tab-content ${activeTab === 'link-performance' ? 'active' : ''}`}>
            <div className="content-grid">
              {/* Network Latency */}
              <div className="content-card">
                <div className="card-header">
                  <h3>Network Latency</h3>
                  <div className="card-actions">
                    <button className="icon-btn">
                      <i className="ri-download-line"></i>
                    </button>
                    <button className="view-all-btn">View Details</button>
                  </div>
                </div>
                <div className="latency-chart">
                  <div className="chart-legend">
                    <div className="legend-item">
                      <span className="legend-color" style={{ backgroundColor: '#3B82F6' }}></span>
                      <span>Khartoum - Port Sudan (45ms)</span>
                    </div>
                    <div className="legend-item">
                      <span className="legend-color" style={{ backgroundColor: '#10B981' }}></span>
                      <span>Khartoum - El Obeid (32ms)</span>
                    </div>
                    <div className="legend-item">
                      <span className="legend-color" style={{ backgroundColor: '#F97316' }}></span>
                      <span>Port Sudan - Kassala (58ms)</span>
                    </div>
                  </div>
                  <div className="chart-data">
                    <div className="data-point" style={{ height: '45%', backgroundColor: '#3B82F6' }}></div>
                    <div className="data-point" style={{ height: '32%', backgroundColor: '#10B981' }}></div>
                    <div className="data-point" style={{ height: '58%', backgroundColor: '#F97316' }}></div>
                  </div>
                  <div className="chart-labels">
                    <span>Last 24 Hours</span>
                  </div>
                </div>
              </div>

              {/* BER Metrics */}
              <div className="content-card">
                <div className="card-header">
                  <h3>Bit Error Rate (BER)</h3>
                  <div className="card-actions">
                    <button className="icon-btn">
                      <i className="ri-download-line"></i>
                    </button>
                    <button className="view-all-btn">View Details</button>
                  </div>
                </div>
                <div className="ber-chart">
                  <div className="chart-legend">
                    <div className="legend-item">
                      <span className="legend-color" style={{ backgroundColor: '#3B82F6' }}></span>
                      <span>Khartoum North #5 (1.2E-9)</span>
                    </div>
                    <div className="legend-item">
                      <span className="legend-color" style={{ backgroundColor: '#10B981' }}></span>
                      <span>Port Sudan #12 (2.5E-9)</span>
                    </div>
                  </div>
                  <div className="chart-data">
                    <div className="data-point" style={{ height: '12%', backgroundColor: '#3B82F6' }}></div>
                    <div className="data-point" style={{ height: '25%', backgroundColor: '#10B981' }}></div>
                  </div>
                  <div className="chart-labels">
                    <span>Last 24 Hours</span>
                  </div>
                </div>
              </div>

              {/* Link Availability */}
              <div className="content-card">
                <div className="card-header">
                  <h3>Link Availability</h3>
                  <div className="card-actions">
                    <select className="time-select">
                      <option>Last 30 Days</option>
                      <option>Last 7 Days</option>
                      <option>Last 90 Days</option>
                    </select>
                  </div>
                </div>
                <div className="availability-chart">
                  <div className="chart-legend">
                    <div className="legend-item">
                      <span className="legend-color" style={{ backgroundColor: '#3B82F6' }}></span>
                      <span>Khartoum - El Obeid (99.95%)</span>
                    </div>
                    <div className="legend-item">
                      <span className="legend-color" style={{ backgroundColor: '#10B981' }}></span>
                      <span>Port Sudan - Kassala (99.98%)</span>
                    </div>
                    <div className="legend-item">
                      <span className="legend-color" style={{ backgroundColor: '#F97316' }}></span>
                      <span>Khartoum - Port Sudan (99.92%)</span>
                    </div>
                  </div>
                  <div className="chart-data">
                    <div className="data-point" style={{ height: '99.95%', backgroundColor: '#3B82F6' }}></div>
                    <div className="data-point" style={{ height: '99.98%', backgroundColor: '#10B981' }}></div>
                    <div className="data-point" style={{ height: '99.92%', backgroundColor: '#F97316' }}></div>
                  </div>
                  <div className="chart-labels">
                    <span>Last 30 Days</span>
                  </div>
                </div>
              </div>

              {/* Link Down Events */}
              <div className="content-card">
                <div className="card-header">
                  <h3>Link Down Events</h3>
                  <button className="view-all-btn">View All</button>
                </div>
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Link</th>
                        <th>Down Time</th>
                        <th>Duration</th>
                        <th>Cause</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Khartoum - Port Sudan</td>
                        <td>Apr 8, 2025 14:32</td>
                        <td>3h 12m</td>
                        <td>Fiber Cut</td>
                        <td><span className="status-badge normal">Resolved</span></td>
                      </tr>
                      <tr>
                        <td>El Obeid - Nyala</td>
                        <td>Apr 7, 2025 08:17</td>
                        <td>5h 45m</td>
                        <td>Power Outage</td>
                        <td><span className="status-badge normal">Resolved</span></td>
                      </tr>
                      <tr>
                        <td>Port Sudan - Kassala</td>
                        <td>Apr 6, 2025 22:05</td>
                        <td>1h 30m</td>
                        <td>Hardware Failure</td>
                        <td><span className="status-badge normal">Resolved</span></td>
                      </tr>
                      <tr>
                        <td>Khartoum - El Obeid</td>
                        <td>Apr 5, 2025 16:48</td>
                        <td>45m</td>
                        <td>Software Update</td>
                        <td><span className="status-badge normal">Resolved</span></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* Maintenance Tab */}
          <div className={`tab-content ${activeTab === 'maintenance' ? 'active' : ''}`}>
            <div className="content-grid">
              {/* Fiber Cut History */}
              <div className="content-card">
                <div className="card-header">
                  <h3>Fiber Cut History</h3>
                  <button className="view-all-btn">View Map</button>
                </div>
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Location</th>
                        <th>Route</th>
                        <th>Impact</th>
                        <th>Resolution Time</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Apr 8, 2025</td>
                        <td>Khartoum North</td>
                        <td>Khartoum - Port Sudan</td>
                        <td>3 Links Affected</td>
                        <td>3h 12m</td>
                        <td><span className="status-badge normal">Resolved</span></td>
                      </tr>
                      <tr>
                        <td>Apr 5, 2025</td>
                        <td>El Obeid</td>
                        <td>El Obeid - Nyala</td>
                        <td>2 Links Affected</td>
                        <td>5h 45m</td>
                        <td><span className="status-badge normal">Resolved</span></td>
                      </tr>
                      <tr>
                        <td>Apr 2, 2025</td>
                        <td>Port Sudan</td>
                        <td>Port Sudan - Kassala</td>
                        <td>1 Link Affected</td>
                        <td>2h 30m</td>
                        <td><span className="status-badge normal">Resolved</span></td>
                      </tr>
                      <tr>
                        <td>Mar 28, 2025</td>
                        <td>Kassala</td>
                        <td>Kassala - Gedaref</td>
                        <td>1 Link Affected</td>
                        <td>4h 15m</td>
                        <td><span className="status-badge normal">Resolved</span></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="fiber-cut-stats">
                  <div className="stat-item">
                    <div className="stat-icon">
                      <i className="ri-scissors-cut-line"></i>
                    </div>
                    <div className="stat-info">
                      <span className="stat-label">Total Cuts (30 Days)</span>
                      <span className="stat-value">4</span>
                    </div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-icon">
                      <i className="ri-time-line"></i>
                    </div>
                    <div className="stat-info">
                      <span className="stat-label">Avg. Resolution Time</span>
                      <span className="stat-value">3h 55m</span>
                    </div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-icon">
                      <i className="ri-route-line"></i>
                    </div>
                    <div className="stat-info">
                      <span className="stat-label">Most Affected Route</span>
                      <span className="stat-value">Khartoum - Port Sudan</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* MTTR by Region */}
              <div className="content-card">
                <div className="card-header">
                  <h3>MTTR by Region</h3>
                  <div className="card-actions">
                    <select className="time-select">
                      <option>Last 90 Days</option>
                      <option>Last 30 Days</option>
                      <option>Last 7 Days</option>
                    </select>
                  </div>
                </div>
                <div className="mttr-chart">
                  <div className="chart-legend">
                    <div className="legend-item">
                      <span className="legend-color" style={{ backgroundColor: '#3B82F6' }}></span>
                      <div className="legend-info">
                        <span className="legend-label">Khartoum</span>
                        <span className="legend-value">3.2h</span>
                      </div>
                    </div>
                    <div className="legend-item">
                      <span className="legend-color" style={{ backgroundColor: '#10B981' }}></span>
                      <div className="legend-info">
                        <span className="legend-label">Port Sudan</span>
                        <span className="legend-value">4.5h</span>
                      </div>
                    </div>
                    <div className="legend-item">
                      <span className="legend-color" style={{ backgroundColor: '#F97316' }}></span>
                      <div className="legend-info">
                        <span className="legend-label">El Obeid</span>
                        <span className="legend-value">5.8h</span>
                      </div>
                    </div>
                  </div>
                  <div className="chart-data">
                    <div className="data-point" style={{ height: '32%', backgroundColor: '#3B82F6' }}>
                      <span className="data-label">3.2h</span>
                    </div>
                    <div className="data-point" style={{ height: '45%', backgroundColor: '#10B981' }}>
                      <span className="data-label">4.5h</span>
                    </div>
                    <div className="data-point" style={{ height: '58%', backgroundColor: '#F97316' }}>
                      <span className="data-label">5.8h</span>
                    </div>
                  </div>
                </div>
                <div className="mttr-stats">
                  <div className="stat-item">
                    <div className="stat-icon best">
                      <i className="ri-arrow-up-circle-line"></i>
                    </div>
                    <div className="stat-info">
                      <span className="stat-label">Best Performing</span>
                      <span className="stat-value">Khartoum (3.2h)</span>
                    </div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-icon worst">
                      <i className="ri-arrow-down-circle-line"></i>
                    </div>
                    <div className="stat-info">
                      <span className="stat-label">Worst Performing</span>
                      <span className="stat-value">El Obeid (5.8h)</span>
                    </div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-icon average">
                      <i className="ri-bar-chart-line"></i>
                    </div>
                    <div className="stat-info">
                      <span className="stat-label">Network Average</span>
                      <span className="stat-value">4.5h</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Pending Maintenance Orders */}
              <div className="content-card">
                <div className="card-header">
                  <h3>Pending Maintenance Orders</h3>
                  <button className="view-all-btn">Create New</button>
                </div>
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Order ID</th>
                        <th>Location</th>
                        <th>Type</th>
                        <th>Created</th>
                        <th>Priority</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>MO-2025-0428</td>
                        <td>Port Sudan #12</td>
                        <td>Preventive</td>
                        <td>Apr 8, 2025</td>
                        <td><span className="status-badge warning">Medium</span></td>
                        <td><span className="status-badge info">Scheduled</span></td>
                      </tr>
                      <tr>
                        <td>MO-2025-0427</td>
                        <td>El Obeid #3</td>
                        <td>Corrective</td>
                        <td>Apr 7, 2025</td>
                        <td><span className="status-badge critical">High</span></td>
                        <td><span className="status-badge normal">In Progress</span></td>
                      </tr>
                      <tr>
                        <td>MO-2025-0426</td>
                        <td>Khartoum North #5</td>
                        <td>Preventive</td>
                        <td>Apr 6, 2025</td>
                        <td><span className="status-badge normal">Low</span></td>
                        <td><span className="status-badge info">Scheduled</span></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Team Dispatch Status */}
              <div className="content-card">
                <div className="card-header">
                  <h3>Field Team Status</h3>
                  <button className="view-all-btn">Dispatch Team</button>
                </div>
                <div className="team-status">
                  <div className="team-status-chart">
                    <div className="chart-legend">
                      <div className="legend-item">
                        <span className="legend-color" style={{ backgroundColor: '#3B82F6' }}></span>
                        <span>Available (60%)</span>
                      </div>
                      <div className="legend-item">
                        <span className="legend-color" style={{ backgroundColor: '#10B981' }}></span>
                        <span>On Site (40%)</span>
                      </div>
                    </div>
                    <div className="chart-data">
                      <div className="data-point" style={{ height: '60%', backgroundColor: '#3B82F6' }}></div>
                      <div className="data-point" style={{ height: '40%', backgroundColor: '#10B981' }}></div>
                    </div>
                    <div className="chart-labels">
                      <span>Last 24 Hours</span>
                    </div>
                  </div>
                  <div className="active-teams">
                    <div className="team-item">
                      <div className="team-icon">
                        <i className="ri-team-line"></i>
                      </div>
                      <div className="team-info">
                        <div className="team-name">Team Alpha</div>
                        <div className="team-location">Khartoum North #5</div>
                        <div className="team-status">On Site - Fiber Repair</div>
                      </div>
                      <span className="status-badge normal">Active</span>
                    </div>
                    <div className="team-item">
                      <div className="team-icon">
                        <i className="ri-team-line"></i>
                      </div>
                      <div className="team-info">
                        <div className="team-name">Team Bravo</div>
                        <div className="team-location">Port Sudan #12</div>
                        <div className="team-status">Available</div>
                      </div>
                      <span className="status-badge info">Standby</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Management KPIs Tab */}
          <div className={`tab-content ${activeTab === 'management-kpi' ? 'active' : ''}`}>
            <div className="content-grid">
              {/* Network Uptime Trends */}
              <div className="content-card">
                <div className="card-header">
                  <h3>Network Uptime Trends</h3>
                  <div className="card-actions">
                    <button className="icon-btn">
                      <i className="ri-download-line"></i>
                    </button>
                    <button className="view-all-btn">Export Report</button>
                  </div>
                </div>
                <div className="uptime-trend-chart">
                  <div className="chart-legend">
                    <div className="legend-item">
                      <span className="legend-color" style={{ backgroundColor: '#3B82F6' }}></span>
                      <span>Khartoum Region</span>
                    </div>
                    <div className="legend-item">
                      <span className="legend-color" style={{ backgroundColor: '#10B981' }}></span>
                      <span>Port Sudan Region</span>
                    </div>
                  </div>
                  <div className="chart-data">
                    <div className="data-point" style={{ height: '98%', backgroundColor: '#3B82F6' }}></div>
                    <div className="data-point" style={{ height: '99%', backgroundColor: '#10B981' }}></div>
                  </div>
                  <div className="chart-labels">
                    <span>Mon</span>
                    <span>Tue</span>
                  </div>
                </div>
              </div>

              {/* Top Recurring Issues */}
              <div className="content-card">
                <div className="card-header">
                  <h3>Top Recurring Issues</h3>
                  <div className="card-actions">
                    <select className="time-select">
                      <option>Last 90 Days</option>
                      <option>Last 30 Days</option>
                      <option>Last 7 Days</option>
                    </select>
                  </div>
                </div>
                <div className="recurring-issues-chart">
                  <div className="chart-legend">
                    <div className="legend-item">
                      <span className="legend-color" style={{ backgroundColor: '#EF4444' }}></span>
                      <span>Power Issues</span>
                    </div>
                    <div className="legend-item">
                      <span className="legend-color" style={{ backgroundColor: '#F97316' }}></span>
                      <span>Fiber Cuts</span>
                    </div>
                    <div className="legend-item">
                      <span className="legend-color" style={{ backgroundColor: '#F59E0B' }}></span>
                      <span>Hardware Failures</span>
                    </div>
                  </div>
                  <div className="chart-data">
                    <div className="data-point" style={{ height: '70%', backgroundColor: '#EF4444' }}></div>
                    <div className="data-point" style={{ height: '50%', backgroundColor: '#F97316' }}></div>
                    <div className="data-point" style={{ height: '30%', backgroundColor: '#F59E0B' }}></div>
                  </div>
                  <div className="chart-labels">
                    <span>Mon</span>
                    <span>Tue</span>
                    <span>Wed</span>
                  </div>
                </div>
              </div>

              {/* Incidents by Region */}
              <div className="content-card">
                <div className="card-header">
                  <h3>Incidents by Region</h3>
                  <button className="view-all-btn">View Details</button>
                </div>
                <div className="incidents-overview">
                  <div className="incidents-chart">
                    <div className="chart-legend">
                      <div className="legend-item">
                        <span className="legend-color" style={{ backgroundColor: '#EF4444' }}></span>
                        <span>Khartoum</span>
                      </div>
                      <div className="legend-item">
                        <span className="legend-color" style={{ backgroundColor: '#F97316' }}></span>
                        <span>Port Sudan</span>
                      </div>
                    </div>
                    <div className="chart-data">
                      <div className="data-point" style={{ height: '60%', backgroundColor: '#EF4444' }}></div>
                      <div className="data-point" style={{ height: '40%', backgroundColor: '#F97316' }}></div>
                    </div>
                    <div className="chart-labels">
                      <span>Mon</span>
                      <span>Tue</span>
                    </div>
                  </div>
                  <div className="incidents-trend-chart">
                    <div className="chart-legend">
                      <div className="legend-item">
                        <span className="legend-color" style={{ backgroundColor: '#3B82F6' }}></span>
                        <span>Trend</span>
                      </div>
                    </div>
                    <div className="chart-data">
                      <div className="data-point" style={{ height: '50%', backgroundColor: '#3B82F6' }}></div>
                      <div className="data-point" style={{ height: '60%', backgroundColor: '#3B82F6' }}></div>
                      <div className="data-point" style={{ height: '40%', backgroundColor: '#3B82F6' }}></div>
                    </div>
                    <div className="chart-labels">
                      <span>Mon</span>
                      <span>Tue</span>
                      <span>Wed</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Project Progress */}
              <div className="content-card">
                <div className="card-header">
                  <h3>Fiber Expansion Projects</h3>
                  <button className="view-all-btn">Project Dashboard</button>
                </div>
                <div className="project-progress">
                  <div className="project-item">
                    <div className="project-header">
                      <span>Khartoum Metro Ring</span>
                      <span>78%</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: '78%' }}></div>
                    </div>
                    <div className="project-footer">
                      <span>Target: Jun 15, 2025</span>
                      <span className="status-text positive">On Schedule</span>
                    </div>
                  </div>
                  <div className="project-item">
                    <div className="project-header">
                      <span>Eastern Corridor Upgrade</span>
                      <span>45%</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: '45%' }}></div>
                    </div>
                    <div className="project-footer">
                      <span>Target: Aug 30, 2025</span>
                      <span className="status-text warning">2 weeks behind</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Management KPIs */}
              <div className="content-card">
                <div className="card-header">
                  <h3>Management KPIs</h3>
                  <div className="card-actions">
                    <select className="time-select">
                      <option>Last 90 Days</option>
                      <option>Last 30 Days</option>
                      <option>Last 7 Days</option>
                    </select>
                  </div>
                </div>
                <div className="kpi-grid">
                  <div className="kpi-card">
                    <div className="kpi-header">
                      <h4>Network Uptime</h4>
                      <div className="kpi-icon">
                        <i className="ri-time-line"></i>
                      </div>
                    </div>
                    <div className="kpi-value">99.87%</div>
                    <div className="kpi-trend positive">
                      <i className="ri-arrow-up-s-line"></i>
                      <span>+0.2% from target</span>
                    </div>
                  </div>
                  <div className="kpi-card">
                    <div className="kpi-header">
                      <h4>MTTR</h4>
                      <div className="kpi-icon">
                        <i className="ri-tools-line"></i>
                      </div>
                    </div>
                    <div className="kpi-value">4.2h</div>
                    <div className="kpi-trend positive">
                      <i className="ri-arrow-down-s-line"></i>
                      <span>-0.8h from last month</span>
                    </div>
                  </div>
                  <div className="kpi-card">
                    <div className="kpi-header">
                      <h4>Customer Impact</h4>
                      <div className="kpi-icon">
                        <i className="ri-user-line"></i>
                      </div>
                    </div>
                    <div className="kpi-value">0.13%</div>
                    <div className="kpi-trend negative">
                      <i className="ri-arrow-up-s-line"></i>
                      <span>+0.05% from last month</span>
                    </div>
                  </div>
                  <div className="kpi-card">
                    <div className="kpi-header">
                      <h4>Preventive Maintenance</h4>
                      <div className="kpi-icon">
                        <i className="ri-settings-3-line"></i>
                      </div>
                    </div>
                    <div className="kpi-value">92%</div>
                    <div className="kpi-trend positive">
                      <i className="ri-arrow-up-s-line"></i>
                      <span>+3% from last month</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;