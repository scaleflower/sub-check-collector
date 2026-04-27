import axios, { AxiosError } from 'axios';
import { SubscriptionLink } from './types';

/**
 * 验证结果接口
 */
interface ValidationResult {
  link: SubscriptionLink;
  isValid: boolean;
  error?: string;
}

/**
 * 链接验证器
 * 职责: 验证订阅链接的有效性,支持并发验证
 */
export class LinkValidator {
  private timeout: number;
  private concurrency: number;

  constructor(timeout: number = 10000, concurrency: number = 10) {
    this.timeout = timeout;
    this.concurrency = concurrency;
  }

  /**
   * 验证单个链接是否有效
   * @param link 订阅链接
   * @returns 验证结果
   */
  private async validateSingleLink(link: SubscriptionLink): Promise<ValidationResult> {
    try {
      const response = await axios.get(link.url, {
        timeout: this.timeout,
        validateStatus: (status) => status >= 200 && status < 400,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        maxRedirects: 5,
      });

      // 检查是否返回了内容
      const hasContent =
        response.data &&
        (typeof response.data === 'string' ? response.data.length > 0 : true);

      return {
        link,
        isValid: hasContent,
      };
    } catch (error) {
      const axiosError = error as AxiosError;
      let errorMsg = '';

      // 详细记录错误原因
      if (axiosError.code === 'ECONNABORTED') {
        errorMsg = '超时';
      } else if (axiosError.response) {
        errorMsg = `HTTP ${axiosError.response.status}`;
      } else if (axiosError.code === 'ENOTFOUND') {
        errorMsg = '域名无法解析';
      } else if (axiosError.code === 'ECONNREFUSED') {
        errorMsg = '连接被拒绝';
      } else {
        errorMsg = '访问失败';
      }

      return {
        link,
        isValid: false,
        error: errorMsg,
      };
    }
  }

  /**
   * 批量验证链接 (并发)
   * @param links 订阅链接列表
   * @returns 有效的链接列表
   */
  async validateLinks(links: SubscriptionLink[]): Promise<SubscriptionLink[]> {
    console.log(`\n🔍 开始验证 ${links.length} 个链接...`);
    console.log(`   超时设置: ${this.timeout / 1000} 秒`);
    console.log(`   并发数: ${this.concurrency}\n`);

    const startTime = Date.now();
    const results: ValidationResult[] = [];
    let completed = 0;

    // 分批并发验证
    for (let i = 0; i < links.length; i += this.concurrency) {
      const batch = links.slice(i, i + this.concurrency);
      const batchPromises = batch.map((link) => this.validateSingleLink(link));

      // 等待当前批次完成
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // 输出进度
      completed += batch.length;
      batchResults.forEach((result, index) => {
        const globalIndex = i + index + 1;
        const progress = `[${globalIndex}/${links.length}]`;
        const shortUrl = result.link.url.substring(0, 60);

        if (result.isValid) {
          console.log(`${progress} ✅ ${shortUrl}...`);
        } else {
          const errorIcon = this.getErrorIcon(result.error || '');
          console.log(`${progress} ${errorIcon} ${shortUrl}... (${result.error})`);
        }
      });

      // 批次间延迟，避免触发 GitHub Pages 限流
      if (i + this.concurrency < links.length) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      // 显示批次进度
      const percentage = ((completed / links.length) * 100).toFixed(1);
      console.log(`   进度: ${completed}/${links.length} (${percentage}%)\n`);
    }

    // 统计结果
    const validLinks = results.filter((r) => r.isValid).map((r) => r.link);
    const invalidCount = results.length - validLinks.length;
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`\n📊 验证完成:`);
    console.log(`   ✅ 有效链接: ${validLinks.length} 个`);
    console.log(`   ❌ 无效链接: ${invalidCount} 个`);
    console.log(`   📈 有效率: ${((validLinks.length / links.length) * 100).toFixed(1)}%`);
    console.log(`   ⏱️  总耗时: ${elapsed}s\n`);

    // 输出错误统计
    if (invalidCount > 0) {
      const errorStats = this.getErrorStatistics(results);
      console.log(`📋 失败原因统计:`);
      for (const [error, count] of Object.entries(errorStats)) {
        console.log(`   ${this.getErrorIcon(error)} ${error}: ${count} 个`);
      }
      console.log('');
    }

    return validLinks;
  }

  /**
   * 获取错误图标
   */
  private getErrorIcon(error: string): string {
    if (error.includes('超时')) return '⏱️';
    if (error.includes('域名')) return '🔍';
    if (error.includes('拒绝')) return '🚫';
    if (error.includes('HTTP')) return '❌';
    return '⚠️';
  }

  /**
   * 统计错误类型
   */
  private getErrorStatistics(results: ValidationResult[]): Record<string, number> {
    const stats: Record<string, number> = {};

    results
      .filter((r) => !r.isValid && r.error)
      .forEach((r) => {
        const error = r.error!;
        stats[error] = (stats[error] || 0) + 1;
      });

    return stats;
  }
}
