-- SPDX-License-Identifier: GPL-3.0-only
-- HARDWARE WRITE TRACE: the LS259 latches, the watchdog and the audio latch, none of
-- which the RAM state dump covers. ORDER IS PART OF THE CONTRACT -- a set-comparison
-- would call a reordered trace equivalent, and it is not.
-- Env: WRITES_OUT

local sp = manager.machine.devices[":maincpu"].spaces["program"]
local out = assert(io.open(os.getenv("WRITES_OUT") or "wtrace.txt", "w"))
out:setvbuf("no")

-- hardware.json "writeRanges" is the source of truth; keep this consistent with it.
local RANGES = {
  { 0xC000, 0xC000, "sound_latch" },
  { 0xC200, 0xC200, "watchdog" },
  { 0xC300, 0xC30F, "mainlatch" },
}

-- Retain the subscriptions: a collected MAME tap handle unsubscribes silently.
_G.__write_taps = {}
_G.__write_count = 0

for i, r in ipairs(RANGES) do
  _G.__write_taps[i] = sp:install_write_tap(r[1], r[2], r[3], function(offset, data, mask)
    -- One line per write: cycle, address, value. Cycles are recorded but the differ
    -- compares SEQUENCE first (addr,value); matching cycle-for-cycle needs the JS
    -- side's per-instruction accounting to be exact, which is a later bar.
    local secs = manager.machine.time:as_double()
    out:write(string.format("%.0f %04X %02X\n", secs * 3072000, offset, data))
    _G.__write_count = _G.__write_count + 1
    return data
  end)
end
