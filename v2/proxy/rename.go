package proxies

import (
	"strconv"
	"strings"
	"sync"

	"github.com/biter777/countries"
)

var (
	counter     = make(map[string]int)
	counterLock = sync.Mutex{}
)

func Rename(name string) string {
	counterLock.Lock()
	defer counterLock.Unlock()

	counter[name]++
	return CountryCodeToFlag(name) + name + "_" + strconv.Itoa(counter[name])

}

// ResetRenameCounter 将所有计数器重置为 0
func ResetRenameCounter() {
	counterLock.Lock()
	defer counterLock.Unlock()

	counter = make(map[string]int)
}

func CountryCodeToFlag(countryCode string) string {
	code := strings.ToUpper(countryCode)
	country := countries.ByName(code)
	if country == countries.Unknown {
		return "❓Other"
	}
	return country.Emoji()
}
