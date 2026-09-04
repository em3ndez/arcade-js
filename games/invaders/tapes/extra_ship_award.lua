-- SPDX-License-Identifier: GPL-3.0-only
-- Extra-ship-award mechanic tape for the MAME golden (mame_golden.py --tape): coin @300, 1P start @360,
-- NO fire/move (a natural shot + kill would trigger the alien-explosion despawn collapse). At the poke
-- frame, arm the award-pending flag (0x20e5) and set the player-1 score tally (0x20f9) at/above the
-- bonus threshold, so awardExtraShip (0x0935, called each frame from the main loop) grants the reserve
-- ship exactly once: reserve count (0x21ff) +1, flag cleared, reserve column + lives digit repainted.
-- Poked IDENTICALLY on the JS side by games/invaders/tools/mech_compare.mjs. Env-driven so the suite and
-- the comparator stay in lockstep. Input via IN1 fields so MAME folds the active-low coin polarity.
local COIN_FRAME  = tonumber(os.getenv("TAPE_COIN_FRAME")  or "300")
local START_FRAME = tonumber(os.getenv("TAPE_START_FRAME") or "360")
local POKE_FRAME  = tonumber(os.getenv("TAPE_POKE_FRAME")  or "760")
local TALLY_VAL   = tonumber(os.getenv("TAPE_TALLY_VAL")   or "32") -- 0x20, above either bonus threshold

local FLAG_ADDR  = 0x20e5 -- award-pending flag (activePlayerFlagPtr - 2, player 1)
local TALLY_ADDR = 0x20f9 -- player-1 score tally byte (currentPlayerRecordPtr + 1)

local IN1 = manager.machine.ioport.ports[":IN1"]
local coin, start1 = IN1:field(0x01), IN1:field(0x04)
local mem = manager.machine.devices[":maincpu"].spaces["program"]

_G.tframe = 0
_G.esa = emu.add_machine_frame_notifier(function()
  _G.tframe = _G.tframe + 1
  local f = _G.tframe
  if coin then coin:set_value((f >= COIN_FRAME and f < COIN_FRAME + 6) and 1 or 0) end
  if start1 then start1:set_value((f >= START_FRAME and f < START_FRAME + 6) and 1 or 0) end
  if f == POKE_FRAME then
    mem:write_u8(FLAG_ADDR, 1)
    mem:write_u8(TALLY_ADDR, TALLY_VAL)
  end
end)
