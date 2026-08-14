-- SPDX-License-Identifier: GPL-3.0-only
-- Frogger HARDWARE WRITE TRACE: the surface the RAM state dump doesn't cover -- the D0 control
-- latches + the two 8255 PPIs (sound latch/control). VRAM/OBJRAM excluded (already in state); ORDER
-- is part of the contract. Env: WRITES_OUT

local sp = manager.machine.devices[":maincpu"].spaces["program"]
local out = assert(io.open(os.getenv("WRITES_OUT") or "wtrace.txt", "w"))
out:setvbuf("no")

-- Non-state-covered ranges from hardware.json writeRanges: the 0xB8xx D0 latches (one tap) + the
-- 0xC000 PPI window (sound latch/control + PPI control words).
local RANGES = {
  { 0xB808, 0xB81C, "latches" },
  { 0xC000, 0xFFFF, "ppi_window" },
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
