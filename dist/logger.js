"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = exports.LogLevel = void 0;
exports.getLogger = getLogger;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
/**
 * 日志级别
 */
var LogLevel;
(function (LogLevel) {
    LogLevel["INFO"] = "INFO";
    LogLevel["SUCCESS"] = "SUCCESS";
    LogLevel["WARNING"] = "WARNING";
    LogLevel["ERROR"] = "ERROR";
    LogLevel["DEBUG"] = "DEBUG";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
/**
 * 日志记录器
 * 职责: 记录程序运行的关键动作和结果
 */
class Logger {
    constructor(logDir = './logs', enableConsole = true, enableFile = true) {
        this.logDir = logDir;
        this.logFile = path.join(logDir, `app-${this.formatDate(new Date())}.log`);
        this.enableConsole = enableConsole;
        this.enableFile = enableFile;
    }
    /**
     * 初始化日志目录
     */
    async init() {
        if (this.enableFile) {
            try {
                await fs.mkdir(this.logDir, { recursive: true });
            }
            catch (error) {
                console.error('创建日志目录失败:', error);
            }
        }
    }
    /**
     * 记录信息日志
     */
    async info(message, data) {
        await this.log(LogLevel.INFO, message, data);
    }
    /**
     * 记录成功日志
     */
    async success(message, data) {
        await this.log(LogLevel.SUCCESS, message, data);
    }
    /**
     * 记录警告日志
     */
    async warning(message, data) {
        await this.log(LogLevel.WARNING, message, data);
    }
    /**
     * 记录错误日志
     */
    async error(message, error) {
        const errorData = error
            ? {
                message: error.message,
                stack: error.stack,
                ...error,
            }
            : undefined;
        await this.log(LogLevel.ERROR, message, errorData);
    }
    /**
     * 记录调试日志
     */
    async debug(message, data) {
        await this.log(LogLevel.DEBUG, message, data);
    }
    /**
     * 核心日志方法
     */
    async log(level, message, data) {
        const timestamp = this.formatTimestamp(new Date());
        const logEntry = this.formatLogEntry(timestamp, level, message, data);
        // 控制台输出
        if (this.enableConsole) {
            this.printToConsole(level, logEntry);
        }
        // 文件输出
        if (this.enableFile) {
            await this.writeToFile(logEntry);
        }
    }
    /**
     * 格式化日志条目
     */
    formatLogEntry(timestamp, level, message, data) {
        let entry = `[${timestamp}] [${level}] ${message}`;
        if (data !== undefined) {
            try {
                entry += `\n  数据: ${JSON.stringify(data, null, 2)}`;
            }
            catch (error) {
                entry += `\n  数据: [无法序列化]`;
            }
        }
        return entry;
    }
    /**
     * 控制台输出
     */
    printToConsole(level, message) {
        const icon = this.getLevelIcon(level);
        const coloredMessage = this.colorize(level, `${icon} ${message}`);
        console.log(coloredMessage);
    }
    /**
     * 写入文件
     */
    async writeToFile(message) {
        try {
            await fs.appendFile(this.logFile, message + '\n', 'utf-8');
        }
        catch (error) {
            console.error('写入日志文件失败:', error);
        }
    }
    /**
     * 获取日志级别对应的图标
     */
    getLevelIcon(level) {
        const icons = {
            [LogLevel.INFO]: 'ℹ️',
            [LogLevel.SUCCESS]: '✅',
            [LogLevel.WARNING]: '⚠️',
            [LogLevel.ERROR]: '❌',
            [LogLevel.DEBUG]: '🔍',
        };
        return icons[level];
    }
    /**
     * 颜色化输出 (仅用于控制台)
     */
    colorize(level, message) {
        // 简化版本,不使用颜色库
        return message;
    }
    /**
     * 格式化时间戳
     */
    formatTimestamp(date) {
        const y = date.getFullYear();
        const M = String(date.getMonth() + 1).padStart(2, "0");
        const d = String(date.getDate()).padStart(2, "0");
        const h = String(date.getHours()).padStart(2, "0");
        const m = String(date.getMinutes()).padStart(2, "0");
        const s = String(date.getSeconds()).padStart(2, "0");
        return y + "-" + M + "-" + d + " " + h + ":" + m + ":" + s;
    }
    /**
     * 格式化日期 (用于日志文件名)
     */
    formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    /**
     * 记录分隔线
     */
    async separator() {
        const line = '='.repeat(80);
        if (this.enableConsole) {
            console.log(line);
        }
        if (this.enableFile) {
            await this.writeToFile(line);
        }
    }
    /**
     * 记录会话开始
     */
    async sessionStart(sessionName) {
        await this.separator();
        await this.info(`会话开始: ${sessionName}`);
        await this.separator();
    }
    /**
     * 记录会话结束
     */
    async sessionEnd(sessionName, duration) {
        await this.separator();
        const message = duration
            ? `会话结束: ${sessionName} (耗时: ${duration.toFixed(2)}s)`
            : `会话结束: ${sessionName}`;
        await this.info(message);
        await this.separator();
    }
    /**
     * 获取日志文件路径
     */
    getLogFilePath() {
        return this.logFile;
    }
}
exports.Logger = Logger;
/**
 * 创建全局日志实例
 */
let globalLogger = null;
function getLogger(logDir, enableConsole, enableFile) {
    if (!globalLogger) {
        globalLogger = new Logger(logDir, enableConsole, enableFile);
    }
    return globalLogger;
}
