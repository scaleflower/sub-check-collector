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
exports.TaskScheduler = void 0;
const schedule = __importStar(require("node-schedule"));
const collector_1 = require("./collector");
/**
 * 任务调度器
 * 职责: 按计划定期执行收集任务
 */
class TaskScheduler {
    constructor(config, logger) {
        this.config = config;
        this.logger = logger;
        this.collector = new collector_1.SubscriptionCollector(config, logger);
    }
    /**
     * 启动定时任务
     */
    start() {
        console.log(`⏰ 调度器启动`);
        console.log(`   规则: ${this.config.scheduleInterval}`);
        console.log(`   下次执行: ${this.getNextRunTime()}\n`);
        this.job = schedule.scheduleJob(this.config.scheduleInterval, async () => {
            console.log(`\n⏰ [${new Date().toLocaleString('zh-CN')}] 定时任务触发\n`);
            try {
                await this.collector.collect();
            }
            catch (error) {
                console.error('❌ 定时任务执行失败:', error);
            }
        });
    }
    /**
     * 立即执行一次(不影响定时计划)
     */
    async runOnce() {
        console.log('🔥 手动执行一次收集任务\n');
        await this.collector.collect();
    }
    /**
     * 停止定时任务
     */
    stop() {
        if (this.job) {
            this.job.cancel();
            console.log('⏸️  调度器已停止');
        }
    }
    /**
     * 获取下次执行时间
     */
    getNextRunTime() {
        try {
            const tempJob = schedule.scheduleJob(this.config.scheduleInterval, () => { });
            const nextRun = tempJob.nextInvocation();
            tempJob.cancel();
            return nextRun ? new Date(nextRun.toString()).toLocaleString('zh-CN') : '未知';
        }
        catch {
            return '未知';
        }
    }
}
exports.TaskScheduler = TaskScheduler;
