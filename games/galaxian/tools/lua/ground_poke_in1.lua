-- SPDX-License-Identifier: GPL-3.0-only
-- Variant of ground_poke.lua that ALSO forces hardware input bits on IN1 (0x6800) so gate cells the NMI
-- refreshes from hardware (e.g. 0x4011 raw IN1) can be driven. From GROUND_T: OR GROUND_IN1_SET into IN1
-- and clear GROUND_IN1_CLR bits, plus apply GROUND_POKES to RAM every frame. CURPC is the NEXT instruction.
local out = io.open(os.getenv("GROUND_OUT") or "ground_poke.csv", "w")
out:setvbuf("no"); out:write("t,curpc,addr,value\n")
local cpu = manager.machine.devices[":maincpu"]
local prog = cpu.spaces["program"]
local function now() return manager.machine.time:as_double() end
local pt = tonumber(os.getenv("GROUND_T") or "5.0")
local in1set = tonumber(os.getenv("GROUND_IN1_SET") or "0", 16)
local in1clr = tonumber(os.getenv("GROUND_IN1_CLR") or "0", 16)
local pokes = {}
for pair in string.gmatch(os.getenv("GROUND_POKES") or "", "([^,]+)") do
  local a, v = string.match(pair, "(%x+):(%x+)")
  if a then pokes[#pokes + 1] = { addr = tonumber(a, 16), val = tonumber(v, 16) } end
end
_G.__wtap = prog:install_write_tap(0x4000, 0x7fff, "gw", function(off, data, mask)
  out:write(string.format("%.3f,%04x,%04x,%02x\n", now(), cpu.state["CURPC"].value, off, data))
end)
_G.__in0 = prog:install_read_tap(0x6000, 0x6000, "in0", function(off, data, mask)
  local t = now(); local v = data
  if t >= 2.0 and t < 2.4 then v = v | 0x01 end
  if t >= 5.0 then v = v | 0x10; local ph = (t - 5.0) % 1.5; if ph < 0.75 then v = v | 0x04 else v = v | 0x08 end end
  return v
end)
_G.__in1 = prog:install_read_tap(0x6800, 0x6800, "in1", function(off, data, mask)
  local t = now(); local v = data
  if t >= 3.6 and t < 4.0 then v = v | 0x01 end
  if t >= pt then v = (v | in1set) & (~in1clr & 0xff) end
  return v
end)
_G.__poke = emu.add_machine_frame_notifier(function()
  if now() >= pt then for _, p in ipairs(pokes) do prog:write_u8(p.addr, p.val) end end
end)
