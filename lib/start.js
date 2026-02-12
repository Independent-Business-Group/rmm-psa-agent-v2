/**
 * Agent v2 - Start Script
 * Entry point that initializes and starts the Agent v2 service
 */

const { AgentV2 } = require('./core');

async function main() {
  // Handle service installation commands
  if (process.argv.includes('--service-install')) {
    const { ServiceInstaller } = require('./service-installer');
    const installer = new ServiceInstaller();
    await installer.install();
    return;
  }
  
  if (process.argv.includes('--service-uninstall')) {
    const { ServiceInstaller } = require('./service-installer');
    const installer = new ServiceInstaller();
    await installer.uninstall();
    return;
  }
  
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