-- SPDX-License-Identifier: GPL-3.0-only
-- Poke-capture grounding: force a deep state by POKING one or more work-RAM cells to a triggering value
-- each frame (so the game runs a handler the fixed tape never reaches), while recording every RAM+MMIO
-- write (0x4000-0x7fff) with the writing PC. Poking a state to make MAME *run* a handler is valid
-- grounding -- the real hardware executes it. CURPC is the NEXT instruction. Output CSV: t,curpc,addr,value.
-- Env: GROUND_OUT (csv); GROUND_POKES = "addr:val,addr:val,..." (hex) applied every frame from t>=GROUND_T
-- (default 5.0s, after boot); plus coin+start injected so play is live.
local out = io.open(os.getenv("GROUND_OUT") or "ground_poke.csv", "w")
out:setvbuf("no"); out:write("t,curpc,addr,value\n")
local cpu = manager.machine.devices[":maincpu"]
local prog = cpu.spaces["program"]
local function now() return manager.machine.time:as_double() end
local pt = tonumber(os.getenv("GROUND_T") or "5.0")
local pokes = {}
for pair in string.gmatch(os.getenv("GROUND_POKES") or "", "([^,]+)") do
  local a, v = string.match(pair, "(%x+):(%x+)")
  if a then pokes[#pokes + 1] = { addr = tonumber(a, 16), val = tonumber(v, 16) } end
end
_G.__wtap = prog:install_write_tap(0x4000, 0x7fff, "gw", function(off, data, mask)
  out:write(string.format("%.3f,%04x,%04x,%02x\n", now(), cpu.state["CURPC"].value, off, data))
end)
-- coin ~2.0-2.4, start1 ~3.6-4.0, fire+sweep from 5s (live play), and apply the pokes every frame from pt.
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
