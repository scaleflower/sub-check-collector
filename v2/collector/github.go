package collector

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/beck-8/subs-check/config"
)

// searchItem 搜索结果条目
type searchItem struct {
	FullName    string `json:"full_name"`
	HtmlUrl     string `json:"html_url"`
	Description string `json:"description"`
	Stars       int    `json:"stargazers_count"`
	UpdatedAt   string `json:"updated_at"`
}

// GitHub Search API 响应结构
type searchResponse struct {
	TotalCount int          `json:"total_count"`
	Items      []searchItem `json:"items"`
}

// README API 响应结构
type readmeResponse struct {
	Content string `json:"content"`
}

// Repository 仓库信息
type Repository struct {
	FullName    string
	Stars       int
	UpdatedAt   time.Time
}

// githubClient GitHub API 客户端
type githubClient struct {
	httpClient *http.Client
}

// newGitHubClient 创建客户端
func newGitHubClient() *githubClient {
	return &githubClient{
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
}

// apiBase 返回 API 基础 URL
func (c *githubClient) apiBase() string {
	if config.GlobalConfig.GithubAPIMirror != "" {
		mirror := strings.TrimRight(config.GlobalConfig.GithubAPIMirror, "/")
		return mirror
	}
	return "https://api.github.com"
}

// doRequest 发送带认证的 HTTP 请求
func (c *githubClient) doRequest(url string) ([]byte, error) {
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Accept", "application/vnd.github.v3+json")
	if config.GlobalConfig.GithubToken != "" {
		req.Header.Set("Authorization", "Bearer "+config.GlobalConfig.GithubToken)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("请求失败: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == 422 {
		return nil, fmt.Errorf("GitHub API 422: 可能被标记为 spam，请更换搜索关键词")
	}
	if resp.StatusCode == 403 {
		return nil, fmt.Errorf("GitHub API 403: 速率限制，请配置 github-token")
	}
	if resp.StatusCode != 200 {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("GitHub API %d: %s", resp.StatusCode, string(body))
	}

	return io.ReadAll(resp.Body)
}

// SearchRepositories 搜索 GitHub 仓库
func (c *githubClient) SearchRepositories(keywords []string, maxRepos, minStars, maxDays int) ([]Repository, error) {
	query := strings.Join(keywords, " ")
	slog.Info(fmt.Sprintf("搜索关键字: %s", query))

	base := c.apiBase()
	perPage := 100
	targetCount := maxRepos * 3
	if targetCount > 1000 {
		targetCount = 1000
	}

	var allItems []searchItem
	dateCursor := ""

	for round := 1; len(allItems) < targetCount; round++ {
		q := query
		if dateCursor != "" {
			q = fmt.Sprintf("%s pushed:<%s", query, dateCursor)
		}
		if minStars > 0 {
			q = fmt.Sprintf("%s stars:>=%d", q, minStars)
		}

		url := fmt.Sprintf("%s/search/repositories?q=%s&sort=updated&order=desc&per_page=%d",
			base, queryEscape(q), perPage)

		slog.Info(fmt.Sprintf("获取第 %d 轮 (累计 %d 条)...", round, len(allItems)))

		body, err := c.doRequest(url)
		if err != nil {
			return nil, err
		}

		var resp searchResponse
		if err := json.Unmarshal(body, &resp); err != nil {
			return nil, fmt.Errorf("解析搜索结果失败: %w", err)
		}

		if len(resp.Items) == 0 {
			break
		}

		allItems = append(allItems, resp.Items...)
		slog.Info(fmt.Sprintf("第 %d 轮获取 %d 条，累计 %d 条", round, len(resp.Items), len(allItems)))

		lastItem := resp.Items[len(resp.Items)-1]
		dateCursor = strings.Split(lastItem.UpdatedAt, "T")[0]

		if len(resp.Items) < perPage {
			break
		}

		time.Sleep(2 * time.Second)
	}

	// 过滤和排序
	repos := make([]Repository, 0, len(allItems))
	cutoff := time.Time{}
	if maxDays > 0 {
		cutoff = time.Now().AddDate(0, 0, -maxDays)
	}

	for _, item := range allItems {
		t, err := time.Parse(time.RFC3339, item.UpdatedAt)
		if err != nil {
			continue
		}
		if !cutoff.IsZero() && t.Before(cutoff) {
			continue
		}
		repos = append(repos, Repository{
			FullName:  item.FullName,
			Stars:     item.Stars,
			UpdatedAt: t,
		})
	}

	slog.Info(fmt.Sprintf("过滤后剩余 %d 个仓库", len(repos)))

	// 加权排序
	repos = sortRepositories(repos)

	// 限制数量
	if len(repos) > maxRepos {
		repos = repos[:maxRepos]
	}

	slog.Info(fmt.Sprintf("最终选择 %d 个仓库", len(repos)))
	return repos, nil
}

// GetReadmeContent 获取仓库 README 内容
func (c *githubClient) GetReadmeContent(fullName string) (string, error) {
	parts := strings.SplitN(fullName, "/", 2)
	if len(parts) != 2 {
		return "", fmt.Errorf("无效的仓库名: %s", fullName)
	}

	url := fmt.Sprintf("%s/repos/%s/%s/readme", c.apiBase(), parts[0], parts[1])
	body, err := c.doRequest(url)
	if err != nil {
		return "", err
	}

	var resp readmeResponse
	if err := json.Unmarshal(body, &resp); err != nil {
		return "", fmt.Errorf("解析 README 响应失败: %w", err)
	}

	content, err := base64.StdEncoding.DecodeString(resp.Content)
	if err != nil {
		return "", fmt.Errorf("解码 README 内容失败: %w", err)
	}

	return string(content), nil
}

// sortRepositories 加权排序 (star 70% + 更新时间 30%)
func sortRepositories(repos []Repository) []Repository {
	if len(repos) == 0 {
		return repos
	}

	maxStars := repos[0].Stars
	minStars := repos[0].Stars
	maxTime := repos[0].UpdatedAt.Unix()
	minTime := repos[0].UpdatedAt.Unix()

	for _, r := range repos {
		if r.Stars > maxStars {
			maxStars = r.Stars
		}
		if r.Stars < minStars {
			minStars = r.Stars
		}
		if r.UpdatedAt.Unix() > maxTime {
			maxTime = r.UpdatedAt.Unix()
		}
		if r.UpdatedAt.Unix() < minTime {
			minTime = r.UpdatedAt.Unix()
		}
	}

	type scored struct {
		repo  Repository
		score float64
	}

	scoredRepos := make([]scored, len(repos))
	for i, r := range repos {
		normStars := 1.0
		if maxStars > minStars {
			normStars = float64(r.Stars-minStars) / float64(maxStars-minStars)
		}
		normTime := 1.0
		if maxTime > minTime {
			normTime = float64(r.UpdatedAt.Unix()-minTime) / float64(maxTime-minTime)
		}
		scoredRepos[i] = scored{repo: r, score: normStars*0.7 + normTime*0.3}
	}

	// 简单冒泡排序（数据量小，性能足够）
	for i := 0; i < len(scoredRepos); i++ {
		for j := i + 1; j < len(scoredRepos); j++ {
			if scoredRepos[j].score > scoredRepos[i].score {
				scoredRepos[i], scoredRepos[j] = scoredRepos[j], scoredRepos[i]
			}
		}
	}

	result := make([]Repository, len(scoredRepos))
	for i, s := range scoredRepos {
		result[i] = s.repo
	}
	return result
}

// queryEscape 简单 URL 编码空格
func queryEscape(s string) string {
	return strings.ReplaceAll(s, " ", "+")
}
