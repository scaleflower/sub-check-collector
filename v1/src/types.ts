/**
 * 订阅链接类型
 */
export interface SubscriptionLink {
  url: string;
  type?: string; // V2Ray, Clash 等
  source: string; // 来源仓库
  description?: string; // 链接描述
  foundAt: Date; // 发现时间
}

/**
 * GitHub 仓库信息
 */
export interface Repository {
  fullName: string;
  url: string;
  description?: string;
  stars: number;
  updatedAt: Date;
}

/**
 * 配置接口
 */
export interface Config {
  githubToken?: string;
  searchKeywords: string[];
  scheduleInterval: string; // cron 表达式
  outputFile: string;
  maxRepositories: number;
  configYamlPath?: string; // config.yaml 文件路径
  minStars?: number; // 最低 star 数量
  maxDaysSinceUpdate?: number; // 最大更新天数(超过此天数的仓库将被忽略)
  validateLinks?: boolean; // 是否验证链接有效性
  linkValidationTimeout?: number; // 链接验证超时时间(毫秒)
  linkValidationConcurrency?: number; // 链接验证并发数
  logDir?: string; // 日志目录
  enableFileLog?: boolean; // 是否启用文件日志
}
