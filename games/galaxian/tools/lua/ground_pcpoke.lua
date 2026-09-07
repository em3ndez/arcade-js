-- SPDX-License-Identifier: GPL-3.0-only
-- Entry-triggered grounding: force the play state each frame (GROUND_POKES), and the moment the CPU
-- fetches the target routine's ENTRY opcode (GROUND_ENTRY), poke the routine's GATE cells (GROUND_GATE)
-- so the gates hold exactly when the routine reads them -- then let the REAL routine run on real HW.
-- Logs opcode fetches inside [GROUND_CODELO,GROUND_CODEHI] (exec) and all 0x4000-0x7fff writes (write).
local out = io.open(os.getenv("GROUND_OUT") or "ground_pcpoke.csv", "w")
out:setvbuf("no"); out:write("t,curpc,addr,value,kind\n")
local cpu = manager.machine.devices[":maincpu"]
local prog = cpu.spaces["program"]
local function now() return manager.machine.time:as_double() end
local pt = tonumber(os.getenv("GROUND_T") or "5.0")
local lo = tonumber(os.getenv("GROUND_CODELO") or "0", 16)
local hi = tonumber(os.getenv("GROUND_CODEHI") or "0", 16)
local entry = tonumber(os.getenv("GROUND_ENTRY") or "-1", 16)
local pokes, gate = {}, {}
for pair in string.gmatch(os.getenv("GROUND_POKES") or "", "([^,]+)") do
  local a, v = string.match(pair, "(%x+):(%x+)")
  if a then pokes[#pokes + 1] = { addr = tonumber(a, 16), val = tonumber(v, 16) } end
end
for pair in string.gmatch(os.getenv("GROUND_GATE") or "", "([^,]+)") do
  local a, v = string.match(pair, "(%x+):(%x+)")
  if a then gate[#gate + 1] = { addr = tonumber(a, 16), val = tonumber(v, 16) } end
end
_G.__code = prog:install_read_tap(lo, hi, "code", function(off, data, mask)
  -- when the entry opcode is fetched, slam the gate cells so the routine's reads pass
  if off == entry and now() >= pt then for _, g in ipairs(gate) do prog:write_u8(g.addr, g.val) end end
  out:write(string.format("%.3f,%04x,%04x,%02x,exec\n", now(), cpu.state["CURPC"].value, off, data))
end)
_G.__wtap = prog:install_write_tap(0x4000, 0x7fff, "gw", function(off, data, mask)
  out:write(string.format("%.3f,%04x,%04x,%02x,write\n", now(), cpu.state["CURPC"].value, off, data))
end)
_G.__in0 = prog:install_read_tap(0x6000, 0x6000, "in0", function(off, data, mask)
  local t = now(); local v = data
  if t >= 2.0 and t < 2.4 then v = v | 0x01 end
  if t >= 5.0 then v = v | 0x10; local ph = (t - 5.0) % 1.5; if ph < 0.75 then v = v | 0x04 else v = v | 0x08 end end
  return v
end)
_G.__in1 = prog:install_read_tap(0x6800, 0x6800, "in1", function(off, data, mask)
  local t = now(); if t >= 3.6 and t < 4.0 then return data | 0x01 end; return data
end)
_G.__poke = emu.add_machine_frame_notifier(function()
  if now() >= pt then for _, p in ipairs(pokes) do prog:write_u8(p.addr, p.val) end end
end)
