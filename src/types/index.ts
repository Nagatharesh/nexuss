export interface Location {
  lat: number;
  lng: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  altitude?: number;
  timestamp: number;
  battery?: number;
}

export interface ChildData {
  status: 'online' | 'offline';
  lastLocation?: Location;
  lastSeen?: number;
  childName?: string;
  locationHistory?: { [key: string]: Location };
}

export interface SOSAlert {
  timestamp: number;
  lat: number;
  lng: number;
  accuracy: number;
  childCode: string;
  status: 'active' | 'resolved';
}

export interface ChatMessage {
  sender: 'child' | 'parent';
  text: string;
  timestamp: number;
}

export interface SafeZone {
  lat: number;
  lng: number;
  radius: number;
}

export type UserRole = 'child' | 'parent';