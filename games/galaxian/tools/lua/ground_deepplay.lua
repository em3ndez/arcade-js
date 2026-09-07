-- SPDX-License-Identifier: GPL-3.0-only
-- Deep-gameplay grounding capture: coin -> 1P start -> then DRIVE actual play (oscillate left/right +
-- continuous fire) for a long window so the trace reaches wave-spawn, attacker-dive, collision, scoring,
-- next-wave, death and game-over -- the play code the 30s coin+hold-fire capture never enters. Records
-- every RAM+MMIO write (0x4000-0x7fff) with time+PC, same schema as ground_play.lua. CURPC is the NEXT
-- instruction. Input bits (IP_ACTIVE_HIGH): coin=IN0 0x01, left=IN0 0x04, right=IN0 0x08, fire=IN0 0x10,
-- start1=IN1 0x01. Output CSV: t,curpc,addr,value.  Env: GROUND_OUT.
local out = io.open(os.getenv("GROUND_OUT") or "ground_deepplay.csv", "w")
out:setvbuf("no"); out:write("t,curpc,addr,value\n")
local cpu = manager.machine.devices[":maincpu"]
local prog = cpu.spaces["program"]
local function now() return manager.machine.time:as_double() end

_G.__wtap = prog:install_write_tap(0x4000, 0x7fff, "gw", function(off, data, mask)
  out:write(string.format("%.3f,%04x,%04x,%02x\n", now(), cpu.state["CURPC"].value, off, data))
end)

-- IN0: coin pulse ~2.0-2.4s; from 5s onward, hold fire and oscillate left/right on a ~1.5s period so the
-- ship sweeps the field (reaches both edges + the whole formation) across many waves.
_G.__in0 = prog:install_read_tap(0x6000, 0x6000, "in0", function(off, data, mask)
  local t = now(); local v = data
  if t >= 2.0 and t < 2.4 then v = v | 0x01 end
  if t >= 5.0 then
    v = v | 0x10                                   -- fire held
    local phase = (t - 5.0) % 1.5
    if phase < 0.75 then v = v | 0x04 else v = v | 0x08 end  -- sweep left, then right
  end
  return v
end)
-- IN1: start1 pulse ~3.6-4.0s.
_G.__in1 = prog:install_read_tap(0x6800, 0x6800, "in1", function(off, data, mask)
  local t = now(); local v = data
  if t >= 3.6 and t < 4.0 then v = v | 0x01 end
  return v
end)
