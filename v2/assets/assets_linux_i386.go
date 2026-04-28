//go:build linux && 386
// +build linux,386

package assets

import (
	_ "embed"
)

// node 不支持 linux 386 架构
var EmbeddedNode []byte
