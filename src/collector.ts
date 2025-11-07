import { GitHubSearcher } from './github-searcher';
import { ReadmeParser } from './readme-parser';
import { LinkAggregator } from './link-aggregator';
import { ConfigUpdater } from './config-updater';
import { LinkValidator } from './link-validator';
import { Logger } from './logger';
import { Config } from './types';

/**
 * 订阅链接收集器
 * 职责: 协调各模块完成完整的收集流程
 */
export class SubscriptionCollector {
  private searcher: GitHubSearcher;
  private parser: ReadmeParser;
  private aggregator: LinkAggregator;
  private configUpdater: ConfigUpdater;
  private validator?: LinkValidator;
  private logger: Logger;
  private config: Config;

  constructor(config: Config, logger: Logger) {
    this.config = config;
    this.logger = logger;
    this.searcher = new GitHubSearcher(config.githubToken);
    this.parser = new ReadmeParser();
    this.aggregator = new LinkAggregator();
    this.configUpdater = new ConfigUpdater(config.configYamlPath);

    // 如果启用链接验证,创建验证器
    if (config.validateLinks) {
      this.validator = new LinkValidator(
        config.linkValidationTimeout,
        config.linkValidationConcurrency
      );
    }
  }

  /**
   * 执行一次完整的收集流程
   */
  async collect(): Promise<void> {
    console.log('\n🚀 开始收集订阅链接...\n');
    const startTime = Date.now();

    await this.logger.sessionStart('订阅链接收集');
    await this.logger.info('收集流程启动', {
      searchKeywords: this.config.searchKeywords,
      maxRepositories: this.config.maxRepositories,
      minStars: this.config.minStars,
      maxDaysSinceUpdate: this.config.maxDaysSinceUpdate,
      validateLinks: this.config.validateLinks,
    });

    try {
      // 1. 加载历史数据(增量更新)
      await this.logger.info('加载历史数据', { file: this.config.outputFile });
      await this.aggregator.loadFromFile(this.config.outputFile);

      // 2. 搜索 GitHub 仓库
      await this.logger.info('开始搜索 GitHub 仓库');
      const repositories = await this.searcher.searchRepositories(
        this.config.searchKeywords,
        this.config.maxRepositories,
        this.config.minStars,
        this.config.maxDaysSinceUpdate
      );

      await this.logger.success(`找到 ${repositories.length} 个仓库`, {
        count: repositories.length,
        repositories: repositories.map(r => r.fullName),
      });

      console.log(`\n📦 准备处理 ${repositories.length} 个仓库\n`);

      // 3. 遍历每个仓库,提取链接
      for (let i = 0; i < repositories.length; i++) {
        const repo = repositories[i];
        console.log(`\n[${i + 1}/${repositories.length}] 处理: ${repo.fullName}`);

        try {
          // 获取 README
          const readme = await this.searcher.getReadmeContent(repo.fullName);

          if (readme) {
            // 解析链接
            const links = this.parser.extractLinks(readme, repo.fullName);

            // 添加到聚合器
            this.aggregator.addLinks(links);
          }

          // 避免触发 GitHub API 限制
          await this.delay(1000);
        } catch (error) {
          console.error(`⚠️  处理 ${repo.fullName} 时出错:`, error);
          continue;
        }
      }

      // 4. 保存结果到 Markdown 文件
      await this.aggregator.saveToFile(this.config.outputFile);

      // 5. 如果启用了链接验证,验证所有链接
      let linksToUpdate = this.aggregator.getAllLinks();

      if (this.config.validateLinks && this.validator) {
        console.log('\n🔐 链接验证已启用\n');
        linksToUpdate = await this.validator.validateLinks(linksToUpdate);
      }

      // 6. 更新 config.yaml (如果配置了路径)
      if (this.config.configYamlPath) {
        // 备份配置文件
        await this.configUpdater.backupConfig();

        // 更新 config.yaml (使用验证后的链接)
        await this.configUpdater.updateSubUrls(linksToUpdate);
      }

      // 7. 输出统计
      const stats = this.aggregator.getStats();
      const elapsed = (Date.now() - startTime) / 1000;

      console.log('\n✨ 收集完成!\n');
      console.log(`📊 统计信息:`);
      console.log(`   - 总链接数: ${stats.total}`);
      for (const [type, count] of Object.entries(stats.byType)) {
        console.log(`   - ${type}: ${count}`);
      }
      console.log(`   - 耗时: ${elapsed.toFixed(2)}s`);
      console.log(`   - 输出文件: ${this.config.outputFile}\n`);

      await this.logger.success('收集完成', {
        statistics: stats,
        duration: elapsed,
        outputFile: this.config.outputFile,
        validatedLinksCount: this.config.validateLinks ? linksToUpdate.length : undefined,
      });

      await this.logger.sessionEnd('订阅链接收集', elapsed);
    } catch (error) {
      console.error('\n❌ 收集过程出错:', error);
      await this.logger.error('收集过程失败', error);
      throw error;
    }
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return this.aggregator.getStats();
  }
}
