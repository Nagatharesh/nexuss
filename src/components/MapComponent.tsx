import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Circle, Popup, Polyline, useMap, useMapEvents } from 'react-leaflet';
import { Icon, LatLng } from 'leaflet';
import { ref, set, get } from 'firebase/database';
import { database, auth } from '../config/firebase';
import { ChildData, SafeZone } from '../types';
import { showNotification } from '../utils/notifications';
import { calculateDistance } from '../utils/location';
import { MapPin, Target, Save, Settings, Sparkles } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

// Fix for default markers in react-leaflet
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (Icon.Default.prototype as any)._getIconUrl;
Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

interface MapComponentProps {
  childData: ChildData | null;
  safeZone: SafeZone | null;
  onSafeZoneChange: (safeZone: SafeZone | null) => void;
  childCode: string;
  locationHistory?: Location[];
}

// Custom red icon for child marker
const redIcon = new Icon({
  iconUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjUiIGhlaWdodD0iNDEiIHZpZXdCb3g9IjAgMCAyNSA0MSIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyLjUgMEMxOS40MDM2IDAgMjUgNS41OTY0NCAyNSAxMi41QzI1IDE5LjQwMzYgMTkuNDAzNiAyNSAxMi41IDI1QzUuNTk2NDQgMjUgMCAxOS40MDM2IDAgMTIuNUMwIDUuNTk2NDQgNS41OTY0NCAwIDEyLjUgMFoiIGZpbGw9IiNFRjQ0NDQiLz4KPHBhdGggZD0iTTEyLjUgNDFMMjEuNjUwNiAyNi41SDE3LjVIMTIuNUg3LjVIMy4zNDkzN0wxMi41IDQxWiIgZmlsbD0iI0VGNDQ0NCIvPgo8L3N2Zz4K',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

// Custom blue icon for safe zone center
const blueIcon = new Icon({
  iconUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjUiIGhlaWdodD0iNDEiIHZpZXdCb3g9IjAgMCAyNSA0MSIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyLjUgMEMxOS40MDM2IDAgMjUgNS41OTY0NCAyNSAxMi41QzI1IDE5LjQwMzYgMTkuNDAzNiAyNSAxMi41IDI1QzUuNTk2NDQgMjUgMCAxOS40MDM2IDAgMTIuNUMwIDUuNTk2NDQgNS41OTY0NCAwIDEyLjUgMFoiIGZpbGw9IiMzQjgyRjYiLz4KPHBhdGggZD0iTTEyLjUgNDFMMjEuNjUwNiAyNi41SDE3LjVIMTIuNUg3LjVIMy4zNDkzN0wxMi41IDQxWiIgZmlsbD0iIzNCODJGNiIvPgo8L3N2Zz4K',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

function MapUpdater({ childData }: { childData: ChildData | null }) {
  const map = useMap();
  
  useEffect(() => {
    if (childData?.lastLocation) {
      const { lat, lng } = childData.lastLocation;
      map.setView([lat, lng], 15);
    }
  }, [childData?.lastLocation, map]);
  
  return null;
}

function MapClickHandler({ isSettingSafeZone, onMapClick }: { isSettingSafeZone: boolean, onMapClick: (latlng: LatLng) => void }) {
  useMapEvents({
    click: (e) => {
      if (isSettingSafeZone) {
        console.log('Map clicked:', e.latlng);
        onMapClick(e.latlng);
      }
    },
  });
  
  return null;
}

export default function MapComponent({ childData, safeZone, onSafeZoneChange, childCode, locationHistory = [] }: MapComponentProps) {
  const [radius, setRadius] = useState<string>('100');
  const [safeZoneCenter, setSafeZoneCenter] = useState<LatLng | null>(null);
  const [isSettingSafeZone, setIsSettingSafeZone] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showLocationPath, setShowLocationPath] = useState(true);
  const mapRef = useRef<any>(null);

  const defaultCenter: [number, number] = [40.7128, -74.0060]; // New York City

  useEffect(() => {
    loadSafeZone();
  }, [childCode]);

  useEffect(() => {
    if (childData?.lastLocation && safeZone) {
      checkSafeZoneViolation();
    }
  }, [childData?.lastLocation, safeZone]);

  const loadSafeZone = async () => {
    if (!auth.currentUser || !childCode) return;
    
    setIsLoading(true);
    try {
      const safeZoneRef = ref(database, `parents/${auth.currentUser.uid}/safeZones/${childCode}`);
      const snapshot = await get(safeZoneRef);
      
      if (snapshot.exists()) {
        const savedSafeZone = snapshot.val();
        if (savedSafeZone && savedSafeZone.lat && savedSafeZone.lng && savedSafeZone.radius) {
          onSafeZoneChange(savedSafeZone);
          setSafeZoneCenter(new LatLng(savedSafeZone.lat, savedSafeZone.lng));
          setRadius(savedSafeZone.radius.toString());
          showNotification('✅ Safe zone loaded successfully', 'success');
        }
      }
    } catch (error) {
      console.error('Error loading safe zone:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showNotification('Failed to load safe zone: ' + errorMessage, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMapClick = (e: any) => {
    // Validate click event and coordinates
    if (!e || 
        typeof e.lat !== 'number' || 
        typeof e.lng !== 'number' ||
        isNaN(e.lat) || 
        isNaN(e.lng) ||
        !isFinite(e.lat) || 
        !isFinite(e.lng) ||
        Math.abs(e.lat) > 90 || 
        Math.abs(e.lng) > 180) {
      console.error('Invalid map click event:', e);
      showNotification('❌ Invalid location selected', 'error');
      return;
    }
    
    console.log('Setting safe zone center:', e.lat, e.lng);
    setSafeZoneCenter(e);
    setIsSettingSafeZone(false);
    showNotification('📍 Safe zone center set! Now adjust the radius and save.', 'info');
  };

  const saveSafeZone = async () => {
    if (!safeZoneCenter || !radius) {
      showNotification('⚠️ Please set safe zone center and radius', 'warning');
      return;
    }

    const radiusNum = parseInt(radius);
    if (isNaN(radiusNum) || radiusNum <= 0) {
      showNotification('⚠️ Please enter a valid positive radius', 'warning');
      return;
    }

    if (radiusNum > 10000) {
      showNotification('⚠️ Radius cannot exceed 10,000 meters', 'warning');
      return;
    }
    
    if (radiusNum < 10) {
      showNotification('⚠️ Radius must be at least 10 meters', 'warning');
      return;
    }

    if (!auth.currentUser) {
      showNotification('❌ Authentication required', 'error');
      return;
    }

    const newSafeZone: SafeZone = {
      lat: safeZoneCenter.lat,
      lng: safeZoneCenter.lng,
      radius: radiusNum
    };

    setIsLoading(true);
    try {
      // Save to Firebase with proper error handling
      const parentSafeZoneRef = ref(database, `parents/${auth.currentUser.uid}/safeZones/${childCode}`);
      const childSafeZoneRef = ref(database, `children/${childCode}/safeZone`);
      
      // Save to both locations
      await Promise.all([
        set(parentSafeZoneRef, newSafeZone),
        set(childSafeZoneRef, newSafeZone)
      ]);
      
      onSafeZoneChange(newSafeZone);
      showNotification('✅ Safe zone saved successfully!', 'success');
    } catch (error) {
      console.error('Error saving safe zone:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showNotification('❌ Error saving safe zone: ' + errorMessage, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const clearSafeZone = async () => {
    if (!auth.currentUser) return;

    setIsLoading(true);
    try {
      const parentSafeZoneRef = ref(database, `parents/${auth.currentUser.uid}/safeZones/${childCode}`);
      const childSafeZoneRef = ref(database, `children/${childCode}/safeZone`);
      
      // Clear from both locations
      await Promise.all([
        set(parentSafeZoneRef, null),
        set(childSafeZoneRef, null)
      ]);
      
      onSafeZoneChange(null);
      setSafeZoneCenter(null);
      setRadius('100');
      showNotification('🗑️ Safe zone cleared', 'info');
    } catch (error) {
      console.error('Error clearing safe zone:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showNotification('❌ Error clearing safe zone: ' + errorMessage, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const checkSafeZoneViolation = () => {
    if (!childData?.lastLocation || !safeZone) return;

    const distance = calculateDistance(
      childData.lastLocation.lat,
      childData.lastLocation.lng,
      safeZone.lat,
      safeZone.lng
    );

    if (distance > safeZone.radius) {
      showNotification('⚠️ ALERT: Child is outside the safe zone!', 'warning');
    }
  };

  const getCurrentMapCenter = (): [number, number] => {
    if (childData?.lastLocation) {
      return [childData.lastLocation.lat, childData.lastLocation.lng];
    }
    return defaultCenter;
  };

  // Create path from location history
  const getLocationPath = (): [number, number][] => {
    if (!showLocationPath || locationHistory.length < 2) return [];
    
    // Sort by timestamp and take last 20 points for performance
    const sortedHistory = [...locationHistory]
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(-20);
    
    return sortedHistory.map(location => [location.lat, location.lng]);
  };

  return (
    <div className="space-y-6">
      <div className="glass p-6 rounded-2xl border border-white/20">
        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Target className="w-6 h-6 text-blue-400" />
          <Sparkles className="w-5 h-5 text-purple-400" />
          Safe Zone Configuration
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-white/90 mb-2">
              Radius (meters)
            </label>
            <input
              type="number"
              placeholder="100"
              value={radius}
              onChange={(e) => setRadius(e.target.value)}
              min="10"
              max="10000"
              className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent text-white placeholder-white/50 backdrop-blur-sm"
            />
          </div>
          
          <div className="flex items-center">
            <label className="flex items-center gap-2 text-white/90 cursor-pointer">
              <input
                type="checkbox"
                checked={showLocationPath}
                onChange={(e) => setShowLocationPath(e.target.checked)}
                className="w-4 h-4 text-blue-600 bg-white/10 border-white/20 rounded focus:ring-blue-500"
              />
              <span className="text-sm">Show Path</span>
            </label>
          </div>
          
          <button
            onClick={() => setIsSettingSafeZone(true)}
            disabled={isLoading}
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-600 disabled:to-gray-700 text-white px-4 py-2 rounded-xl transition-all duration-300 transform hover:scale-105 hover:shadow-xl flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <MapPin className="w-4 h-4" />
            Set Center
          </button>
          
          <button
            onClick={saveSafeZone}
            disabled={isLoading || !safeZoneCenter}
            className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 disabled:from-gray-600 disabled:to-gray-700 text-white px-4 py-2 rounded-xl transition-all duration-300 transform hover:scale-105 hover:shadow-xl flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {isLoading ? 'Saving...' : 'Save'}
          </button>
          
          <button
            onClick={clearSafeZone}
            disabled={isLoading || !safeZone}
            className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 disabled:from-gray-600 disabled:to-gray-700 text-white px-4 py-2 rounded-xl transition-all duration-300 transform hover:scale-105 hover:shadow-xl flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Settings className="w-4 h-4" />
            Clear
          </button>
        </div>

        {isSettingSafeZone && (
          <div className="mt-4 p-4 bg-blue-500/20 border border-blue-400/30 rounded-xl animate-pulse backdrop-blur-sm">
            <p className="text-sm text-blue-300 font-medium flex items-center gap-2">
              <Target className="w-4 h-4" />
              Click anywhere on the map to set the safe zone center
            </p>
          </div>
        )}
      </div>

      <div className="h-80 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/20">
        <MapContainer
          center={getCurrentMapCenter()}
          zoom={15}
          className="h-full w-full"
          ref={mapRef}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          <MapUpdater childData={childData} />
          <MapClickHandler isSettingSafeZone={isSettingSafeZone} onMapClick={handleMapClick} />

          {/* Location tracking path */}
          {showLocationPath && getLocationPath().length > 1 && (
            <Polyline
              positions={getLocationPath()}
              pathOptions={{
                color: '#3b82f6',
                weight: 4,
                opacity: 0.8,
                dashArray: '10, 5',
                lineCap: 'round',
                lineJoin: 'round'
              }}
            />
          )}

          {/* Child location marker */}
          {childData?.lastLocation && (
            <Marker
              position={[childData.lastLocation.lat, childData.lastLocation.lng]}
              icon={redIcon}
            >
              <Popup>
                <div className="text-center p-2">
                  <p className="font-semibold text-red-600 mb-2">👶 Child's Location</p>
                  <div className="space-y-1 text-sm">
                    <p><strong>Accuracy:</strong> {childData.lastLocation.accuracy?.toFixed(0) || 'N/A'}m</p>
                    <p><strong>Last Update:</strong> {new Date(childData.lastLocation.timestamp).toLocaleTimeString()}</p>
                    {typeof childData.lastLocation.battery === 'number' && (
                      <p><strong>Battery:</strong> {childData.lastLocation.battery.toFixed(0)}%</p>
                    )}
                    {childData.lastLocation.speed && (
                      <p><strong>Speed:</strong> {(childData.lastLocation.speed * 3.6).toFixed(1)} km/h</p>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          )}

          {/* Safe zone center marker */}
          {safeZoneCenter && (
            <Marker position={safeZoneCenter} icon={blueIcon}>
              <Popup>
                <div className="text-center p-2">
                  <p className="font-semibold text-blue-600">🛡️ Safe Zone Center</p>
                  <p className="text-sm mt-1">Radius: {radius}m</p>
                </div>
              </Popup>
            </Marker>
          )}

          {/* Safe zone circle */}
          {safeZone && (
            <Circle
              center={[safeZone.lat, safeZone.lng]}
              radius={safeZone.radius}
              pathOptions={{
                color: '#3b82f6',
                fillColor: '#3b82f6',
                fillOpacity: 0.1,
                weight: 3,
                dashArray: '10, 10'
              }}
            />
          )}
        </MapContainer>
      </div>

      {childData?.lastLocation && (
        <div className="text-center p-4 glass rounded-xl border border-white/20">
          <p className="text-sm text-white/80">
            <strong>Last updated:</strong> {new Date(childData.lastLocation.timestamp).toLocaleString()}
          </p>
          {showLocationPath && locationHistory.length > 0 && (
            <p className="text-sm text-white/60 mt-1">
              <strong>Path points:</strong> {locationHistory.length} locations tracked
            </p>
          )}
          {safeZone && childData.lastLocation && (
            <p className="text-sm mt-2">
              <strong>Distance from safe zone:</strong> {' '}
              <span className={`font-semibold ${
                calculateDistance(
                  childData.lastLocation.lat,
                  childData.lastLocation.lng,
                  safeZone.lat,
                  safeZone.lng
                ) > safeZone.radius ? 'text-red-400' : 'text-green-400'
              }`}>
                {calculateDistance(
                  childData.lastLocation.lat,
                  childData.lastLocation.lng,
                  safeZone.lat,
                  safeZone.lng
                ).toFixed(0)}m
              </span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}