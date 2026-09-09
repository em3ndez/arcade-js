-- SPDX-License-Identifier: GPL-3.0-only
-- Coin/start/PLAY gameplay tape for centiped, the MAME-side twin of tapes/coin_start_play.json. It injects
-- the SAME schedule the JSON drives through the idiomatic engine, so a MAME golden captured under this
-- script is a matched reference for the tape gate (games/centiped/test/tape.test.js) and for a pixel golden.
--   coin @300..307 (IN1 "Coin 1"), 1P start @380..387 (IN1 "1 Player Start"),
--   then from frame 450: fire held (IN1 "P1 Button 1") + a trackball-X sweep that alternates +7 / -7 every
--   40 frames (TRACK0_X "Trackball X"; -7 is 249 as an unsigned byte), matching the JSON's {track:[0,d]} rows.
-- Trackball is the analog player control (X on IN0, Y on IN2 in the port fold); this drives X only, which is
-- enough to sweep the shooter across the band. Frame indexing matches the engine: the first machine-frame
-- notifier tick is frame 1, as tape.test.js and the JSON dur windows assume.
--
-- ⚠ Isolate cfg/nvram so a prior self-test/dip capture cannot poison the working-dir cfg (freezes the golden):
--   mame centiped -rompath games/centiped/rom -video none -sound none -nothrottle \
--     -cfg_directory /tmp/mamecap -nvram_directory /tmp/mamecap \
--     -autoboot_script games/centiped/tapes/coin_start_play.lua
local FLD = nil
local frames = 0
_G.__tape_frame = emu.add_machine_frame_notifier(function()
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
    FLD.fire:set_value(1)                                   -- fire held (one dart on screen at a time)
    -- X sweep: +7 for 40 frames, then -7 (249 = -7 as u8), alternating -- mirrors the JSON track rows.
    local block = math.floor((f - 450) / 40)
    FLD.tx:set_value((block % 2 == 0) and 7 or 249)
  else
    FLD.fire:set_value(0)
    FLD.tx:set_value(0)
  end
end)
