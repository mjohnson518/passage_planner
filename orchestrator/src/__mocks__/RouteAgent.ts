/**
 * Mock RouteAgent for orchestrator tests
 */
export class RouteAgent {
  initialize = jest.fn().mockResolvedValue(undefined);
  shutdown = jest.fn().mockResolvedValue(undefined);
  getTools = jest.fn().mockReturnValue([]);
  handleToolCall = jest.fn().mockResolvedValue({
    waypoints: [
      { latitude: 42.3601, longitude: -71.0589, name: 'Boston, MA' },
      { latitude: 42.7, longitude: -70.8 },
      { latitude: 43.0, longitude: -70.5 },
      { latitude: 43.6591, longitude: -70.2568, name: 'Portland, ME' }
    ],
    totalDistance: 85.7,
    estimatedDuration: 17.14,
    route_type: 'great_circle'
  });
}

export default RouteAgent;
