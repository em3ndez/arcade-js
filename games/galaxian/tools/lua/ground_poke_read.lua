-- SPDX-License-Identifier: GPL-3.0-only
-- Exec-evidence capture: READ-tap ROM 0x0000-0x3fff (opcode fetches = execution) WHILE poking a deep state,
-- so a no-write routine's execution can be confirmed (its body bytes get opcode-fetched by a non-sweep PC).
-- Same poke/input mechanism as ground_poke.lua. Dedup (pc,addr). Output CSV: pc,addr. Env: GROUND_OUT,
-- GROUND_POKES ("addr:val,..." hex, applied each frame from GROUND_T, default 6.0).
local out = io.open(os.getenv("GROUND_OUT") or "poke_read.csv", "w")
out:setvbuf("no"); out:write("pc,addr\n")
local cpu = manager.machine.devices[":maincpu"]
local prog = cpu.spaces["program"]
local function now() return manager.machine.time:as_double() end
local pt = tonumber(os.getenv("GROUND_T") or "6.0")
local pokes = {}
for pair in string.gmatch(os.getenv("GROUND_POKES") or "", "([^,]+)") do
  local a, v = string.match(pair, "(%x+):(%x+)")
  if a then pokes[#pokes + 1] = { addr = tonumber(a, 16), val = tonumber(v, 16) } end
end
local seen = {}
_G.__rtap = prog:install_read_tap(0x0000, 0x3fff, "gr", function(off, data, mask)
  local pc = cpu.state["CURPC"].value
  local k = pc * 0x10000 + off
  if not seen[k] then seen[k] = true; out:write(string.format("%04x,%04x\n", pc, off)) end
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
