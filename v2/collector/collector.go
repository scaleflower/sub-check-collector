package collector

import (
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/beck-8/subs-check/config"
)

// Collect 执行一次完整的订阅链接收集流程
func Collect() error {
	startTime := time.Now()
	cfg := config.GlobalConfig

	keywords := cfg.CollectorKeywords
	if len(keywords) == 0 {
		return fmt.Errorf("collector-keywords 未配置")
	}

	maxRepos := cfg.CollectorMaxRepos
	if maxRepos <= 0 {
		maxRepos = 30
	}

	// 确定 state 文件路径
	statePath := getStatePath()

	// 1. 加载历史数据
	agg := NewAggregator()
	if err := agg.LoadState(statePath); err != nil {
		slog.Warn(fmt.Sprintf("加载历史 state 失败: %v", err))
	}

	historyCount := agg.Count()
	slog.Info(fmt.Sprintf("历史链接数: %d", historyCount))

	// 2. 搜索 GitHub 仓库
	client := newGitHubClient()
	repos, err := client.SearchRepositories(
		keywords,
		maxRepos,
		cfg.CollectorMinStars,
		cfg.CollectorMaxDays,
	)
	if err != nil {
		return fmt.Errorf("搜索 GitHub 仓库失败: %w", err)
	}

	if len(repos) == 0 {
		slog.Info("未找到匹配的仓库")
		return nil
	}

	// 3. 遍历仓库提取链接
	totalExtracted := 0
	for i, repo := range repos {
		slog.Info(fmt.Sprintf("[%d/%d] 处理: %s", i+1, len(repos), repo.FullName))

		readme, err := client.GetReadmeContent(repo.FullName)
		if err != nil {
			slog.Warn(fmt.Sprintf("获取 %s README 失败: %v", repo.FullName, err))
			continue
		}

		links := ExtractLinks(readme, repo.FullName)
		agg.AddURLs(links)
		totalExtracted += len(links)

		slog.Info(fmt.Sprintf("从 %s 提取到 %d 个链接", repo.FullName, len(links)))

		// 避免 API 速率限制
		if i < len(repos)-1 {
			time.Sleep(1 * time.Second)
		}
	}

	// 4. 保存 state
	if err := agg.SaveState(statePath); err != nil {
		slog.Error(fmt.Sprintf("保存 state 失败: %v", err))
	}

	// 5. 将发现的 URL 追加到 SubUrls (去重)
	newCount := mergeIntoSubUrls(agg.GetURLs())

	elapsed := time.Since(startTime)
	slog.Info(fmt.Sprintf("收集完成: 历史链接 %d, 新发现 %d, 追加到 SubUrls %d 个, 耗时 %.1fs",
		historyCount, totalExtracted, newCount, elapsed.Seconds()))

	return nil
}

// mergeIntoSubUrls 将 collector URL 追加到 GlobalConfig.SubUrls (去重)
func mergeIntoSubUrls(urls []string) int {
	existing := make(map[string]bool)
	for _, u := range config.GlobalConfig.SubUrls {
		existing[u] = true
	}

	added := 0
	for _, u := range urls {
		u = strings.TrimSpace(u)
		if u != "" && !existing[u] {
			config.GlobalConfig.SubUrls = append(config.GlobalConfig.SubUrls, u)
			existing[u] = true
			added++
		}
	}

	return added
}

// getStatePath 返回 state 文件路径
func getStatePath() string {
	execPath, err := os.Executable()
	if err == nil {
		dir := filepath.Dir(execPath)
		p := filepath.Join(dir, "config", "collector-urls.txt")
		return p
	}
	return "collector-urls.txt"
}
