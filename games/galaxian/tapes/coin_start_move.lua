-- SPDX-License-Identifier: GPL-3.0-only
-- No-death gameplay tape for the MAME pixel golden: coin @300, 1P start @360, then a left/right sweep ONLY
-- (NO fire) from 450 so the player never kills and (in this short window) is never hit -> no kill/death
-- busy-wait collapse -> the idiomatic collapsed timeline stays aligned to MAME (validates ship-move +
-- formation-sweep + starfield/sprite render vs MAME). Shoot/collision/death are the mechanics gate's job.
-- galaxian ports: coin=IN0 0x01, left=IN0 0x04, right=IN0 0x08 (P1 2-way); start1=IN1 0x01. IP_ACTIVE_HIGH.
local IN0 = manager.machine.ioport.ports[":IN0"]
local IN1 = manager.machine.ioport.ports[":IN1"]
local coin, left, right = IN0:field(0x01), IN0:field(0x04), IN0:field(0x08)
local start1 = IN1:field(0x01)
_G.tframe = 0
_G.tn = emu.add_machine_frame_notifier(function()
  _G.tframe = _G.tframe + 1; local f = _G.tframe
  if coin then coin:set_value((f >= 300 and f < 306) and 1 or 0) end
  if start1 then start1:set_value((f >= 360 and f < 366) and 1 or 0) end
  if left then left:set_value((f >= 450 and (f % 160) < 80) and 1 or 0) end
  if right then right:set_value((f >= 450 and (f % 160) >= 80) and 1 or 0) end
end)
