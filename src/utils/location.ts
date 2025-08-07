import { Location } from '../types';

export async function getCurrentLocation(): Promise<Location> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser'));
      return;
    }

    const options: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 15000, // Increased timeout for better reliability
      maximumAge: 0
    };

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude, accuracy, speed, heading, altitude } = position.coords;
        
        let batteryLevel: number | undefined;
        try {
          // Check if getBattery is available and is a function
          if ('getBattery' in navigator && typeof (navigator as any).getBattery === 'function') {
            const battery = await (navigator as any).getBattery();
            // Validate battery object and level property
            if (battery && typeof battery.level === 'number' && battery.level >= 0 && battery.level <= 1) {
              batteryLevel = Math.round(battery.level * 100);
            }
          }
        } catch (error) {
          console.warn('Could not get battery level:', error);
        }

        resolve({
          lat: latitude,
          lng: longitude,
          accuracy: accuracy || undefined,
          speed: speed || undefined,
          heading: heading || undefined,
          altitude: altitude || undefined,
          timestamp: Date.now(),
          battery: batteryLevel
        });
      },
      (error) => {
        let message = 'Location error: ';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            message += 'Location access denied. Please enable GPS permissions.';
            break;
          case error.POSITION_UNAVAILABLE:
            message += 'Location information is unavailable.';
            break;
          case error.TIMEOUT:
            message += 'Location request timed out.';
            break;
          default:
            message += 'An unknown error occurred.';
            break;
        }
        reject(new Error(message));
      },
      options
    );
  });
}

export function watchLocation(
  onSuccess: (location: Location) => void,
  onError: (error: GeolocationPositionError) => void
): number {
  if (!navigator.geolocation) {
    throw new Error('Geolocation is not supported by this browser');
  }

  const options: PositionOptions = {
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 0
  };

  return navigator.geolocation.watchPosition(
    async (position) => {
      const { latitude, longitude, accuracy, speed, heading, altitude } = position.coords;
      
      let batteryLevel: number | undefined;
      try {
        if ('getBattery' in navigator) {
          const battery = await (navigator as any).getBattery();
          batteryLevel = battery.level * 100;
        }
      } catch (error) {
        console.warn('Could not get battery level:', error);
      }

      onSuccess({
        lat: latitude,
        lng: longitude,
        accuracy: accuracy || undefined,
        speed: speed || undefined,
        heading: heading || undefined,
        altitude: altitude || undefined,
        timestamp: Date.now(),
        battery: batteryLevel
      });
    },
    onError,
    options
  );
}

export function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
}