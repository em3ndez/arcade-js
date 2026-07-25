-- SPDX-License-Identifier: GPL-3.0-only
-- Hardware-write trace for The Pit (game #2), in EXECUTION ORDER. Adapted from
-- games/dkong/tools/lua/dump_writes.lua. Write taps fire without -debug; retain the
-- subscriptions in a global or GC silently truncates the trace. One line per write:
-- cycle, address, value. The differ compares the (addr,value) SEQUENCE first.

local out = assert(io.open(os.getenv("WRITES_OUT") or "writes.txt", "w"))
out:setvbuf("no")

local sp = manager.machine.devices[":maincpu"].spaces["program"]

-- The full hardware write surface outside RAM. Mirrors boards/thepit/hardware.json
-- "writeRanges". Keep consistent with that file.
local RANGES = {
  { 0xB000, 0xB007, "control" },      -- LS259 latch: NMI mask / coin lockout / sound enable / flip
  { 0xB800, 0xB800, "sound_latch" },  -- sound command to the audio Z80
}

_G.__write_taps = {}
_G.__write_count = 0

for i, r in ipairs(RANGES) do
  _G.__write_taps[i] = sp:install_write_tap(r[1], r[2], r[3], function(offset, data, mask)
    local secs = manager.machine.time:as_double()
    out:write(string.format("%.0f %04X %02X\n", secs * 3072000, offset, data))
    _G.__write_count = _G.__write_count + 1
    return data
  end)
end
