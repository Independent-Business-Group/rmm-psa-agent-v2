/**
 * Guacamole Plugin v2 - Uses helper-based architecture
 * 
 * This plugin coordinates with helpers to enable remote desktop access
 * for Apache Guacamole without performing privileged operations directly.
 */

class GuacamolePluginV2 {
  constructor(logger, ipcManager) {
    this.logger = logger;
    this.ipc = ipcManager;
    this.version = '2.0.0';
    this.description = 'Apache Guacamole integration with helper-based remote desktop setup';
  }
  
  async initialize() {
    this.logger.info('Guacamole Plugin v2 initialized');
  }
  
  async enable(options = {}) {
    try {
      this.logger.info('Enabling remote desktop for Guacamole...');
      
      // Use RDP helper to enable remote desktop
      const result = await this.ipc.executeHelper('rdp-helper-v2', ['enable', '--guacamole'], {
        timeout: 60000
      });
      
      if (!result.success) {
        throw new Error(result.error || 'RDP helper failed');
      }
      
      // Get connection information
      const connectionInfo = await this.getConnectionInfo();
      
      return {
        success: true,
        message: 'Remote desktop enabled for Guacamole',
        data: {
          ...result.data,
          connection: connectionInfo.data
        }
      };
      
    } catch (error) {
      this.logger.error('Failed to enable Guacamole:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  async disable() {
    try {
      this.logger.info('Disabling remote desktop...');
      
      const result = await this.ipc.executeHelper('rdp-helper-v2', ['disable'], {
        timeout: 30000
      });
      
      return result;
    } catch (error) {
      this.logger.error('Failed to disable remote desktop:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  async getStatus() {
    try {
      const result = await this.ipc.executeHelper('rdp-helper-v2', ['status'], {
        timeout: 15000
      });
      
      return result;
    } catch (error) {
      this.logger.error('Failed to get Guacamole status:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  async getConnectionInfo() {
    const os = require('os');
    const networkInterfaces = os.networkInterfaces();
    
    // Get primary IP address
    let ipAddress = '127.0.0.1';
    let hostname = os.hostname();
    
    for (const interfaceName in networkInterfaces) {
      const interfaces = networkInterfaces[interfaceName];
      for (const iface of interfaces) {
        if (iface.family === 'IPv4' && !iface.internal) {
          ipAddress = iface.address;
          break;
        }
      }
    }
    
    const connectionInfo = {
      protocol: os.platform() === 'win32' ? 'rdp' : 'vnc',
      hostname: hostname,
      ipAddress: ipAddress,
      port: os.platform() === 'win32' ? 3389 : 5900,
      platform: os.platform()
    };
    
    return {
      success: true,
      data: connectionInfo
    };
  }
  
  async configure(options = {}) {
    try {
      this.logger.info('Configuring remote desktop settings...');
      
      const args = ['configure'];
      if (options.guacamole) args.push('--guacamole');
      if (options.security === 'relaxed') args.push('--security=relaxed');
      
      const result = await this.ipc.executeHelper('rdp-helper-v2', args, {
        timeout: 30000
      });
      
      return result;
    } catch (error) {
      this.logger.error('Failed to configure remote desktop:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  async test() {
    try {
      this.logger.info('Testing remote desktop connection...');
      
      const result = await this.ipc.executeHelper('rdp-helper-v2', ['test'], {
        timeout: 30000
      });
      
      return result;
    } catch (error) {
      this.logger.error('Remote desktop test failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  async initialize_full() {
    try {
      this.logger.info('Full Guacamole initialization...');
      
      // Step 1: Enable remote desktop
      const enableResult = await this.enable({ guacamole: true });
      if (!enableResult.success) {
        throw new Error(`Enable failed: ${enableResult.error}`);
      }
      
      // Step 2: Configure for Guacamole
      const configResult = await this.configure({ guacamole: true });
      if (!configResult.success) {
        this.logger.warn(`Configuration warning: ${configResult.error}`);
      }
      
      // Step 3: Test connection
      const testResult = await this.test();
      if (!testResult.success) {
        this.logger.warn(`Test warning: ${testResult.error}`);
      }
      
      // Step 4: Get final status and connection info
      const status = await this.getStatus();
      const connectionInfo = await this.getConnectionInfo();
      
      return {
        success: true,
        message: 'Guacamole initialization completed',
        data: {
          enabled: enableResult.data,
          configured: configResult.success ? configResult.data : null,
          tested: testResult.success ? testResult.data : null,
          status: status.success ? status.data : null,
          connection: connectionInfo.data
        }
      };
      
    } catch (error) {
      this.logger.error('Full initialization failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  async cleanup() {
    this.logger.info('Guacamole Plugin v2 cleanup completed');
  }
}

module.exports = GuacamolePluginV2;