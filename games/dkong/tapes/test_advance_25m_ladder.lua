-- SPDX-License-Identifier: GPL-3.0-only
-- LEVEL-ADVANCE fixture (25m): climb the final ladder, rescue Pauline, advance.
--
-- This tape demonstrates BOARD COMPLETION the honest way: the only thing poked is
-- Mario's STARTING SPOT on the girder below Pauline. The walk to the ladder, the
-- catch, the climb and the rescue are all the game's own engine. Poking Mario
-- straight onto Pauline's platform also fires the rescue, but that is a teleport
-- into the rescue zone, not a completion -- it proves nothing about the climb.
--
-- WHAT IT PROVES (verified in the JS engine, frame numbers below are MAME's):
--   f1499  poke start  -> Mario at (0x78, 0x4a); he settles onto the girder (Y->0x4c)
--   f1505..f1543  hold P1 Right -> X walks 0x78 -> 0x92
--   f1544..       hold P1 Up    -> X LOCKS at 0x93, Y climbs 0x4c -> 0x30
--   f1611  rescue fires   (0x600A -> 0x16)
--   f1844  board advances (0x6227: 1 -> 4)  = 25m -> 100m, the correct DK level-1
--          order (level 1 skips 50m/75m)
--
-- ==========================================================================
-- PINNED CONTRACT VALUES -- do not drift. Each was MEASURED, not guessed.
-- ==========================================================================
-- LADDER_X = 0x92 is the ROM ladder-X for 25m's right ladder to Pauline (record
-- @0x3af8, interpolated to Mario's walk level). This number is the whole trick:
-- an earlier attempt used 0x88/0x84, ~10px short, and Mario stopped "well before
-- the ladder" every time and walked off the girder instead.
--
-- START_Y = 0x4a lands him on the girder that settles at 0x4c. Poking Y to a
-- value that is NOT a girder makes him FALL to the nearest one, and he can neither
-- walk nor climb while falling -- he just lands stuck somewhere else. That was the
-- other thing that cost a lot of time. Girder calibration at this X:
-- 0x2a = Pauline's platform, 0x4c = the girder directly below, 0x6b = two below.
--
-- The RIGHT window ENDS exactly when X hits LADDER_X. This tape is open-loop, so
-- that frame is baked in: hold Right one frame too long and he walks past the
-- ladder; one frame too short and he never reaches it. 25m gameplay begins at
-- f1461 (0x600A -> 0x0c) with Mario spawning bottom-left at (0x3f, 0xf0).
local COIN_FRAME   = tonumber(os.getenv("TAPE_COIN_FRAME")   or "399")
local START_FRAME  = tonumber(os.getenv("TAPE_START_FRAME")  or "459")
local POKE_FRAME   = tonumber(os.getenv("TAPE_POKE_FRAME")   or "1499") -- 2-frame hold
local RIGHT_FRAME  = tonumber(os.getenv("TAPE_RIGHT_FRAME")  or "1505")
local UP_FRAME     = tonumber(os.getenv("TAPE_UP_FRAME")     or "1544") -- Right ends here
local UP_HOLD      = tonumber(os.getenv("TAPE_UP_HOLD")      or "260")
local START_X      = tonumber(os.getenv("TAPE_START_X")      or "120")  -- 0x78
local START_Y      = tonumber(os.getenv("TAPE_START_Y")      or "74")   -- 0x4a

local M   = manager.machine
local mem = M.devices[":maincpu"].spaces["program"]
local I2  = M.ioport.ports[":IN2"]
local I0  = M.ioport.ports[":IN0"]
local coin  = I2.fields["Coin 1"]
local start = I2.fields["1 Player Start"]
local right = I0.fields["P1 Right"]
local up    = I0.fields["P1 Up"]
assert(coin and start and right and up, "fields")

local f = 0
_G.__adv25 = emu.add_machine_frame_notifier(function()
  f = f + 1
  coin:set_value((f >= COIN_FRAME  and f < COIN_FRAME  + 1) and 1 or 0)
  start:set_value((f >= START_FRAME and f < START_FRAME + 1) and 1 or 0)

  -- Poke ONLY the starting spot, for 2 frames, then let the game own him.
  if f >= POKE_FRAME and f <= POKE_FRAME + 1 then
    mem:write_u8(0x6203, START_X)
    mem:write_u8(0x6205, START_Y)
  end

  -- Walk right to the ladder, then climb. The handover frame is the contract.
  right:set_value((f >= RIGHT_FRAME and f < UP_FRAME) and 1 or 0)
  up:set_value((f >= UP_FRAME and f < UP_FRAME + UP_HOLD) and 1 or 0)
end)
