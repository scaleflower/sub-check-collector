//go:build windows && 386
// +build windows,386

package assets

import (
	_ "embed"
)

//go:embed node_windows_i386.zst
var EmbeddedNode []byte
