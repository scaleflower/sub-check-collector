import { SubscriptionLink } from './types';

/**
 * README 解析器
 * 职责: 从 README 内容中提取订阅链接
 */
export class ReadmeParser {
  // 常见的订阅链接模式
  private readonly URL_PATTERNS = [
    // raw.githubusercontent.com 链接
    /https?:\/\/raw\.githubusercontent\.com\/[^\s<>")]+/gi,
    // GitHub blob 链接
    /https?:\/\/github\.com\/[^\/\s]+\/[^\/\s]+\/blob\/[^\s<>")]+/gi,
    // 其他常见订阅域名
    /https?:\/\/[^\s<>"]+\.(yaml|yml|txt|conf|json|v2ray|clash)/gi,
  ];

  // 订阅类型关键字映射
  private readonly TYPE_KEYWORDS: Record<string, string[]> = {
    V2Ray: ['v2ray', 'vmess', 'vless', 'trojan'],
    Clash: ['clash', 'clash.yaml', 'clash.yml'],
    Shadowsocks: ['shadowsocks', 'ss', 'ssr'],
    订阅链接: ['订阅', 'subscription', 'sub'],
  };

  /**
   * 从 README 内容中提取订阅链接
   * @param content README 内容
   * @param source 来源仓库名称
   */
  extractLinks(content: string, source: string): SubscriptionLink[] {
    const links: SubscriptionLink[] = [];
    const foundUrls = new Set<string>();

    // 按行处理,保留上下文信息
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const prevLine = i > 0 ? lines[i - 1] : '';

      // 使用所有模式匹配 URL
      for (const pattern of this.URL_PATTERNS) {
        const matches = line.matchAll(pattern);

        for (const match of matches) {
          const url = match[0].trim();

          // 去重
          if (foundUrls.has(url)) continue;
          foundUrls.add(url);

          // 推断订阅类型和描述
          const type = this.inferType(line, prevLine);
          const description = this.extractDescription(line, prevLine);

          links.push({
            url,
            type,
            source,
            description,
            foundAt: new Date(),
          });
        }
      }
    }

    console.log(`📝 从 ${source} 提取到 ${links.length} 个链接`);
    return links;
  }

  /**
   * 推断订阅类型
   */
  private inferType(currentLine: string, previousLine: string): string | undefined {
    const context = (previousLine + ' ' + currentLine).toLowerCase();

    for (const [type, keywords] of Object.entries(this.TYPE_KEYWORDS)) {
      if (keywords.some((keyword) => context.includes(keyword.toLowerCase()))) {
        return type;
      }
    }

    return undefined;
  }

  /**
   * 提取描述信息
   */
  private extractDescription(currentLine: string, previousLine: string): string | undefined {
    // 尝试从当前行或上一行提取描述
    const context = previousLine + ' ' + currentLine;

    // 移除 URL 和 Markdown 语法
    let description = context
      .replace(/https?:\/\/[^\s]+/g, '')
      .replace(/[#*`\[\]()]/g, '')
      .trim();

    // 限制长度
    if (description.length > 100) {
      description = description.substring(0, 97) + '...';
    }

    return description || undefined;
  }

  /**
   * 验证 URL 是否有效
   */
  isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}
