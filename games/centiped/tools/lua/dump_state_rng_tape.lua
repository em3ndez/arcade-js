-- SPDX-License-Identifier: GPL-3.0-only
-- Gameplay convergence capture: the coin/start/PLAY tape (tapes/coin_start_play.lua) DRIVING the machine,
-- WITH the per-frame state dump + observe-only $100a RNG log (dump_state_rng.lua). MAME allows one
-- -autoboot_script, so a gameplay golden -- inputs applied AND state/rng logged -- needs the two merged
-- here. The JS side (convergence.mjs --tape) replays the SAME JSON schedule + this RNG stream, so the diff
-- is idiomatic-under-play vs MAME-under-play. Frame indexing matches the engine: first notifier tick = 1.
--   coin @300..307, 1P start @380..387, then from 450: fire held + X sweep +7/-7 every 40 frames.
-- ⚠ Isolate cfg/nvram (a stale self-test cfg freezes the golden): -cfg_directory <tmp> -nvram_directory <tmp>.
local sout = assert(io.open(assert(os.getenv("STATE_OUT")), "wb")); sout:setvbuf("no")
local rout = assert(io.open(assert(os.getenv("RNG_OUT")), "wb")); rout:setvbuf("no")
local mem = manager.machine.devices[":maincpu"].spaces["program"]

_G.__rng_tap = mem:install_read_tap(0x100a, 0x100a, "rng", function(off, data, mask)
  rout:write(string.char(data & 0xff)); return data
end)

local REGIONS = { { 0x0000, 0x03FF }, { 0x0400, 0x07BF }, { 0x07C0, 0x07FF } }
local function sample()
  local p = {}
  for _, r in ipairs(REGIONS) do for a = r[1], r[2] do p[#p + 1] = string.char(mem:read_u8(a)) end end
  sout:write(table.concat(p))
end
sample() -- state[0] = power-on (all zero on this board), before the CPU runs

local FLD = nil
local frames = 0
_G.__frame_sub = emu.add_machine_frame_notifier(function()
  if not FLD then
    local IN1 = manager.machine.ioport.ports[":IN1"]
    local TX = manager.machine.ioport.ports[":TRACK0_X"]
    FLD = {
      coin = IN1.fields["Coin 1"], start = IN1.fields["1 Player Start"],
      fire = IN1.fields["P1 Button 1"], tx = TX.fields["Trackball X"],
    }
    assert(FLD.coin and FLD.start and FLD.fire and FLD.tx, "centiped input fields missing")
  end
  local f = frames + 1; frames = f
  FLD.coin:set_value((f >= 300 and f < 308) and 1 or 0)
  FLD.start:set_value((f >= 380 and f < 388) and 1 or 0)
  if f >= 450 and f < 710 then
    FLD.fire:set_value(1)
    local block = math.floor((f - 450) / 40)
    FLD.tx:set_value((block % 2 == 0) and 7 or 249)         -- +7 / -7 (249 = -7 as u8), matching the JSON
  else
    FLD.fire:set_value(0)
    FLD.tx:set_value(0)
  end
  sample()                                                  -- dump AFTER inputs land, matching the JS tick order
end)
