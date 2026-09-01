-- Grounding capture (play): work-RAM write-tap (full CSV) + video-RAM write-tap (dedup PCs -> reachability of
-- the video routines) + input injection. Env: GROUND_OUT (work CSV), GROUND_VPC (video-PC list).
_G.gout = io.open(os.getenv("GROUND_OUT") or "ground_play.csv", "w")
_G.gout:setvbuf("no"); _G.gout:write("frame,curpc,addr,value\n")
_G.gvpc = io.open(os.getenv("GROUND_VPC") or "ground_vpc.txt", "w"); _G.gvpc:setvbuf("no")
_G.gseen = {}
local cpu = manager.machine.devices[":maincpu"]
local prog = cpu.spaces["program"]
_G.gframe = 0
_G.gtapw = prog:install_write_tap(0x2000, 0x23ff, "gw", function(offset, data, mask)
  _G.gout:write(string.format("%d,%04x,%04x,%02x\n", _G.gframe, cpu.state["CURPC"].value, offset, data))
end)
_G.gtapv = prog:install_write_tap(0x2400, 0x3fff, "gv", function(offset, data, mask)
  local pc = cpu.state["CURPC"].value
  if not _G.gseen[pc] then _G.gseen[pc] = true; _G.gvpc:write(string.format("%04x\n", pc)) end
end)
local IN1 = manager.machine.ioport.ports[":IN1"]
local coin, start1, fire = IN1:field(0x01), IN1:field(0x04), IN1:field(0x10)
local left, right = IN1:field(0x20), IN1:field(0x40)
_G.gnotify = emu.add_machine_frame_notifier(function()
  _G.gframe = _G.gframe + 1; local f = _G.gframe
  if coin then coin:set_value((f >= 300 and f < 303) and 1 or 0) end
  if start1 then start1:set_value((f >= 360 and f < 363) and 1 or 0) end
  if fire then fire:set_value((f >= 430) and 1 or 0) end
  if left then left:set_value((f >= 430 and (f % 160) < 80) and 1 or 0) end
  if right then right:set_value((f >= 430 and (f % 160) >= 80) and 1 or 0) end
end)
