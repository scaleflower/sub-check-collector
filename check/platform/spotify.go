package platform

import (
	"bytes"
	"net/http"
	"strings"
)

// CheckSpotify 检测 Spotify 解锁状态
// 优先从重定向后的 URL 路径提取地区码（如 /us/...），兜底从 body 中提取 countryCode
// 返回地区二字码（如 "US"），空字符串表示不可用
func CheckSpotify(httpClient *http.Client) (string, error) {
	req, err := http.NewRequest("GET", "https://www.spotify.com/api/content/v1/country-selector?platform=web&format=json", nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36")

	resp, err := httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode == 403 || resp.StatusCode == 451 {
		return "", nil
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", nil
	}

	// 方式1: 从重定向后的最终 URL 提取地区码
	// Spotify 会重定向到如 https://www.spotify.com/us/... 或 /jp/...
	finalURL := resp.Request.URL.Path
	if region := extractRegionFromPath(finalURL); region != "" {
		return region, nil
	}

	// 方式2: 从 body 中提取 countryCode
	buf := getPooledBuf()
	defer putPooledBuf(buf)
	if _, err := buf.ReadFrom(resp.Body); err != nil {
		return "", err
	}
	body := buf.Bytes()

	// 检查是否被封禁
	if bytes.Contains(bytes.ToLower(body), []byte("not available in your country")) {
		return "", nil
	}

	// 查找 "countryCode":"XX"
	marker := []byte(`"countryCode":"`)
	if idx := bytes.Index(body, marker); idx != -1 {
		start := idx + len(marker)
		rest := body[start:]
		if end := bytes.Index(rest, []byte(`"`)); end > 0 {
			code := strings.ToUpper(string(rest[:end]))
			if len(code) == 2 {
				return code, nil
			}
		}
	}

	return "", nil
}

// extractRegionFromPath 从 URL 路径的第一段提取地区码
// 如 /us/... → US, /jp/... → JP, /en-us/... → EN
func extractRegionFromPath(path string) string {
	path = strings.TrimPrefix(path, "/")
	if path == "" {
		return ""
	}

	// 取第一段路径
	segment := path
	if idx := strings.Index(path, "/"); idx != -1 {
		segment = path[:idx]
	}

	// 跳过 api 开头（说明没有重定向）
	if segment == "" || segment == "api" {
		return ""
	}

	// 如果是 en-us 这种格式，取前半部分
	if idx := strings.Index(segment, "-"); idx != -1 {
		segment = segment[:idx]
	}

	if len(segment) == 2 {
		return strings.ToUpper(segment)
	}

	return ""
}
