# Passage Planner Frontend

This is the Next.js 14 frontend application for the Passage Planner multi-agent system.

## Features

- **Chat Interface**: Natural language interface for passage planning
- **Real-time Agent Visualization**: Live view of agent network and processing status
- **Interactive Map**: View and export passage plans with waypoints, weather, and hazards
- **WebSocket Integration**: Real-time updates from the orchestrator

## Getting Started

### Prerequisites

- Node.js 20.x or higher
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Copy environment variables:
```bash
cp .env.example .env.local
```

3. Download Leaflet icons:
```bash
npm install leaflet
cp node_modules/leaflet/dist/images/* public/leaflet/
```

### Development

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Testing

Run tests:

```bash
npm test
```

Run tests in watch mode:

```bash
npm run test:watch
```

### Building

Build for production:

```bash
npm run build
```

Run production build:

```bash
npm start
```

## Project Structure

```
frontend/
├── app/                    # Next.js 14 app directory
│   ├── components/        # React components
│   │   ├── chat/         # Chat interface components
│   │   ├── map/          # Map visualization components
│   │   ├── ui/           # Shared UI components
│   │   └── visualization/ # Agent visualization components
│   ├── config/           # Configuration files
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Utility functions
│   ├── types/            # TypeScript type definitions
│   ├── layout.tsx        # Root layout
│   ├── page.tsx          # Home page
│   └── providers.tsx     # Context providers
├── public/               # Static assets
│   └── leaflet/         # Leaflet marker icons
├── __tests__/           # Test files
└── package.json         # Dependencies and scripts
```

## Key Technologies

- **Next.js 14**: React framework with App Router
- **TypeScript**: Type safety throughout
- **Tailwind CSS**: Utility-first styling
- **Zustand**: State management
- **Socket.io**: WebSocket communication
- **Leaflet**: Interactive maps
- **D3.js**: Agent network visualization
- **React Query**: Server state management
- **Radix UI**: Accessible UI components

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Orchestrator API URL | `http://localhost:8080` |
| `NEXT_PUBLIC_WS_URL` | WebSocket URL | `ws://localhost:8080` |
| `NEXT_PUBLIC_ENABLE_AGENT_FACTORY` | Enable dynamic agent creation | `true` |
| `NEXT_PUBLIC_ENABLE_WEATHER_LAYERS` | Enable weather map layers | `true` |

## Contributing

See the main project README for contribution guidelines.

## License

MIT License - see the main project LICENSE file for details. 