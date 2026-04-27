import { Octokit } from '@octokit/rest';
import { Repository } from './types';

/**
 * GitHub 搜索模块
 * 职责: 根据关键字搜索相关仓库
 */
export class GitHubSearcher {
  private octokit: Octokit;

  constructor(token?: string) {
    // 只有当 token 存在且不为空时才使用(避免无效 token 导致401)
    this.octokit = new Octokit(
      token && token.trim() ? { auth: token } : {}
    );
  }

  /**
   * 搜索包含指定关键字的仓库
   * @param keywords 关键字数组
   * @param maxResults 最大结果数
   * @param minStars 最低 star 数量
   * @param maxDaysSinceUpdate 最大更新天数
   */
  async searchRepositories(
    keywords: string[],
    maxResults: number = 30,
    minStars: number = 0,
    maxDaysSinceUpdate?: number
  ): Promise<Repository[]> {
    try {
      // 构建搜索查询: 使用 AND 连接所有关键字
      const query = keywords.join(' ');

      console.log(`🔍 搜索关键字: ${query}`);
      if (minStars > 0) {
        console.log(`   最低 star: ${minStars}`);
      }
      if (maxDaysSinceUpdate) {
        console.log(`   最大更新天数: ${maxDaysSinceUpdate} 天`);
      }

      // 使用日期游标分页，GitHub Search API 的 page 参数不可靠
      const perPage = 100;
      const targetCount = Math.min(maxResults * 3, 1000);
      let allItems: any[] = [];
      let dateCursor = '';

      for (let round = 1; allItems.length < targetCount; round++) {
        // 每轮查询加上 pushed 限定条件，缩小日期范围获取新结果
        const q = dateCursor
          ? `${query} pushed:<${dateCursor}`
          : query;

        console.log(`   📄 获取第 ${round} 轮 (累计 ${allItems.length} 条)...`);
        const response = await this.octokit.rest.search.repos({
          q,
          sort: 'updated',
          order: 'desc',
          per_page: perPage,
        });

        const items = response.data.items;
        if (items.length === 0) break;

        allItems = allItems.concat(items);
        console.log(`   ✅ 第 ${round} 轮获取 ${items.length} 条，累计 ${allItems.length} 条 (total_count: ${response.data.total_count})`);

        // 用本页最旧结果的更新时间作为下一轮游标
        const lastItem = items[items.length - 1];
        const lastDate = new Date(lastItem.updated_at);
        dateCursor = lastDate.toISOString().split('T')[0]; // YYYY-MM-DD

        // 本轮结果不足 perPage，说明已经没有更多数据
        if (items.length < perPage) break;

        // 避免触发 GitHub API 速率限制
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      let repositories: Repository[] = allItems.map((item) => ({
        fullName: item.full_name,
        url: item.html_url,
        description: item.description || undefined,
        stars: item.stargazers_count,
        updatedAt: new Date(item.updated_at),
      }));

      console.log(`✅ 初步找到 ${repositories.length} 个仓库`);

      // 1. 过滤: 最低 star 数量
      if (minStars > 0) {
        const beforeCount = repositories.length;
        repositories = repositories.filter(repo => repo.stars >= minStars);
        console.log(`   ⭐ 过滤 star < ${minStars}: ${beforeCount} → ${repositories.length}`);
      }

      // 2. 过滤: 最大更新天数
      if (maxDaysSinceUpdate) {
        const beforeCount = repositories.length;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - maxDaysSinceUpdate);

        repositories = repositories.filter(repo => repo.updatedAt >= cutoffDate);
        const filteredCount = beforeCount - repositories.length;
        if (filteredCount > 0) {
          console.log(`   📅 过滤超过 ${maxDaysSinceUpdate} 天未更新: ${beforeCount} → ${repositories.length} (过滤了 ${filteredCount} 个)`);
        }
      }

      // 3. 综合排序: star 权重 70%, 更新时间权重 30%
      repositories = this.sortRepositories(repositories);

      // 4. 限制结果数量
      repositories = repositories.slice(0, maxResults);

      console.log(`🎯 最终选择 ${repositories.length} 个仓库`);
      return repositories;
    } catch (error) {
      console.error('❌ GitHub 搜索失败:', error);
      throw error;
    }
  }

  /**
   * 综合排序: 考虑 star 数量和更新时间
   * 算法: score = (star权重 * 归一化stars) + (时间权重 * 归一化时间)
   */
  private sortRepositories(repos: Repository[]): Repository[] {
    if (repos.length === 0) return repos;

    // 找出最大和最小值用于归一化
    const maxStars = Math.max(...repos.map(r => r.stars));
    const minStars = Math.min(...repos.map(r => r.stars));
    const now = Date.now();
    const timestamps = repos.map(r => r.updatedAt.getTime());
    const maxTime = Math.max(...timestamps);
    const minTime = Math.min(...timestamps);

    // 计算每个仓库的综合得分
    const scored = repos.map(repo => {
      // 归一化 stars (0-1)
      const normalizedStars = maxStars > minStars
        ? (repo.stars - minStars) / (maxStars - minStars)
        : 1;

      // 归一化时间 (0-1, 越新分数越高)
      const normalizedTime = maxTime > minTime
        ? (repo.updatedAt.getTime() - minTime) / (maxTime - minTime)
        : 1;

      // 综合得分: star 70%, 时间 30%
      const score = (normalizedStars * 0.7) + (normalizedTime * 0.3);

      return { repo, score };
    });

    // 按得分降序排序
    scored.sort((a, b) => b.score - a.score);

    return scored.map(item => item.repo);
  }

  /**
   * 获取仓库的 README 内容
   * @param fullName 仓库完整名称 (owner/repo)
   */
  async getReadmeContent(fullName: string): Promise<string | null> {
    try {
      const [owner, repo] = fullName.split('/');

      const response = await this.octokit.rest.repos.getReadme({
        owner,
        repo,
      });

      // README 内容是 base64 编码的
      const content = Buffer.from(response.data.content, 'base64').toString('utf-8');
      return content;
    } catch (error: any) {
      if (error.status === 404) {
        console.warn(`⚠️  仓库 ${fullName} 没有 README`);
        return null;
      }
      console.error(`❌ 获取 ${fullName} README 失败:`, error.message);
      return null;
    }
  }
}
