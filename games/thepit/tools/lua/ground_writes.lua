-- SPDX-License-Identifier: GPL-3.0-only
-- Grounding write-tap (The Pit): attribute each RAM/VRAM/colour/sprite/latch write to its CURPC,
-- aggregated in-Lua per (pc,addr) into the 8-col `pc,addr,n,v0,vN,vmin,vmax,cyc0` gwtrace that
-- tools/grounding_evidence.mjs consumes (R38 [U]). Model: games/timeplt/tools/lua/ground_writes.lua.
-- Span 0x8000-0xB800 = full RAM+MMIO (work/colour/video/sprite RAM + LS259 mainlatch + soundlatch), from
-- boards/thepit/hardware.json: a work-RAM-only tap misreads renderer/port producers as writeless.
-- vmin/vmax catch a pulsing cell that ends on its rest value; CURPC is the NEXT instruction.
-- Run: compose games/thepit/tapes/coin_start.lua via TAPE_INSTRUMENT; dump periodically (no stop hook).
-- Env WTRACE_OUT (default gwtrace.csv); cyc0 ignored by the tool. ⚠ Retain every tap token in _G or a GC'd tap flatlines.
local cpu = manager.machine.devices[":maincpu"]
local prog = cpu.spaces["program"]
local OUT = os.getenv("WTRACE_OUT") or "gwtrace.csv"
local CPUHZ = 3072000        -- boards/thepit/hardware.json cpuHz (18.432MHz / 3 / 2)

local T = {}                 -- T[pc][addr] = { n, v0, vN, vmin, vmax, c0(seconds) }
_G.__wt = T
_G.__wtaps = {}

local function tapfn(offset, data, mask)
  local pc = cpu.state["CURPC"].value
  local p = T[pc]; if not p then p = {}; T[pc] = p end
  local e = p[offset]
  if not e then
    p[offset] = { n = 1, v0 = data, vN = data, vmin = data, vmax = data, c0 = manager.machine.time:as_double() }
  else
    e.n = e.n + 1; e.vN = data
    if data < e.vmin then e.vmin = data end
    if data > e.vmax then e.vmax = data end
  end
  return data
end

-- FULL RAM+MMIO write space (work/colour/video/attrspr RAM + LS259 mainlatch + soundlatch). Load-bearing
-- -- do not narrow to work RAM (see header).
_G.__wtaps[1] = prog:install_write_tap(0x8000, 0xb800, "groundw", tapfn)
assert(#_G.__wtaps == 1, "write tap not installed")

local function dump()
  local f = assert(io.open(OUT, "w"))
  f:write("pc,addr,n,v0,vN,vmin,vmax,cyc0\n")
  for pc, p in pairs(T) do
    for addr, e in pairs(p) do
      f:write(string.format("%04x,%04x,%d,%02x,%02x,%02x,%02x,%.0f\n",
        pc, addr, e.n, e.v0, e.vN, e.vmin, e.vmax, e.c0 * CPUHZ))
    end
  end
  f:close()
end

-- MAME 0.2xx has no stop hook; dump periodically so the aggregated trace survives the run's exit.
local frames = 0
_G.__wt_frame = emu.add_machine_frame_notifier(function()
  frames = frames + 1
  if frames % 300 == 0 then dump() end
end)
