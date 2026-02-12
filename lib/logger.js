/**
 * Logger v2 - Enhanced logging with structured output
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs');
const os = require('os');

function createLogger(module = 'agent-v2', isDev = false) {
  const logsDir = getLogsDirectory();
  
  // Ensure logs directory exists
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  
  const logFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
      const metaString = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
      const stackString = stack ? `\n${stack}` : '';
      return `[${timestamp}] [${level.toUpperCase()}] [${module}] ${message}${metaString}${stackString}`;
    })
  );
  
  const transports = [
    // Main log file
    new winston.transports.File({
      filename: path.join(logsDir, 'agent-v2.log'),
      level: 'info',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      format: logFormat
    }),
    
    // Error log file
    new winston.transports.File({
      filename: path.join(logsDir, 'agent-v2-error.log'),
      level: 'error',
      maxsize: 5 * 1024 * 1024, // 5MB
      maxFiles: 3,
      format: logFormat
    })
  ];
  
  // Add console output in development
  if (isDev) {
    transports.push(
      new winston.transports.Console({
        level: 'debug',
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        )
      })
    );
  }
  
  const logger = winston.createLogger({
    level: isDev ? 'debug' : 'info',
    transports
  });
  
  // Add structured logging methods
  logger.structured = (level, message, data = {}) => {
    logger.log(level, message, { structured: true, ...data });
  };
  
  return logger;
}

function getLogsDirectory() {
  const platform = os.platform();
  
  // Always use system directories (can't write to snapshot)
  if (platform === 'win32') {
    return path.join(process.env.PROGRAMDATA || 'C:\\ProgramData', 'EverydayTech', 'logs');
  } else if (platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'EverydayTech', 'logs');
  } else {
    // Check if running as root/sudo
    if (process.getuid && process.getuid() === 0) {
      return '/var/log/everydaytech';
    }
    // For non-root users
    return path.join(os.homedir(), '.everydaytech', 'logs');
  }
}

module.exports = { createLogger, getLogsDirectory };