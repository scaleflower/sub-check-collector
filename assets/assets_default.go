//go:build !darwin && !linux && !windows
// +build !darwin,!linux,!windows

package assets

import (
	_ "embed"
)

// 其他不支持的平台
// 需要手动指定NODEBIN_PATH
var EmbeddedNode []byte
