/**
 * IPC Manager - Handles communication with helper applications
 * 
 * This module provides a clean interface for executing helper applications
 * with proper timeout, error handling, and response parsing.
 */

const os = require('os');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');

class IPCManager {
  constructor(logger, options = {}) {
    this.logger = logger;
    this.options = {
      timeout: options.timeout || 30000,
      retryAttempts: options.retryAttempts || 2,
      helpersPath: options.helpersPath || this.getDefaultHelpersPath(),
      ...options
    };
    
    this.activeCommands = new Map();
    this.isInitialized = false;
  }
  
  getDefaultHelpersPath() {
    const platform = os.platform();
    const agentDir = path.dirname(path.dirname(__dirname));
    
    if (platform === 'win32') {
      return path.join(agentDir, 'helpers');
    } else {
      return path.join(agentDir, 'helpers');
    }
  }
  
  async initialize() {
    this.logger.info('Initializing IPC Manager...');
    
    // Ensure helpers directory exists
    if (!fs.existsSync(this.options.helpersPath)) {
      this.logger.warn(`Helpers path does not exist: ${this.options.helpersPath}`);
      fs.mkdirSync(this.options.helpersPath, { recursive: true });
    }
    
    this.isInitialized = true;
    this.logger.info(`IPC Manager initialized. Helpers path: ${this.options.helpersPath}`);
  }
  
  async executeHelper(helperName, args = [], options = {}) {
    if (!this.isInitialized) {
      throw new Error('IPC Manager not initialized');
    }
    
    const commandId = uuidv4();
    const timeout = options.timeout || this.options.timeout;
    const retryAttempts = options.retryAttempts || this.options.retryAttempts;
    
    this.logger.debug(`Executing helper: ${helperName} ${args.join(' ')} [${commandId}]`);
    
    let lastError;
    for (let attempt = 0; attempt <= retryAttempts; attempt++) {
      try {
        const result = await this._executeHelperOnce(helperName, args, { ...options, commandId, timeout });
        
        if (attempt > 0) {
          this.logger.info(`Helper succeeded on attempt ${attempt + 1}: ${helperName}`);
        }
        
        return result;
      } catch (error) {
        lastError = error;
        
        if (attempt < retryAttempts) {
          this.logger.warn(`Helper attempt ${attempt + 1} failed, retrying: ${error.message}`);
          await this._delay(1000 * (attempt + 1)); // Progressive delay
        }
      }
    }
    
    this.logger.error(`Helper failed after ${retryAttempts + 1} attempts: ${helperName}`);
    throw lastError;
  }
  
  async _executeHelperOnce(helperName, args, options) {
    const { commandId, timeout } = options;
    const helperPath = this.getHelperPath(helperName);
    
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      // Check if helper exists
      if (!fs.existsSync(helperPath)) {
        reject(new Error(`Helper not found: ${helperPath}`));
        return;
      }
      
      // Spawn helper process
      const child = spawn(helperPath, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true
      });
      
      let stdout = '';
      let stderr = '';
      let isResolved = false;
      
      // Store active command for cleanup
      this.activeCommands.set(commandId, {
        process: child,
        startTime,
        helperName,
        args
      });
      
      // Collect output
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      // Handle process completion
      child.on('close', (code) => {
        if (isResolved) return;
        isResolved = true;
        
        const executionTime = Date.now() - startTime;
        this.activeCommands.delete(commandId);
        
        this.logger.debug(`Helper completed: ${helperName} [${commandId}] in ${executionTime}ms, exit code: ${code}`);
        
        if (code === 0) {
          try {
            // Try to parse JSON response
            const result = this._parseHelperResponse(stdout);
            resolve(result);
          } catch (parseError) {
            // If JSON parsing fails, return raw output
            resolve({
              success: true,
              message: stdout.trim(),
              rawOutput: stdout,
              executionTime
            });
          }
        } else {
          reject(new Error(`Helper exited with code ${code}: ${stderr.trim() || stdout.trim()}`));
        }
      });
      
      // Handle process errors
      child.on('error', (error) => {
        if (isResolved) return;
        isResolved = true;
        
        this.activeCommands.delete(commandId);
        this.logger.error(`Helper process error: ${helperName} [${commandId}]`, error);
        reject(new Error(`Helper process error: ${error.message}`));
      });
      
      // Handle timeout
      const timeoutHandle = setTimeout(() => {
        if (isResolved) return;
        isResolved = true;
        
        this.logger.warn(`Helper timeout: ${helperName} [${commandId}] after ${timeout}ms`);
        
        // Kill the process
        if (!child.killed) {
          child.kill('SIGTERM');
          
          // Force kill if SIGTERM doesn't work
          setTimeout(() => {
            if (!child.killed) {
              child.kill('SIGKILL');
            }
          }, 5000);
        }
        
        this.activeCommands.delete(commandId);
        reject(new Error(`Helper timeout after ${timeout}ms`));
      }, timeout);
      
      // Clear timeout if process completes
      child.on('close', () => {
        clearTimeout(timeoutHandle);
      });
    });
  }
  
  getHelperPath(helperName) {
    const platform = os.platform();
    const extension = platform === 'win32' ? '.exe' : '';
    
    return path.join(this.options.helpersPath, `${helperName}${extension}`);
  }
  
  _parseHelperResponse(output) {
    // Try to parse as JSON
    try {
      return JSON.parse(output.trim());
    } catch {
      // If not JSON, try to find JSON in output
      const lines = output.split('\n');
      for (const line of lines) {
        try {
          const trimmed = line.trim();
          if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            return JSON.parse(trimmed);
          }
        } catch {
          continue;
        }
      }
      
      // If no JSON found, return as success with message
      return {
        success: true,
        message: output.trim()
      };
    }
  }
  
  async _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  getActiveCommands() {
    return Array.from(this.activeCommands.entries()).map(([id, command]) => ({
      id,
      helperName: command.helperName,
      args: command.args,
      startTime: command.startTime,
      duration: Date.now() - command.startTime
    }));
  }
  
  async killCommand(commandId) {
    const command = this.activeCommands.get(commandId);
    if (!command) {
      return false;
    }
    
    this.logger.info(`Killing command: ${command.helperName} [${commandId}]`);
    
    if (!command.process.killed) {
      command.process.kill('SIGTERM');
      
      // Force kill after 5 seconds
      setTimeout(() => {
        if (!command.process.killed) {
          command.process.kill('SIGKILL');
        }
      }, 5000);
    }
    
    this.activeCommands.delete(commandId);
    return true;
  }
  
  async shutdown() {
    this.logger.info('Shutting down IPC Manager...');
    
    // Kill all active commands
    for (const [commandId] of this.activeCommands) {
      await this.killCommand(commandId);
    }
    
    this.isInitialized = false;
    this.logger.info('IPC Manager shut down');
  }
}

module.exports = { IPCManager };