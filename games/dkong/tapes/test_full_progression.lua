-- SPDX-License-Identifier: GPL-3.0-only
-- FULL NATURAL-PROGRESSION fixture -- the single long tape that exercises EVERY board
-- transition Donkey Kong has, back to back, by genuine play (no board/level pokes).
--
-- The ROM's own board-sequence table (0x3A70: 01 03 04 01 02 01 03 01 04 7F) drives which
-- board loads next; this tape only ever pokes Mario's STARTING SPOT on each board and then
-- WALKS + CLIMBS to Pauline. 100m has no Pauline, so it is completed by clearing the rivets
-- (poke 0x6290=0 -> Kong falls), the established method for that board.
--
-- WHAT IT PROVES (JS engine frame numbers; MAME frame = these - 1):
--   L1:  25m -> 100m
--   L2:  25m -> 75m -> 100m
--   L3:  25m -> 50m -> 75m -> 100m
--   then the board wraps to 25m at L4 (level counter 0x6229 increments) -- the LEVEL LOOP,
--   where a HAMMER grab is tested (pose beside the lower 25m hammer + JUMP -> 0x6217 latches).
-- Nine board completions + a hammer test in one continuous game. Rescues (0x600A->0x16) fire
-- at JS frames: 1612, 2121, 3267, 4049, 4566, 5712, 6515, 7534, 8051; the hammer latch (0x6217->1) sets ~f9130.
--
-- Each board's recipe is the honest one from the per-board completion work:
--   25m: pose (0x78,0x4a) on the girder below Pauline, walk RIGHT to ladder 0x92, climb.
--   75m: pose (0x50,0x48) on the girder,             walk RIGHT to ladder 0x93, climb.
--   50m: pose (0x18,0x70) ABOVE the belt -> falls to the Y=0x78 conveyor, walk to ladder
--        0x23, climb one floor to Y=0x50 (< 0x51 -> rescue). Posed LATE (to thread the L3
--        fireballs that patrol the belt -- posing early leaves Mario a sitting duck).
--  100m: poke rivet count 0x6290=0 -> Kong falls.
-- The first board's numbers are IDENTICAL to test_advance_25m_ladder.lua (poke@1499,
-- Right 1505-1543, Up@1544) -- this tape is that one, continued through eight more boards.
--
-- Open-loop: every frame below was recorded from a reactive solver then baked to a fixed
-- schedule and re-verified to reproduce all nine completions. Do not drift the numbers.
--
-- VALIDATION (MAME 0.288, the oracle): all nine rescues (0x600A->0x16), every board advance
-- (0x6227), the level increment (0x6229) at the L3->L4 wrap, and the hammer latch (0x6217->1)
-- all fire in MAME's own RAM at the frames above -- confirmed against the JS engine, and the
-- full work-RAM (0x6000-0x6BFF) agrees at every rescue. The COMPLETIONS are byte-faithful.
-- PIXEL CAVEAT (honest): unlike the single-board test_advance_25m_ladder (0.00% through climb),
-- this long run surfaces the known DMA/PRNG cycle-timing artifact -- the PRNG (0x6018/0x6019)
-- drifts between JS and MAME and, since it is not perfectly re-timed, RNG-DRIVEN sprites drift:
-- clean on 25m, ~2.5% on the 75m elevators, transient spikes to ~22% during the tall Kong-climb
-- board intros. Mario's path is poked+walked (RNG-independent), so completions are unaffected;
-- the divergence is enemy/elevator sprite PHASE, not game logic. This is the artifact class the
-- project deliberately does not chase (see docs / the Pauline-climb DMA note).

local COIN_FRAME  = tonumber(os.getenv("TAPE_COIN_FRAME")  or "399")
local START_FRAME = tonumber(os.getenv("TAPE_START_FRAME") or "459")

-- {mameFrame, addr, value, holdFrames}
local POKES = {
  {1499,0x6203,0x78,2},
  {1499,0x6205,0x4a,2},
  {2119,0x6290,0x00,4},
  {3154,0x6203,0x78,2},
  {3154,0x6205,0x4a,2},
  {3812,0x6203,0x50,2},
  {3812,0x6205,0x48,2},
  {4564,0x6290,0x00,4},
  {5599,0x6203,0x78,2},
  {5599,0x6205,0x4a,2},
  {6389,0x6203,0x18,2},
  {6389,0x6205,0x70,2},
  {7297,0x6203,0x50,2},
  {7297,0x6205,0x48,2},
  {8049,0x6290,0x00,4},
  {9076,0x6203,0xbb,2},
  {9076,0x6205,0xd0,2},
  {9077,0x6203,0xbb,2},
  {9077,0x6205,0xd0,2}
}
-- {mameFrame, durationFrames, IN0 bits}  (R=1 L=2 U=4 D=8 J=0x10)
local INPUTS = {
  {1505,39,0x01},
  {1544,67,0x04},
  {3160,39,0x01},
  {3199,67,0x04},
  {3870,101,0x01},
  {3971,77,0x04},
  {5605,39,0x01},
  {5644,67,0x04},
  {6407,10,0x01},
  {6417,97,0x04},
  {7355,101,0x01},
  {7456,77,0x04},
  {9080,24,0x10}
}

local M   = manager.machine
local mem = M.devices[":maincpu"].spaces["program"]
local I2  = M.ioport.ports[":IN2"]
local I0  = M.ioport.ports[":IN0"]
local coin  = I2.fields["Coin 1"]
local start = I2.fields["1 Player Start"]
local right = I0.fields["P1 Right"]
local left  = I0.fields["P1 Left"]
local up    = I0.fields["P1 Up"]
local down  = I0.fields["P1 Down"]
local jump  = I0.fields["P1 Button 1"] or I0.fields["P1 Button1"] or I0.fields["Jump"]
assert(coin and start and right and left and up and down, "fields")

local f = 0
_G.__fullprog = emu.add_machine_frame_notifier(function()
  f = f + 1
  coin:set_value((f == COIN_FRAME) and 1 or 0)
  start:set_value((f == START_FRAME) and 1 or 0)

  for _,p in ipairs(POKES) do
    if f >= p[1] and f < p[1] + p[4] then mem:write_u8(p[2], p[3]) end
  end

  local in0 = 0
  for _,e in ipairs(INPUTS) do
    if f >= e[1] and f < e[1] + e[2] then in0 = in0 | e[3] end
  end
  right:set_value((in0 & 0x01) ~= 0 and 1 or 0)
  left :set_value((in0 & 0x02) ~= 0 and 1 or 0)
  up   :set_value((in0 & 0x04) ~= 0 and 1 or 0)
  down :set_value((in0 & 0x08) ~= 0 and 1 or 0)
  if jump then jump:set_value((in0 & 0x10) ~= 0 and 1 or 0) end
end)
