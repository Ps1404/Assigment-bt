import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

// Custom car icon
const carIcon = new L.Icon({
  iconUrl: '/car.png', // Path to your PNG
  iconSize: [32, 32],            // Size of the icon
  iconAnchor: [16, 16],          // Anchor point (center of icon)
  popupAnchor: [0, -16],         // Popup appears above the icon
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png', // Optional shadow
  shadowSize: [41, 41],          // Shadow size (default Leaflet shadow)
});

export default function App() {
  const [route, setRoute] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [traveledPath, setTraveledPath] = useState([]);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [speed, setSpeed] = useState(0);
  const mapRef = useRef(null);

  // Load dummy data
  useEffect(() => {
    fetch('/dummyRoutes.json')
      .then(res => {
        if (!res.ok) throw new Error('Failed to load route data');
        return res.json();
      })
      .then(data => {
        if (!data || data.length === 0) {
          throw new Error('Empty route data');
        } else {
          setRoute(data);
          setTraveledPath([data[0]]);
          // Initialize elapsed time if timestamp exists
          if (data[0].timestamp) {
            setElapsedTime(0);
          }
        }
      })
      .catch(err => {
        console.error('Error loading route:', err);
        alert('Failed to load route data. Please ensure dummyRoutes.json exists.');
      });
  }, []);

  // Calculate speed between two points (if timestamps exist)
  const calculateSpeed = (pointA, pointB) => {
    if (!pointA?.timestamp || !pointB?.timestamp) return 0;
    
    const timeDiff = (new Date(pointB.timestamp) - new Date(pointA.timestamp)) / 3600000; // hours
    if (timeDiff <= 0) return 0;
    
    const distance = getDistance(
      pointA.latitude,
      pointA.longitude,
      pointB.latitude,
      pointB.longitude
    );
    
    return distance / timeDiff; // km/h
  };

  // Distance calculation helper (Haversine formula)
  function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  // Simulate movement
  useEffect(() => {
    if (!isPlaying || route.length === 0) return;

    const interval = setInterval(() => {
      setCurrentIndex(prev => {
        const nextIndex = (prev + 1) % route.length;
        const newPos = route[nextIndex];
        
        // Calculate speed if timestamps exist
        if (route[prev].timestamp && newPos.timestamp) {
          const currentSpeed = calculateSpeed(route[prev], newPos);
          setSpeed(currentSpeed);
          
          // Update elapsed time
          if (route[0].timestamp) {
            setElapsedTime(
              (new Date(newPos.timestamp) - new Date(route[0].timestamp)) / 1000
            );
          }
        }
        
        setTraveledPath(prev => [...prev, newPos]);
        
        if (mapRef.current) {
          mapRef.current.flyTo([newPos.latitude, newPos.longitude], 13);
        }
        return nextIndex;
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [isPlaying, route]);

  if (route.length === 0) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        fontSize: '1.5rem'
      }}>
        Loading vehicle data...
      </div>
    );
  }

  const currentPos = route[currentIndex];

  return (
    <div style={{ height: '100vh', width: '100%', position: 'relative' }}>
      {/* Controls */}
      <div style={{ 
        position: 'absolute', 
        top: 10, 
        right: 10, 
        zIndex: 1000, 
        background: 'rgba(255,255,255,0.9)', 
        padding: '12px',
        borderRadius: '8px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
        maxWidth: '300px'
      }}>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
          <button 
            onClick={() => setIsPlaying(!isPlaying)}
            style={{
              padding: '8px 16px',
              background: isPlaying ? '#ff4757' : '#2ed573',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
              flex: 1
            }}
          >
            {isPlaying ? '⏸ Pause' : '▶ Play'}
          </button>
          <button 
            onClick={() => {
              setCurrentIndex(0);
              setTraveledPath([route[0]]);
              setElapsedTime(0);
              setIsPlaying(false);
              mapRef.current?.flyTo([route[0].latitude, route[0].longitude], 13);
            }}
            style={{
              padding: '8px 16px',
              background: '#3498db',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            Reset
          </button>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: '600' }}>Position:</span>
            <span>
              {currentPos.latitude.toFixed(6)}, {currentPos.longitude.toFixed(6)}
            </span>
          </div>
          
          {currentPos.timestamp && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: '600' }}>Time:</span>
              <span>{new Date(currentPos.timestamp).toLocaleTimeString()}</span>
            </div>
          )}
          
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: '600' }}>Speed:</span>
            <span>{speed.toFixed(2)} km/h</span>
          </div>
          
          {route[0].timestamp && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: '600' }}>Elapsed:</span>
              <span>
                {Math.floor(elapsedTime / 60)}m {Math.floor(elapsedTime % 60)}s
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Map */}
      <MapContainer
        center={[route[0].latitude, route[0].longitude]}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
        ref={mapRef}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        
        <Polyline 
          positions={route.map(p => [p.latitude, p.longitude])} 
          color="#3498db" 
          weight={4}
        />
        
        <Polyline 
          positions={traveledPath.map(p => [p.latitude, p.longitude])} 
          color="#e74c3c" 
          weight={3}
        />
        
        <Marker position={[currentPos.latitude, currentPos.longitude]} 
        icon={carIcon}>
          <Popup>
            <div style={{ minWidth: '200px' }}>
              <h4 style={{ margin: '0 0 8px 0', borderBottom: '1px solid #eee', paddingBottom: '4px' }}>
                Vehicle Details
              </h4>
              <div>ID: KA-01-AB-1234</div>
              <div>Speed: {speed.toFixed(2)} km/h</div>
              {currentPos.timestamp && (
                <div>Time: {new Date(currentPos.timestamp).toLocaleString()}</div>
              )}
            </div>
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}