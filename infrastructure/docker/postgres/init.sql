-- Fleet Management Tables (Pro tier feature)
CREATE TABLE fleets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE fleet_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fleet_id UUID REFERENCES fleets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'captain', 'crew', 'viewer')),
  joined_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(fleet_id, user_id)
);

CREATE TABLE fleet_vessels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fleet_id UUID REFERENCES fleets(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(50) NOT NULL,
  length DECIMAL(5,2), -- length in feet
  beam DECIMAL(5,2), -- beam in feet
  draft DECIMAL(4,2), -- draft in feet
  registration VARCHAR(50),
  home_port VARCHAR(100),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE fleet_member_vessels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES fleet_members(id) ON DELETE CASCADE,
  vessel_id UUID REFERENCES fleet_vessels(id) ON DELETE CASCADE,
  can_view BOOLEAN DEFAULT true,
  can_plan BOOLEAN DEFAULT false,
  UNIQUE(member_id, vessel_id)
);

CREATE TABLE fleet_passages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fleet_id UUID REFERENCES fleets(id) ON DELETE CASCADE,
  passage_id UUID REFERENCES passages(id) ON DELETE CASCADE,
  vessel_id UUID REFERENCES fleet_vessels(id),
  shared_by UUID REFERENCES users(id),
  shared_at TIMESTAMP DEFAULT NOW(),
  distance_nm DECIMAL(8,2),
  UNIQUE(fleet_id, passage_id)
);

CREATE TABLE fleet_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fleet_id UUID REFERENCES fleets(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL,
  vessel_ids UUID[] DEFAULT '{}',
  invited_by UUID REFERENCES users(id),
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  accepted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Fleet indexes
CREATE INDEX idx_fleet_owner ON fleets(owner_id);
CREATE INDEX idx_fleet_members_fleet ON fleet_members(fleet_id);
CREATE INDEX idx_fleet_members_user ON fleet_members(user_id);
CREATE INDEX idx_fleet_vessels_fleet ON fleet_vessels(fleet_id);
CREATE INDEX idx_fleet_passages_fleet ON fleet_passages(fleet_id);
CREATE INDEX idx_fleet_invitations_token ON fleet_invitations(token);
CREATE INDEX idx_fleet_invitations_email ON fleet_invitations(email); 