-- SPDX-License-Identifier: GPL-3.0-only
-- TAPE: coin, start, then fly and shoot, for the per-routine equivalence capture.
--
-- Attract mode reaches most of the code but not what only a CREDITED, PLAYING machine
-- runs: coin and credit handling, score and bonus-life, death and respawn. Those came
-- out "not reached" from an attract-only capture -- a gap in the instrument.
--
-- MINIMISE EVENTS, MAXIMISE CODE: two pinned events plus periodic stick and fire.
-- Nothing reacts to game state, so nothing breaks when a frame shifts upstream.
--
-- PINNED CONTRACT VALUES: when the coin lands relative to the attract cycle can select
-- a different code path, so these are stated. The env overrides let them be SWEPT as a
-- measurement without editing the file and losing the record.
local COIN_FRAME  = tonumber(os.getenv("TAPE_COIN_FRAME")  or "300")
local COIN_HOLD   = tonumber(os.getenv("TAPE_COIN_HOLD")   or "8")
local START_FRAME = tonumber(os.getenv("TAPE_START_FRAME") or "360")
local START_HOLD  = tonumber(os.getenv("TAPE_START_HOLD")  or "8")
local PLAY_FROM   = tonumber(os.getenv("TAPE_PLAY_FROM")   or "420")

-- Time Pilot's stick steers a plane that is always moving, so any held direction is a
-- turn. Rotating through the four directions on a period that does not divide the fire
-- period keeps the two from phase-locking into one repeated situation.
local TURN_PERIOD = 97   -- frames per held direction
local FIRE_PERIOD = 23
local FIRE_HOLD   = 7

local IN0 = manager.machine.ioport.ports[":IN0"]
local IN1 = manager.machine.ioport.ports[":IN1"]
local coin  = IN0 and IN0.fields["Coin 1"]
local start = IN0 and IN0.fields["1 Player Start"]
local fire  = IN1 and IN1.fields["P1 Button 1"]
local dirs  = {
  IN1 and IN1.fields["P1 Up"],
  IN1 and IN1.fields["P1 Right"],
  IN1 and IN1.fields["P1 Down"],
  IN1 and IN1.fields["P1 Left"],
}
assert(coin,  "IN0 'Coin 1' field not found")
assert(start, "IN0 '1 Player Start' field not found")
assert(fire,  "IN1 'P1 Button 1' field not found")
for i, d in ipairs(dirs) do assert(d, "IN1 direction field " .. i .. " not found") end

_G.__tape_frame = 0
_G.__tape_sub = emu.add_machine_frame_notifier(function()
  local f = _G.__tape_frame
  _G.__tape_frame = f + 1

  coin:set_value((f >= COIN_FRAME and f < COIN_FRAME + COIN_HOLD) and 1 or 0)
  start:set_value((f >= START_FRAME and f < START_FRAME + START_HOLD) and 1 or 0)

  local playing = f >= PLAY_FROM
  local held = playing and ((math.floor((f - PLAY_FROM) / TURN_PERIOD) % 4) + 1) or 0
  for i, d in ipairs(dirs) do d:set_value(i == held and 1 or 0) end
  fire:set_value((playing and ((f - PLAY_FROM) % FIRE_PERIOD) < FIRE_HOLD) and 1 or 0)
end)
