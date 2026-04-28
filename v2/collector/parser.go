package collector

import (
	"regexp"
	"strings"
)

// 3 种订阅链接匹配模式
var urlPatterns = []*regexp.Regexp{
	// raw.githubusercontent.com 链接
	regexp.MustCompile(`https?://raw\.githubusercontent\.com/[^\s<>"')]+`),
	// GitHub blob 链接
	regexp.MustCompile(`https?://github\.com/[^/\s]+/[^/\s]+/blob/[^\s<>"')]+`),
	// 常见订阅文件后缀
	regexp.MustCompile(`https?://[^\s<>"']+\.(yaml|yml|txt|conf|json|v2ray|clash)`),
}

// 订阅类型关键字（用于日志，不影响提取）
var typeKeywords = map[string][]string{
	"V2Ray":       {"v2ray", "vmess", "vless", "trojan"},
	"Clash":       {"clash"},
	"Shadowsocks": {"shadowsocks", "ss", "ssr"},
}

// ExtractLinks 从内容中提取订阅链接
func ExtractLinks(content, source string) []string {
	found := make(map[string]bool)
	var result []string

	lines := strings.Split(content, "\n")
	for _, line := range lines {
		for _, pattern := range urlPatterns {
			matches := pattern.FindAllString(line, -1)
			for _, u := range matches {
				u = strings.TrimRight(u, ".,;:)>")
				if !found[u] {
					found[u] = true
					result = append(result, u)
				}
			}
		}
	}

	return result
}

// InferType 根据上下文推断订阅类型
func InferType(line string) string {
	lower := strings.ToLower(line)
	for typ, keywords := range typeKeywords {
		for _, kw := range keywords {
			if strings.Contains(lower, kw) {
				return typ
			}
		}
	}
	return ""
}
