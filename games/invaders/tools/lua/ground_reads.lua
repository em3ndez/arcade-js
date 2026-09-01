-- SPDX-License-Identifier: GPL-3.0-only
-- Grounding READ-tap: a ROM data table is never written, so the write-tap cannot ground it; instead
-- attribute every READ of a watched ROM range to the instruction PC that read it, aggregated per
-- (addr, CURPC) as `addr,pc,n,v0`. The role code's own entry reads (base+offset) land on the table
-- bytes attributed to the reading routine; a whole-ROM checksum sweep PC reads hundreds of addrs and
-- grounds nothing, so exclude it in triage. Env: RTRACE_OUT (default rtrace.csv). Input driver: the
-- coin+start+1P-fire play injection so the rate/score/sprite tables are exercised in real play.
-- Retain every tap token in _G or a GC'd tap flatlines silently.
local cpu = manager.machine.devices[":maincpu"]
local sp = cpu.spaces["program"]
local OUT = os.getenv("RTRACE_OUT") or "rtrace.csv"

local T = {}
_G.__rt = T
_G.__rtaps = {}
local function tapfn(offset, data, mask)
  local pc = cpu.state["CURPC"].value
  local a = T[offset]; if not a then a = {}; T[offset] = a end
  local e = a[pc]
  if not e then a[pc] = { n = 1, v0 = data } else e.n = e.n + 1 end
  return data
end

-- Watched ROM data-table ranges (batch-2 tables kept [code]/loc_ pending a read-grounding):
local RANGES = {
  {0x1a11, 0x1a20},          -- FLEET_RATE_THRESHOLDS
  {0x1a21, 0x1a30},          -- FLEET_RATE_TABLE
  {0x1aa1, 0x1aa6},          -- ALIEN_SHOT_RATE_TABLE
  {0x1cb8, 0x1cbc},          -- ALIEN_SHOT_RATE_THRESHOLDS
  {0x1b00, 0x1bc0},          -- WORKRAM_INIT_IMAGE
  {0x1b83, 0x1b8d},          -- loc_1b83 (object template)
  {0x1d20, 0x1d4c},          -- loc_1d20 (shield template)
  {0x1da0, 0x1da3},          -- loc_1da0 (score/award table)
  {0x1e00, 0x1eff},          -- loc_1e00 (sprite/glyph table)
}
for i, r in ipairs(RANGES) do
  _G.__rtaps[i] = sp:install_read_tap(r[1], r[2], "rt" .. i, tapfn)
end
assert(#_G.__rtaps == #RANGES, "not all read taps installed")

local IN1 = manager.machine.ioport.ports[":IN1"]
local coin, start1, fire = IN1:field(0x01), IN1:field(0x04), IN1:field(0x10)
local left, right = IN1:field(0x20), IN1:field(0x40)
local function dump()
  local out = io.open(OUT, "w"); out:write("addr,pc,n,v0\n")
  local addrs = {}; for a in pairs(T) do addrs[#addrs + 1] = a end; table.sort(addrs)
  for _, a in ipairs(addrs) do
    for pc, e in pairs(T[a]) do out:write(string.format("%04x,%04x,%d,%02x\n", a, pc, e.n, e.v0)) end
  end
  out:close()
end

_G.__rframe = 0
_G.__rdumped = false
_G.__rnotify = emu.add_machine_frame_notifier(function()
  _G.__rframe = _G.__rframe + 1; local f = _G.__rframe
  if coin then coin:set_value((f >= 300 and f < 303) and 1 or 0) end
  if start1 then start1:set_value((f >= 360 and f < 363) and 1 or 0) end
  if fire then fire:set_value((f >= 430 and (f % 30) < 2) and 1 or 0) end
  if left then left:set_value((f >= 430 and (f % 160) < 80) and 1 or 0) end
  if right then right:set_value((f >= 430 and (f % 160) >= 80) and 1 or 0) end
  -- The watched tables are read every play frame; dump once well before the run ends (no stop hook here).
  if f >= 2000 and not _G.__rdumped then _G.__rdumped = true; dump() end
end)
