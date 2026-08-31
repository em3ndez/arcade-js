-- SPDX-License-Identifier: GPL-3.0-only
-- Pooyan coin+start+PLAY tape (gameplay golden driver) -- a STATE-READING BOT.
--
-- Replaces the old dumb periodic-oscillation driver. Each frame it reads game RAM through MAME,
-- finds the descending wolves in the sprite table, drives Mama's elevator to the highest reachable
-- wolf's vertical (top-down, the shipped MODE=high), and fires an arrow when lined up. Goal: CLEAR
-- BOARD 1 (drain STAGE_COUNTDOWN 0x8901 -> 0, which advances ROUND_COUNTER 0x8907 >= 1) inside the
-- 90s golden. Verified: the tape-driven MAME golden reaches ROUND_COUNTER=1 at frame 4955 (< 5456),
-- with zero deaths, and `pixel_suite --done` prints PASS.
--
-- Two things make it clear inside the budget where the old dumb tape never did: (1) fire at FIRECAD=3
-- (1 frame on, 2 off) -- a clean rising edge that the ROM's input edge-filter (sampleJoystickInto-
-- PlayerAimState, INPUT_ROTATE_LATCH low-3 == 1) actually accepts; a held or every-other-frame press
-- is largely swallowed, roughly halving the effective shot rate. (2) an elevator Y clamp (Y_MIN/Y_MAX)
-- that keeps Mama out of the extreme-bottom zone where she was being caught.
--
-- CONFIRMED RAM (MAME, this romset):
--   0x8805 MAIN state  (== 3 while in active play)
--   0x8a84 PLAYER_Y    (Mama's elevator vertical; small=top, large=bottom, max ~0xe1)
--   0x8901 STAGE_COUNTDOWN (starts 0x20; each enemy RETIRE -- shot or arrived -- decrements it; 0 clears the board)
--   0x8907 ROUND_COUNTER  (the success signal; >=1 after a board clears)
--   0x8948 PLAYER0_LIVES
--   sprite bank0 0x9000: [off]=vertical axis, [off+1]=tile code
--   sprite bank1 0x9400: [off]=colour,        [off+1]=horizontal axis
--   Mama shoots RIGHTWARD; an arrow at Mama's vertical hits a wolf at (wolfVertical + ~0x10).
--
-- The old dumb-tape env knobs (TAPE_COIN_FRAME etc.) are gone; a couple of DEBUG-only knobs remain
-- (LOG, MODE, plus aim tuning) with clearing defaults baked in so the suite's default-env run clears.

local cpu = manager.machine.devices[":maincpu"]
local sp  = cpu.spaces["program"]
local function rd(a) return sp:read_u8(a) end

local MAIN   = 0x8805
local PY     = 0x8a84
local STAGEC = 0x8901
local ROUND  = 0x8907
local LIVES  = 0x8948
local SPRV   = 0x9000   -- bank0: [off]=vertical, [off+1]=tile code
local SPRH   = 0x9400   -- bank1: [off]=colour,   [off+1]=horizontal

-- Tunables (DEBUG env overrides; defaults are the clearing configuration).
local LEAD     = tonumber(os.getenv("AIM_LEAD") or "") or 0x10  -- arrow vs sprite-vertical offset
local FIRE_TOL = tonumber(os.getenv("FIRE_TOL") or "") or 8     -- |aim - PY| that counts as aligned
local MODE     = os.getenv("MODE") or "high"                    -- high (top-down; the clearing config) | near | urgent
local FIRECAD  = tonumber(os.getenv("FIRECAD") or "") or 3      -- fire pulse period (3 = clean rising edge for the input edge-filter)
local Y_MIN    = tonumber(os.getenv("Y_MIN")  or "") or 0x44    -- clamp: never command above this
local Y_MAX    = tonumber(os.getenv("Y_MAX")  or "") or 0xc6    -- clamp Mama out of the extreme-bottom death zone
local LOG      = os.getenv("LOG")
local TRACE    = os.getenv("TRACE_OUT")                         -- DEBUG: dump per-frame pressed inputs for JS replay
local TFH      = TRACE and io.open(TRACE, "w") or nil

local BAND_LO, BAND_HI = 0x42, 0xd6     -- reachable vertical aim band
local CENTER = 0x88                       -- park position when no target

-- Enemy tile codes: wolves + balloons + carried variants (from a live sprite census). Excludes
-- Mama's own cluster and the fixed structure/boss sprites.
local ENEMY = {}
for _,c in ipairs({0x1b,0x1d,0x1f,0x22,0x26,0x27,0x28,0x29,0x2a,0x2b,0xa1}) do ENEMY[c]=true end

-- Bow ready to fire? tile 0x11 present (not off-screen at 0xf8) = a loaded arrow indicator on Mama.
local function bow_ready()
  for i=0,63 do if rd(SPRV+2*i+1)==0x11 and rd(SPRV+2*i)~=0xf8 then return true end end
  return false
end

-- Scan the sprite slots for enemies. Returns: aim vertical for the chosen target, whether ANY
-- reachable enemy is vertically aligned with Mama right now (opportunistic fire), and the count seen.
-- Target choice: 'urgent' picks the LOWEST in-band wolf (closest to arriving -> kill it before it lands,
-- which is what prevents both the arrivals that stall the wave and the pile-ups that kill Mama);
-- 'high' picks the highest (top-down).
local function scan(py)
  local best_ty, best_key = nil, nil
  local aligned = false
  local nseen = 0
  for off=0x10,0x3e,2 do
    local v = rd(SPRV+off)
    if v~=0xf8 and v~=0x00 then
      local code = rd(SPRV+off+1)
      if ENEMY[code] then
        local ty = v + LEAD; if ty>0xff then ty=0xff end
        if ty>=BAND_LO and ty<=BAND_HI then
          nseen = nseen + 1
          local aim = ty; if aim>Y_MAX then aim=Y_MAX end; if aim<Y_MIN then aim=Y_MIN end
          local dv = aim - py; if dv<0 then dv=-dv end
          if dv <= FIRE_TOL then aligned = true end
          local key
          if MODE=="high" then key = ty
          elseif MODE=="urgent" then key = 0xff - ty
          else local a = aim - py; key = (a<0) and -a or a end   -- near: minimise travel from current py
          if best_key==nil or key < best_key then best_key=key; best_ty=aim end
        end
      end
    end
  end
  return best_ty, aligned, nseen
end

local FLD = nil
local f = 0
local maxround, cleared, deaths, lastlives, minstgc = 0, false, 0, nil, 0xff

_G.__coinstartplay = emu.add_machine_frame_notifier(function()
  if not FLD then
    local IN0 = manager.machine.ioport.ports[":IN0"]
    local IN1 = manager.machine.ioport.ports[":IN1"]
    assert(IN0 and IN1, "no :IN0 / :IN1")
    FLD = { coin=IN0.fields["Coin 1"], start=IN0.fields["1 Player Start"],
            fire=IN1.fields["P1 Button 1"], up=IN1.fields["P1 Up"], down=IN1.fields["P1 Down"] }
    assert(FLD.coin and FLD.start, "IN0 Coin 1 / 1 Player Start not found")
    assert(FLD.fire and FLD.up and FLD.down, "IN1 P1 Button 1 / Up / Down not found")
  end
  f = f + 1
  local c,st,fi,u,d = 0,0,0,0,0

  local inplay = (rd(MAIN)==3)
  if inplay then
    local rc = rd(ROUND); if rc>maxround then maxround=rc end
    if rc>=1 and not cleared then
      cleared = true
      if LOG then print(string.format("[CLEAR] f=%d ROUND_COUNTER=%d reached! stgc=%02x", f, rc, rd(STAGEC))) end
    end
    local stg = rd(STAGEC); if rc==0 and stg<minstgc then minstgc=stg end

    local lv = rd(LIVES)
    if lastlives~=nil and lv<lastlives then deaths=deaths+1 end
    lastlives = lv

    local py = rd(PY)
    local ty, aligned = scan(py)
    if ty then
      if     ty < py-1 then u=1
      elseif ty > py+1 then d=1 end
      if aligned and bow_ready() then fi = (f%FIRECAD==0) and 1 or 0 end
    else
      if     py > CENTER+3 then u=1
      elseif py < CENTER-3 then d=1 end
      if bow_ready() then fi = (f%FIRECAD==0) and 1 or 0 end
    end
  else
    -- Not in play: coin@120/start@180 (play begins ~f182). Re-pulse on a 90-frame cycle so a
    -- game-over (all lives lost) restarts a fresh game rather than idling in attract.
    local cyc = f % 90
    if f < 90 then
      -- boot settle
    else
      c  = (cyc>=0  and cyc<6)  and 1 or 0
      st = (cyc>=60 and cyc<66) and 1 or 0
    end
    -- Fixed first game: coin@120, start@180 for a clean, early start.
    if f>=120 and f<126 then c=1 end
    if f>=180 and f<186 then st=1 end
  end

  FLD.coin:set_value(c); FLD.start:set_value(st)
  FLD.fire:set_value(fi); FLD.up:set_value(u); FLD.down:set_value(d)

  if TFH then TFH:write(string.format("%d %d %d %d %d %d\n", f, c, st, fi, u, d)); TFH:flush() end

  if LOG and f%180==0 then
    print(string.format("[state] f=%6d ip=%s L=%d rnd=%02x(max%02x) stgc=%02x(min%02x) py=%02x deaths=%d",
      f, tostring(inplay), rd(LIVES), rd(ROUND), maxround, rd(STAGEC), minstgc, rd(PY), deaths))
  end
end)
