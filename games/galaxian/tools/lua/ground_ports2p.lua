-- SPDX-License-Identifier: GPL-3.0-only
-- Residual-grounding capture: READ-tap the MMIO ports 0x6000-0x7fff (so the input read-ports IN0/IN1/IN2
-- and the watchdog/DSW reads are observed being read for their role) AND write-tap 0x4000-0x7fff, while
-- injecting a 2-PLAYER game (coin x2 -> START2 -> play) so the player-2 cells and sound/lamp latches are
-- exercised. Two outputs: GROUND_OUT_R (reads: pc,addr) and GROUND_OUT_W (writes: t,curpc,addr,value).
-- CURPC = the accessing instruction's own pc. Input bits IP_ACTIVE_HIGH: coin=IN0 0x01, left 0x04, right
-- 0x08, fire 0x10, start2=IN1 0x02.
local outr = io.open(os.getenv("GROUND_OUT_R") or "reads_ports2p.csv", "w")
local outw = io.open(os.getenv("GROUND_OUT_W") or "writes_ports2p.csv", "w")
outr:setvbuf("no"); outr:write("pc,addr\n")
outw:setvbuf("no"); outw:write("t,curpc,addr,value\n")
local cpu = manager.machine.devices[":maincpu"]
local prog = cpu.spaces["program"]
local function now() return manager.machine.time:as_double() end
local seen = {}
_G.__rtap = prog:install_read_tap(0x6000, 0x7fff, "gr", function(off, data, mask)
  local pc = cpu.state["CURPC"].value
  local k = pc * 0x10000 + off
  if not seen[k] then seen[k] = true; outr:write(string.format("%04x,%04x\n", pc, off)) end
end)
_G.__wtap = prog:install_write_tap(0x4000, 0x7fff, "gw", function(off, data, mask)
  outw:write(string.format("%.3f,%04x,%04x,%02x\n", now(), cpu.state["CURPC"].value, off, data))
end)
-- coin x2 (2 credits), START2, then sweep+fire play
_G.__in0 = prog:install_read_tap(0x6000, 0x6000, "in0", function(off, data, mask)
  local t = now(); local v = data
  if (t >= 2.0 and t < 2.4) or (t >= 2.7 and t < 3.1) then v = v | 0x01 end
  if t >= 5.0 then v = v | 0x10; local ph = (t - 5.0) % 1.5; if ph < 0.75 then v = v | 0x04 else v = v | 0x08 end end
  return v
end)
_G.__in1 = prog:install_read_tap(0x6800, 0x6800, "in1", function(off, data, mask)
  local t = now(); if t >= 3.6 and t < 4.0 then return data | 0x02 end; return data
end)
