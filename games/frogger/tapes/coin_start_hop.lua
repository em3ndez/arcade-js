-- SPDX-License-Identifier: GPL-3.0-only
-- Frogger coin + start + HOP input tape (RIDE-HANDLER validation probe, games/frogger de-risk).
-- Presses Coin 1 (IN0 b7) then 1 Player Start (IN1 b7) to reach in-play (PLAY_FLAG 0x83fe=1), then
-- pulses P1 Up (IN2 b4) once the frog has settled idle at its road start (FROG_Y 0x8047 = 0xE0, ~MAME
-- frame 262). A single UP edge hops the frog one row up, which drives the frog's per-direction hop
-- animation = the "river-lane ride" begin/commit handlers (rideRiverLaneAndCommitArrival, dispatched by
-- commitRiverLaneArrivals 0x23b7): lane-1 (vertical UP) carries FROG_Y down by RIVER_VERTICAL_RIDE_DELTA
-- each frame while RIVER_LANE1_RIDE_COUNTER (0x8251) drains, with RIVER_LANE1_DIR (0x8249) held set.
-- Optional second RIGHT pulse (P1 Right, IN0 b4) drives lane-2 (horizontal) carrying FROG_X.
-- Frame numbers are env-overridable so timings can be swept without editing the file. Composed with an
-- instrument by mame_golden.py's tape shim (tape first, then dump_state.lua).
local COIN_FRAME  = tonumber(os.getenv("TAPE_COIN_FRAME")  or "150")
local COIN_HOLD   = tonumber(os.getenv("TAPE_COIN_HOLD")   or "8")
local START_FRAME = tonumber(os.getenv("TAPE_START_FRAME") or "210")
local START_HOLD  = tonumber(os.getenv("TAPE_START_HOLD")  or "8")
local UP_FRAME    = tonumber(os.getenv("TAPE_UP_FRAME")    or "300")
local UP_HOLD     = tonumber(os.getenv("TAPE_UP_HOLD")     or "4")
local RIGHT_FRAME = tonumber(os.getenv("TAPE_RIGHT_FRAME") or "0")   -- 0 disables the RIGHT pulse
local RIGHT_HOLD  = tonumber(os.getenv("TAPE_RIGHT_HOLD")  or "4")

local IN0 = manager.machine.ioport.ports[":IN0"]
local IN1 = manager.machine.ioport.ports[":IN1"]
local IN2 = manager.machine.ioport.ports[":IN2"]
assert(IN0, "no :IN0"); assert(IN1, "no :IN1"); assert(IN2, "no :IN2")
local coin  = IN0.fields["Coin 1"]
local start = IN1.fields["1 Player Start"]
local up    = IN2.fields["P1 Up"]
local right = IN0.fields["P1 Right"]
assert(coin,  "IN0 'Coin 1' field not found")
assert(start, "IN1 '1 Player Start' field not found")
assert(up,    "IN2 'P1 Up' field not found")
assert(right, "IN0 'P1 Right' field not found")

local f = 0
_G.__coinstarthop = emu.add_machine_frame_notifier(function()
  f = f + 1
  coin:set_value((f >= COIN_FRAME  and f < COIN_FRAME  + COIN_HOLD)  and 1 or 0)
  start:set_value((f >= START_FRAME and f < START_FRAME + START_HOLD) and 1 or 0)
  up:set_value((f >= UP_FRAME and f < UP_FRAME + UP_HOLD) and 1 or 0)
  if RIGHT_FRAME > 0 then
    right:set_value((f >= RIGHT_FRAME and f < RIGHT_FRAME + RIGHT_HOLD) and 1 or 0)
  end
end)
