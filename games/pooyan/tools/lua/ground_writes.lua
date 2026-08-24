-- Grounding write-trace (the producer tools/grounding_evidence.mjs consumes; docs/reviewer-rules.md
-- R38 [U]). Attributes every RAM/VRAM/sprite/latch write to the instruction PC that made it, aggregated
-- per (CURPC, addr) with count + first/last value + first-seen cycle, and emits `pc,addr,n,v0,vN,cyc0`.
-- Drives coin+start+1P play inline so the trace covers real gameplay, not just attract. This is the
-- per-cert MAME evidence a grounding review confirms a [seen] against.
--
-- Run (from repo root; ROM in games/pooyan/rom/, MAME rig per tools/mame_golden.py):
--   mame pooyan -rompath games/pooyan/rom -window -sound none -nothrottle \
--     -autoboot_script games/pooyan/tools/lua/ground_writes.lua
-- then: node tools/grounding_evidence.mjs gwtrace.csv pooyan routine <lo> <hi> | cell <addr>
-- Env: WTRACE_OUT (default gwtrace.csv). MAME 0.288 has no stop hook, so it dumps periodically.
-- ⚠ Retain every tap + notifier token in _G or a garbage-collected tap flatlines silently.
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
    p[offset] = { n = 1, v0 = data, vN = data, c0 = manager.machine.time:as_double() }
  else
    e.n = e.n + 1; e.vN = data
  end
  return data
end

-- color(8000-83ff)+video(8400-87ff)+work(8800-8fff)+sprite0(9000-90ff)+sprite1(9400-94ff);
-- sound latch(a100) + LS259(a180-a187). Watchdog a000 excluded (pure-timing flood, no mem effect).
local RANGES = { {0x8000, 0x94ff}, {0xa100, 0xa100}, {0xa180, 0xa187} }
for i, r in ipairs(RANGES) do
  _G.__wtaps[i] = sp:install_write_tap(r[1], r[2], "wt" .. i, tapfn)
end
assert(#_G.__wtaps == #RANGES, "not all write taps installed")

local function dump()
  local f = assert(io.open(OUT, "w"))
  f:write("pc,addr,n,v0,vN,cyc0\n")
  for pc, p in pairs(T) do
    for addr, e in pairs(p) do
      f:write(string.format("%04x,%04x,%d,%02x,%02x,%.0f\n", pc, addr, e.n, e.v0, e.vN, e.c0 * 3072000))
    end
  end
  f:close()
end

-- Inline coin+start+1P play so the trace reaches gameplay state (not just attract).
local FLD = nil
_G.__wtframe = 0
_G.__wtsub = emu.add_machine_frame_notifier(function()
  if not FLD then
    local IN0 = manager.machine.ioport.ports[":IN0"]
    local IN1 = manager.machine.ioport.ports[":IN1"]
    FLD = {
      coin  = IN0.fields["Coin 1"], start = IN0.fields["1 Player Start"],
      fire  = IN1.fields["P1 Button 1"], up = IN1.fields["P1 Up"], down = IN1.fields["P1 Down"],
    }
    assert(FLD.coin and FLD.start and FLD.fire and FLD.up and FLD.down, "input fields missing")
  end
  local f = _G.__wtframe + 1; _G.__wtframe = f
  FLD.coin:set_value((f >= 300 and f < 306) and 1 or 0)
  FLD.start:set_value((f >= 360 and f < 366) and 1 or 0)
  if f >= 420 then
    FLD.fire:set_value(((f - 420) % 24 < 4) and 1 or 0)
    local half = (f - 420) % 120 < 60
    FLD.up:set_value(half and 1 or 0)
    FLD.down:set_value((not half) and 1 or 0)
  end
  if f % 300 == 0 then dump() end
end)
