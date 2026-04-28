package platform

import (
	"net/http"
	"regexp"
	"strings"
)

var netflixRe = regexp.MustCompile(`/([a-z]{2})/title/`)

// NetflixResult 表示 Netflix 检测结果
type NetflixResult struct {
	Full          bool   // 全解锁
	OriginalsOnly bool   // 仅自制剧
	Region        string // 地区码
}

// CheckNetflix 检测 Netflix 解锁状态
// 1. 全解锁: 非自制剧title返回200/301，提取地区码 → NF-US
// 2. 仅自制剧: 非自制剧title返回404，自制剧title返回200 → NF
// 3. 封禁: 全部403 → 无标签
func CheckNetflix(httpClient *http.Client) (*NetflixResult, error) {
	result := &NetflixResult{}

	// title 81280792 是非自制剧（地区限制内��）
	// title 70143836 是自制剧（Netflix Originals）
	nonOriginalStatus := checkNetflixTitle(httpClient, "81280792")
	originalStatus := checkNetflixTitle(httpClient, "70143836")

	if nonOriginalStatus == 200 || nonOriginalStatus == 301 {
		// 非自制剧可访问 → 全解锁
		result.Full = true
		result.Region = getNetflixRegion(httpClient)
	} else if nonOriginalStatus == 404 && (originalStatus == 200 || originalStatus == 301) {
		// 非自制剧404但自制剧可访问 → 仅自制剧
		result.OriginalsOnly = true
	}

	return result, nil
}

// checkNetflixTitle 检测指定 Netflix title 的 HTTP 状态码
func checkNetflixTitle(httpClient *http.Client, titleID string) int {
	req, err := http.NewRequest("GET", "https://www.netflix.com/title/"+titleID, nil)
	if err != nil {
		return 0
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36")

	resp, err := httpClient.Do(req)
	if err != nil {
		return 0
	}
	defer resp.Body.Close()

	return resp.StatusCode
}

// getNetflixRegion 通过访问特定title提取地区码
func getNetflixRegion(httpClient *http.Client) string {
	req, err := http.NewRequest("GET", "https://www.netflix.com/title/80018499", nil)
	if err != nil {
		return ""
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36")

	// 不跟随重定向，从 Location 头提取地区码
	client := *httpClient
	client.CheckRedirect = func(req *http.Request, via []*http.Request) error {
		return http.ErrUseLastResponse
	}

	resp, err := client.Do(req)
	if err != nil {
		return ""
	}
	defer resp.Body.Close()

	location := resp.Header.Get("Location")
	if location == "" {
		return ""
	}

	// Location 格式如: https://www.netflix.com/xx/title/80018499
	matches := netflixRe.FindStringSubmatch(location)
	if len(matches) > 1 {
		return strings.ToUpper(matches[1])
	}

	return ""
}
