/**
 * Heartbeat Manager v2 - Manages agent health monitoring
 */

class HeartbeatManager {
  constructor(logger, wsClient, agent) {
    this.logger = logger;
    this.ws = wsClient;
    this.agent = agent;
    this.interval = null;
    this.isRunning = false;
    this.heartbeatCount = 0;
    this.lastHeartbeat = null;
  }
  
  start() {
    if (this.isRunning) {
      this.logger.warn('Heartbeat already running');
      return;
    }
    
    const intervalMs = this.agent.config.get('heartbeatInterval', 30000);
    this.logger.info(`Starting heartbeat (${intervalMs}ms interval)`);
    
    this.interval = setInterval(() => {
      this.sendHeartbeat();
    }, intervalMs);
    
    this.isRunning = true;
    
    // Send initial heartbeat
    this.sendHeartbeat();
  }
  
  stop() {
    if (!this.isRunning) {
      return;
    }
    
    this.logger.info('Stopping heartbeat');
    
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    
    this.isRunning = false;
  }
  
  async sendHeartbeat() {
    try {
      this.heartbeatCount++;
      this.lastHeartbeat = new Date().toISOString();
      
      const heartbeat = {
        type: 'heartbeat',
        data: {
          timestamp: this.lastHeartbeat,
          count: this.heartbeatCount,
          status: this.agent.getStatus(),
          metrics: await this.collectMetrics()
        }
      };
      
      await this.ws.send(heartbeat);
      
      this.logger.debug(`Heartbeat sent #${this.heartbeatCount}`);
      
      // Update agent state
      this.agent.state.lastHeartbeat = this.lastHeartbeat;
      
    } catch (error) {
      this.logger.error('Failed to send heartbeat:', error);
    }
  }
  
  async collectMetrics() {
    const metrics = {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      connections: this.ws.getStatus(),
      helpers: Object.keys(this.agent.state.helpersAvailable).length,
      plugins: Object.keys(this.agent.state.pluginsLoaded).length,
      errors: this.agent.state.errors.length
    };
    
    // Add system metrics if available
    try {
      if (this.agent.systemInfo) {
        const os = require('os');
        metrics.system = {
          loadavg: os.loadavg(),
          freemem: os.freemem(),
          totalmem: os.totalmem()
        };
      }
    } catch (error) {
      this.logger.debug('Failed to collect system metrics:', error.message);
    }
    
    return metrics;
  }
  
  getStatus() {
    return {
      running: this.isRunning,
      count: this.heartbeatCount,
      lastHeartbeat: this.lastHeartbeat,
      interval: this.interval ? this.agent.config.get('heartbeatInterval') : null
    };
  }
}

module.exports = { HeartbeatManager };