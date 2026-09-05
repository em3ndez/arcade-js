-- SPDX-License-Identifier: GPL-3.0-only
-- Galaxian HARDWARE WRITE TRACE: the surface the RAM state dump doesn't cover -- the D0 control latches +
-- the custom discrete-sound registers. VRAM (0x5000)/OBJRAM (0x5800) excluded (already in state); ORDER is
-- part of the contract. Galaxian has NO sound CPU/PPI: sound is memory-mapped device writes. Env: WRITES_OUT

local sp = manager.machine.devices[":maincpu"].spaces["program"]
local out = assert(io.open(os.getenv("WRITES_OUT") or "wtrace.txt", "w"))
out:setvbuf("no")

-- Non-state-covered device write ranges (canonical addresses; galaxian_map_base@1746 + discrete@1739):
--   0x6000-0x6007 start_lamp/coin_lock/coin_count_0 + sound lfo_freq_w
--   0x6800-0x6807 sound_w
--   0x7001-0x7007 irq_enable/stars_enable/flip_x/flip_y latches
--   0x7800        sound pitch_w  (the 0x7800 READ is the watchdog, not written here)
local RANGES = {
  { 0x6000, 0x6007, "io_6000" },
  { 0x6800, 0x6807, "sound_w" },
  { 0x7001, 0x7007, "latches" },
  { 0x7800, 0x7800, "pitch" },
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
