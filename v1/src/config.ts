import * as dotenv from 'dotenv';
import { Config } from './types';

// 加载环境变量
dotenv.config();

/**
 * 默认配置
 */
export const DEFAULT_CONFIG: Config = {
  // GitHub Token (可选,但建议配置以提高 API 限制)
  githubToken: process.env.GITHUB_TOKEN,

  // 搜索关键字
  searchKeywords: ['free', 'v2ray'],

  // 定时执行规则 (cron 表达式)
  // 默认: 每天凌晨 2 点执行
  scheduleInterval: '0 2 * * *',

  // 输出文件路径
  outputFile: './output/subscriptions.md',

  // 最大搜索仓库数
  maxRepositories: 30,

  // config.yaml 文件路径
  configYamlPath: './config.yaml',

  // 最低 star 数量 (默认不限制)
  minStars: 0,

  // 最大更新天数 (默认 90 天,超过此天数的仓库将被忽略)
  maxDaysSinceUpdate: 90,

  // 是否验证链接有效性 (默认关闭)
  validateLinks: false,

  // 链接验证超时时间 (默认 10 秒)
  linkValidationTimeout: 10000,

  // 链接验证并发数 (默认 10)
  linkValidationConcurrency: 10,

  // 日志目录 (默认 ./logs)
  logDir: './logs',

  // 是否启用文件日志 (默认启用)
  enableFileLog: true,
};

/**
 * 从环境变量和配置文件加载配置
 */
export function loadConfig(): Config {
  return {
    githubToken: process.env.GITHUB_TOKEN,
    searchKeywords: process.env.SEARCH_KEYWORDS?.split(',') || DEFAULT_CONFIG.searchKeywords,
    scheduleInterval: process.env.SCHEDULE_INTERVAL || DEFAULT_CONFIG.scheduleInterval,
    outputFile: process.env.OUTPUT_FILE || DEFAULT_CONFIG.outputFile,
    maxRepositories: parseInt(process.env.MAX_REPOSITORIES || String(DEFAULT_CONFIG.maxRepositories)),
    configYamlPath: process.env.CONFIG_YAML_PATH || DEFAULT_CONFIG.configYamlPath,
    minStars: parseInt(process.env.MIN_STARS || String(DEFAULT_CONFIG.minStars)),
    maxDaysSinceUpdate: parseInt(process.env.MAX_DAYS_SINCE_UPDATE || String(DEFAULT_CONFIG.maxDaysSinceUpdate)),
    validateLinks: process.env.VALIDATE_LINKS === 'true' || DEFAULT_CONFIG.validateLinks,
    linkValidationTimeout: parseInt(process.env.LINK_VALIDATION_TIMEOUT || String(DEFAULT_CONFIG.linkValidationTimeout)),
    linkValidationConcurrency: parseInt(process.env.LINK_VALIDATION_CONCURRENCY || String(DEFAULT_CONFIG.linkValidationConcurrency)),
    logDir: process.env.LOG_DIR || DEFAULT_CONFIG.logDir,
    enableFileLog: process.env.ENABLE_FILE_LOG !== 'false', // 默认启用,除非明确设置为 false
  };
}
