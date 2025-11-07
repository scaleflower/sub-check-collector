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

      // 先按更新时间搜索,获取更多结果用于后续排序
      const response = await this.octokit.rest.search.repos({
        q: query,
        sort: 'updated',
        order: 'desc',
        per_page: Math.min(maxResults * 3, 100), // 获取3倍数量用于过滤和排序
      });

      let repositories: Repository[] = response.data.items.map((item) => ({
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
