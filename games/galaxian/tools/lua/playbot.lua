-- SPDX-License-Identifier: GPL-3.0-only
-- Galaxian smart play-bot grounding capture. An aim+kill driver that PLAYS the real game under MAME so the
-- trace reaches the scoring / HUD / sound / spawn / crowd / 2-player states a blind sweep-and-fire never
-- enters, and records the grounding taps while it plays. It is the write-tap the R38 grounding confirmer
-- re-runs (docs/runbook.md §4 "Ground at SCALE"; the deep-tail states are reached by PLAYING, not poking).
--
-- Aim (ROT90): the ship's control axis is work-RAM 0x4202 (the player-X reference the enemy AI homes on);
-- the ship's hardware sprite X is 255-0x4202, so by the same rotation an active enemy's aim axis is its
-- hardware sprite X byte (OBJRAM 0x5843 + slot*4). A straight-up shot hits when the two hardware X match,
-- so the bot steers shipHWX(=255-0x4202) toward the most-imminent active enemy sprite (largest Y = nearest
-- the player) and pulses fire. It auto re-coins after a game-over.
--
-- Modes (env): PLAYERS=2 runs a 2-player game (coin x2 + start2, reaching the P2 cells); NOCOIN=1 stays in
-- pure attract (the demo sub-states); START_AFTER_COIN=<frames> lingers with a credit before starting (the
-- attract credit/HUD screens). Inputs are active-HIGH, OR'd into IN0 0x6000 (coin 0x01, coin2 0x02, left
-- 0x04, right 0x08, fire 0x10) and IN1 0x6800 (start1 0x01, start2 0x02), computed each frame and applied
-- at the port read. GROUND_OUT = write CSV (t,curpc,addr,value over 0x4000-0x7fff, CURPC = NEXT instr);
-- GROUND_READS = narrow read CSV (addr,pc) over the residue ROM tables + the two non-writing residue
-- routines' bodies, for ROM-const and reachability grounding. Coin lands only after boot settles (~t=3s);
-- an earlier coin does not bank.
local prog = manager.machine.devices[":maincpu"].spaces["program"]
local cpu = manager.machine.devices[":maincpu"]
local function rd(a) return prog:read_u8(a) end
local function now() return manager.machine.time:as_double() end

local PLAYERS = tonumber(os.getenv("PLAYERS") or "1")
local wout = io.open(os.getenv("GROUND_OUT") or "playbot_writes.csv", "w")
wout:setvbuf("no"); wout:write("t,curpc,addr,value\n")
_G.__wtap = prog:install_write_tap(0x4000, 0x7fff, "pbw", function(off, data, mask)
  wout:write(string.format("%.3f,%04x,%04x,%02x\n", now(), cpu.state["CURPC"].value, off, data))
end)
local rpath = os.getenv("GROUND_READS")
if rpath then
  local rout = io.open(rpath, "w"); rout:setvbuf("no"); rout:write("addr,pc\n")
  _G.__rtaps = {}
  for i, r in ipairs({ {0x1446,0x145b}, {0x259e,0x259f}, {0x1cf6,0x1d20}, {0x1db1,0x1dd1}, {0x22d0,0x2300} }) do
    _G.__rtaps[i] = prog:install_read_tap(r[1], r[2], "pbr"..i, function(off, data, mask)
      rout:write(string.format("%04x,%04x\n", off, cpu.state["CURPC"].value))
    end)
  end
end

local GS = 0x4005; local SHIPX = 0x4202; local SPR = 0x5840

_G.__i0 = 0; _G.__i1 = 0
_G.__in0 = prog:install_read_tap(0x6000, 0x6000, "in0", function(o, d, m) return d | _G.__i0 end)
_G.__in1 = prog:install_read_tap(0x6800, 0x6800, "in1", function(o, d, m) return d | _G.__i1 end)

_G.__f = 0; _G.__coin_f = 0; _G.__seq = false; _G.__played = false

_G.__sub = emu.add_machine_frame_notifier(function()
  local f = _G.__f + 1; _G.__f = f
  local t = now(); local gs = rd(GS); local i0, i1 = 0, 0

  if os.getenv("NOCOIN") then _G.__i0 = 0; _G.__i1 = 0; return end

  if not _G.__seq and not _G.__played and f == 180 then _G.__coin_f = f; _G.__seq = true end
  if _G.__played and gs ~= 0x03 and not _G.__seq and f > _G.__coin_f + 120 then _G.__coin_f = f; _G.__seq = true end
  if _G.__seq then
    local d = f - _G.__coin_f
    if PLAYERS == 2 then
      if (d >= 0 and d < 25) or (d >= 40 and d < 65) then i0 = i0 | 0x01 end  -- two coins
      if d >= 100 and d < 125 then i1 = i1 | 0x02 end                          -- 2-player start
      if d >= 130 then _G.__seq = false end
    else
      local sac = tonumber(os.getenv("START_AFTER_COIN") or "90")
      if d >= 0 and d < 25 then i0 = i0 | 0x01 end
      if d >= sac and d < sac + 25 then i1 = i1 | 0x01 end
      if d >= sac + 30 then _G.__seq = false end
    end
  end

  if gs == 0x03 then
    _G.__played = true
    local shipHWX = (255 - rd(SHIPX)) & 0xff
    local tgtX, tgtY = nil, -1
    for s = 0, 7 do local b = SPR + s * 4; local y = rd(b)
      if y ~= 0xf8 and y ~= 0x00 and y > tgtY then tgtY = y; tgtX = rd(b + 3) end
    end
    if tgtX then
      if tgtX > shipHWX + 2 then i0 = i0 | 0x08 elseif tgtX < shipHWX - 2 then i0 = i0 | 0x04 end
    else
      if (f % 180) < 90 then i0 = i0 | 0x04 else i0 = i0 | 0x08 end
    end
    if f % 2 == 0 then i0 = i0 | 0x10 end   -- fire pulse; release windows let the ROM re-arm the single shot
  end

  _G.__i0 = i0; _G.__i1 = i1
end)
