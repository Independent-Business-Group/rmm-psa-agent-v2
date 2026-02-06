/**
 * Agent v2 - Start Script
 * Entry point that initializes and starts the Agent v2 service
 */

const { AgentV2 } = require('./core');

async function main() {
  try {
    const agent = new AgentV2({ dev: process.argv.includes('--dev') });
    await agent.start();
    
    // Keep the process running
    process.on('SIGTERM', async () => {
      await agent.stop();
      process.exit(0);
    });
    
    process.on('SIGINT', async () => {
      await agent.stop();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('Failed to start Agent v2:', error);
    process.exit(1);
  }
}

// Start the agent
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});