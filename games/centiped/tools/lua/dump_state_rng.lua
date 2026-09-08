-- SPDX-License-Identifier: GPL-3.0-only
-- Convergence capture: per-frame RAM dump (2048B: work RAM + VRAM + sprite RAM, mirroring memory.js dumpState)
-- PLUS an OBSERVE-ONLY log of the $100a POKEY-RANDOM read stream (values in read order). The tap returns the
-- value UNCHANGED, so it does not perturb the run (an OVERRIDE tap on this device register resets the game).
-- The oracle replays this exact stream to entropy-match MAME, then convergence.mjs drift-diffs the state.
local sout = assert(io.open(assert(os.getenv("STATE_OUT")), "wb")); sout:setvbuf("no")
local rout = assert(io.open(assert(os.getenv("RNG_OUT")), "wb")); rout:setvbuf("no")
local mem = manager.machine.devices[":maincpu"].spaces["program"]

_G.__rng_tap = mem:install_read_tap(0x100a, 0x100a, "rng", function(off, data, mask)
  rout:write(string.char(data & 0xff)); return data
end)

local REGIONS = { { 0x0000, 0x03FF }, { 0x0400, 0x07BF }, { 0x07C0, 0x07FF } }
local function sample()
  local p = {}
  for _, r in ipairs(REGIONS) do for a = r[1], r[2] do p[#p + 1] = string.char(mem:read_u8(a)) end end
  sout:write(table.concat(p))
end
sample() -- state[0] = power-on (all zero on this board), before the CPU runs
_G.__frame_sub = emu.add_machine_frame_notifier(sample)
