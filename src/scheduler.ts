import * as schedule from 'node-schedule';
import { SubscriptionCollector } from './collector';
import { Logger } from './logger';
import { Config } from './types';

/**
 * 任务调度器
 * 职责: 按计划定期执行收集任务
 */
export class TaskScheduler {
  private collector: SubscriptionCollector;
  private logger: Logger;
  private config: Config;
  private job?: schedule.Job;

  constructor(config: Config, logger: Logger) {
    this.config = config;
    this.logger = logger;
    this.collector = new SubscriptionCollector(config, logger);
  }

  /**
   * 启动定时任务
   */
  start(): void {
    console.log(`⏰ 调度器启动`);
    console.log(`   规则: ${this.config.scheduleInterval}`);
    console.log(`   下次执行: ${this.getNextRunTime()}\n`);

    this.job = schedule.scheduleJob(this.config.scheduleInterval, async () => {
      console.log(`\n⏰ [${new Date().toLocaleString('zh-CN')}] 定时任务触发\n`);
      try {
        await this.collector.collect();
      } catch (error) {
        console.error('❌ 定时任务执行失败:', error);
      }
    });
  }

  /**
   * 立即执行一次(不影响定时计划)
   */
  async runOnce(): Promise<void> {
    console.log('🔥 手动执行一次收集任务\n');
    await this.collector.collect();
  }

  /**
   * 停止定时任务
   */
  stop(): void {
    if (this.job) {
      this.job.cancel();
      console.log('⏸️  调度器已停止');
    }
  }

  /**
   * 获取下次执行时间
   */
  private getNextRunTime(): string {
    try {
      const tempJob = schedule.scheduleJob(this.config.scheduleInterval, () => {});
      const nextRun = tempJob.nextInvocation();
      tempJob.cancel();
      return nextRun ? new Date(nextRun.toString()).toLocaleString('zh-CN') : '未知';
    } catch {
      return '未知';
    }
  }
}
