/**
 * Command Executor v2 - Handles remote command execution
 */

const { exec } = require('child_process');
const os = require('os');

class CommandExecutor {
  constructor(logger, wsClient) {
    this.logger = logger;
    this.ws = wsClient;
    this.activeExecutions = new Map();
  }
  
  /**
   * Execute script with output streaming
   * Matches v1 implementation
   */
  executeScript(execution_id, script_id, code) {
    this.logger.info(`Executing script ${script_id} (execution: ${execution_id})`);
    
    const platform = os.platform();
    let shell, args;
    
    if (platform === 'win32') {
      shell = 'powershell';
      args = ['-Command', code];
    } else {
      shell = 'bash';
      args = ['-c', code];
    }
    
    const command = `${shell} ${args.map(a => `"${a.replace(/"/g, '\\"')}"`).join(' ')}`;
    const proc = exec(command, {
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      timeout: 300000 // 5 minute timeout
    });
    
    this.activeExecutions.set(execution_id, { process: proc, script_id });
    
    // Stream stdout
    proc.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (line.trim()) {
          this.send({
            type: 'script_output',
            execution_id,
            line: line.trim(),
            timestamp: Date.now()
          });
        }
      }
    });
    
    // Stream stderr
    proc.stderr.on('data', (data) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (line.trim()) {
          this.send({
            type: 'script_output',
            execution_id,
            line: `[ERROR] ${line.trim()}`,
            timestamp: Date.now()
          });
        }
      }
    });
    
    // Handle completion
    proc.on('close', (exit_code) => {
      this.logger.info(`Script execution ${execution_id} completed with code ${exit_code}`);
      this.send({
        type: 'script_complete',
        execution_id,
        exit_code,
        timestamp: Date.now()
      });
      this.activeExecutions.delete(execution_id);
    });
    
    // Handle errors
    proc.on('error', (err) => {
      this.logger.error(`Script execution ${execution_id} failed:`, err.message);
      this.send({
        type: 'script_error',
        execution_id,
        error: err.message,
        timestamp: Date.now()
      });
      this.activeExecutions.delete(execution_id);
    });
  }
  
  /**
   * Kill a specific execution
   */
  killExecution(execution_id) {
    const execution = this.activeExecutions.get(execution_id);
    if (execution && execution.process) {
      this.logger.info(`Killing execution ${execution_id}`);
      execution.process.kill();
      this.activeExecutions.delete(execution_id);
      return { success: true };
    }
    return { success: false, error: 'Execution not found' };
  }
  
  /**
   * Cleanup all active executions
   */
  cleanup() {
    this.logger.info('Cleaning up active executions');
    for (const [execution_id, execution] of this.activeExecutions.entries()) {
      if (execution.process) {
        execution.process.kill();
      }
      this.activeExecutions.delete(execution_id);
    }
  }
  
  /**
   * Send message via WebSocket
   */
  send(message) {
    if (this.ws && this.ws.isConnected) {
      this.ws.send(message);
    } else {
      this.logger.warn('Cannot send script output - WebSocket not connected');
    }
  }
  
  /**
   * Get status of all active executions
   */
  getStatus() {
    return {
      active: this.activeExecutions.size,
      executions: Array.from(this.activeExecutions.keys())
    };
  }
}

module.exports = { CommandExecutor };
