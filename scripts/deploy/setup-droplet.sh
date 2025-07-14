#!/bin/bash
# DigitalOcean Droplet Setup Script for Passage Planner

set -e

echo "🚀 Setting up Passage Planner on DigitalOcean"

# Update system
echo "📦 Updating system packages..."
apt-get update
apt-get upgrade -y

# Install Docker
echo "🐳 Installing Docker..."
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
usermod -aG docker $USER

# Install Docker Compose
echo "🐳 Installing Docker Compose..."
curl -L "https://github.com/docker/compose/releases/download/v2.23.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Install Node.js 20
echo "📦 Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Install nginx for reverse proxy
echo "🔧 Installing nginx..."
apt-get install -y nginx certbot python3-certbot-nginx

# Install git
echo "📦 Installing git..."
apt-get install -y git

# Setup firewall
echo "🔥 Configuring firewall..."
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 8080/tcp
ufw --force enable

# Create app directory
echo "📁 Creating application directory..."
mkdir -p /opt/passage-planner
cd /opt/passage-planner

# Clone repository (replace with your repo URL)
echo "📥 Cloning repository..."
git clone https://github.com/mjohnson518/passage_planner.git .

# Create .env file
echo "🔧 Creating environment file..."
cat > .env << EOF
NODE_ENV=production
PORT=8080
LOG_LEVEL=info

# Database
DATABASE_URL=postgresql://admin:$(openssl rand -base64 32)@localhost:5432/passage_planner

# Redis
REDIS_URL=redis://localhost:6379

# Security
JWT_SECRET=$(openssl rand -base64 64)
ENCRYPTION_KEY=$(openssl rand -base64 32)

# External APIs (add your keys here)
NOAA_API_KEY=your_noaa_api_key
OPENWEATHER_API_KEY=your_openweather_api_key
WINDFINDER_API_KEY=your_windfinder_api_key

# Frontend URLs
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_WS_URL=wss://api.yourdomain.com
EOF

# Create nginx configuration
echo "🔧 Configuring nginx..."
cat > /etc/nginx/sites-available/passage-planner << 'EOF'
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL configuration will be added by certbot
    
    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name api.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    # SSL configuration will be added by certbot
    
    # API and WebSocket
    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket specific
        proxy_read_timeout 86400;
    }
}
EOF

ln -s /etc/nginx/sites-available/passage-planner /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx

# Create systemd service for docker-compose
echo "🔧 Creating systemd service..."
cat > /etc/systemd/system/passage-planner.service << EOF
[Unit]
Description=Passage Planner Docker Compose Application
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/passage-planner
ExecStart=/usr/local/bin/docker-compose up -d
ExecStop=/usr/local/bin/docker-compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

systemctl enable passage-planner
systemctl daemon-reload

# Create update script
echo "📝 Creating update script..."
cat > /opt/passage-planner/update.sh << 'EOF'
#!/bin/bash
cd /opt/passage-planner
git pull
npm install
npm run build
docker-compose build
docker-compose up -d
EOF
chmod +x /opt/passage-planner/update.sh

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Update /opt/passage-planner/.env with your API keys"
echo "2. Update nginx config with your domain name"
echo "3. Run: cd /opt/passage-planner && npm install && npm run build"
echo "4. Run: docker-compose up -d"
echo "5. Setup SSL: certbot --nginx -d yourdomain.com -d www.yourdomain.com -d api.yourdomain.com"
echo ""
echo "To update the application, run: /opt/passage-planner/update.sh" 