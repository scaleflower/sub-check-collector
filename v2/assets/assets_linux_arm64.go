//go:build linux && arm64
// +build linux,arm64

package assets

import (
	_ "embed"
)

//go:embed node_linux_arm64.zst
var EmbeddedNode []byte
