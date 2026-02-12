/**
 * Update Helper v2 - Handles agent updates and binary replacement
 * 
 * This helper manages the complex process of updating the agent
 * while it's running, including downloading, verifying, and replacing binaries.
 * 
 * Usage: update-helper [check|download|install|rollback]
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync, spawn } = require('child_process');
const os = require('os');
const https = require('https');

class UpdateHelperV2 {
  constructor() {
    this.version = '2.0.0';
    this.platform = os.platform();
    this.arch = os.arch();
    this.logFile = this.getLogPath();
    
    // Check GitHub directly for updates (public repo)
    this.githubRepo = 'Independent-Business-Group/rmm-psa-agent-v2';
    this.updateUrl = `https://api.github.com/repos/${this.githubRepo}/releases/latest`;
    this.tempDir = this.getTempDir();
    this.backupDir = this.getBackupDir();
    
    this.ensureDirectories();
    this.log(`Update Helper v${this.version} started`);
  }
  
  getLogPath() {
    if (this.platform === 'win32') {
      return 'C:\\ProgramData\\EverydayTech\\logs\\update-helper.log';
    } else {
      return '/var/log/everydaytech/update-helper.log';
    }
  }
  
  getTempDir() {
    if (this.platform === 'win32') {
      return 'C:\\ProgramData\\EverydayTech\\temp';
    } else {
      return '/tmp/everydaytech';
    }
  }
  
  getBackupDir() {
    if (this.platform === 'win32') {
      return 'C:\\ProgramData\\EverydayTech\\backup';
    } else {
      return '/opt/everydaytech/backup';
    }
  }
  
  ensureDirectories() {
    for (const dir of [this.tempDir, this.backupDir, path.dirname(this.logFile)]) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }
  
  log(message) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}\n`;
    
    try {
      fs.appendFileSync(this.logFile, logEntry);
    } catch (e) {
      // Continue silently
    }
    
    console.log(message);
  }
  
  async checkForUpdates() {
    try {
      this.log('Checking for available updates...');
      
      const updateInfo = await this.fetchUpdateInfo();
      const currentVersion = this.getCurrentVersion();
      
      const hasUpdate = this.compareVersions(updateInfo.version, currentVersion) > 0;
      
      return this.success('Update check completed', {
        currentVersion,
        latestVersion: updateInfo.version,
        hasUpdate,
        updateInfo: hasUpdate ? updateInfo : null
      });
    } catch (error) {
      return this.error(`Update check failed: ${error.message}`);
    }
  }
  
  async downloadUpdate(version) {
    try {
      this.log(`Downloading update: ${version}`);
      
      const updateInfo = await this.fetchUpdateInfo(version);
      const downloadUrl = this.getBinaryUrl(updateInfo);
      
      if (!downloadUrl) {
        throw new Error(`No download available for ${this.platform}-${this.arch}`);
      }
      
      // Extract filename from URL or use GitHub asset name
      const urlFilename = downloadUrl.split('/').pop();
      const downloadPath = path.join(this.tempDir, urlFilename);
      
      this.log(`Downloading from: ${downloadUrl}`);
      
      // Download the update
      await this.downloadFile(downloadUrl, downloadPath);
      
      // Hash verification is optional for GitHub releases
      // (GitHub provides integrity through HTTPS)
      const downloadedHash = await this.calculateFileHash(downloadPath);
      
      this.log('✅ Update downloaded successfully');
      return this.success('Update downloaded successfully', {
        version: updateInfo.version,
        downloadPath,
        hash: downloadedHash,
        size: fs.statSync(downloadPath).size
      });
    } catch (error) {
      return this.error(`Download failed: ${error.message}`);
    }
  }
  
  async installUpdate(version) {
    try {
      this.log(`Installing update: ${version}`);
      
      // Get current executable path
      const currentPath = this.getCurrentExecutablePath();
      const backupPath = path.join(this.backupDir, `agent-backup-${Date.now()}${this.platform === 'win32' ? '.exe' : ''}`);
      
      // Find downloaded update
      const filename = `agent-v2-${version}-${this.platform}-${this.arch}${this.platform === 'win32' ? '.exe' : ''}`;
      const updatePath = path.join(this.tempDir, filename);
      
      if (!fs.existsSync(updatePath)) {
        throw new Error('Update file not found. Run download first.');
      }
      
      // Backup current executable
      this.log('Creating backup...');
      fs.copyFileSync(currentPath, backupPath);
      
      // Stop the agent service
      this.log('Stopping agent service...');
      await this.stopAgentService();
      
      // Replace executable
      this.log('Replacing executable...');
      fs.copyFileSync(updatePath, currentPath);
      
      // Set executable permissions on Unix systems
      if (this.platform !== 'win32') {
        fs.chmodSync(currentPath, 0o755);
      }
      
      // Start the agent service
      this.log('Starting agent service...');
      await this.startAgentService();
      
      // Cleanup
      fs.unlinkSync(updatePath);
      
      this.log('✅ Update installation completed');
      return this.success('Update installed successfully', {
        version,
        backupPath,
        installedAt: new Date().toISOString()
      });
    } catch (error) {
      this.log(`❌ Installation failed: ${error.message}`);
      return this.error(`Installation failed: ${error.message}`);
    }
  }
  
  async rollbackUpdate() {
    try {
      this.log('Rolling back to previous version...');
      
      // Find most recent backup
      const backupFiles = fs.readdirSync(this.backupDir)
        .filter(file => file.startsWith('agent-backup-'))
        .sort((a, b) => {
          const timeA = parseInt(a.split('-')[2]);
          const timeB = parseInt(b.split('-')[2]);
          return timeB - timeA; // Most recent first
        });
      
      if (backupFiles.length === 0) {
        throw new Error('No backup found for rollback');
      }
      
      const latestBackup = path.join(this.backupDir, backupFiles[0]);
      const currentPath = this.getCurrentExecutablePath();
      
      // Stop service
      await this.stopAgentService();
      
      // Restore backup
      fs.copyFileSync(latestBackup, currentPath);
      
      if (this.platform !== 'win32') {
        fs.chmodSync(currentPath, 0o755);
      }
      
      // Start service
      await this.startAgentService();
      
      this.log('✅ Rollback completed');
      return this.success('Rollback completed successfully', {
        restoredFrom: latestBackup
      });
    } catch (error) {
      return this.error(`Rollback failed: ${error.message}`);
    }
  }
  
  async fetchUpdateInfo(version = 'latest') {
    return new Promise((resolve, reject) => {
      // GitHub API endpoint - already set to releases/latest
      const url = this.updateUrl;
      
      const options = {
        headers: {
          'User-Agent': 'EverydayTechAgent-v2',
          'Accept': 'application/vnd.github.v3+json'
        }
      };
      
      https.get(url, options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const release = JSON.parse(data);
            
            // Transform GitHub release format to our expected format
            const updateInfo = {
              version: release.tag_name || release.name,
              name: release.name,
              published: release.published_at,
              notes: release.body,
              downloads: {},
              assets: release.assets
            };
            
            // Map assets to platform keys
            for (const asset of release.assets || []) {
              const name = asset.name.toLowerCase();
              if (name.includes('windows') || name.includes('win')) {
                updateInfo.downloads['win32-x64'] = asset.browser_download_url;
              } else if (name.includes('linux')) {
                updateInfo.downloads['linux-x64'] = asset.browser_download_url;
              } else if (name.includes('macos') || name.includes('darwin')) {
                updateInfo.downloads['darwin-x64'] = asset.browser_download_url;
                updateInfo.downloads['darwin-arm64'] = asset.browser_download_url;
              }
            }
            
            resolve(updateInfo);
          } catch (e) {
            reject(new Error(`Invalid GitHub API response: ${e.message}`));
          }
        });
      }).on('error', reject);
    });
  }
  
  async downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(dest);
      
      https.get(url, (response) => {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      }).on('error', (error) => {
        fs.unlinkSync(dest);
        reject(error);
      });
    });
  }
  
  async calculateFileHash(filePath) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      
      stream.on('data', data => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }
  
  getCurrentVersion() {
    try {
      // Try to get version from package.json or executable
      const packagePath = path.join(process.cwd(), 'package.json');
      if (fs.existsSync(packagePath)) {
        const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
        return pkg.version;
      }
      
      return '2.0.0'; // Fallback
    } catch (e) {
      return '2.0.0';
    }
  }
  
  getCurrentExecutablePath() {
    // Get path to current executable
    if (process.pkg) {
      return process.execPath;
    } else {
      // Development mode
      return path.join(process.cwd(), 'dist', `EverydayTechAgent-v2${this.platform === 'win32' ? '.exe' : ''}`);
    }
  }
  
  getBinaryUrl(updateInfo) {
    const platformKey = `${this.platform}-${this.arch}`;
    return updateInfo.downloads[platformKey];
  }
  
  compareVersions(a, b) {
    const aParts = a.split('.').map(Number);
    const bParts = b.split('.').map(Number);
    
    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const aPart = aParts[i] || 0;
      const bPart = bParts[i] || 0;
      
      if (aPart > bPart) return 1;
      if (aPart < bPart) return -1;
    }
    
    return 0;
  }
  
  async stopAgentService() {
    try {
      if (this.platform === 'win32') {
        execSync('net stop "EverydayTech Agent v2"', { timeout: 10000 });
      } else {
        execSync('systemctl stop everydaytech-agent-v2', { timeout: 10000 });
      }
    } catch (error) {
      this.log(`Service stop warning: ${error.message}`);
    }
  }
  
  async startAgentService() {
    try {
      if (this.platform === 'win32') {
        execSync('net start "EverydayTech Agent v2"', { timeout: 10000 });
      } else {
        execSync('systemctl start everydaytech-agent-v2', { timeout: 10000 });
      }
    } catch (error) {
      throw new Error(`Failed to start service: ${error.message}`);
    }
  }
  
  success(message, data = null) {
    return {
      success: true,
      message,
      data,
      timestamp: new Date().toISOString(),
      version: this.version
    };
  }
  
  error(message, data = null) {
    return {
      success: false,
      error: message,
      data,
      timestamp: new Date().toISOString(),
      version: this.version
    };
  }
}

// Command Line Interface
async function main() {
  const helper = new UpdateHelperV2();
  const action = process.argv[2] || 'check';
  
  let result;
  
  switch (action) {
    case 'check':
      result = await helper.checkForUpdates();
      break;
    case 'download':
      const downloadVersion = process.argv[3] || 'latest';
      result = await helper.downloadUpdate(downloadVersion);
      break;
    case 'install':
      const installVersion = process.argv[3];
      if (!installVersion) {
        console.log('Usage: update-helper install <version>');
        process.exit(1);
      }
      result = await helper.installUpdate(installVersion);
      break;
    case 'rollback':
      result = await helper.rollbackUpdate();
      break;
    case 'update':
      // Complete update process: check -> download -> install
      const updateVersion = process.argv[3] || 'latest';
      
      // Check for updates
      const checkResult = await helper.checkForUpdates();
      if (!checkResult.success || !checkResult.data.hasUpdate) {
        result = checkResult;
        break;
      }
      
      // Download
      const downloadResult = await helper.downloadUpdate(updateVersion);
      if (!downloadResult.success) {
        result = downloadResult;
        break;
      }
      
      // Install
      result = await helper.installUpdate(updateVersion);
      break;
    case '--version':
      result = helper.success(`Update Helper v${helper.version}`);
      break;
    default:
      console.log('Usage: update-helper [check|download|install|rollback|update]');
      process.exit(1);
  }
  
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.success ? 0 : 1);
}

// Export for testing
module.exports = UpdateHelperV2;

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, null, 2));
    process.exit(1);
  });
}