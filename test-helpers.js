/**
 * Helper Test Script - Tests Agent v2 functionality
 */

const { AgentV2 } = require('./lib/core');

class HelperTester {
  constructor() {
    this.agent = null;
  }

  async start() {
    console.log('🚀 Starting Agent v2 Helper Tests...');
    
    // Set development environment
    process.env.NODE_ENV = 'development';
    
    try {
      // Initialize agent in test mode
      this.agent = new AgentV2({ dev: true });
      
      console.log('📝 Initializing core components...');
      
      // Initialize just the components we need for testing
      const { createLogger } = require('./lib/logger');
      const { ConfigManager } = require('./lib/config-manager');
      const { IPCManager } = require('./lib/ipc/manager');
      
      this.agent.logger = createLogger('test', true);
      this.agent.config = new ConfigManager(this.agent.logger);
      await this.agent.config.initialize();
      
      this.agent.ipc = new IPCManager(this.agent.logger);
      await this.agent.ipc.initialize();
      
      console.log('✅ Core components initialized');
      
      await this.testHelperAvailability();
      await this.testHelperFunctionality();
      
      console.log('\n🎉 Helper tests completed!');
      
    } catch (error) {
      console.error('❌ Test failed:', error.message);
      process.exit(1);
    }
  }

  async testHelperAvailability() {
    console.log('\n🔍 Testing Helper Availability:');
    
    const helpers = ['rdp-helper-v2', 'system-helper', 'update-helper'];
    
    for (const helper of helpers) {
      try {
        const result = await this.agent.ipc.executeHelper(helper, ['--version'], { timeout: 5000 });
        console.log(`✅ ${helper}: Available`);
      } catch (error) {
        console.log(`⚠️  ${helper}: Not available - ${error.message}`);
      }
    }
  }

  async testHelperFunctionality() {
    console.log('\n🔧 Testing Helper Commands:');
    
    try {
      const rdpStatus = await this.agent.ipc.executeHelper('rdp-helper-v2', ['status']);
      console.log('✅ RDP Helper Status:', rdpStatus.success ? 'Working' : 'Failed');
    } catch (error) {
      console.log('❌ RDP Helper Status: Failed -', error.message);
    }
    
    try {
      const systemInfo = await this.agent.ipc.executeHelper('system-helper', ['info']);
      console.log('✅ System Helper Info:', systemInfo.success ? 'Working' : 'Failed');
    } catch (error) {
      console.log('❌ System Helper Info: Failed -', error.message);
    }
  }
}

// Run the tests
const tester = new HelperTester();
tester.start().catch(error => {
  console.error('Test runner failed:', error);
  process.exit(1);
});