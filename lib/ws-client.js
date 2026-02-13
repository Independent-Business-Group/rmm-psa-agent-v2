/**
 * WebSocket Client v2 - Enhanced WebSocket communication with reconnection
 */

const WebSocket = require('ws');
const EventEmitter = require('events');
const crypto = require('crypto');

class WebSocketClient extends EventEmitter {
  constructor(logger, config) {
    super();
    
    this.logger = logger;
    this.config = config;
    this.ws = null;
    this.isConnected = false;
    this.shouldReconnect = true;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 5000;
    this.heartbeatInterval = null;
    this.messageQueue = [];
    
    this.setupEventHandlers();
  }
  
  async connect() {
    const backendUrl = this.config.get('backendUrl');
    const agentUuid = this.config.get('agentUuid');
    
    if (!backendUrl) {
      throw new Error('Backend URL not configured');
    }
    
    if (!agentUuid) {
      throw new Error('Agent UUID not configured - registration required');
    }
    
    // Convert backend URL to WebSocket URL
    // Example: https://everydaytech.au/api → wss://everydaytech.au/ws
    // Remove /api suffix if present, then add /ws
    let baseUrl = backendUrl.replace(/\/api$/, '');
    const wsUrl = baseUrl.replace('https', 'wss').replace('http', 'ws') + `/ws?agent_uuid=${agentUuid}`;
    
    this.logger.info(`Connecting to WebSocket: ${wsUrl}`);
    
    try {
      this.ws = new WebSocket(wsUrl, {
        headers: {
          'User-Agent': 'EverydayTechAgent-v2/2.0.0',
          'X-Agent-Version': '2.0.0',
          'X-Agent-UUID': agentUuid
        },
        handshakeTimeout: 10000
      });
      
      this.ws.on('open', () => this.handleOpen());
      this.ws.on('message', (data) => this.handleMessage(data));
      this.ws.on('close', (code, reason) => this.handleClose(code, reason));
      this.ws.on('error', (error) => this.handleError(error));
      
    } catch (error) {
      this.logger.error('WebSocket connection failed:', error);
      throw error;
    }
  }
  
  async disconnect() {
    this.shouldReconnect = false;
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    if (this.ws) {
      this.ws.close(1000, 'Agent shutdown');
      this.ws = null;
    }
    
    this.isConnected = false;
    this.logger.info('WebSocket disconnected');
  }
  
  async send(message) {
    if (!this.isConnected) {
      this.logger.debug('Queueing message (not connected):', message.type);
      this.messageQueue.push(message);
      return;
    }
    
    try {
      // Send message as-is with timestamp (don't automatically add agentId - it's in URL)
      const payload = JSON.stringify({
        ...message,
        timestamp: Date.now()
      });
      
      this.ws.send(payload);
      this.logger.debug(`Message sent: ${message.type}`);
    } catch (error) {
      this.logger.error('Failed to send message:', error);
      throw error;
    }
  }
  
  handleOpen() {
    this.logger.info('WebSocket connected');
    this.isConnected = true;
    this.reconnectAttempts = 0;
    
    // Send agent_hello message (match v1 format)
    const os = require('os');
    const helloMsg = {
      type: 'agent_hello',
      hostname: os.hostname(),
      os: os.platform(),
      agent_uuid: this.config.get('agentUuid'),
      version: '2.0.0',
      timestamp: Date.now()
    };
    
    this.logger.info('Sending agent_hello:', helloMsg);
    
    try {
      this.ws.send(JSON.stringify(helloMsg));
    } catch (error) {
      this.logger.error('Failed to send agent_hello:', error);
    }
    
    // Send queued messages
    this.flushMessageQueue();
    
    // Start heartbeat
    this.startHeartbeat();
    
    this.emit('connected');
  }
  
  handleMessage(data) {
    try {
      const message = JSON.parse(data.toString());
      this.logger.debug(`Message received: ${message.type}`);
      
      // Handle built-in message types
      if (message.type === 'ping') {
        this.send({ type: 'pong', pingId: message.pingId });
        return;
      }
      
      this.emit('message', data.toString());
    } catch (error) {
      this.logger.error('Failed to parse WebSocket message:', error);
    }
  }
  
  handleClose(code, reason) {
    this.logger.warn(`WebSocket closed: ${code} - ${reason}`);
    this.isConnected = false;
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    this.emit('disconnected', { code, reason });
    
    if (this.shouldReconnect) {
      this.scheduleReconnect();
    }
  }
  
  handleError(error) {
    this.logger.error('WebSocket error:', error);
    this.emit('error', error);
  }
  
  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.logger.error('Max reconnection attempts reached, giving up');
      return;
    }
    
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1);
    
    this.logger.info(`Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);
    
    setTimeout(() => {
      if (this.shouldReconnect) {
        this.connect().catch(error => {
          this.logger.error('Reconnection failed:', error);
        });
      }
    }, delay);
  }
  
  startHeartbeat() {
    const interval = this.config.get('heartbeatInterval', 30000);
    
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected) {
        this.send({ type: 'heartbeat' });
      }
    }, interval);
    
    this.logger.debug(`Heartbeat started (${interval}ms)`);
  }
  
  flushMessageQueue() {
    if (this.messageQueue.length > 0) {
      this.logger.info(`Sending ${this.messageQueue.length} queued messages`);
      
      for (const message of this.messageQueue) {
        this.send(message);
      }
      
      this.messageQueue = [];
    }
  }
  
  setupEventHandlers() {
    // Handle process signals for clean shutdown
    process.on('SIGTERM', () => this.disconnect());
    process.on('SIGINT', () => this.disconnect());
  }
  
  getStatus() {
    return {
      connected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      queuedMessages: this.messageQueue.length,
      url: this.config.get('websocketUrl')
    };
  }
}

module.exports = { WebSocketClient };