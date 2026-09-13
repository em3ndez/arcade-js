-- SPDX-License-Identifier: GPL-3.0-only
-- Gameplay tape for the pixel_suite --done gate: press COIN (IN0 0x04) -> START1 (IN2 0x20, via pokey2) ->
-- FIRE (BUTTONSP1 0x02) to drive Tempest from attract into play, so the MAME golden (AVI) is GAMEPLAY, not
-- attract. Also taps POKEY RANDOM (0x60ca/0x60da) for the testing-only entropy pin the JS side replays. The
-- frame windows are calibrated to reach play; the JS side uses its own (tick-keyed) windows and the pixel
-- suite reconverges drift-tolerant, so the two need only reach the same states, not the same frames. Retain
-- every tap in a global or the GC drops it (a silent flatline).
local rout = assert(io.open(os.getenv("RANDOM_OUT") or "random.txt", "w"))
rout:setvbuf("no")
local mem = manager.machine.devices[":maincpu"].spaces["program"]
local ports = manager.machine.ioport.ports
local function field(port, mask)
  local p = ports[port]
  if not p then return nil end
  for _, f in pairs(p.fields) do if f.mask == mask then return f end end
  return nil
end
local coin = field(":IN0", 0x04)
local start1 = field(":IN2", 0x20)
local fire = field(":BUTTONSP1", 0x02)
_G.__r0 = mem:install_read_tap(0x60ca, 0x60ca, "r0", function(o, d, m) rout:write("0 " .. (d & 0xff) .. "\n") end)
_G.__r1 = mem:install_read_tap(0x60da, 0x60da, "r1", function(o, d, m) rout:write("1 " .. (d & 0xff) .. "\n") end)
local fn = 0
_G.__sub = emu.add_machine_frame_notifier(function()
  fn = fn + 1
  if coin then coin:set_value((fn >= 50 and fn <= 65) and 1 or 0) end
  if start1 then start1:set_value((fn >= 110 and fn <= 130) and 1 or 0) end
  if fire then fire:set_value(((fn >= 200 and fn <= 210) or (fn >= 240 and fn <= 250)) and 1 or 0) end
end)
