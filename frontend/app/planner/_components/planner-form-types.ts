export interface Waypoint {
  id: string;
  name: string;
  lat?: number;
  lng?: number;
}

export interface PlannerFormData {
  departure: string;
  destination: string;
  departureCoords: { latitude: number; longitude: number };
  destinationCoords: { latitude: number; longitude: number };
  departureDate: Date;
  boat: string;
  cruiseSpeed: number;
  maxSpeed: number;
  draft: number;
  fuelCapacity: number;
  fuelRate: number;
  waterCapacity: number;
  crewSize: number;
  checklist: Record<string, boolean>;
  waypoints: Waypoint[];
}
