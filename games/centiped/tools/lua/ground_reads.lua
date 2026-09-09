-- SPDX-License-Identifier: GPL-3.0-only
-- Centipede (Atari, MOS 6502) GROUNDING read-trace: the write-tap can't ground ROM constants/tables (ROM
-- is never written) nor pure input-port reads. This taps READS of the specific input ports + ROM table
-- targets, aggregated per (CURPC, addr) with count + first value, emitting `pc,addr,n,v0`. A role PC that
-- reads a ROM table grounds the constant; the boot checksum/anti-tamper sweep (one PC reading a wide span)
-- grounds nothing role-specific and is EXCLUDED at triage by its address breadth. Taps SPECIFIC targets
-- (not the whole ROM) so opcode fetches never flood the trace. Companion to ground_writes.lua (R38 [U]).
--
-- Run (repo root; MAME romset in ~/Downloads, set centiped3):
--   mame centiped3 -rompath ~/Downloads -video none -sound none -nothrottle -seconds_to_run 40 \
--     -autoboot_script games/centiped/tools/lua/ground_reads.lua
-- then: node tools/grounding_evidence.mjs rdtrace.csv centiped cell <addr>   (env RTRACE_OUT)
-- ⚠ Retain every tap token in _G or a GC'd tap flatlines silently.
local cpu = manager.machine.devices[":maincpu"]
local sp = cpu.spaces["program"]
local OUT = os.getenv("RTRACE_OUT") or "rdtrace.csv"

local T = {}                 -- T[pc][addr] = {n, v0}
_G.__rt = T
_G.__rtaps = {}

local function tapfn(offset, data, mask)
  local pc = cpu.state["CURPC"].value
  local p = T[pc]; if not p then p = {}; T[pc] = p end
  local e = p[offset]
  if not e then p[offset] = { n = 1, v0 = data } else e.n = e.n + 1 end
  return data
end

-- Read targets: the ungrounded input ports (DSW 0x0800-0x0801, IN0-3 0x0C00-0x0C03, POKEY RANDOM 0x100A,
-- EAROM read window 0x1700-0x173F) plus the ROM constant/table cells still [code] (their tight ranges, so
-- the entry reads at base+offset are caught: SEGMENT_ROW_THRESHOLD_TABLE 0x3413.., the 0x346D/0x3A69 tables).
local RANGES = {
  { 0x0800, 0x0801, "dsw" },
  { 0x0c00, 0x0c03, "in" },
  { 0x100a, 0x100a, "pokey_rand" },
  { 0x1700, 0x173f, "earom_r" },
  { 0x2003, 0x2003, "rom_2003" },
  { 0x2120, 0x2120, "rom_2120" },
  { 0x21bf, 0x21c0, "rom_21bf" },
  { 0x3413, 0x3427, "rom_thresh" },
  { 0x346d, 0x347f, "rom_346d" },
  { 0x3a69, 0x3a7f, "rom_3a69" },
  { 0x3fd8, 0x3fd8, "rom_3fd8" },
  { 0x140c, 0x140c, "pal_140c" },
}
for i, r in ipairs(RANGES) do
  _G.__rtaps[i] = sp:install_read_tap(r[1], r[2], "rt" .. i, tapfn)
end
assert(#_G.__rtaps == #RANGES, "not all read taps installed")

local function dump()
  local f = assert(io.open(OUT, "w"))
  f:write("pc,addr,n,v0\n")
  for pc, p in pairs(T) do
    for addr, e in pairs(p) do
      f:write(string.format("%04x,%04x,%d,%02x\n", pc, addr, e.n, e.v0))
    end
  end
  f:close()
end

-- Inline coin -> start -> fire + trackball sweep so the trace reaches gameplay reads, not just attract.
local FLD = nil
local frames = 0
_G.__rt_frame = emu.add_machine_frame_notifier(function()
  if not FLD then
    local IN1 = manager.machine.ioport.ports[":IN1"]
    local TX = manager.machine.ioport.ports[":TRACK0_X"]
    FLD = {
      coin = IN1.fields["Coin 1"], start = IN1.fields["1 Player Start"],
      fire = IN1.fields["P1 Button 1"], tx = TX.fields["Trackball X"],
    }
    assert(FLD.coin and FLD.start and FLD.fire and FLD.tx, "centiped input fields missing")
  end
  local f = frames + 1; frames = f
  FLD.coin:set_value((f >= 300 and f < 306) and 1 or 0)
  FLD.start:set_value((f >= 360 and f < 366) and 1 or 0)
  if f >= 420 then
    FLD.fire:set_value(((f - 420) % 20 < 4) and 1 or 0)
    FLD.tx:set_value((((f - 420) % 120 < 60) and 6 or 250))
  end
  if f % 300 == 0 then dump() end
end)
