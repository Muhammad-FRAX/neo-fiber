import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Layout/Sidebar';
import MapView from '../components/Map/MapView';
import ActiveAlarms from '../components/Alarms/ActiveAlarms';
import StatusCounts from '../components/Status/StatusCounts';
import DependentNodesOverlay from '../components/Map/DependentNodesOverlay';
import { fetchDependentNodes } from '../services/neo4jService';
import '../styles/pages/homepage.css';

const HomePage = ({ user, onLogout }) => {
  const [downDevices, setDownDevices] = useState(0);
  const [downLinks, setDownLinks] = useState(0);
  const [dependentNodes, setDependentNodes] = useState([]);
  const [showOverlay, setShowOverlay] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState(null);

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const response = await fetch('http://localhost:5000/down-counts');
        if (!response.ok) {
          throw new Error('Failed to fetch down counts');
        }
        const { downDevices, downLinks } = await response.json();
        setDownDevices(downDevices);
        setDownLinks(downLinks);
      } catch (error) {
        console.error('Error fetching down counts:', error);
      }
    };

    fetchCounts();
    const intervalId = setInterval(fetchCounts, 2000);

    return () => clearInterval(intervalId);
  }, []);

  const handleDeviceClick = async (device) => {
    console.log('handleDeviceClick called with device:', device);
    try {
      setSelectedDevice(device);
      console.log('Fetching dependent nodes for device:', device.device_name);
      const nodes = await fetchDependentNodes(device.device_name);
      console.log('Fetched dependent nodes:', nodes);
      setDependentNodes(nodes);
      setShowOverlay(true);
      console.log('Overlay state updated:', { showOverlay: true, selectedDevice: device, dependentNodes: nodes });
    } catch (error) {
      console.error('Error fetching dependent nodes:', error);
    }
  };

  const handleCloseOverlay = () => {
    console.log('Closing overlay');
    setShowOverlay(false);
    setSelectedDevice(null);
  };

  // Add effect to monitor state changes
  useEffect(() => {
    console.log('State updated:', { showOverlay, selectedDevice, dependentNodes });
  }, [showOverlay, selectedDevice, dependentNodes]);

  return (
    <div className="home-page">
      <Sidebar/>
      <div className="main-content">
        <div className="kpi-section">
          <div className="kpi-card down-devices">
            <div className="kpi-header">
              <h3>Down Devices</h3>
              <div className="kpi-icon">
                <i className="ri-computer-line"></i>
              </div>
            </div>
            <div className="kpi-content">
              <div className="kpi-value">{downDevices}</div>
              <div className="kpi-trend">
                <i className="ri-arrow-up-s-line"></i>
                <span>Last 24h</span>
              </div>
            </div>
          </div>

          <div className="kpi-card down-links">
            <div className="kpi-header">
              <h3>Down Links</h3>
              <div className="kpi-icon">
                <i className="ri-link"></i>
              </div>
            </div>
            <div className="kpi-content">
              <div className="kpi-value">{downLinks}</div>
              <div className="kpi-trend">
                <i className="ri-arrow-up-s-line"></i>
                <span>Last 24h</span>
              </div>
            </div>
          </div>

          <div className="kpi-card availability">
            <div className="kpi-header">
              <h3>Network Availability</h3>
              <div className="kpi-icon">
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

          <div className="kpi-card mttr">
            <div className="kpi-header">
              <h3>Avg. MTTR</h3>
              <div className="kpi-icon">
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

        <div className="content-section">
          <MapView onDeviceClick={handleDeviceClick} />
        </div>

        <div className="status-section">
          <div className="alarm-summary">
            <h3>Alarm Summary by Severity</h3>
            <div className="severity-chart">
              <div className="severity-bar-container">
                <div className="severity-bar critical" style={{ height: '60%' }}>
                  <span className="bar-value">7</span>
                </div>
                <div className="severity-bar major" style={{ height: '40%' }}>
                  <span className="bar-value">12</span>
                </div>
                <div className="severity-bar minor" style={{ height: '30%' }}>
                  <span className="bar-value">8</span>
                </div>
                <div className="severity-bar warning" style={{ height: '20%' }}>
                  <span className="bar-value">5</span>
                </div>
              </div>
            </div>
            <div className="severity-labels">
              <div className="label-item">
                <span className="label-dot critical"></span>
                <span>Critical</span>
              </div>
              <div className="label-item">
                <span className="label-dot major"></span>
                <span>Major</span>
              </div>
              <div className="label-item">
                <span className="label-dot minor"></span>
                <span>Minor</span>
              </div>
              <div className="label-item">
                <span className="label-dot warning"></span>
                <span>Warning</span>
              </div>
            </div>
          </div>

          <div className="node-status">
            <div className="node-status-header">
              <h3>Node Status Overview</h3>
              <div className="total-nodes">
                <span className="total-label">Total Nodes</span>
                <span className="total-value">252</span>
              </div>
            </div>
            <div className="status-grid">
              <div className="status-row">
                <div className="status-item">
                  <div className="status-content">
                    <div className="status-indicator online"></div>
                    <div className="status-details">
                      <span className="status-label">Online</span>
                      <span className="status-count">67</span>
                      <span className="status-percentage">26.5%</span>
                    </div>
                  </div>
                  <div className="status-bar">
                    <div className="status-bar-fill online" style={{ width: '26.5%' }}></div>
                  </div>
                </div>
                <div className="status-item">
                  <div className="status-content">
                    <div className="status-indicator degraded"></div>
                    <div className="status-details">
                      <span className="status-label">Degraded</span>
                      <span className="status-count">28</span>
                      <span className="status-percentage">11.1%</span>
                    </div>
                  </div>
                  <div className="status-bar">
                    <div className="status-bar-fill degraded" style={{ width: '11.1%' }}></div>
                  </div>
                </div>
              </div>
              <div className="status-row">
                <div className="status-item">
                  <div className="status-content">
                    <div className="status-indicator down"></div>
                    <div className="status-details">
                      <span className="status-label">Down</span>
                      <span className="status-count">185</span>
                      <span className="status-percentage">73.4%</span>
                    </div>
                  </div>
                  <div className="status-bar">
                    <div className="status-bar-fill down" style={{ width: '73.4%' }}></div>
                  </div>
                </div>
                <div className="status-item">
                  <div className="status-content">
                    <div className="status-indicator maintenance"></div>
                    <div className="status-details">
                      <span className="status-label">Maintenance</span>
                      <span className="status-count">5</span>
                      <span className="status-percentage">2%</span>
                    </div>
                  </div>
                  <div className="status-bar">
                    <div className="status-bar-fill maintenance" style={{ width: '2%' }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="right-side">
        <ActiveAlarms user={user} onLogout={onLogout} />
      </div>
      {showOverlay && selectedDevice && (
        <DependentNodesOverlay
          device={selectedDevice}
          dependentNodes={dependentNodes}
          onClose={handleCloseOverlay}
        />
      )}
    </div>
  );
};

export default HomePage;