# Agent v2 - Helper-Based Architecture

## Overview

Agent v2 addresses the fundamental Windows service limitations discovered in v1 by implementing a clean separation between the core service and privileged operations.

## Key Improvements from v1

### 1. **Service Isolation**
- Core service remains lightweight and stable
- No direct system modifications from service context
- Proper privilege separation

### 2. **Helper Architecture**
- Dedicated helper executables for privileged operations
- Clean IPC communication between service and helpers
- Timeout and error handling for helper operations

### 3. **Reliability**
- Service failures don't cascade to helpers
- Helper failures don't crash main service
- Proper error recovery mechanisms

### 4. **Security**
- Minimal attack surface in core service
- Helpers run only when needed
- Proper permission boundaries

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Agent v2 Service                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Core Service                            │   │
│  │  • WebSocket Communication                          │   │
│  │  • Configuration Management                         │   │
│  │  • Plugin Coordination                             │   │
│  │  • Helper Process Management                       │   │
│  │  • Status Monitoring                               │   │
│  └─────────────────────────────────────────────────────┘   │
│                           │                                 │
│                           ▼                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           IPC Communication Layer                   │   │
│  │  • Named Pipes / Local Sockets                     │   │
│  │  • Command Queue Management                        │   │
│  │  • Response Handling                               │   │
│  │  • Timeout Management                              │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                  Helper Applications                        │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌────────┐ │
│  │RDP Helper   │ │System Helper│ │Update Helper│ │ Others │ │
│  │• Enable RDP │ │• Registry   │ │• Download   │ │• VNC   │ │
│  │• Config FW  │ │• Services   │ │• Install    │ │• SSH   │ │
│  │• Test Conn  │ │• Features   │ │• Restart    │ │• More  │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Components

### Core Service (`agent-v2.js`)
- Maintains connection to backend
- Coordinates with helper applications
- Manages agent state and configuration
- Handles non-privileged operations

### Helper Applications (`helpers/`)
- **RDP Helper**: Remote desktop setup and configuration
- **System Helper**: Registry, services, and system configuration
- **Update Helper**: Agent updates and binary replacement
- **VNC Helper**: VNC setup for Linux/macOS
- **RustDesk Helper**: RustDesk configuration and management

### IPC Layer (`lib/ipc/`)
- Command execution framework
- Response handling
- Error recovery
- Timeout management

### Plugin System (`plugins/`)
- Updated plugins that use helper architecture
- Backward compatibility with v1 plugins
- Enhanced error handling

## Benefits

1. **Service Stability**: Core service remains stable even if helpers fail
2. **Proper Privileges**: Helpers run with necessary elevation only when needed
3. **Security**: Reduced attack surface in core service
4. **Flexibility**: Easy to add new helpers without service changes
5. **Debugging**: Clear separation makes troubleshooting easier
6. **Deployment**: Modular approach to installation and updates

## Migration from v1

- Core service logic preserved
- Plugins updated to use helper architecture
- Configuration compatibility maintained
- Gradual migration path available

## Status

- ✅ Architecture designed
- 🚧 Implementation in progress
- ⏳ Testing pending
- ⏳ Deployment pending