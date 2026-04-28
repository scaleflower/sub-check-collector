//go:build windows && arm64
// +build windows,arm64

package assets

import (
	_ "embed"
)

//go:embed node_windows_arm64.zst
var EmbeddedNode []byte
