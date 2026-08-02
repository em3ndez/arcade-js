-- Donkey Kong driver for tools/reach_sweep.lua — see docs/grounding.md "Triage the backlog FIRST".
--
-- Coins up, starts a 1P game, then walks the four board types by writing 0x6227 / 0x6049 directly
-- (plus the sequence-pointer bytes, whose values are only partly meaningful — see BOARD_SEQ below),
-- stepping DIFFICULTY every board and LEVEL every full cycle, with scripted input so gameplay
-- paths stay live. Returns function(frame, mem) as reach_sweep.lua requires.
--
-- WHAT THIS DRIVER DOES NOT DRIVE (so a not-reached row is read honestly): it never dies
-- deliberately, never collects every prize, never runs two-player, and only brushes each
-- difficulty tier.
--
-- ★ AND THE BIG ONE: IT LOSES THE GAME AND DOES NOT RE-COIN. Measured over 9090 frames, three
--   incidental deaths take lives 3 -> 0 and the machine returns to ATTRACT (0x6005 back to 01) at
--   about frame 4600, for the remaining ~4500 frames. The board/level/difficulty this driver keeps
--   poking are still written, so those frames are LABELLED as gameplay in the CSV's context column
--   while the machine is actually in attract. Any hit attributed to a late phase -- which includes
--   the single largest bucket in the DK sweep -- is an attract hit wearing a gameplay label. The
--   84-of-105 headline is unaffected (a hit is a hit), but do not read the CONTEXT column of a
--   late phase as "this fires on board 4". Any of those can move a routine out of the not-reached set.
local M = manager.machine
local I0, I2 = M.ioport.ports[':IN0'], M.ioport.ports[':IN2']
local coin  = I2.fields['Coin 1']
local start = I2.fields['1 Player Start']
local right, left = I0.fields['P1 Right'], I0.fields['P1 Left']
local up, jump    = I0.fields['P1 Up'], I0.fields['P1 Button 1']

-- Sequence-pointer low bytes. NOT "the four entries of a table at 0x3A70": the ROM's board
-- sequence is single bytes running 0x3A65-0x3A78 with a 0x7F sentinel at 0x3A79, so these four
-- pointers select 01, 02, 04 and (for 0x7C) an address past the sentinel. The four board TYPES
-- actually come from the direct 0x6227 / 0x6049 writes below, which is why the sweep works
-- despite the pointer values being partly meaningless.
local BOARD_SEQ = { 0x70, 0x74, 0x78, 0x7c }

return function(f, mem)
  coin:set_value((f >= 399 and f < 405) and 1 or 0)
  start:set_value((f >= 459 and f < 465) and 1 or 0)

  if f >= 500 then
    local phase = math.floor((f - 500) / 1800)
    local seq   = BOARD_SEQ[(phase % 4) + 1]
    local board = (phase % 4) + 1
    mem:write_u8(0x604A, seq); mem:write_u8(0x604B, 0x3A); mem:write_u8(0x6049, board)
    mem:write_u8(0x622A, seq); mem:write_u8(0x622B, 0x3A); mem:write_u8(0x6227, board)
    mem:write_u8(0x6229, math.min(1 + math.floor(phase / 4), 5))   -- LEVEL
    mem:write_u8(0x6380, math.min(phase, 5))                       -- DIFFICULTY (ROM clamps at 5)
  end

  right:set_value((f >= 520 and (f - 520) % 128 < 48) and 1 or 0)
  left:set_value((f >= 520 and (f - 520) % 128 >= 48 and (f - 520) % 128 < 96) and 1 or 0)
  up:set_value((f >= 520 and (f - 520) % 128 >= 96) and 1 or 0)
  jump:set_value((f >= 540 and (f - 540) % 53 < 3) and 1 or 0)
end
