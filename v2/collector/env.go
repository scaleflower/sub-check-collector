package collector

import (
	"bufio"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"

	"github.com/beck-8/subs-check/config"
)

const envFileName = "collector.env"

var (
	envPath     string
	envPathOnce sync.Once
)

// GetEnvPath 返回 collector.env 文件路径
func GetEnvPath() string {
	envPathOnce.Do(func() {
		execPath, err := os.Executable()
		if err == nil {
			envPath = filepath.Join(filepath.Dir(execPath), "config", envFileName)
		} else {
			envPath = envFileName
		}
	})
	return envPath
}

// LoadEnv 从 .env 文件加载 collector 配置到 GlobalConfig
func LoadEnv() error {
	path := GetEnvPath()
	f, err := os.Open(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return fmt.Errorf("打开 collector.env 失败: %w", err)
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			continue
		}
		key := strings.TrimSpace(parts[0])
		value := strings.TrimSpace(parts[1])

		switch key {
		case "COLLECTOR_ENABLED":
			config.GlobalConfig.CollectorEnabled = value == "true"
		case "COLLECTOR_KEYWORDS":
			if value != "" {
				keywords := strings.Split(value, ",")
				for i, k := range keywords {
					keywords[i] = strings.TrimSpace(k)
				}
				config.GlobalConfig.CollectorKeywords = keywords
			}
		case "COLLECTOR_MAX_REPOS":
			if v, err := strconv.Atoi(value); err == nil && v > 0 {
				config.GlobalConfig.CollectorMaxRepos = v
			}
		case "COLLECTOR_MIN_STARS":
			if v, err := strconv.Atoi(value); err == nil && v >= 0 {
				config.GlobalConfig.CollectorMinStars = v
			}
		case "COLLECTOR_MAX_DAYS":
			if v, err := strconv.Atoi(value); err == nil && v >= 0 {
				config.GlobalConfig.CollectorMaxDays = v
			}
		}
	}

	slog.Info(fmt.Sprintf("已加载 collector.env: enabled=%v, keywords=%v, max-repos=%d, min-stars=%d, max-days=%d",
		config.GlobalConfig.CollectorEnabled,
		config.GlobalConfig.CollectorKeywords,
		config.GlobalConfig.CollectorMaxRepos,
		config.GlobalConfig.CollectorMinStars,
		config.GlobalConfig.CollectorMaxDays,
	))
	return scanner.Err()
}

// ReadEnvFile 读取 .env 文件为 map（供 API 使用）
func ReadEnvFile() (map[string]string, error) {
	path := GetEnvPath()
	result := map[string]string{
		"COLLECTOR_ENABLED":  "false",
		"COLLECTOR_KEYWORDS": "clash,subscription",
		"COLLECTOR_MAX_REPOS": "30",
		"COLLECTOR_MIN_STARS": "0",
		"COLLECTOR_MAX_DAYS":  "90",
	}

	f, err := os.Open(path)
	if err != nil {
		if os.IsNotExist(err) {
			return result, nil
		}
		return nil, err
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) == 2 {
			result[strings.TrimSpace(parts[0])] = strings.TrimSpace(parts[1])
		}
	}

	return result, scanner.Err()
}

// WriteEnvFile 将 map 写入 .env 文件
func WriteEnvFile(data map[string]string) error {
	path := GetEnvPath()
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("创建 collector.env 目录失败: %w", err)
	}

	lines := []string{
		"# Collector 配置文件",
		"# 修改后自动热加载，无需重启",
		"",
	}
	for _, key := range []string{
		"COLLECTOR_ENABLED",
		"COLLECTOR_KEYWORDS",
		"COLLECTOR_MAX_REPOS",
		"COLLECTOR_MIN_STARS",
		"COLLECTOR_MAX_DAYS",
	} {
		val, ok := data[key]
		if !ok {
			val = ""
		}
		lines = append(lines, fmt.Sprintf("%s=%s", key, val))
	}

	content := strings.Join(lines, "\n") + "\n"
	if err := os.WriteFile(path, []byte(content), 0644); err != nil {
		return fmt.Errorf("写入 collector.env 失败: %w", err)
	}

	slog.Info("collector.env 已更新")
	return nil
}
