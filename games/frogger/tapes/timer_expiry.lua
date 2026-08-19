-- SPDX-License-Identifier: GPL-3.0-only
-- Frogger `timer_expiry` MECHANIC scenario tape (mechanics_gate poke-vs-MAME suite). Drives attract ->
-- in-play (Coin 1 then 1 Player Start), then from GATE_HOLD_FROM holds BOARD_LAYOUT_GATE (0x83ea)=0 so the
-- scene core renderFrogSceneAndTickTimer (0x0942) keeps ticking the timer (steady in-play latches the gate
-- SET and the timer freezes — confirmed vs MAME), and at TIMER_POKE_FRAME seeds TIME_REMAINING_P1 (0x83e5)
-- once; the ROM drains it to 0 and raises the expiry flag 0x83cf. The same pokes hit the JS engine
-- (mech_compare.mjs, offset-shifted). Composed after dump_state.lua by mame_golden.py; frame numbers / the
-- poked value are env-overridable.
local COIN_FRAME       = tonumber(os.getenv("TAPE_COIN_FRAME")       or "150")
local COIN_HOLD        = tonumber(os.getenv("TAPE_COIN_HOLD")        or "8")
local START_FRAME      = tonumber(os.getenv("TAPE_START_FRAME")      or "210")
local START_HOLD       = tonumber(os.getenv("TAPE_START_HOLD")       or "8")
local GATE_HOLD_FROM   = tonumber(os.getenv("TAPE_GATE_HOLD_FROM")   or "240")
local TIMER_POKE_FRAME = tonumber(os.getenv("TAPE_TIMER_POKE_FRAME") or "280")
local TIMER_POKE_VAL   = tonumber(os.getenv("TAPE_TIMER_POKE_VAL")   or "8")

local BOARD_LAYOUT_GATE = 0x83ea
local TIME_REMAINING_P1 = 0x83e5

local IN0 = manager.machine.ioport.ports[":IN0"]
local IN1 = manager.machine.ioport.ports[":IN1"]
assert(IN0, "no :IN0"); assert(IN1, "no :IN1")
local coin  = IN0.fields["Coin 1"]
local start = IN1.fields["1 Player Start"]
assert(coin,  "IN0 'Coin 1' field not found")
assert(start, "IN1 '1 Player Start' field not found")

local mem = manager.machine.devices[":maincpu"].spaces["program"]

local f = 0
_G.__timer_expiry = emu.add_machine_frame_notifier(function()
  f = f + 1
  coin:set_value((f >= COIN_FRAME  and f < COIN_FRAME  + COIN_HOLD)  and 1 or 0)
  start:set_value((f >= START_FRAME and f < START_FRAME + START_HOLD) and 1 or 0)
  -- Hold the board-layout gate open so the ROM's timer tick keeps running.
  if f >= GATE_HOLD_FROM then mem:write_u8(BOARD_LAYOUT_GATE, 0) end
  -- Seed the timer once; the ROM drains it from here.
  if f == TIMER_POKE_FRAME then mem:write_u8(TIME_REMAINING_P1, TIMER_POKE_VAL) end
end)
