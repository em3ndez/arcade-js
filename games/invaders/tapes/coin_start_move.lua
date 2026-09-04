-- SPDX-License-Identifier: GPL-3.0-only
-- No-fork gameplay tape for the MAME golden: coin @300, 1P start @360, then from 500 a left/right sweep
-- ONLY (NO fire) so no alien dies -> no alien-death busy-wait collapse -> the idiomatic collapsed timeline
-- stays uniformly aligned to MAME (validates ship-move + alien-march + render vs MAME byte-exact; shoot/
-- collision/death are covered by the poke mechanics gate, which sidesteps tape-alignment). IN1 fields.
local IN1 = manager.machine.ioport.ports[":IN1"]
local coin, start1 = IN1:field(0x01), IN1:field(0x04)
local left, right = IN1:field(0x20), IN1:field(0x40)
_G.tframe = 0
_G.tn = emu.add_machine_frame_notifier(function()
  _G.tframe = _G.tframe + 1; local f = _G.tframe
  if coin then coin:set_value((f >= 300 and f < 306) and 1 or 0) end
  if start1 then start1:set_value((f >= 360 and f < 366) and 1 or 0) end
  if left then left:set_value((f >= 500 and (f % 160) < 80) and 1 or 0) end
  if right then right:set_value((f >= 500 and (f % 160) >= 80) and 1 or 0) end
end)
