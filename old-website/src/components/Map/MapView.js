import React, { useEffect, useState, useCallback } from 'react';
import L from 'leaflet'; // Import Leaflet
import { initializeMap } from '../../services/mapService';
import { fetchSitesAndLinks, fetchDependentNodes } from '../../services/neo4jService';
import 'leaflet/dist/leaflet.css'; // Import Leaflet's CSS
import '../../styles/components/mapview.css';

const MapView = ({ onDeviceClick }) => {
  const [map, setMap] = useState(null);
  const [permanentLine, setPermanentLine] = useState(null);

  // Initialize the map once when the component mounts
  useEffect(() => {
    const mapInstance = initializeMap('map-container');

    // Create custom panes with proper z-index ordering
    mapInstance.createPane('backgroundPane');
    mapInstance.createPane('areaPane');
    mapInstance.createPane('markerPane');

    // Set z-index for each pane
    mapInstance.getPane('backgroundPane').style.zIndex = 400;
    mapInstance.getPane('areaPane').style.zIndex = 450;
    mapInstance.getPane('markerPane').style.zIndex = 500;

    // Add the permanent dashed grey line
    const lineCoordinates = [
      [22.00449647050857, 33.171093382825205],
      [21.721603525859422, 33.548859648271815],
      [21.78932925522014, 34.019336298884156],
      [22.215514659482537, 34.14523962909874],
      [22.301315357938492, 34.681895673240746],
      [22.864137262974836, 34.940300706317004],
      [22.778632683597024, 35.21194276326534],
      [23.17572398182375, 35.610229606982216]
    ];

    const permanentLine = L.polyline(lineCoordinates, {
      color: 'grey',
      weight: 2,
      dashArray: '5, 10',
      opacity: 0.7
    }).addTo(mapInstance);

    setPermanentLine(permanentLine);
    setMap(mapInstance);
  }, []);

  // Function to update the map with new data
  const updateMap = useCallback((sites) => {
    if (!map) return;

    // Clear existing layers except the permanent line
    map.eachLayer((layer) => {
      if ((layer instanceof L.Marker || layer instanceof L.Polyline || layer instanceof L.CircleMarker || layer instanceof L.Circle) && layer !== permanentLine) {
        map.removeLayer(layer);
      }
    });

    // Add new markers and polylines
    sites.forEach(({ site, devices, linkedSites }) => {
      if (site.latitude && site.longitude) {
        // Add polylines for links first
        linkedSites.forEach(({ site: linkedSite, link }) => {
          if (linkedSite && linkedSite.latitude && linkedSite.longitude) {
            const latlngs = [
              [site.latitude, site.longitude],
              [linkedSite.latitude, linkedSite.longitude]
            ];
            const color = link && link.status === 'UP'
              ? '#39ff39'
              : link && link.status === 'DOWN'
              ? 'red'
              : 'grey';
            L.polyline(latlngs, { color, weight: 2 }).addTo(map);
          }
        });

        // Add circle markers for devices after polylines
        devices.forEach(device => {
          const color = device.status === 'UP' ? 'green' : 'red';
          
          // Add red area first (if device is down)
          if (device.status === 'DOWN') {
            L.circle([site.latitude, site.longitude], {
              radius: 45000,
              color: 'red',
              stroke: false,
              fillColor: 'red',
              fillOpacity: 0.3,
              pane: 'areaPane'
            }).addTo(map);
          }

          // Add device marker on top
          const circleMarker = L.circleMarker([site.latitude, site.longitude], {
            radius: 5,
            color: color,
            fillColor: color,
            fillOpacity: 1,
            pane: 'markerPane'
          }).addTo(map);

          // Add click handler for dependent nodes
          circleMarker.on('click', () => {
            console.log('Marker clicked:', device);
            if (onDeviceClick) {
              onDeviceClick(device);
            } else {
              console.log('onDeviceClick prop is not provided');
            }
          });
        });
      }
    });
  }, [map, onDeviceClick, permanentLine]);

  // Set up a timer to fetch data and update the map every 3 seconds
  useEffect(() => {
    const intervalId = setInterval(async () => {
      try {
        const sites = await fetchSitesAndLinks();
        updateMap(sites);
      } catch (error) {
        console.error('Error fetching and updating map data:', error);
      }
    }, 3000);

    return () => clearInterval(intervalId);
  }, [map, updateMap]);

  return <div id="map-container" className="map-container"></div>;
};

export default MapView;
