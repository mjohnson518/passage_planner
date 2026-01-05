/**
 * Mock WeatherAgent for orchestrator tests
 */
export class WeatherAgent {
  initialize = jest.fn().mockResolvedValue(undefined);
  shutdown = jest.fn().mockResolvedValue(undefined);
  getTools = jest.fn().mockReturnValue([]);
  handleToolCall = jest.fn().mockResolvedValue([
    {
      time: '2024-01-20T12:00:00Z',
      windSpeed: 15,
      windDirection: 'NE',
      waveHeight: 2,
      temperature: 45,
      conditions: 'Partly Cloudy'
    }
  ]);
}

export default WeatherAgent;
