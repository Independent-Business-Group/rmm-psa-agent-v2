/**
 * Plugin Manager v2 - Manages plugins with helper integration
 */

const fs = require('fs');
const path = require('path');

class PluginManager {
  constructor(logger, ipcManager) {
    this.logger = logger;
    this.ipc = ipcManager;
    this.plugins = new Map();
    this.pluginsPath = path.join(__dirname, '..', 'plugins');
  }
  
  async loadPlugins() {
    try {
      if (!fs.existsSync(this.pluginsPath)) {
        this.logger.warn(`Plugins directory not found: ${this.pluginsPath}`);
        return;
      }
      
      const pluginFiles = fs.readdirSync(this.pluginsPath)
        .filter(file => file.endsWith('.js'))
        .filter(file => !file.startsWith('.'));
      
      this.logger.info(`Loading ${pluginFiles.length} plugins...`);
      
      for (const file of pluginFiles) {
        await this.loadPlugin(file);
      }
      
      this.logger.info(`Loaded ${this.plugins.size} plugins successfully`);
    } catch (error) {
      this.logger.error('Failed to load plugins:', error);
    }
  }
  
  async loadPlugin(filename) {
    try {
      const pluginPath = path.join(this.pluginsPath, filename);
      const pluginName = path.basename(filename, '.js');
      
      // Clear require cache to allow reloading
      delete require.cache[require.resolve(pluginPath)];
      
      const PluginClass = require(pluginPath);
      const plugin = new PluginClass(this.logger, this.ipc);
      
      // Initialize plugin if it has an init method
      if (typeof plugin.initialize === 'function') {
        await plugin.initialize();
      }
      
      this.plugins.set(pluginName, plugin);
      this.logger.info(`✅ Plugin loaded: ${pluginName}`);
      
    } catch (error) {
      this.logger.error(`❌ Failed to load plugin ${filename}:`, error);
    }
  }
  
  async executePlugin(pluginName, action, parameters = {}) {
    try {
      const plugin = this.plugins.get(pluginName);
      
      if (!plugin) {
        throw new Error(`Plugin not found: ${pluginName}`);
      }
      
      if (typeof plugin[action] !== 'function') {
        throw new Error(`Action not found: ${pluginName}.${action}`);
      }
      
      this.logger.debug(`Executing plugin: ${pluginName}.${action}`);
      
      const result = await plugin[action](parameters);
      
      this.logger.debug(`Plugin executed successfully: ${pluginName}.${action}`);
      return {
        success: true,
        plugin: pluginName,
        action: action,
        data: result
      };
      
    } catch (error) {
      this.logger.error(`Plugin execution failed: ${pluginName}.${action}`, error);
      return {
        success: false,
        plugin: pluginName,
        action: action,
        error: error.message
      };
    }
  }
  
  async unloadPlugins() {
    this.logger.info('Unloading plugins...');
    
    for (const [name, plugin] of this.plugins) {
      try {
        if (typeof plugin.cleanup === 'function') {
          await plugin.cleanup();
        }
        this.logger.debug(`Plugin unloaded: ${name}`);
      } catch (error) {
        this.logger.error(`Failed to unload plugin ${name}:`, error);
      }
    }
    
    this.plugins.clear();
    this.logger.info('All plugins unloaded');
  }
  
  getLoadedPlugins() {
    return Array.from(this.plugins.keys());
  }
  
  getPluginInfo(pluginName) {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      return null;
    }
    
    return {
      name: pluginName,
      loaded: true,
      version: plugin.version || '1.0.0',
      description: plugin.description || 'No description available',
      actions: Object.getOwnPropertyNames(Object.getPrototypeOf(plugin))
        .filter(name => name !== 'constructor' && typeof plugin[name] === 'function')
    };
  }
  
  getAllPluginInfo() {
    const info = {};
    
    for (const pluginName of this.plugins.keys()) {
      info[pluginName] = this.getPluginInfo(pluginName);
    }
    
    return info;
  }
}

module.exports = { PluginManager };