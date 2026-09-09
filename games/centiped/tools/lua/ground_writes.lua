-- SPDX-License-Identifier: GPL-3.0-only
-- Centipede (Atari, MOS 6502) GROUNDING write-trace: attributes every RAM/VRAM/sprite/latch write to
-- the instruction PC that made it, aggregated per (CURPC, addr) with count + first/last value +
-- first-seen cycle, emitting `pc,addr,n,v0,vN,cyc0`. This is the per-cert MAME evidence a grounding
-- review confirms a [seen] against (tools/grounding_evidence.mjs; docs/reviewer-rules.md R38 [U]).
-- Model: games/pooyan/tools/lua/ground_writes.lua. Ranges: boards/centiped/hardware.json write space
-- (centiped.cpp centiped_base_map@695). Cycle scale = 1.512 MHz 6502 (matches dump_writes.lua).
--
-- Run (repo root; ROM in games/centiped/rom/):
--   mame centiped -rompath games/centiped/rom -window -sound none -nothrottle \
--     -autoboot_script games/centiped/tools/lua/ground_writes.lua
-- then: node tools/grounding_evidence.mjs gwtrace.csv centiped routine <lo> <hi> | cell <addr>
-- Env: WTRACE_OUT (default gwtrace.csv). ⚠ Retain every tap token in _G or a GC'd tap flatlines silently.
-- Drives coin -> 1P start -> fire + a trackball sweep inline, so the trace covers real gameplay (the
-- movement/collision/spawn leaves), not just attract. Trackball is the player control (analog X/Y).
local cpu = manager.machine.devices[":maincpu"]
local sp = cpu.spaces["program"]
local OUT = os.getenv("WTRACE_OUT") or "gwtrace.csv"

local T = {}                 -- T[pc][addr] = {n, v0, vN, c0(cycles)}
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

-- FULL RAM+MMIO write space (per runbook: a renderer's role write lands in VRAM, a sound-writer's in
-- the latches). work RAM+VRAM+sprite 0x0000-0x07FF; POKEY 0x1000-0x100F; palette 0x1400-0x140F;
-- EAROM 0x1600-0x163F + ctl 0x1680; LS259 outlatch 0x1C00-0x1C07. EXCLUDED as pure-timing floods:
-- watchdog 0x2000, irq_ack 0x1800 (no memory role to ground).
local RANGES = {
  { 0x0000, 0x07FF, "ram" },
  { 0x1000, 0x100F, "pokey" },
  { 0x1400, 0x140F, "palette" },
  { 0x1600, 0x163F, "earom_w" },
  { 0x1680, 0x1680, "earom_ctl" },
  { 0x1C00, 0x1C07, "outlatch" },
}
for i, r in ipairs(RANGES) do
  _G.__wtaps[i] = sp:install_write_tap(r[1], r[2], "wt" .. i, tapfn)
end
assert(#_G.__wtaps == #RANGES, "not all write taps installed")

local function dump()
  local f = assert(io.open(OUT, "w"))
  -- vmin/vmax (not just first/last) so a PULSING cell -- a sound volume set non-zero then back to 0 --
  -- is seen changing; v0==vN would hide it whenever the capture ends on the resting value.
  f:write("pc,addr,n,v0,vN,vmin,vmax,cyc0\n")
  for pc, p in pairs(T) do
    for addr, e in pairs(p) do
      f:write(string.format("%04x,%04x,%d,%02x,%02x,%02x,%02x,%.0f\n", pc, addr, e.n, e.v0, e.vN, e.vmin, e.vmax, e.c0 * 1512000))
    end
  end
  f:close()
end

-- Coin -> start -> deep play: RE-COIN across many short games and sweep BOTH trackball axes with rapid
-- reversals, so the trace reaches deep play states + the sound-event volume cells (set non-zero only by
-- specific effects), not just the first life's attract-adjacent code. MAME 0.2xx has no stop hook; dump
-- periodically so the trace survives a kill.
local FLD = nil
local frames = 0
_G.__wt_frame = emu.add_machine_frame_notifier(function()
  if not FLD then
    local IN1 = manager.machine.ioport.ports[":IN1"]
    local TX = manager.machine.ioport.ports[":TRACK0_X"]
    local TY = manager.machine.ioport.ports[":TRACK0_Y"]
    FLD = {
      coin = IN1.fields["Coin 1"], start = IN1.fields["1 Player Start"],
      fire = IN1.fields["P1 Button 1"],
      tx = TX.fields["Trackball X"], ty = TY and TY.fields["Trackball Y"] or nil,
    }
    assert(FLD.coin and FLD.start and FLD.fire and FLD.tx, "centiped input fields missing")
  end
  local f = frames + 1; frames = f
  local ph = f % 900                                        -- re-coin each ~900-frame cycle (a life ends by then)
  FLD.coin:set_value((ph >= 60 and ph < 66) and 1 or 0)
  FLD.start:set_value((ph >= 120 and ph < 126) and 1 or 0)
  if ph >= 180 then
    FLD.fire:set_value((f % 12 < 4) and 1 or 0)             -- pulse fire
    FLD.tx:set_value(((f % 40 < 20) and 8 or 248))          -- sweep X +8 / -8 (248 = -8 as u8)
    if FLD.ty then FLD.ty:set_value(((f % 26 < 13) and 6 or 250)) end -- sweep Y +6 / -6, offset period
  end
  if f % 300 == 0 then dump() end
end)
