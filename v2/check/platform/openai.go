package platform

import (
	"bytes"
	"net/http"
	"regexp"
)

var openaiRe = regexp.MustCompile(`loc=([A-Z]{2})`)

// OpenAIResult 表示 OpenAI 检测结果
type OpenAIResult struct {
	Full   bool   // 客户端可用（cookies+client双通过）
	Web    bool   // 仅Web端可用（单项通过）
	Region string // 地区码
}

// CheckOpenAI 检测 ChatGPT 解锁状态
// 1. cookies+client 双通过 → GPT⁺-US
// 2. 仅单项通过 → GPT-US
// 3. 都不通过 → 无标签
func CheckOpenAI(httpClient *http.Client) *OpenAIResult {
	result := &OpenAIResult{}

	cookiesOK := checkCookies(httpClient)
	clientOK := checkClient(httpClient)

	if cookiesOK && clientOK {
		result.Full = true
	} else if cookiesOK || clientOK {
		result.Web = true
	} else {
		return result
	}

	result.Region = getOpenAIRegion(httpClient)
	return result
}

// getOpenAIRegion 通过 Cloudflare cdn-cgi/trace 提取地区码
func getOpenAIRegion(httpClient *http.Client) string {
	req, err := http.NewRequest("GET", "https://chat.openai.com/cdn-cgi/trace", nil)
	if err != nil {
		return ""
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36")

	resp, err := httpClient.Do(req)
	if err != nil {
		return ""
	}
	defer resp.Body.Close()

	buf := getPooledBuf()
	defer putPooledBuf(buf)
	if _, err := buf.ReadFrom(resp.Body); err != nil {
		return ""
	}
	body := buf.Bytes()

	matches := openaiRe.FindSubmatch(body)
	if len(matches) > 1 {
		return string(matches[1])
	}
	return ""
}

// checkCookies 通过检查cookies判断网络访问
func checkCookies(httpClient *http.Client) bool {
	req, err := http.NewRequest("GET", "https://api.openai.com/compliance/cookie_requirements", nil)
	if err != nil {
		return false
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36")
	resp, err := httpClient.Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()

	buf := getPooledBuf()
	defer putPooledBuf(buf)
	if _, err := buf.ReadFrom(resp.Body); err != nil {
		return false
	}
	body := buf.Bytes()

	return !bytes.Contains(bytes.ToLower(body), []byte("unsupported_country"))
}

// checkClient 通过模拟客户端访问检查app可用性
func checkClient(httpClient *http.Client) bool {
	req, err := http.NewRequest("GET", "https://ios.chat.openai.com", nil)
	if err != nil {
		return false
	}

	req.Header.Set("User-Agent", "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6_0 like Mac OS X) AppleWebKit/537.36 (KHTML, like Gecko) Mobile/16G29 ChatGPT/3.0")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Requested-With", "com.openai.chatgpt")
	req.Header.Set("Referer", "https://chat.openai.com/")
	req.Header.Set("Accept-Language", "en-US,en;q=0.9")
	req.Header.Set("Origin", "https://chat.openai.com")
	req.Header.Set("Sec-Fetch-Site", "same-origin")
	req.Header.Set("sec-ch-ua-mobile", "?1")

	resp, err := httpClient.Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()

	buf := getPooledBuf()
	defer putPooledBuf(buf)
	if _, err := buf.ReadFrom(resp.Body); err != nil {
		return false
	}
	body := buf.Bytes()

	bodyLower := bytes.ToLower(body)
	return !bytes.Contains(bodyLower, []byte("unsupported_country")) && !bytes.Contains(bodyLower, []byte("vpn"))
}
