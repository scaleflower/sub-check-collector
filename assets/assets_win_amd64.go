//go:build windows && amd64
// +build windows,amd64

package assets

import (
	_ "embed"
)

//go:embed node_windows_amd64.zst
var EmbeddedNode []byte
