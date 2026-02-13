/**
 * Agent v2 - Registration Module
 * Handles agent enrollment and registration with backend
 */

const os = require('os');
const crypto = require('crypto');
const { execSync } = require('child_process');
const fs = require('fs');
const fetch = require('node-fetch');

class AgentRegistration {
  constructor(logger, config) {
    this.logger = logger;
    this.config = config;
    this.maxAttempts = 5;
    this.baseDelay = 2000;
  }

  /**
   * Get unique hardware ID for this machine
   */
  getHardwareId() {
    try {
      if (os.platform() === 'win32') {
        try {
          const uuid = execSync(
            'powershell -Command "(Get-CimInstance -Class Win32_ComputerSystemProduct).UUID"',
            { encoding: 'utf8' }
          ).trim();
          
          if (uuid && uuid.length > 0 && uuid !== 'FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF') {
            return uuid;
          }
        } catch (err) {
          this.logger.warn('Failed to get hardware UUID from Win32_ComputerSystemProduct:', err.message);
        }
      }

      if (os.platform() === 'linux') {
        try {
          const uuid = fs.readFileSync('/sys/class/dmi/id/product_uuid', 'utf8').trim();
          if (uuid && uuid.length > 0 && uuid !== 'FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF') {
            return uuid;
          }
        } catch (err) {
          // Fallback below
        }
      }

      if (os.platform() === 'darwin') {
        try {
          const uuid = execSync(
            'ioreg -rd1 -c IOPlatformExpertDevice | grep IOPlatformUUID | awk -F\\" \'{print $4}\'',
            { encoding: 'utf8' }
          ).trim();
          
          if (uuid && uuid.length > 0) {
            return uuid;
          }
        } catch (err) {
          // Fallback below
        }
      }

      // Fallback: hash hostname + platform + cpu
      const cpuModel = os.cpus()[0]?.model || 'unknown';
      const sysString = `${os.hostname()}|${os.platform()}|${os.arch()}|${cpuModel}`;
      return crypto.createHash('sha256').update(sysString).digest('hex');
    } catch (err) {
      this.logger.error('getHardwareId() failed:', err);
      return null;
    }
  }

  /**
   * Register/enroll agent with backend
   */
  async register(jwt) {
    if (!jwt) {
      throw new Error('JWT token required for registration');
    }

    this.logger.info('🚀 Starting agent registration...');
    
    const hardwareId = this.getHardwareId();
    if (!hardwareId) {
      throw new Error('Failed to get hardware ID');
    }

    this.logger.info(`Hardware ID: ${hardwareId}`);

    let attempt = 0;
    let delay = this.baseDelay;

    while (attempt < this.maxAttempts) {
      try {
        const payload = {
          hardware_uuid: hardwareId,
          hostname: os.hostname(),
          os: os.platform(),
          version: '2.0.0'
        };

        const backendUrl = this.config.get('backendUrl');
        if (!backendUrl) {
          throw new Error('Backend URL not configured');
        }

        // Decode JWT to get tenantId
        const jwtParts = jwt.split('.');
        const payloadBase64 = jwtParts[1];
        const payloadJson = Buffer.from(payloadBase64, 'base64').toString();
        const jwtPayload = JSON.parse(payloadJson);
        const tenantId = jwtPayload.tenantId;

        this.logger.debug(`Attempting registration (${attempt + 1}/${this.maxAttempts})...`);

        const response = await fetch(`${backendUrl}/agent/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${jwt}`
          },
          body: JSON.stringify({
            tenantId: tenantId,
            machineId: hardwareId,
            hostname: payload.hostname,
            platform: payload.os,
            version: payload.version
          })
        });

        const rawBody = await response.text();
        this.logger.debug(`Registration response status: ${response.status}`);
        this.logger.debug(`Registration response body: ${rawBody}`);

        let data;
        try {
          data = JSON.parse(rawBody);
        } catch (err) {
          throw new Error(`Invalid JSON response: ${err.message}`);
        }

        if (response.status === 409) {
          this.logger.info('ℹ️ Agent already registered');
          if (data.agentId) {
            this.config.set('agentId', data.agentId);
            if (data.agentUuid) {
              this.config.set('agentUuid', data.agentUuid);
            }
            this.config.set('hardwareId', hardwareId);
            await this.config.save();
          }
          return data;
        }

        if (!response.ok) {
          throw new Error(`Registration failed: ${response.status} ${response.statusText}`);
        }

        this.logger.info('✅ Registration successful');
        
        if (data.agentId) {
          this.config.set('agentId', data.agentId);
          if (data.agentUuid) {
            this.config.set('agentUuid', data.agentUuid);
          }
          this.config.set('hardwareId', hardwareId);
          await this.config.save();
          this.logger.info(`Agent ID: ${data.agentId}`);
        }

        return data;

      } catch (err) {
        attempt++;
        this.logger.error(`❌ Registration error (attempt ${attempt}/${this.maxAttempts}):`, err.message);

        if (attempt < this.maxAttempts) {
          this.logger.info(`⏳ Retrying in ${delay / 1000}s...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2; // Exponential backoff
        } else {
          throw new Error(`Registration failed after ${this.maxAttempts} attempts: ${err.message}`);
        }
      }
    }
  }
}

module.exports = { AgentRegistration };
