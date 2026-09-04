-- SPDX-License-Identifier: GPL-3.0-only
-- player_death mechanic tape for the MAME golden (mame_golden.py --tape): coin @300, 1P start @360, NO
-- fire/move up to the poke. At the poke frame, seat the player-ship record (record 0, 0x2010..0x2017) at
-- its death-drain step -- animByte (0x2015)=0 (death animation, not the 0xff alive sentinel), inner
-- (0x2016)/outer (0x2017) timers at 1 so ONE ship-handler pass drains the animation -- with two reserve
-- ships seated (0x21ff=2) and the warm-restart suppress (0x206d) clear. This pokes the ship-hit TRIGGER
-- (the state stepAlienShot sets when an alien bomb collides with the ship band); the ROM's playerShipHandler
-- (0x028e) then consumes the life on its own -- the reserve count drops 2->1 and the round continues
-- (respawn). Poked IDENTICALLY on the JS side by games/invaders/tools/mech_compare.mjs (--mechanic
-- player_death). Env-driven so the suite and the comparator stay in lockstep. Input via IN1 fields so MAME
-- folds the active-low coin polarity.
local COIN_FRAME  = tonumber(os.getenv("TAPE_COIN_FRAME")  or "300")
local START_FRAME = tonumber(os.getenv("TAPE_START_FRAME") or "360")
local POKE_FRAME  = tonumber(os.getenv("TAPE_POKE_FRAME")  or "764")
local RESERVES    = tonumber(os.getenv("TAPE_RESERVES")    or "2")

-- The record-0 death-drain seat + reserve count. Same trigger the transition test drives idiomatic-only,
-- here poked into both engines so the life-loss CONSEQUENCE (reserve 2->1) is compared vs MAME.
local POKE = {
  [0x21ff] = RESERVES, -- reserve-ship count (page:0xff), seated so the drop is non-vacuous
  [0x2010] = 0x00,     -- record-0 frame timer hi
  [0x2011] = 0x00,     -- record-0 frame timer lo -> drained, dispatch this pass
  [0x2012] = 0x00,     -- gate byte -> dispatch the handler now
  [0x2013] = 0x8e,     -- handler target lo (0x028e playerShipHandler)
  [0x2014] = 0x02,     -- handler target hi
  [0x2015] = 0x00,     -- animByte != 0xff -> death animation (not alive)
  [0x2016] = 0x01,     -- inner frame timer -> drains this pass
  [0x2017] = 0x01,     -- outer animation counter -> drains -> life consumed
  [0x206d] = 0x00,     -- warm-restart suppress off
}

local IN1 = manager.machine.ioport.ports[":IN1"]
local coin, start1 = IN1:field(0x01), IN1:field(0x04)
local mem = manager.machine.devices[":maincpu"].spaces["program"]

_G.tframe = 0
_G.pd = emu.add_machine_frame_notifier(function()
  _G.tframe = _G.tframe + 1
  local f = _G.tframe
  if coin then coin:set_value((f >= COIN_FRAME and f < COIN_FRAME + 6) and 1 or 0) end
  if start1 then start1:set_value((f >= START_FRAME and f < START_FRAME + 6) and 1 or 0) end
  if f == POKE_FRAME then
    for addr, val in pairs(POKE) do mem:write_u8(addr, val) end
  end
end)
