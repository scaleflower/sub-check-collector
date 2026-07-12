import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * 日志级别
 */
export enum LogLevel {
  INFO = 'INFO',
  SUCCESS = 'SUCCESS',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  DEBUG = 'DEBUG',
}

/**
 * 日志记录器
 * 职责: 记录程序运行的关键动作和结果
 */
export class Logger {
  private logDir: string;
  private logFile: string;
  private enableConsole: boolean;
  private enableFile: boolean;

  constructor(
    logDir: string = './logs',
    enableConsole: boolean = true,
    enableFile: boolean = true
  ) {
    this.logDir = logDir;
    this.logFile = path.join(
      logDir,
      `app-${this.formatDate(new Date())}.log`
    );
    this.enableConsole = enableConsole;
    this.enableFile = enableFile;
  }

  /**
   * 初始化日志目录
   */
  async init(): Promise<void> {
    if (this.enableFile) {
      try {
        await fs.mkdir(this.logDir, { recursive: true });
      } catch (error) {
        console.error('创建日志目录失败:', error);
      }
    }
  }

  /**
   * 记录信息日志
   */
  async info(message: string, data?: any): Promise<void> {
    await this.log(LogLevel.INFO, message, data);
  }

  /**
   * 记录成功日志
   */
  async success(message: string, data?: any): Promise<void> {
    await this.log(LogLevel.SUCCESS, message, data);
  }

  /**
   * 记录警告日志
   */
  async warning(message: string, data?: any): Promise<void> {
    await this.log(LogLevel.WARNING, message, data);
  }

  /**
   * 记录错误日志
   */
  async error(message: string, error?: any): Promise<void> {
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
  async debug(message: string, data?: any): Promise<void> {
    await this.log(LogLevel.DEBUG, message, data);
  }

  /**
   * 核心日志方法
   */
  private async log(
    level: LogLevel,
    message: string,
    data?: any
  ): Promise<void> {
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
  private formatLogEntry(
    timestamp: string,
    level: LogLevel,
    message: string,
    data?: any
  ): string {
    let entry = `[${timestamp}] [${level}] ${message}`;

    if (data !== undefined) {
      try {
        entry += `\n  数据: ${JSON.stringify(data, null, 2)}`;
      } catch (error) {
        entry += `\n  数据: [无法序列化]`;
      }
    }

    return entry;
  }

  /**
   * 控制台输出
   */
  private printToConsole(level: LogLevel, message: string): void {
    const icon = this.getLevelIcon(level);
    const coloredMessage = this.colorize(level, `${icon} ${message}`);
    console.log(coloredMessage);
  }

  /**
   * 写入文件
   */
  private async writeToFile(message: string): Promise<void> {
    try {
      await fs.appendFile(this.logFile, message + '\n', 'utf-8');
    } catch (error) {
      console.error('写入日志文件失败:', error);
    }
  }

  /**
   * 获取日志级别对应的图标
   */
  private getLevelIcon(level: LogLevel): string {
    const icons: Record<LogLevel, string> = {
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
  private colorize(level: LogLevel, message: string): string {
    // 简化版本,不使用颜色库
    return message;
  }

  /**
   * 格式化时间戳
   */
  private formatTimestamp(date: Date): string {
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
  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * 记录分隔线
   */
  async separator(): Promise<void> {
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
  async sessionStart(sessionName: string): Promise<void> {
    await this.separator();
    await this.info(`会话开始: ${sessionName}`);
    await this.separator();
  }

  /**
   * 记录会话结束
   */
  async sessionEnd(sessionName: string, duration?: number): Promise<void> {
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
  getLogFilePath(): string {
    return this.logFile;
  }
}

/**
 * 创建全局日志实例
 */
let globalLogger: Logger | null = null;

export function getLogger(
  logDir?: string,
  enableConsole?: boolean,
  enableFile?: boolean
): Logger {
  if (!globalLogger) {
    globalLogger = new Logger(logDir, enableConsole, enableFile);
  }
  return globalLogger;
}
