# Agent v2 Development Guide

## Quick Start

### Development Setup

```bash
cd agent-v2
npm install
npm run dev
```

### Building for Production

```bash
# Build everything
npm run build:all

# Build just the core agent
npm run build:core

# Build just the helpers
npm run build:helpers
```

### Testing

```bash
# Test the core agent
npm run test:core

# Test helper capabilities
node test/helpers.test.js

# Manual testing
npm run dev
```

## Architecture Overview

Agent v2 implements a **helper-based architecture** that solves the Windows service limitations discovered in v1:

```
Core Service (Lightweight)
    ↓
IPC Layer (Communication)
    ↓
Helper Applications (Elevated)
```

### Key Components

1. **Core Service** (`lib/core.js`)
   - Lightweight service for communication
   - No privileged operations
   - Coordinates with helpers via IPC

2. **IPC Manager** (`lib/ipc/manager.js`)
   - Handles communication with helpers
   - Timeout and retry logic
   - Process management

3. **Helper Applications** (`helpers/`)
   - **rdp-helper-v2**: Remote desktop setup
   - **system-helper**: System operations
   - **update-helper**: Agent updates

4. **Plugin System** (`plugins/`)
   - Updated to use helper architecture
   - Backward compatible with v1 plugins

## Development Workflow

### 1. Core Service Development

The core service is in `lib/core.js`. It's designed to be lightweight and never perform privileged operations directly.

**Key principles:**
- No `execSync` calls for system modifications
- All privileged operations go through helpers
- Graceful failure handling when helpers unavailable

### 2. Helper Development

Helpers are standalone executables in `helpers/`. Each helper:

- Is a complete Node.js script
- Can be compiled with `pkg`
- Runs with elevated privileges when needed
- Returns structured JSON responses

**Helper template:**
```javascript
class HelperV2 {
  constructor() {
    this.version = '2.0.0';
    // Setup logging, etc.
  }
  
  async performAction(params) {
    try {
      // Do privileged operation
      return this.success('Operation completed', data);
    } catch (error) {
      return this.error(`Operation failed: ${error.message}`);
    }
  }
  
  success(message, data = null) {
    return { success: true, message, data, timestamp: new Date().toISOString() };
  }
  
  error(message, data = null) {
    return { success: false, error: message, data, timestamp: new Date().toISOString() };
  }
}
```

### 3. Plugin Development

Plugins now receive an `ipcManager` instance to communicate with helpers:

```javascript
class MyPluginV2 {
  constructor(logger, ipcManager) {
    this.logger = logger;
    this.ipc = ipcManager;
  }
  
  async doSomething() {
    const result = await this.ipc.executeHelper('system-helper', ['action', 'param']);
    return result;
  }
}
```

### 4. Testing Helpers

Test helpers individually:

```bash
# Test RDP helper
node helpers/rdp-helper-v2.js status

# Test system helper
node helpers/system-helper.js info

# Test update helper
node helpers/update-helper.js check
```

## Configuration

Agent v2 uses a JSON configuration file located at:

- **Windows**: `C:\\ProgramData\\EverydayTech\\config\\agent-v2.json`
- **macOS**: `~/Library/Application Support/EverydayTech/agent-v2.json`
- **Linux**: `/etc/everydaytech/agent-v2.json`

### Default Configuration

```json
{
  "version": "2.0.0",
  "agentId": "auto-generated-uuid",
  "backendUrl": "https://everydaytech.au/api",
  "websocketUrl": "wss://everydaytech.au/api/agent/ws",
  "updateInterval": 60000,
  "heartbeatInterval": 30000,
  "helpers": {
    "timeout": 30000,
    "retryAttempts": 2,
    "enabled": ["rdp-helper", "system-helper", "update-helper"]
  }
}
```

## Debugging

### Enable Debug Logging

```bash
# Run with debug logging
npm run dev

# Or set environment variable
NODE_ENV=development node lib/start.js --dev
```

### Check Helper Status

```javascript
// From within the agent
const status = await this.ipc.executeHelper('rdp-helper-v2', ['--version']);
```

### View Logs

- **Agent logs**: `logs/agent-v2.log`
- **Helper logs**: `C:\\ProgramData\\EverydayTech\\logs\\*-helper.log`

## Deployment

### Manual Deployment

1. Build the agent and helpers
2. Copy to target machine
3. Install as service
4. Configure backend connection

```bash
npm run build:all
npm run package

# On target machine
./install.bat  # Windows
./install.sh   # Linux/macOS
```

### Automated Deployment

The build process creates packages for each platform:

- `EverydayTechAgent-v2-2.0.0-win32.zip`
- `EverydayTechAgent-v2-2.0.0-linux.zip`
- `EverydayTechAgent-v2-2.0.0-darwin.zip`

Each package includes:
- Core agent binary
- All helper binaries
- Installation scripts
- Configuration templates

## Troubleshooting

### Service Won't Start

1. Check logs in `logs/agent-v2.log`
2. Verify configuration file exists and is valid
3. Test helpers individually
4. Check network connectivity to backend

### Helpers Not Working

1. Verify helper binaries exist and are executable
2. Test helper individually: `rdp-helper-v2.exe status`
3. Check helper logs
4. Verify elevated privileges for system operations

### Plugin Errors

1. Check if plugin is using helper architecture correctly
2. Verify IPC communication is working
3. Test plugin actions individually

### Connection Issues

1. Check WebSocket URL configuration
2. Verify backend is accessible
3. Check firewall settings
4. Review authentication tokens

## Common Development Tasks

### Adding a New Helper

1. Create helper script in `helpers/`
2. Follow the helper template pattern
3. Add to build script
4. Update plugin to use new helper
5. Test individually and integrated

### Updating Plugins

1. Modify plugin to use `ipcManager`
2. Replace direct system calls with helper calls
3. Update error handling for helper responses
4. Test with and without helpers available

### Modifying Core Service

1. Keep service lightweight
2. No privileged operations in core
3. Use configuration manager for settings
4. Maintain WebSocket connectivity
5. Handle helper failures gracefully

## Performance Considerations

### Helper Execution

- Helpers have startup overhead
- Use caching for frequent operations
- Batch operations when possible
- Set appropriate timeouts

### Memory Usage

- Core service should remain lightweight
- Helpers are short-lived processes
- Monitor memory usage in production
- Implement cleanup routines

### Network Efficiency

- Batch WebSocket messages when possible
- Use heartbeat for keep-alive
- Implement reconnection logic
- Handle offline scenarios

## Security

### Helper Security

- Helpers run with elevated privileges
- Validate all input parameters
- Log all privileged operations
- Implement timeout limits

### Communication Security

- Use HTTPS/WSS for backend communication
- Encrypt sensitive data in transit
- Validate all incoming messages
- Implement authentication tokens

### File System Security

- Use secure paths for logs and config
- Set appropriate file permissions
- Protect helper binaries
- Clean up temporary files

## Next Steps

1. **Production Testing**: Test on various Windows versions and configurations
2. **Performance Optimization**: Profile and optimize helper execution times
3. **Additional Helpers**: Create more specialized helpers as needed
4. **Monitoring**: Implement comprehensive health monitoring
5. **Documentation**: Create user installation and configuration guides

This architecture solves the fundamental Windows service limitations while maintaining all the functionality of v1 with improved reliability and security.