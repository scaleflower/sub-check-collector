import * as fs from 'fs/promises';
import * as path from 'path';
import { SubscriptionLink } from './types';

/**
 * 链接聚合器
 * 职责: 去重、排序、持久化订阅链接
 */
export class LinkAggregator {
  private links: Map<string, SubscriptionLink> = new Map();

  /**
   * 添加链接(自动去重)
   */
  addLinks(newLinks: SubscriptionLink[]): void {
    for (const link of newLinks) {
      // 使用 URL 作为唯一标识进行去重
      if (!this.links.has(link.url)) {
        this.links.set(link.url, link);
      } else {
        // 如果链接已存在,更新发现时间
        const existing = this.links.get(link.url)!;
        existing.foundAt = link.foundAt;
      }
    }
  }

  /**
   * 获取所有链接(按类型分组)
   */
  getGroupedLinks(): Record<string, SubscriptionLink[]> {
    const grouped: Record<string, SubscriptionLink[]> = {};

    for (const link of this.links.values()) {
      const type = link.type || '其他';
      if (!grouped[type]) {
        grouped[type] = [];
      }
      grouped[type].push(link);
    }

    // 每个组内按发现时间倒序
    for (const type in grouped) {
      grouped[type].sort((a, b) => b.foundAt.getTime() - a.foundAt.getTime());
    }

    return grouped;
  }

  /**
   * 获取统计信息
   */
  getStats(): { total: number; byType: Record<string, number> } {
    const byType: Record<string, number> = {};

    for (const link of this.links.values()) {
      const type = link.type || '其他';
      byType[type] = (byType[type] || 0) + 1;
    }

    return {
      total: this.links.size,
      byType,
    };
  }

  /**
   * 获取所有链接
   */
  getAllLinks(): SubscriptionLink[] {
    return Array.from(this.links.values());
  }

  /**
   * 保存到文件
   */
  async saveToFile(filePath: string): Promise<void> {
    const grouped = this.getGroupedLinks();
    const stats = this.getStats();

    // 生成 Markdown 格式输出
    let content = '# V2Ray/Clash 订阅链接汇总\n\n';
    content += `> 最后更新: ${new Date().toLocaleString('zh-CN')}\n`;
    content += `> 总计: ${stats.total} 个链接\n\n`;

    content += '## 📊 统计\n\n';
    for (const [type, count] of Object.entries(stats.byType)) {
      content += `- ${type}: ${count} 个\n`;
    }
    content += '\n---\n\n';

    // 按类型输出
    for (const [type, links] of Object.entries(grouped)) {
      content += `## ${type}\n\n`;

      for (const link of links) {
        content += `### ${link.source}\n\n`;
        if (link.description) {
          content += `**说明:** ${link.description}\n\n`;
        }
        content += `**链接:** ${link.url}\n\n`;
        content += `*发现时间: ${link.foundAt.toLocaleString('zh-CN')}*\n\n`;
        content += '---\n\n';
      }
    }

    // 附录: 纯链接列表(方便复制)
    content += '## 📎 纯链接列表\n\n';
    content += '```\n';
    for (const link of this.links.values()) {
      content += link.url + '\n';
    }
    content += '```\n';

    // 确保目录存在
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });

    // 写入文件
    await fs.writeFile(filePath, content, 'utf-8');
    console.log(`💾 已保存到: ${filePath}`);
  }

  /**
   * 从文件加载(用于增量更新)
   */
  async loadFromFile(filePath: string): Promise<void> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');

      // 简单解析: 提取所有 URL
      const urlPattern = /https?:\/\/[^\s<>"]+/g;
      const matches = content.matchAll(urlPattern);

      for (const match of matches) {
        const url = match[0];
        if (!this.links.has(url)) {
          this.links.set(url, {
            url,
            source: '历史记录',
            foundAt: new Date(),
          });
        }
      }

      console.log(`📂 从文件加载了 ${this.links.size} 个链接`);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        console.log('📂 输出文件不存在,将创建新文件');
      } else {
        console.error('❌ 加载文件失败:', error);
      }
    }
  }

  /**
   * 清空所有链接
   */
  clear(): void {
    this.links.clear();
  }
}
