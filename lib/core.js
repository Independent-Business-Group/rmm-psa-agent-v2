/**
 * Agent v2 - Core Service Entry Point
 * 
 * This is a lightweight service that coordinates with helper applications
 * for privileged operations. No direct system modifications are performed
 * from this service context.
 */

const os = require('os');
const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

// Import v2 modules
const { createLogger } = require('./logger');
const { IPCManager } = require('./ipc/manager');
const { PluginManager } = require('./plugin-manager');
const { ConfigManager } = require('./config-manager');
const { WebSocketClient } = require('./ws-client');
const { SystemInfo } = require('./system-info');
const { HeartbeatManager } = require('./heartbeat');
const { AgentRegistration } = require('./registration');
const { MetricsCollector } = require('./metrics');

// Generate UUID function (since uuid might not be available)
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

class AgentV2 extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.version = '2.0.0';
    this.agentId = null;
    this.isRunning = false;
    this.isDev = options.dev || process.argv.includes('--dev');
    
    // Initialize components
    this.logger = null;
    this.config = null;
    this.ipc = null;
    this.plugins = null;
    this.ws = null;
    this.systemInfo = null;
    this.heartbeat = null;
    this.metrics = null;
    
    // State management
    this.state = {
      connected: false,
      registered: false,
      lastHeartbeat: null,
      helpersAvailable: {},
      pluginsLoaded: {},
      errors: []
    };
    
    // Ensure state objects exist
    if (!this.state.helpersAvailable) this.state.helpersAvailable = {};
    if (!this.state.pluginsLoaded) this.state.pluginsLoaded = {};
    
    // Graceful shutdown handling
    this.setupSignalHandlers();
  }
  
  async start() {
    try {
      this.logger = createLogger('agent-v2', this.isDev);
      this.logger.info('🚀 Starting EverydayTech Agent v2...');
      this.logger.info(`Platform: ${os.platform()}, Architecture: ${os.arch()}`);
      
      // Initialize configuration
      this.config = new ConfigManager(this.logger);
      await this.config.initialize();
      
      // Check if agent needs registration
      let agentId = this.config.get('agentId');
      const jwt = this.config.get('jwt');
      
      if (!agentId && jwt) {
        // Need to register with backend
        this.logger.info('No agent ID found, registering with backend...');
        const registration = new AgentRegistration(this.logger, this.config);
        
        try {
          const result = await registration.register(jwt);
          agentId = result.agentId || this.config.get('agentId');
          this.state.registered = true;
          this.logger.info(`✅ Registration complete. Agent ID: ${agentId}`);
        } catch (err) {
          this.logger.error('❌ Registration failed:', err);
          throw err;
        }
      } else if (!agentId) {
        // No agent ID and no JWT - generate temporary ID
        this.logger.warn('⚠️ No JWT token provided. Using temporary agent ID.');
        agentId = generateUUID();
        this.config.set('agentId', agentId);
        await this.config.save();
      } else {
        // Already registered
        this.state.registered = true;
        this.logger.info('Agent already registered');
      }
      
      this.agentId = agentId;
      this.logger.info(`Agent ID: ${this.agentId}`);
      
      // Initialize system information collector
      this.systemInfo = new SystemInfo(this.logger);
      
      // Initialize IPC manager for helper communication
      this.logger.info('Initializing IPC manager...');
      this.ipc = new IPCManager(this.logger, {
        timeout: 30000,
        retryAttempts: 3
      });
      await this.ipc.initialize();
      
      // Test helper availability
      await this.testHelperAvailability();
      
      // Initialize plugin manager
      this.logger.info('Loading plugin system...');
      this.plugins = new PluginManager(this.logger, this.ipc);
      await this.plugins.loadPlugins();
      
      // Initialize WebSocket connection
      this.logger.info('Connecting to backend...');
      this.ws = new WebSocketClient(this.logger, this.config);
      this.ws.on('connected', () => this.handleConnected());
      this.ws.on('disconnected', () => this.handleDisconnected());
      this.ws.on('message', (data) => this.handleMessage(data));
      
      await this.ws.connect();
      
      // Start heartbeat
      this.heartbeat = new HeartbeatManager(this.logger, this.ws, this);
      this.heartbeat.start();
      
      // Start metrics collection
      this.metrics = new MetricsCollector(this.logger, this.config);
      this.metrics.start();
      
      // Mark as running
      this.isRunning = true;
      this.state.connected = true;
      
      this.logger.info('✅ Agent v2 started successfully');
      this.logger.info(`Helpers available: ${Object.keys(this.state.helpersAvailable || {}).join(', ')}`);
      this.logger.info(`Plugins loaded: ${Object.keys(this.state.pluginsLoaded || {}).join(', ')}`);
      
    } catch (error) {
      this.logger && this.logger.error('❌ Failed to start agent v2:', error);
      console.error('❌ Failed to start agent v2:', error);
      throw error;
    }
  }
  
  async stop() {
    this.logger.info('🛑 Stopping Agent v2...');
    this.isRunning = false;
    
    // Stop metrics collection
    if (this.metrics) {
      this.metrics.stop();
    }
    
    // Stop heartbeat
    if (this.heartbeat) {
      this.heartbeat.stop();
    }
    
    // Close WebSocket connection
    if (this.ws) {
      await this.ws.disconnect();
    }
    
    // Unload plugins
    if (this.plugins) {
      await this.plugins.unloadPlugins();
    }
    
    // Close IPC
    if (this.ipc) {
      await this.ipc.shutdown();
    }
    
    // Save configuration
    if (this.config) {
      await this.config.save();
    }
    
    this.logger.info('✅ Agent v2 stopped successfully');
  }
  
  async testHelperAvailability() {
    this.logger.info('Testing helper availability...');
    
    const helpers = [
      'rdp-helper-v2',
      'system-helper',
      'update-helper'
    ];
    
    for (const helper of helpers) {
      try {
        const result = await this.ipc.executeHelper(helper, ['--version'], { timeout: 5000 });
        this.state.helpersAvailable[helper] = true;
        this.logger.info(`✅ ${helper}: Available`);
      } catch (error) {
        this.state.helpersAvailable[helper] = false;
        this.logger.warn(`⚠️  ${helper}: Not available - ${error.message}`);
      }
    }
    
    const availableCount = Object.values(this.state.helpersAvailable).filter(Boolean).length;
    this.logger.info(`Helper availability: ${availableCount}/${helpers.length} available`);
  }
  
  handleConnected() {
    this.logger.info('🔗 Connected to backend');
    this.state.connected = true;
    this.emit('connected');
  }
  
  handleDisconnected() {
    this.logger.warn('🔌 Disconnected from backend');
    this.state.connected = false;
    this.emit('disconnected');
  }
  
  async handleMessage(data) {
    try {
      const message = JSON.parse(data);
      this.logger.debug(`Received message: ${message.type}`);
      
      switch (message.type) {
        case 'ping':
          await this.ws.send({ type: 'pong', timestamp: Date.now() });
          break;
          
        case 'system_info':
          await this.handleSystemInfoRequest();
          break;
          
        case 'execute_command':
          await this.handleCommandExecution(message);
          break;
          
        case 'plugin_command':
          await this.handlePluginCommand(message);
          break;
          
        case 'helper_command':
          await this.handleHelperCommand(message);
          break;
          
        case 'update_agent':
          await this.handleAgentUpdate(message);
          break;
          
        default:
          this.logger.warn(`Unknown message type: ${message.type}`);
      }
    } catch (error) {
      this.logger.error('Error handling message:', error);
    }
  }
  
  async handleSystemInfoRequest() {
    try {
      const info = await this.systemInfo.collect();
      await this.ws.send({
        type: 'system_info_response',
        data: {
          ...info,
          agentVersion: this.version,
          helpersAvailable: this.state.helpersAvailable,
          pluginsLoaded: this.state.pluginsLoaded
        }
      });
    } catch (error) {
      this.logger.error('Failed to collect system info:', error);
    }
  }
  
  async handleCommandExecution(message) {
    try {
      this.logger.info(`Executing command: ${message.command}`);
      
      // Commands are executed via helpers, not directly
      const result = await this.ipc.executeHelper('system-helper', ['exec', message.command]);
      
      await this.ws.send({
        type: 'command_response',
        requestId: message.requestId,
        success: result.success,
        data: result
      });
    } catch (error) {
      this.logger.error('Command execution failed:', error);
      await this.ws.send({
        type: 'command_response',
        requestId: message.requestId,
        success: false,
        error: error.message
      });
    }
  }
  
  async handlePluginCommand(message) {
    try {
      const { plugin, action, parameters } = message;
      const result = await this.plugins.executePlugin(plugin, action, parameters);
      
      await this.ws.send({
        type: 'plugin_response',
        requestId: message.requestId,
        plugin: plugin,
        success: result.success,
        data: result
      });
    } catch (error) {
      this.logger.error(`Plugin command failed:`, error);
      await this.ws.send({
        type: 'plugin_response',
        requestId: message.requestId,
        plugin: message.plugin,
        success: false,
        error: error.message
      });
    }
  }
  
  async handleHelperCommand(message) {
    try {
      const { helper, args } = message;
      const result = await this.ipc.executeHelper(helper, args);
      
      await this.ws.send({
        type: 'helper_response',
        requestId: message.requestId,
        helper: helper,
        success: result.success,
        data: result
      });
    } catch (error) {
      this.logger.error(`Helper command failed:`, error);
      await this.ws.send({
        type: 'helper_response',
        requestId: message.requestId,
        helper: message.helper,
        success: false,
        error: error.message
      });
    }
  }
  
  async handleAgentUpdate(message) {
    try {
      this.logger.info('Agent update requested');
      
      // Use update helper for safe agent updates
      const result = await this.ipc.executeHelper('update-helper', ['update', message.version]);
      
      await this.ws.send({
        type: 'update_response',
        requestId: message.requestId,
        success: result.success,
        data: result
      });
      
      if (result.success) {
        // Schedule restart after response is sent
        setTimeout(() => {
          this.logger.info('Restarting for update...');
          process.exit(0);
        }, 1000);
      }
    } catch (error) {
      this.logger.error('Agent update failed:', error);
      await this.ws.send({
        type: 'update_response',
        requestId: message.requestId,
        success: false,
        error: error.message
      });
    }
  }
  
  getStatus() {
    return {
      version: this.version,
      agentId: this.agentId,
      isRunning: this.isRunning,
      state: this.state,
      uptime: process.uptime()
    };
  }
  
  setupSignalHandlers() {
    const shutdown = async (signal) => {
      this.logger.info(`Received ${signal}, shutting down gracefully...`);
      try {
        await this.stop();
        process.exit(0);
      } catch (error) {
        this.logger.error('Error during shutdown:', error);
        process.exit(1);
      }
    };
    
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    
    process.on('uncaughtException', (error) => {
      this.logger.error('Uncaught exception:', error);
      shutdown('UNCAUGHT_EXCEPTION');
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error('Unhandled rejection at:', promise, 'reason:', reason);
    });
  }
}

module.exports = { AgentV2 };