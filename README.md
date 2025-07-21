# Passage Planner - Production-Ready SaaS Maritime Navigation System

A production-ready SaaS passage planning system built with the Model Context Protocol (MCP) that orchestrates specialized AI agents to provide comprehensive sailing route planning. The system features a complete business infrastructure including authentication, subscription billing, analytics, and real-time monitoring.

## 🌟 Key Features

### Core Planning Features
- **Hierarchical Agent Architecture**: Orchestrator pattern managing specialized MCP agents
- **Dynamic Agent Creation**: Meta-agent capable of creating new agents for unforeseen requirements
- **Real-time Visualization**: Live architecture diagram showing agent interactions and request flow
- **Comprehensive Planning**: Weather, tides, currents, port facilities, safety considerations, and optimal routing
- **Natural Language Interface**: Plan sailing passages using conversational queries
- **Real-Time Data Integration**: Live weather, tidal predictions, and safety warnings

### SaaS Platform Features
- **Authentication & Authorization**: Supabase-powered auth with JWT tokens
- **Subscription Billing**: Stripe integration with three tiers (Free, Premium $19/mo, Pro $49/mo)
- **Email System**: Beautiful transactional emails with React Email and Resend
- **Analytics Dashboard**: Comprehensive business metrics and user behavior tracking
- **Agent Health Monitoring**: Real-time monitoring with auto-restart capabilities
- **Production Infrastructure**: Kubernetes-ready with comprehensive monitoring

## 🏗️ Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Web Client    │────▶│   Orchestrator  │────▶│  Specialized    │
│   (Next.js)     │◀────│     (MCP)       │◀────│    Agents       │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                      │                         │
        │                      ▼                         ▼
        │               ┌─────────────┐          ┌──────────────┐
        │               │    Redis    │          │  PostgreSQL  │
        │               │   (State)   │          │   (Data)     │
        │               └─────────────┘          └──────────────┘
        │
        ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Supabase      │     │    Stripe       │     │    Resend       │
│   (Auth)        │     │   (Billing)     │     │   (Email)       │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### Specialized Agents

- **Weather Agent**: NOAA weather data, marine forecasts, storm warnings
- **Tidal Agent**: Tide predictions, current forecasts, water depth calculations
- **Port Agent**: Port information, facilities, contacts, entry requirements
- **Safety Agent**: Navigation warnings, emergency contacts, safety checklists
- **Route Agent**: Route calculation, waypoint optimization, distance calculations
- **Wind Agent**: Wind forecasts, gust analysis, optimal sail recommendations
- **Agent Factory**: Dynamic agent creation for new capabilities

### Platform Components

- **Authentication Service**: User registration, login, password reset, session management
- **Billing Service**: Subscription management, payment processing, webhook handling
- **Email Service**: Transactional emails, usage reports, billing notifications
- **Analytics Service**: Business metrics, user behavior tracking, cohort analysis
- **Agent Manager**: Health monitoring, auto-restart, performance tracking

## 💰 Pricing Tiers

- **Free Tier**: 5 passages/month, basic features
- **Premium ($19/mo)**: 50 passages/month, advanced weather, priority support
- **Pro ($49/mo)**: Unlimited passages, fleet management, API access, white-label options

### Pro Fleet Management Features
- **Multi-Vessel Management**: Track and manage unlimited vessels in your fleet
- **Crew Coordination**: Invite crew members with role-based permissions
- **Fleet Analytics**: Utilization metrics, popular routes, and performance tracking
- **Vessel Tracking**: Real-time location monitoring for all fleet vessels
- **Maintenance Scheduling**: Track and schedule vessel maintenance
- **Shared Passages**: Automatically share passage plans across your fleet

## 🛠️ Technical Stack

- **Framework**: Model Context Protocol (MCP) by Anthropic
- **Language**: TypeScript/Node.js
- **Frontend**: Next.js 14 with App Router, Tailwind CSS, shadcn/ui
- **Authentication**: Supabase Auth with JWT tokens
- **Payments**: Stripe with subscription management
- **Email**: React Email + Resend for transactional emails
- **Database**: PostgreSQL 15+ with Supabase
- **Cache/Queue**: Redis 7+
- **Monitoring**: Prometheus, Grafana, custom analytics
- **Container**: Docker & Kubernetes-ready
- **Testing**: Jest, React Testing Library, Supertest

## 📊 Analytics & Monitoring

### Business Metrics Dashboard (Admin Only)
- **Revenue Metrics**: MRR, ARR, ARPU, LTV
- **User Metrics**: Total users, paid users, conversion rates
- **Engagement**: MAU, feature usage, retention cohorts
- **Performance**: Churn rate, growth trends, funnel analysis

### Agent Health Monitoring
- Real-time status of all agents
- Automatic restart on failure
- Memory and CPU usage tracking
- Request/response metrics
- WebSocket-based live updates

## 🚀 Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/mjohnson518/passage_planner.git
   cd passage-planner
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Required variables:
   # - SUPABASE_URL, SUPABASE_ANON_KEY
   # - STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
   # - RESEND_API_KEY
   # - Weather API keys
   ```

4. **Start infrastructure**
   ```bash
   docker-compose up -d
   ```

5. **Run database migrations**
   ```bash
   npm run db:migrate
   ```

6. **Start development servers**
   ```bash
   npm run dev
   ```

The application will be available at:
- Frontend: http://localhost:3000
- Orchestrator: http://localhost:8080
- Agent Health Dashboard: http://localhost:3000/admin/agents (admin only)
- Analytics Dashboard: http://localhost:3000/admin/analytics (admin only)

## 📁 Project Structure

```
passage-planner/
├── frontend/               # Next.js web application
│   ├── app/               # App router pages and components
│   ├── components/        # Reusable UI components
│   ├── contexts/          # React contexts (Auth, Socket, etc.)
│   ├── hooks/             # Custom React hooks
│   └── lib/               # Utilities and services
├── orchestrator/          # MCP orchestrator service
│   ├── services/          # Core services (Stripe, Email, Analytics)
│   └── config/            # Configuration files
├── agents/                # Specialized agent implementations
├── shared/                # Shared types and utilities
├── emails/                # React Email templates
├── infrastructure/        # Docker, Kubernetes configs
└── tests/                 # Integration and E2E tests
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run frontend tests
npm run test:frontend

# Run backend tests
npm run test:backend

# Run integration tests
npm run test:integration

# Run E2E tests
npm run test:e2e
```

## 🔒 Security

- JWT authentication with secure token handling
- Stripe webhook signature verification
- Rate limiting and input validation
- Encrypted sensitive data storage
- Role-based access control for admin features
- GDPR compliance with data export/deletion

## 🚢 Example Usage

```typescript
// After authentication
const { user } = useAuth();

// Plan a passage (counts against subscription limit)
const plan = await orchestrator.callTool('plan_passage', {
  departure: 'Boston, MA',
  destination: 'Portland, ME',
  departure_time: '2024-07-15T10:00:00Z',
  boat_type: 'sailboat',
  preferences: {
    avoid_night: true,
    max_wind_speed: 25,
    max_wave_height: 2
  }
});

// Track analytics
const { trackFeature } = useAnalytics();
trackFeature('passage_planned', { 
  distance: plan.total_distance,
  duration: plan.estimated_duration 
});
```

## 📧 Email Templates

Beautiful, responsive email templates for:
- Welcome emails with getting started guide
- Trial ending reminders (3 days before)
- Subscription confirmations
- Payment failures
- Usage reports (weekly/monthly)
- Password reset

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Write tests for your changes
4. Commit your changes (`git commit -m 'Add amazing feature'`)
5. Push to the branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Model Context Protocol (MCP) by Anthropic
- NOAA for weather and marine data APIs
- Stripe for payment infrastructure
- Supabase for authentication and database
- The sailing community for inspiration

## 📞 Support

For questions and support:
- Free tier: GitHub issues
- Premium tier: Email support (support@passageplanner.com)
- Pro tier: Priority support with SLA