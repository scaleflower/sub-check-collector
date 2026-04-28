package platform

import (
	"net/http"
	"regexp"
	"strings"

	"github.com/biter777/countries"
)

var geminiRe = regexp.MustCompile(`,2,1,200,"([A-Z]{3})"`)

// Gemini 封禁地区列表（三字码）
var geminiBlockedCodes = map[string]bool{
	"CHN": true, "RUS": true, "BLR": true, "CUB": true,
	"IRN": true, "PRK": true, "SYR": true, "HKG": true, "MAC": true,
}

// alpha3ToAlpha2 使用 countries 库将三字码转换为二字码
func alpha3ToAlpha2(alpha3 string) string {
	code := strings.ToUpper(alpha3)
	country := countries.ByName(code)
	if country == countries.Unknown {
		return ""
	}
	return country.Alpha2()
}

// CheckGemini 检测 Google Gemini 解锁状态
// 返回地区二字码（如 "US"），空字符串表示不可用
func CheckGemini(httpClient *http.Client) (string, error) {
	req, err := http.NewRequest("GET", "https://gemini.google.com/", nil)
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

	// 提取三字母国家码
	matches := geminiRe.FindSubmatch(body)
	if len(matches) <= 1 {
		return "", nil
	}

	alpha3Code := string(matches[1])

	// 检查是否在封禁列表中
	if geminiBlockedCodes[alpha3Code] {
		return "", nil
	}

	alpha2Code := alpha3ToAlpha2(alpha3Code)
	if alpha2Code == "" {
		return "", nil
	}
	return alpha2Code, nil
}
