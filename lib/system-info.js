/**
 * System Info v2 - Collects system information using helpers when needed
 */

const os = require('os');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class SystemInfo {
  constructor(logger, ipcManager = null) {
    this.logger = logger;
    this.ipc = ipcManager;
  }
  
  async collect() {
    const info = {
      agent: this.getAgentInfo(),
      system: await this.getSystemInfo(),
      hardware: await this.getHardwareInfo(),
      network: this.getNetworkInfo(),
      processes: await this.getProcessInfo(),
      services: await this.getServiceInfo(),
      software: await this.getSoftwareInfo(),
      timestamp: new Date().toISOString()
    };
    
    this.logger.debug('System information collected');
    return info;
  }
  
  getAgentInfo() {
    return {
      version: '2.0.0',
      architecture: 'helper-based',
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      pid: process.pid,
      uptime: process.uptime(),
      workingDirectory: process.cwd(),
      executablePath: process.execPath
    };
  }
  
  async getSystemInfo() {
    const info = {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      release: os.release(),
      version: os.version(),
      type: os.type(),
      uptime: os.uptime(),
      loadavg: os.loadavg(),
      tmpdir: os.tmpdir(),
      homedir: os.homedir()
    };
    
    // Get additional OS information via helper if available
    if (this.ipc) {
      try {
        const helperResult = await this.ipc.executeHelper('system-helper', ['info'], { timeout: 10000 });
        if (helperResult.success) {
          info.extended = helperResult.data;
        }
      } catch (error) {
        this.logger.debug('Helper system info failed:', error.message);
      }
    }
    
    return info;
  }
  
  async getHardwareInfo() {
    const info = {
      memory: {
        total: os.totalmem(),
        free: os.freemem(),
        used: os.totalmem() - os.freemem()
      },
      cpus: os.cpus().map(cpu => ({
        model: cpu.model,
        speed: cpu.speed,
        times: cpu.times
      })),
      cpuCount: os.cpus().length
    };
    
    // Add disk information if possible
    try {
      info.disks = await this.getDiskInfo();
    } catch (error) {
      this.logger.debug('Disk info collection failed:', error.message);
      info.disks = [];
    }
    
    return info;
  }
  
  getNetworkInfo() {
    const interfaces = os.networkInterfaces();
    const info = {
      interfaces: {},
      external: null
    };
    
    for (const [name, addresses] of Object.entries(interfaces)) {
      info.interfaces[name] = addresses.map(addr => ({
        address: addr.address,
        netmask: addr.netmask,
        family: addr.family,
        mac: addr.mac,
        internal: addr.internal,
        cidr: addr.cidr
      }));
      
      // Find external IP
      const external = addresses.find(addr => 
        addr.family === 'IPv4' && 
        !addr.internal && 
        !addr.address.startsWith('169.254.')
      );
      
      if (external && !info.external) {
        info.external = external.address;
      }
    }
    
    return info;
  }
  
  async getProcessInfo() {
    const info = {
      count: 0,
      top: [],
      agent: {
        pid: process.pid,
        memory: process.memoryUsage(),
        cpu: process.cpuUsage()
      }
    };
    
    try {
      if (os.platform() === 'win32') {
        const output = execSync('tasklist /fo csv', { encoding: 'utf8', timeout: 5000 });
        const lines = output.split('\n').slice(1); // Skip header
        info.count = lines.filter(line => line.trim()).length;
        
        // Get top processes by memory
        info.top = lines
          .filter(line => line.trim())
          .slice(0, 10)
          .map(line => {
            const parts = line.split(',').map(p => p.replace(/"/g, ''));
            return {
              name: parts[0],
              pid: parts[1],
              memory: parts[4]
            };
          });
      } else {
        const output = execSync('ps aux', { encoding: 'utf8', timeout: 5000 });
        const lines = output.split('\n').slice(1);
        info.count = lines.filter(line => line.trim()).length;
        
        info.top = lines
          .filter(line => line.trim())
          .slice(0, 10)
          .map(line => {
            const parts = line.trim().split(/\s+/);
            return {
              user: parts[0],
              pid: parts[1],
              cpu: parts[2],
              memory: parts[3],
              command: parts.slice(10).join(' ')
            };
          });
      }
    } catch (error) {
      this.logger.debug('Process info collection failed:', error.message);
    }
    
    return info;
  }
  
  async getServiceInfo() {
    const info = {
      count: 0,
      running: 0,
      services: []
    };
    
    // Use helper for service information if available
    if (this.ipc && os.platform() === 'win32') {
      try {
        const result = await this.ipc.executeHelper('system-helper', ['service-list'], { timeout: 15000 });
        if (result.success) {
          info.services = result.data.services || [];
          info.count = info.services.length;
          info.running = info.services.filter(s => s.status === 'running').length;
        }
      } catch (error) {
        this.logger.debug('Helper service info failed:', error.message);
      }
    }
    
    return info;
  }
  
  async getSoftwareInfo() {
    const info = {
      count: 0,
      software: []
    };
    
    // Use helper for software inventory if available
    if (this.ipc) {
      try {
        const result = await this.ipc.executeHelper('system-helper', ['software-list'], { timeout: 20000 });
        if (result.success && result.data.software) {
          info.software = result.data.software;
          info.count = result.data.count;
        }
      } catch (error) {
        this.logger.debug('Helper software info failed:', error.message);
      }
    }
    
    return info;
  }
  
  async getDiskInfo() {
    const disks = [];
    
    try {
      if (os.platform() === 'win32') {
        const output = execSync('wmic logicaldisk get size,freespace,caption', { 
          encoding: 'utf8', 
          timeout: 5000 
        });
        
        const lines = output.split('\n').slice(1);
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 3) {
            disks.push({
              drive: parts[0],
              freeSpace: parseInt(parts[1]) || 0,
              totalSpace: parseInt(parts[2]) || 0
            });
          }
        }
      } else {
        const output = execSync('df -h', { encoding: 'utf8', timeout: 5000 });
        const lines = output.split('\n').slice(1);
        
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 6) {
            disks.push({
              filesystem: parts[0],
              size: parts[1],
              used: parts[2],
              available: parts[3],
              usePercent: parts[4],
              mountPoint: parts[5]
            });
          }
        }
      }
    } catch (error) {
      this.logger.debug('Disk info collection failed:', error.message);
    }
    
    return disks;
  }
}

module.exports = { SystemInfo };