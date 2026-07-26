-- SPDX-License-Identifier: GPL-3.0-only
-- TAPE: coin + start, then a MODE.  The Pit (game #2) input tape.
--
--   TAPE_MODE=idle  (default)  press nothing after start
--   TAPE_MODE=dig              hold Down, pulse Dig -- the player tunnels down
--
-- Adapted from games/dkong/tapes/coin_start.lua -- same discipline: ONE file (the
-- coin/start frame numbers are PINNED CONTRACT VALUES, and a second file duplicating
-- them is a place for them to drift silently); modes differ only in what happens AFTER
-- start. Minimise input events, maximise code reached. A 2-event tape is nearly immune
-- to timing drift; a 200-event tape breaks the moment anything upstream shifts a frame.
--
-- ==========================================================================
-- PINNED CONTRACT VALUES -- INPUTS to every golden captured with this tape. WHEN the
-- coin lands relative to the attract cycle may select a different code path, so a tape
-- whose timing is incidental rather than stated is a reproducibility hazard.
-- The env overrides exist so the timings can be SWEPT (a measurement, not a
-- reconfiguration) without editing the file in place and losing the contract.
-- ==========================================================================
local COIN_FRAME  = tonumber(os.getenv("TAPE_COIN_FRAME")  or "400")
local COIN_HOLD   = tonumber(os.getenv("TAPE_COIN_HOLD")   or "8")
local START_FRAME = tonumber(os.getenv("TAPE_START_FRAME") or "460")
local START_HOLD  = tonumber(os.getenv("TAPE_START_HOLD")  or "8")

-- ★ JS-EMIT MIRROR OFFSET = +2. To reproduce a golden captured with THIS tape,
-- the JS emitter presses the SAME bits two frames LATER than these lua frames:
--     emit --input 0xa800=0x01@402:hold8  --input 0xa800=0x04@462:hold8
-- (i.e. coin@400->402, start@460->462). Measured: at +2 the game accepts start on
-- the SAME emulated frame both sides (0x8001 3->1 at frame 464) and the whole
-- coin+start+gameplay run then diffs byte-clean except a 1-byte stack-scratch
-- transient. This is The Pit's analogue of DK's documented emitter N+1 skew (the
-- MAME frame notifier and the JS boundary sample count frames from different
-- origins); it is a CONTRACT, re-verify it if the coin/start timing changes.

-- The Pit input bits (from src/mame/taito/roundup.cpp, mirrored in boards/thepit/io.js):
--   IN1 @ 0xA800 ACTIVE HIGH: b0=Coin1 (0x01)  b2=Start1 (0x04)
--   IN0 @ 0xA000 ACTIVE LOW:  b0=Left b1=Right b2=Down b3=Up b4=Dig/Button1
-- The JS emit --input mirror presses these SAME physical bits (emit inverts IN0's
-- active-low polarity internally), so lua and JS share one "press these bits" contract.

-- COMPOSABILITY: MAME accepts only one -autoboot_script, so the tape carries the
-- instrument. Set TAPE_INSTRUMENT to a Lua path (dump_state.lua, dump_writes.lua, ...)
-- and it is loaded alongside the input; without this a tape could never be measured.
local instrument = os.getenv("TAPE_INSTRUMENT")
if instrument and #instrument > 0 then
  dofile(instrument)
end

-- DIG-MODE constants. PERIODIC rather than game-state-dependent, so immune to timing
-- drift -- a tape that presses "dig when the player reaches a diamond" breaks the moment
-- anything upstream shifts by a frame.
local DIG_PERIOD = 32   -- pulse Dig every 32 frames
local DIG_HOLD   = 6
local DOWN_FROM  = 480  -- hold Down from just after start, continuously

local mode = os.getenv("TAPE_MODE") or "idle"
assert(mode == "idle" or mode == "dig", "TAPE_MODE must be idle or dig")

local IN1 = manager.machine.ioport.ports[":IN1"]
local IN0 = manager.machine.ioport.ports[":IN0"]
local coin  = IN1 and IN1.fields["Coin 1"]
local start = IN1 and IN1.fields["1 Player Start"]
local down  = IN0 and IN0.fields["P1 Down"]
local dig   = IN0 and IN0.fields["P1 Button 1"]
assert(coin,  "IN1 'Coin 1' field not found")
assert(start, "IN1 '1 Player Start' field not found")
assert(down,  "IN0 'P1 Down' field not found")
assert(dig,   "IN0 'P1 Button 1' field not found")

local log = io.open(os.getenv("TAPE_LOG") or "tape.log", "w")
if log then log:setvbuf("no") end

_G.__tape_frame = 0
_G.__tape_sub = emu.add_machine_frame_notifier(function()
  local f = _G.__tape_frame
  _G.__tape_frame = f + 1

  local want_coin  = (f >= COIN_FRAME)  and (f < COIN_FRAME  + COIN_HOLD)
  local want_start = (f >= START_FRAME) and (f < START_FRAME + START_HOLD)

  coin:set_value(want_coin and 1 or 0)
  start:set_value(want_start and 1 or 0)

  if mode == "dig" then
    local in_dig = (f >= DOWN_FROM) and ((f - DOWN_FROM) % DIG_PERIOD < DIG_HOLD)
    dig:set_value(in_dig and 1 or 0)
    down:set_value((f >= DOWN_FROM) and 1 or 0)
  end

  if log and (f == COIN_FRAME or f == COIN_FRAME + COIN_HOLD
              or f == START_FRAME or f == START_FRAME + START_HOLD) then
    log:write(string.format("frame %d  mode=%s coin=%d start=%d\n",
      f, mode, want_coin and 1 or 0, want_start and 1 or 0))
  end
end)
