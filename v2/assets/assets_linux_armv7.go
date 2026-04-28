//go:build linux && arm
// +build linux,arm

package assets

import (
	_ "embed"
)

//go:embed node_linux_armv7.zst
var EmbeddedNode []byte
