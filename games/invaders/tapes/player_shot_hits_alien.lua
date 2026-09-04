-- SPDX-License-Identifier: GPL-3.0-only
-- player_shot_hits_alien mechanic tape (mame_golden.py --tape): coin@300, 1P start@360, no fire. At the
-- poke frame, seat a LIVE player shot one step BELOW a live bottom-row alien so the ROM's own stepper drives
-- it UP into the alien and drawSpriteWithCollision -> resolvePlayerShotHit (0x14d8) kills it: this pokes the
-- TRIGGER (a live shot below the alien), NOT the end-state -- the kill (cell clear, status 2->5, ALIEN_COUNT
-- -1, score) is computed by the ROM. Poked IDENTICALLY on the JS side by mech_compare.mjs (--mechanic
-- player_shot_hits_alien), env-driven. Input via IN1 fields (MAME folds the active-low coin polarity).
local COIN_FRAME  = tonumber(os.getenv("TAPE_COIN_FRAME")  or "300")
local START_FRAME = tonumber(os.getenv("TAPE_START_FRAME") or "360")
local POKE_FRAME  = tonumber(os.getenv("TAPE_POKE_FRAME")  or "764")

-- The full player-shot descriptor + step + fire-latch, seating a live shot at (Y=0x74, X=0x44): one 4px
-- step below the bottom alien row, on a live column (idiomatic sweep: X in [0x40..0x4a] all kill cell 0x2100).
local POKE = {
  [0x2025] = 0x02, -- PLAYER_SHOT_STATUS = 2 (in flight)
  [0x2026] = 0x10, -- retire counter
  [0x2027] = 0x90, -- PLAYER_SHOT_DESC lo (sprite src 0x1c90)
  [0x2028] = 0x1c, -- PLAYER_SHOT_DESC hi
  [0x2029] = 0x74, -- shot Y coord (one step below the bottom alien row 0x78)
  [0x202a] = 0x44, -- shot X coord (live column)
  [0x202b] = 0x01, -- sprite row count
  [0x202c] = 0x04, -- per-frame Y step
  [0x202d] = 0x01, -- FIRE_BUTTON_LATCH (a shot is out)
}

local IN1 = manager.machine.ioport.ports[":IN1"]
local coin, start1 = IN1:field(0x01), IN1:field(0x04)
local mem = manager.machine.devices[":maincpu"].spaces["program"]

_G.tframe = 0
_G.psha = emu.add_machine_frame_notifier(function()
  _G.tframe = _G.tframe + 1
  local f = _G.tframe
  if coin then coin:set_value((f >= COIN_FRAME and f < COIN_FRAME + 6) and 1 or 0) end
  if start1 then start1:set_value((f >= START_FRAME and f < START_FRAME + 6) and 1 or 0) end
  if f == POKE_FRAME then
    for addr, val in pairs(POKE) do mem:write_u8(addr, val) end
  end
end)
