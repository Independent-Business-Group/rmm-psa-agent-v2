/**
 * Configuration Manager v2 - Manages agent configuration with validation
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

class ConfigManager {
  constructor(logger) {
    this.logger = logger;
    this.config = {};
    this.configPath = this.getConfigPath();
    this.defaultConfig = this.getDefaultConfig();
  }
  
  async initialize() {
    try {
      await this.load();
      this.logger.info(`Configuration loaded from: ${this.configPath}`);
    } catch (error) {
      this.logger.warn(`Failed to load config, using defaults: ${error.message}`);
      this.config = { ...this.defaultConfig };
      await this.save();
    }
  }
  
  getConfigPath() {
    const platform = os.platform();
    
    // Always use system directories (can't write to pkg snapshot)
    if (platform === 'win32') {
      return path.join(process.env.PROGRAMDATA || 'C:\\ProgramData', 'EverydayTech', 'config', 'agent-v2.json');
    } else if (platform === 'darwin') {
      return path.join(os.homedir(), 'Library', 'Application Support', 'EverydayTech', 'agent-v2.json');
    } else {
      // Check if running as root/sudo
      if (process.getuid && process.getuid() === 0) {
        return '/etc/everydaytech/agent-v2.json';
      }
      // For non-root users
      return path.join(os.homedir(), '.everydaytech', 'agent-v2.json');
    }
  }
  
  getDefaultConfig() {
    return {
      version: '2.0.0',
      agentId: null,
      backendUrl: process.env.BACKEND_URL || 'https://rmm-psa-backend-t9f7k.ondigitalocean.app/api',
      websocketUrl: null, // Will be derived from backendUrl
      updateInterval: 60000, // 1 minute
      heartbeatInterval: 30000, // 30 seconds
      logLevel: 'info',
      enableHelpers: true,
      helpers: {
        timeout: 30000,
        retryAttempts: 2,
        enabled: ['rdp-helper', 'system-helper', 'update-helper']
      },
      plugins: {
        autoLoad: true,
        enabled: []
      },
      security: {
        encryptCommunication: true,
        allowRemoteExecution: true,
        allowSystemModifications: false // Delegated to helpers
      },
      features: {
        remoteDesktop: true,
        systemInfo: true,
        processManagement: true,
        fileTransfer: true,
        softwareInventory: true
      }
    };
  }
  
  async load() {
    const configDir = path.dirname(this.configPath);
    
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    if (!fs.existsSync(this.configPath)) {
      throw new Error('Configuration file not found');
    }
    
    const configData = fs.readFileSync(this.configPath, 'utf8');
    const loadedConfig = JSON.parse(configData);
    
    // Merge with defaults to ensure all properties exist
    this.config = { ...this.defaultConfig, ...loadedConfig };
    
    // Validate configuration
    this.validate();
    
    // Update websocket URL if not set
    if (!this.config.websocketUrl) {
      this.config.websocketUrl = this.config.backendUrl.replace('http', 'ws') + '/agent/ws';
    }
  }
  
  async save() {
    const configDir = path.dirname(this.configPath);
    
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    this.logger.debug('Configuration saved');
  }
  
  get(key, defaultValue = undefined) {
    const keys = key.split('.');
    let value = this.config;
    
    for (const k of keys) {
      value = value && value[k];
    }
    
    return value !== undefined ? value : defaultValue;
  }
  
  set(key, value) {
    const keys = key.split('.');
    let target = this.config;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!target[k] || typeof target[k] !== 'object') {
        target[k] = {};
      }
      target = target[k];
    }
    
    target[keys[keys.length - 1]] = value;
    this.logger.debug(`Configuration updated: ${key} = ${JSON.stringify(value)}`);
  }
  
  validate() {
    // Validate required fields
    const required = ['backendUrl'];
    for (const field of required) {
      if (!this.config[field]) {
        throw new Error(`Required configuration field missing: ${field}`);
      }
    }
    
    // Validate URLs
    try {
      new URL(this.config.backendUrl);
    } catch (e) {
      throw new Error(`Invalid backend URL: ${this.config.backendUrl}`);
    }
    
    // Validate intervals
    if (this.config.updateInterval < 10000) {
      this.logger.warn('Update interval too low, setting to 10 seconds');
      this.config.updateInterval = 10000;
    }
    
    if (this.config.heartbeatInterval < 5000) {
      this.logger.warn('Heartbeat interval too low, setting to 5 seconds');
      this.config.heartbeatInterval = 5000;
    }
  }
  
  getAll() {
    return { ...this.config };
  }
  
  reset() {
    this.config = { ...this.defaultConfig };
    this.logger.info('Configuration reset to defaults');
  }
  
  update(newConfig) {
    this.config = { ...this.config, ...newConfig };
    this.validate();
    this.logger.info('Configuration updated');
  }
}

module.exports = { ConfigManager };