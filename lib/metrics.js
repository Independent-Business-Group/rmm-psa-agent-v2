/**
 * Metrics Collection Module v2
 * Collects and sends system metrics (CPU, memory, disk) to backend
 */

const os = require('os');
const { execSync } = require('child_process');

// Import fetch (node-fetch for Node <18, native for Node 18+)
let fetch;
if (global.fetch) {
  fetch = global.fetch;
} else {
  try {
    fetch = require('node-fetch');
  } catch (err) {
    console.error('fetch not available - install node-fetch or use Node 18+');
  }
}

class MetricsCollector {
  constructor(logger, config) {
    this.logger = logger;
    this.config = config;
    this.interval = null;
    this.intervalMs = 2 * 60 * 1000; // 2 minutes (match v1)
  }

  /**
   * Start periodic metrics collection
   */
  start() {
    if (this.interval) {
      this.logger.warn('Metrics collector already running');
      return;
    }

    this.logger.info('Starting metrics collection (interval: 2 minutes)');
    
    // Send metrics immediately on start
    this.collect().catch(err => {
      this.logger.error('Initial metrics collection failed:', err.message);
    });

    // Then start periodic collection
    this.interval = setInterval(() => {
      this.collect().catch(err => {
        this.logger.error('Metrics collection failed:', err.message);
      });
    }, this.intervalMs);
  }

  /**
   * Stop metrics collection
   */
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      this.logger.info('Metrics collection stopped');
    }
  }

  /**
   * Collect system metrics
   */
  async collect() {
    const metrics = await this.collectSystemMetrics();
    
    this.logger.debug('Collected metrics:', metrics);

    // Send metrics via WebSocket
    await this.sendMetrics(metrics);

    return metrics;
  }

  /**
   * Collect system metrics (match v1 format)
   */
  async collectSystemMetrics() {
    const platform = os.platform();

    // CPU usage percentage
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;
    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });
    const cpuLoad1 = 100 - Math.floor(100 * totalIdle / totalTick);

    // Memory usage percentage
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memPercent = (usedMem / totalMem) * 100;

    // Disk usage array (Windows only for now)
    let disk = [];
    if (platform === 'win32') {
      try {
        const output = execSync(
          'powershell -Command "Get-PSDrive -PSProvider FileSystem | Select-Object Name, Used, Free | ConvertTo-Json"',
          { encoding: 'utf8', timeout: 5000 }
        );
        const drives = JSON.parse(output);
        disk = (Array.isArray(drives) ? drives : [drives])
          .filter(d => d.Used && d.Free)
          .map(d => ({
            used: d.Used,
            free: d.Free,
            total: d.Used + d.Free
          }));
      } catch (err) {
        this.logger.debug('Failed to get disk usage:', err.message);
      }
    } else if (platform === 'linux') {
      try {
        const output = execSync('df -B1 / | tail -1', { encoding: 'utf8', timeout: 5000 });
        const parts = output.trim().split(/\s+/);
        if (parts.length >= 4) {
          disk = [{
            used: parseInt(parts[2], 10),
            free: parseInt(parts[3], 10),
            total: parseInt(parts[1], 10)
          }];
        }
      } catch (err) {
        this.logger.debug('Failed to get disk usage:', err.message);
      }
    }

    const metrics = {
      cpuLoad1: cpuLoad1,
      memPercent: memPercent,
      disk: disk,
      uptime: os.uptime(),
      hostname: os.hostname(),
      platform: platform,
      arch: os.arch(),
      cpus: cpus.length
    };

    return metrics;
  }

  /**
   * Send metrics to backend via REST API (matches v1)
   */
  async sendMetrics(metrics) {
    const agentUuid = this.config.get('agentUuid');
    const jwt = this.config.get('jwt');
    const backendUrl = this.config.get('backendUrl');
    
    if (!agentUuid) {
      this.logger.warn('Agent UUID not configured, cannot send metrics');
      return;
    }

    if (!backendUrl) {
      this.logger.warn('Backend URL not configured, cannot send metrics');
      return;
    }

    const metric = {
      agent_uuid: agentUuid,
      type: 'system',
      data: metrics,
      ts: new Date().toISOString()
    };

    const metricsEndpoint = `${backendUrl}/agent/metrics`;

    try {
      const response = await fetch(metricsEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwt || ''}`
        },
        body: JSON.stringify(metric)
      });

      if (!response.ok) {
        const responseText = await response.text();
        throw new Error(`Backend returned ${response.status}: ${responseText}`);
      }

      this.logger.debug('Metrics sent successfully');
    } catch (error) {
      this.logger.error('Failed to send metrics:', error.message);
      // TODO: Buffer offline metrics for retry later
    }
  }
}

module.exports = { MetricsCollector };
