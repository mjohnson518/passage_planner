/**
 * Port Agent Entry Point
 * Exports the Port Agent for use by orchestrator and tests
 */

import PortAgent from './PortAgent';

export { PortAgent };
export default PortAgent;

// Start the agent if run directly
/* istanbul ignore next */
if (require.main === module) {
  const agent = new PortAgent();
  agent.initialize().then(() => {
    console.log('Port Agent running...');
  }).catch(console.error);
} 
