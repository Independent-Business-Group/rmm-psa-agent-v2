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
  
  sendHeartbeat() {
    try {
      this.heartbeatCount++;
      this.lastHeartbeat = new Date().toISOString();
      
      // Use WebSocket ping (matches v1 implementation)
      this.ws.ping();
      
      this.logger.debug(`Heartbeat sent #${this.heartbeatCount}`);
      
      // Update agent state
      this.agent.state.lastHeartbeat = this.lastHeartbeat;
      
    } catch (error) {
      this.logger.error('Failed to send heartbeat:', error);
    }
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