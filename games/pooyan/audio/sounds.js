// SPDX-License-Identifier: GPL-3.0-only
// Pooyan sound map -- DATA ONLY, read by web/player.html. Clip model: the main CPU writes a command
// byte to the soundlatch 0xA100 (boards/pooyan/io.js writeSoundData; pooyan.cpp:306); a 2nd Z80
// (MAME timeplt_audio "tpsound") turns each command into sound; the recorder (tools/record_samples.py)
// captures one WAV per command + a gitignored index.json, so no per-command table lives here.
// NO ports.control ON PURPOSE: io.js forwards only the 0xA100 write (the LS259 sh_irqtrigger 0xA181 is
// never notified), so the player keys off the latch write like Time Pilot -- a control port that never
// emits would silence the game.
export default {
  model: "clips",
  soundLatch: 0xa100,
};
