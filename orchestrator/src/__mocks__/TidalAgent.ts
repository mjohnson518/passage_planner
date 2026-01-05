/**
 * Mock TidalAgent for orchestrator tests
 */
export class TidalAgent {
  initialize = jest.fn().mockResolvedValue(undefined);
  shutdown = jest.fn().mockResolvedValue(undefined);
  getTools = jest.fn().mockReturnValue([]);
  handleToolCall = jest.fn().mockResolvedValue({
    station: '8443970',
    station_name: 'Boston Harbor',
    predictions: [
      { time: '2024-01-20T06:15:00Z', height: 9.5, type: 'H' },
      { time: '2024-01-20T12:30:00Z', height: 1.2, type: 'L' },
      { time: '2024-01-20T18:45:00Z', height: 9.8, type: 'H' }
    ],
    datum: 'MLLW',
    units: 'english'
  });
}

export default TidalAgent;
