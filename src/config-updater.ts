import * as fs from 'fs/promises';
import * as yaml from 'js-yaml';
import { SubscriptionLink } from './types';

/**
 * YAML 配置文件更新器
 * 职责: 将收集到的订阅链接更新到 config.yaml 的 sub-urls 部分
 * 使用替换模式：每次运行会用新链接替换旧链接，而非追加
 */
export class ConfigUpdater {
  private configPath: string;

  // 默认 URL，始终放在第一行，永不覆盖
  private readonly DEFAULT_URL = 'https://misub.907737.xyz/allnodes';

  constructor(configPath: string = './config.yaml') {
    this.configPath = configPath;
  }

  /**
   * 更新 config.yaml 中的 sub-urls
   * 替换模式：丢弃旧链接，只保留新抓取的链接（不超过 maxSubUrls 上限）
   * @param links 订阅链接列表
   * @param maxSubUrls 最大 URL 数量限制
   */
  async updateSubUrls(links: SubscriptionLink[], maxSubUrls: number = 50): Promise<void> {
    try {
      console.log('\n📝 开始更新 config.yaml...');

      const fileContent = await fs.readFile(this.configPath, 'utf-8');
      const config = yaml.load(fileContent) as any;

      if (!config) {
        throw new Error('配置文件解析失败');
      }

      // 替换模式：丢弃旧链接，只保留新链接
      const validUrls = this.extractValidUrls(links);
      const limitedUrls = Array.from(validUrls).slice(0, maxSubUrls);
      const finalUrls = new Set(limitedUrls);

      config['sub-urls'] = [this.DEFAULT_URL, ...limitedUrls];
      await this.writeConfigWithComments(fileContent, finalUrls);

      console.log(`✅ 配置文件已更新（替换模式）`);
      console.log(`   - 旧链接已全部清除`);
      console.log(`   - 新写入链接: ${finalUrls.size} 个`);
      console.log(`   - 上限: ${maxSubUrls} 个`);
      console.log(`   - 默认链接: ${this.DEFAULT_URL}\n`);
    } catch (error) {
      console.error('❌ 更新配置文件失败:', error);
      throw error;
    }
  }

  private extractValidUrls(links: SubscriptionLink[]): Set<string> {
    const urls = new Set<string>();
    for (const link of links) {
      const url = link.url;
      if (
        url.includes('raw.githubusercontent.com') ||
        url.includes('gist.githubusercontent.com') ||
        url.includes('github.com') ||
        url.match(/\.(txt|yaml|yml|conf|json)$/i) ||
        url.includes('/sub') ||
        url.includes('subscription')
      ) {
        urls.add(url);
      }
    }
    return urls;
  }

  private async writeConfigWithComments(originalContent: string, newUrls: Set<string>): Promise<void> {
    const sortedUrls = Array.from(newUrls).sort();
    const allUrls = [this.DEFAULT_URL, ...sortedUrls];
    const urlsLines = '\n' + allUrls.map(u => `  - ${u}`).join('\n');

    const lines = originalContent.split('\n');
    const newLines = [];
    let inSubUrls = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim() === 'sub-urls:') {
        inSubUrls = true;
        newLines.push(line);
        continue;
      }
      if (inSubUrls) {
        if (line.length > 0 && !line.match(/^[\s#]/)) {
          inSubUrls = false;
          newLines.push(urlsLines);
          newLines.push(line);
        } else {
          if (line.trim().startsWith('#') || line.trim() === '') {
            newLines.push(line);
          }
        }
      } else {
        newLines.push(line);
      }
    }
    if (inSubUrls) {
      newLines.push(urlsLines);
    }
    await fs.writeFile(this.configPath, newLines.join('\n'), 'utf-8');
  }

  async backupConfig(): Promise<string> {
    const backupPath = `${this.configPath}.backup.${Date.now()}`;
    await fs.copyFile(this.configPath, backupPath);
    console.log(`💾 配置文件已备份: ${backupPath}`);
    return backupPath;
  }
}
