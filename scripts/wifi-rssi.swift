// Prints "<on|off> <rssi>" for the current Wi-Fi interface, e.g. "on -41".
//
// Compiled on demand by .config/sketchybar/plugins/wifi_signal.sh and cached
// under $XDG_CACHE_HOME/sketchybar/. It used to be inlined as `swift -e ...`,
// which recompiled it on every tick: 120ms and 124MB RSS every 10 seconds,
// about 58% of sketchybar's whole CPU budget. Compiled, the same work costs
// 10ms and 9MB.
//
// There is no cheaper source for RSSI: ipconfig getsummary, scutil --nwi and
// wdutil info expose neither RSSI nor noise without sudo, and the airport
// utility was removed from macOS.

import CoreWLAN

if let iface = CWWiFiClient.shared().interface() {
    print("\(iface.powerOn() ? "on" : "off") \(iface.rssiValue())")
} else {
    print("off 0")
}
