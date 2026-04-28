package platform

import (
	"bytes"
	"encoding/json"
	"io"
	"sync"
)

// bodyBufPool 复用 HTTP response body 的 buffer,摊薄 io.ReadAll 的扩容成本。
var bodyBufPool = sync.Pool{
	New: func() any {
		return bytes.NewBuffer(make([]byte, 0, 64<<10))
	},
}

// getPooledBuf 从池子借一个 len=0 的 buffer。
//
// 契约:
//   - 必须 defer putPooledBuf(buf) 归还 buffer。
//   - 归还之后 buf.Bytes() 拿到的切片不再有效,也不能让它或其 substring 逃逸到
//     函数外(存入返回值、struct 字段、闭包捕获等均不允许)。
func getPooledBuf() *bytes.Buffer {
	buf := bodyBufPool.Get().(*bytes.Buffer)
	buf.Reset()
	return buf
}

// putPooledBuf 把 buf 归还池子。异常大的 buffer 直接丢弃,避免池子膨胀。
func putPooledBuf(buf *bytes.Buffer) {
	if buf == nil || buf.Cap() > 4<<20 {
		return
	}
	bodyBufPool.Put(buf)
}

// readJSONPooled 读 r 并把 JSON 解码到 v,buffer 在返回前归还池子。
func readJSONPooled(r io.Reader, v any) error {
	buf := getPooledBuf()
	defer putPooledBuf(buf)
	if _, err := buf.ReadFrom(r); err != nil {
		return err
	}
	return json.Unmarshal(buf.Bytes(), v)
}
