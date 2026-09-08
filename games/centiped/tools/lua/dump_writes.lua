-- SPDX-License-Identifier: GPL-3.0-only
-- Centipede (Atari, MOS 6502) HARDWARE WRITE TRACE: the surface the RAM state dump doesn't cover -- the
-- POKEY sound registers, the dynamic palette RAM, the LS259 output latch, the IRQ ack, EAROM, and the
-- watchdog kick. VRAM (0x0400)/spriteRAM (0x07C0) excluded (already in state); ORDER is part of the
-- contract. Centipede has NO sound CPU: sound is memory-mapped POKEY writes. Env: WRITES_OUT

local sp = manager.machine.devices[":maincpu"].spaces["program"]
local out = assert(io.open(os.getenv("WRITES_OUT") or "wtrace.txt", "w"))
out:setvbuf("no")

-- Non-state-covered device write ranges (canonical addresses; centiped.cpp centiped_base_map@695 +
-- centiped_map@718). Mirrors boards/centiped/hardware.json "writeRanges" minus videoram/spriteram:
--   0x1000-0x100F POKEY sound + control write
--   0x1400-0x140F centiped_paletteram_w (dynamic palette; video reads it, not state-diffed)
--   0x1600-0x163F EAROM write   0x1680 EAROM control
--   0x1800        irq_ack_w (clears the 6502 IRQ line)
--   0x1C00-0x1C07 LS259 outlatch (write_d7: one addr/bit, datum = D7)
--   0x2000        watchdog reset_w (WRITE side of 0x2000; the READ side is program ROM)
local RANGES = {
  { 0x1000, 0x100F, "pokey" },
  { 0x1400, 0x140F, "palette" },
  { 0x1600, 0x163F, "earom_w" },
  { 0x1680, 0x1680, "earom_ctl" },
  { 0x1800, 0x1800, "irq_ack" },
  { 0x1C00, 0x1C07, "outlatch" },
  { 0x2000, 0x2000, "watchdog" },
}

-- Retain the subscriptions: a collected MAME tap handle unsubscribes silently.
_G.__write_taps = {}
_G.__write_count = 0

for i, r in ipairs(RANGES) do
  _G.__write_taps[i] = sp:install_write_tap(r[1], r[2], r[3], function(offset, data, mask)
    -- One line per write: cycle addr value. The differ compares (addr,value) SEQUENCE first.
    local secs = manager.machine.time:as_double()
    out:write(string.format("%.0f %04X %02X\n", secs * 1512000, offset, data))
    _G.__write_count = _G.__write_count + 1
    return data
  end)
end
