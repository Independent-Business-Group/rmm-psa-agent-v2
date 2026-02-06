# EverydayTech Agent v2 - Installation & Deployment Guide

## Overview

Agent v2 addresses the fundamental Windows service limitations through a helper-based architecture. This guide covers installation, configuration, and deployment.

## Installation Methods

### Method 1: Pre-built Packages (Recommended)

1. **Download the appropriate package for your platform:**
   - Windows: `EverydayTechAgent-v2-2.0.0-win32.zip`
   - Linux: `EverydayTechAgent-v2-2.0.0-linux.zip`
   - macOS: `EverydayTechAgent-v2-2.0.0-darwin.zip`

2. **Extract the package to a temporary location**

3. **Run the installer:**
   - Windows: Right-click `install.bat` → "Run as administrator"
   - Linux/macOS: `sudo ./install.sh`

### Method 2: Manual Installation

#### Windows

```batch
:: 1. Create directories
mkdir "C:\\Program Files\\EverydayTech\\Agent"
mkdir "C:\\Program Files\\EverydayTech\\Agent\\helpers"
mkdir "C:\\ProgramData\\EverydayTech\\logs"
mkdir "C:\\ProgramData\\EverydayTech\\config"

:: 2. Copy files
copy EverydayTechAgent-v2.exe "C:\\Program Files\\EverydayTech\\Agent\\"
copy helpers\\*.exe "C:\\Program Files\\EverydayTech\\Agent\\helpers\\"

:: 3. Install service
"C:\\Program Files\\EverydayTech\\Agent\\EverydayTechAgent-v2.exe" --install-service

:: 4. Start service
net start "EverydayTech Agent v2"
```

#### Linux/macOS

```bash
# 1. Create directories
sudo mkdir -p /opt/everydaytech/agent
sudo mkdir -p /opt/everydaytech/agent/helpers
sudo mkdir -p /var/log/everydaytech
sudo mkdir -p /etc/everydaytech

# 2. Copy files
sudo cp EverydayTechAgent-v2 /opt/everydaytech/agent/
sudo cp helpers/* /opt/everydaytech/agent/helpers/

# 3. Set permissions
sudo chmod +x /opt/everydaytech/agent/EverydayTechAgent-v2
sudo chmod +x /opt/everydaytech/agent/helpers/*

# 4. Install systemd service
sudo /opt/everydaytech/agent/EverydayTechAgent-v2 --install-service

# 5. Start service
sudo systemctl start everydaytech-agent-v2
sudo systemctl enable everydaytech-agent-v2
```

## Configuration

### Initial Configuration

Create the configuration file at:
- Windows: `C:\\ProgramData\\EverydayTech\\config\\agent-v2.json`
- Linux: `/etc/everydaytech/agent-v2.json`
- macOS: `/etc/everydaytech/agent-v2.json`

### Basic Configuration

```json
{
  "version": "2.0.0",
  "backendUrl": "https://everydaytech.au/api",
  "websocketUrl": "wss://everydaytech.au/api/agent/ws",
  "agentId": "auto-generated-on-first-run",
  "updateInterval": 60000,
  "heartbeatInterval": 30000,
  "logLevel": "info",
  "helpers": {
    "timeout": 30000,
    "retryAttempts": 2,
    "enabled": [
      "rdp-helper-v2",
      "system-helper", 
      "update-helper"
    ]
  },
  "features": {
    "remoteDesktop": true,
    "systemInfo": true,
    "processManagement": true,
    "fileTransfer": true
  }
}
```

### Advanced Configuration

```json
{
  "security": {
    "encryptCommunication": true,
    "allowRemoteExecution": true,
    "allowSystemModifications": false
  },
  "plugins": {
    "autoLoad": true,
    "enabled": ["guacamole", "rustdesk"]
  },
  "helpers": {
    "helpersPath": "/custom/path/to/helpers",
    "timeout": 45000,
    "retryAttempts": 3,
    "enabled": [
      "rdp-helper-v2",
      "system-helper",
      "update-helper",
      "vnc-helper",
      "rustdesk-helper"
    ]
  }
}
```

## Service Management

### Windows

```batch
:: Start service
net start "EverydayTech Agent v2"

:: Stop service
net stop "EverydayTech Agent v2"

:: Service status
sc query "EverydayTech Agent v2"

:: Uninstall service
"C:\\Program Files\\EverydayTech\\Agent\\EverydayTechAgent-v2.exe" --uninstall-service
```

### Linux/macOS

```bash
# Start service
sudo systemctl start everydaytech-agent-v2

# Stop service
sudo systemctl stop everydaytech-agent-v2

# Service status
sudo systemctl status everydaytech-agent-v2

# Enable auto-start
sudo systemctl enable everydaytech-agent-v2

# View logs
sudo journalctl -u everydaytech-agent-v2 -f

# Uninstall service
sudo systemctl stop everydaytech-agent-v2
sudo systemctl disable everydaytech-agent-v2
sudo rm /etc/systemd/system/everydaytech-agent-v2.service
sudo systemctl daemon-reload
```

## Verification & Testing

### 1. Service Status Check

**Windows:**
```batch
sc query "EverydayTech Agent v2"
```

**Linux/macOS:**
```bash
sudo systemctl status everydaytech-agent-v2
```

### 2. Log Analysis

**Windows:**
```batch
type "C:\\ProgramData\\EverydayTech\\logs\\agent-v2.log"
```

**Linux/macOS:**
```bash
tail -f /var/log/everydaytech/agent-v2.log
```

### 3. Helper Testing

Test helpers individually to ensure they're working:

```bash
# Windows
"C:\\Program Files\\EverydayTech\\Agent\\helpers\\rdp-helper-v2.exe" status
"C:\\Program Files\\EverydayTech\\Agent\\helpers\\system-helper.exe" info

# Linux/macOS
/opt/everydaytech/agent/helpers/rdp-helper-v2 status
/opt/everydaytech/agent/helpers/system-helper info
```

### 4. Backend Connectivity

Check if the agent can connect to your backend:

```bash
# Test WebSocket connection
curl -I https://everydaytech.au/api/agent/ws

# Check agent registration endpoint
curl -X POST https://everydaytech.au/api/agent/register
```

## Troubleshooting

### Common Issues

#### 1. Service Won't Start

**Symptoms:** Service fails to start or immediately stops

**Solutions:**
1. Check configuration file exists and is valid JSON
2. Verify backend URL is accessible
3. Check log files for specific errors
4. Ensure proper file permissions

#### 2. Helpers Not Working

**Symptoms:** Remote desktop or system operations fail

**Solutions:**
1. Test helpers individually
2. Check if running with elevated privileges
3. Verify helper binaries are not corrupted
4. Check antivirus quarantine

#### 3. Connection Issues

**Symptoms:** Agent appears offline in dashboard

**Solutions:**
1. Verify network connectivity
2. Check firewall settings
3. Validate WebSocket URL configuration
4. Test backend accessibility

#### 4. High Resource Usage

**Symptoms:** Agent consuming excessive CPU/memory

**Solutions:**
1. Reduce update and heartbeat intervals
2. Check for helper process leaks
3. Review log files for repeated errors
4. Monitor plugin performance

### Log Analysis

**Agent startup logs should show:**
```
[2026-01-16T10:00:00.000Z] [INFO] [agent-v2] 🚀 Starting EverydayTech Agent v2...
[2026-01-16T10:00:00.100Z] [INFO] [agent-v2] Agent ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
[2026-01-16T10:00:00.200Z] [INFO] [agent-v2] Initializing IPC manager...
[2026-01-16T10:00:00.300Z] [INFO] [agent-v2] ✅ rdp-helper-v2: Available
[2026-01-16T10:00:00.400Z] [INFO] [agent-v2] ✅ system-helper: Available
[2026-01-16T10:00:00.500Z] [INFO] [agent-v2] 🔗 Connected to backend
[2026-01-16T10:00:00.600Z] [INFO] [agent-v2] ✅ Agent v2 started successfully
```

### Diagnostic Commands

```bash
# Check agent process
# Windows
tasklist | findstr EverydayTech

# Linux/macOS
ps aux | grep EverydayTech

# Check listening ports
# Windows
netstat -an | findstr :80

# Linux/macOS
netstat -an | grep :80

# Test helper availability
# Windows
"C:\\Program Files\\EverydayTech\\Agent\\helpers\\rdp-helper-v2.exe" --version

# Linux/macOS
/opt/everydaytech/agent/helpers/rdp-helper-v2 --version
```

## Uninstallation

### Complete Removal

#### Windows

```batch
:: Stop and remove service
net stop "EverydayTech Agent v2"
"C:\\Program Files\\EverydayTech\\Agent\\EverydayTechAgent-v2.exe" --uninstall-service

:: Remove files
rmdir /S "C:\\Program Files\\EverydayTech"
rmdir /S "C:\\ProgramData\\EverydayTech"
```

#### Linux/macOS

```bash
# Stop and remove service
sudo systemctl stop everydaytech-agent-v2
sudo systemctl disable everydaytech-agent-v2
sudo rm /etc/systemd/system/everydaytech-agent-v2.service
sudo systemctl daemon-reload

# Remove files
sudo rm -rf /opt/everydaytech
sudo rm -rf /var/log/everydaytech
sudo rm -rf /etc/everydaytech
```

## Updates

### Automatic Updates

Agent v2 supports automatic updates through the update helper:

1. Backend pushes update notification
2. Agent downloads new version using update-helper
3. Update helper replaces binaries and restarts service
4. Agent verifies successful update

### Manual Updates

1. Download new Agent v2 package
2. Stop the agent service
3. Replace binaries
4. Start the agent service

```bash
# Stop service
sudo systemctl stop everydaytech-agent-v2

# Backup current version
sudo cp /opt/everydaytech/agent/EverydayTechAgent-v2 /opt/everydaytech/agent/EverydayTechAgent-v2.backup

# Replace with new version
sudo cp EverydayTechAgent-v2 /opt/everydaytech/agent/
sudo chmod +x /opt/everydaytech/agent/EverydayTechAgent-v2

# Start service
sudo systemctl start everydaytech-agent-v2
```

## Security Considerations

1. **Run with minimum required privileges**
2. **Use HTTPS/WSS for all communications**
3. **Regularly update agent and helpers**
4. **Monitor log files for suspicious activity**
5. **Restrict helper execution to trusted operations**
6. **Use firewall rules to limit network access**
7. **Encrypt sensitive configuration data**

## Support

For support and troubleshooting:

1. Check log files first
2. Test individual components
3. Verify configuration
4. Contact support with diagnostic information

**Diagnostic Information to Collect:**
- Agent version and platform
- Configuration file (sanitized)
- Recent log entries
- Service status
- Helper test results
- Network connectivity tests