// Fleet types (TODO: Import from shared package when available)
export interface Fleet {
  id: string;
  name: string;
  description?: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
  role?: "owner" | "admin" | "captain" | "member" | "viewer";
}

export interface FleetMember {
  id: string;
  fleet_id: string;
  user_id: string;
  role: "owner" | "admin" | "member" | "viewer";
  joined_at: string;
}

export interface FleetVessel {
  id: string;
  fleet_id: string;
  vessel_id: string;
  added_at: string;
}
