-- SPDX-License-Identifier: GPL-3.0-only
-- Pooyan HARDWARE WRITE TRACE: the surface the RAM state dump doesn't cover -- the LS259 D0 control
-- latch + the sound-data latch to the audio Z80. Watchdog (0xA000) excluded: pure-timing flood, no
-- memory effect. ORDER is part of the contract. Env: WRITES_OUT

local sp = manager.machine.devices[":maincpu"].spaces["program"]
local out = assert(io.open(os.getenv("WRITES_OUT") or "wtrace.txt", "w"))
out:setvbuf("no")

-- Non-state-covered write addresses from hardware.json writeRanges: sound_data (0xA100) + the
-- 0xA180-0xA187 LS259 (one address per bit -> bit = (addr-0xA180)&7).
local RANGES = {
  { 0xA100, 0xA100, "sound" },
  { 0xA180, 0xA187, "latch" },
}

-- Retain the subscriptions: a collected MAME tap handle unsubscribes silently.
_G.__write_taps = {}
_G.__write_count = 0

for i, r in ipairs(RANGES) do
  _G.__write_taps[i] = sp:install_write_tap(r[1], r[2], r[3], function(offset, data, mask)
    -- One line per write: cycle addr value. The differ compares (addr,value) SEQUENCE first.
    local secs = manager.machine.time:as_double()
    out:write(string.format("%.0f %04X %02X\n", secs * 3072000, offset, data))
    _G.__write_count = _G.__write_count + 1
    return data
  end)
end
