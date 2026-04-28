//go:build darwin && amd64
// +build darwin,amd64

package assets

import (
	_ "embed"
)

//go:embed node_darwin_amd64.zst
var EmbeddedNode []byte
