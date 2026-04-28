//go:build darwin && arm64
// +build darwin,arm64

package assets

import (
	_ "embed"
)

//go:embed node_darwin_arm64.zst
var EmbeddedNode []byte
