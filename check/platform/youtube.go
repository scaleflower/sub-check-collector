package platform

import (
	"bytes"
	"net/http"
	"regexp"
)

// 在body中查找 INNERTUBE_CONTEXT_GL 并提取区域代码
var youtubeRe = regexp.MustCompile(`"INNERTUBE_CONTEXT_GL"\s*:\s*"([^"]+)"`)

func CheckYoutube(httpClient *http.Client) (string, error) {
	// 创建请求
	req, err := http.NewRequest("GET", "https://www.youtube.com/premium", nil)
	if err != nil {
		return "", err
	}

	// 添加请求头
	req.Header.Set("accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7")
	req.Header.Set("accept-language", "zh-CN,zh;q=0.9")
	req.Header.Set("sec-ch-ua", `"Chromium";v="131", "Not_A Brand";v="24", "Google Chrome";v="131"`)
	req.Header.Set("sec-ch-ua-platform", `"Windows"`)
	req.Header.Set("sec-fetch-dest", "document")
	req.Header.Set("sec-fetch-mode", "navigate")
	req.Header.Set("sec-fetch-site", "none")
	req.Header.Set("user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")

	// 发送请求
	resp, err := httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	// 读取响应内容
	buf := getPooledBuf()
	defer putPooledBuf(buf)
	if _, err := buf.ReadFrom(resp.Body); err != nil {
		return "", err
	}
	body := buf.Bytes()

	// 送中
	if bytes.Contains(body, []byte("www.google.cn")) {
		return "CN", nil
	}

	if bytes.Contains(body, []byte("Premium is not available in your country")) {
		return "", nil
	}

	// 先检测上方是否送中，在检测位置
	match := youtubeRe.FindSubmatch(body)
	if len(match) > 1 {
		if region := string(match[1]); region != "" {
			return region, nil
		}
	}

	return "", nil
}
