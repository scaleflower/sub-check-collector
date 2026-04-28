package collector

import (
	"bufio"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
)

// Aggregator 订阅链接去重与持久化
type Aggregator struct {
	urls map[string]bool
}

// NewAggregator 创建聚合器
func NewAggregator() *Aggregator {
	return &Aggregator{
		urls: make(map[string]bool),
	}
}

// AddURLs 添加 URL 并去重
func (a *Aggregator) AddURLs(urls []string) {
	for _, u := range urls {
		u = strings.TrimSpace(u)
		if u != "" {
			a.urls[u] = true
		}
	}
}

// GetURLs 返回所有 URL
func (a *Aggregator) GetURLs() []string {
	result := make([]string, 0, len(a.urls))
	for u := range a.urls {
		result = append(result, u)
	}
	return result
}

// Count 返回 URL 数量
func (a *Aggregator) Count() int {
	return len(a.urls)
}

// LoadState 从 state 文件加载历史 URL
func (a *Aggregator) LoadState(filePath string) error {
	f, err := os.Open(filePath)
	if err != nil {
		if os.IsNotExist(err) {
			slog.Info("collector state 文件不存在，将创建新文件")
			return nil
		}
		return fmt.Errorf("打开 state 文件失败: %w", err)
	}
	defer f.Close()

	count := 0
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		u := strings.TrimSpace(scanner.Text())
		if u != "" && !strings.HasPrefix(u, "#") {
			a.urls[u] = true
			count++
		}
	}

	slog.Info(fmt.Sprintf("从 state 文件加载了 %d 个历史链接", count))
	return scanner.Err()
}

// SaveState 持久化 URL 到 state 文件
func (a *Aggregator) SaveState(filePath string) error {
	dir := filepath.Dir(filePath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("创建 state 目录失败: %w", err)
	}

	f, err := os.Create(filePath)
	if err != nil {
		return fmt.Errorf("创建 state 文件失败: %w", err)
	}
	defer f.Close()

	w := bufio.NewWriter(f)
	for u := range a.urls {
		if _, err := w.WriteString(u + "\n"); err != nil {
			return fmt.Errorf("写入 state 文件失败: %w", err)
		}
	}

	if err := w.Flush(); err != nil {
		return fmt.Errorf("刷新 state 文件失败: %w", err)
	}

	slog.Info(fmt.Sprintf("已保存 %d 个链接到 state 文件: %s", len(a.urls), filePath))
	return nil
}
