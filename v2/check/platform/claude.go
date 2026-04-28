package platform

import (
	"net/http"
	"regexp"
)

var claudeRe = regexp.MustCompile(`loc=([A-Z]{2})`)

// Claude 封禁地区列表（二字码）
var claudeBlockedRegions = map[string]bool{
	"AF": true, "BY": true, "CN": true, "CU": true, "HK": true,
	"IR": true, "KP": true, "MO": true, "RU": true, "SY": true,
}

// CheckClaude 检测 Claude 解锁状态
// 通过 cdn-cgi/trace 提取地区码，再用封禁列表过滤
// 返回地区二字码（如 "US"），空字符串表示不可用
func CheckClaude(httpClient *http.Client) (string, error) {
	req, err := http.NewRequest("GET", "https://claude.ai/cdn-cgi/trace", nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36")

	resp, err := httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	buf := getPooledBuf()
	defer putPooledBuf(buf)
	if _, err := buf.ReadFrom(resp.Body); err != nil {
		return "", err
	}
	body := buf.Bytes()

	matches := claudeRe.FindSubmatch(body)
	if len(matches) <= 1 {
		return "", nil
	}

	region := string(matches[1])
	if claudeBlockedRegions[region] {
		return "", nil
	}

	return region, nil
}
