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
exports.DEFAULT_CONFIG = void 0;
exports.loadConfig = loadConfig;
const dotenv = __importStar(require("dotenv"));
// 加载环境变量
dotenv.config();
/**
 * 默认配置
 */
exports.DEFAULT_CONFIG = {
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
    // sub-urls maximum count limit (replaces old links each run)
    maxSubUrls: 50,
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
function loadConfig() {
    return {
        githubToken: process.env.GITHUB_TOKEN,
        searchKeywords: process.env.SEARCH_KEYWORDS?.split(',') || exports.DEFAULT_CONFIG.searchKeywords,
        scheduleInterval: process.env.SCHEDULE_INTERVAL || exports.DEFAULT_CONFIG.scheduleInterval,
        outputFile: process.env.OUTPUT_FILE || exports.DEFAULT_CONFIG.outputFile,
        maxRepositories: parseInt(process.env.MAX_REPOSITORIES || String(exports.DEFAULT_CONFIG.maxRepositories)),
        maxSubUrls: parseInt(process.env.SUB_URLS_MAX_COUNT || String(exports.DEFAULT_CONFIG.maxSubUrls)),
        configYamlPath: process.env.CONFIG_YAML_PATH || exports.DEFAULT_CONFIG.configYamlPath,
        minStars: parseInt(process.env.MIN_STARS || String(exports.DEFAULT_CONFIG.minStars)),
        maxDaysSinceUpdate: parseInt(process.env.MAX_DAYS_SINCE_UPDATE || String(exports.DEFAULT_CONFIG.maxDaysSinceUpdate)),
        validateLinks: process.env.VALIDATE_LINKS === 'true' || exports.DEFAULT_CONFIG.validateLinks,
        linkValidationTimeout: parseInt(process.env.LINK_VALIDATION_TIMEOUT || String(exports.DEFAULT_CONFIG.linkValidationTimeout)),
        linkValidationConcurrency: parseInt(process.env.LINK_VALIDATION_CONCURRENCY || String(exports.DEFAULT_CONFIG.linkValidationConcurrency)),
        logDir: process.env.LOG_DIR || exports.DEFAULT_CONFIG.logDir,
        enableFileLog: process.env.ENABLE_FILE_LOG !== 'false', // 默认启用,除非明确设置为 false
    };
}
