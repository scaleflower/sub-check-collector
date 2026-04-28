//go:build linux && amd64
// +build linux,amd64

package assets

import (
	_ "embed"
)

//go:embed node_linux_amd64.zst
var EmbeddedNode []byte
