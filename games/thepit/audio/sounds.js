// SPDX-License-Identifier: GPL-3.0-only
//
// The Pit sound map -- DATA ONLY. No logic, no imports, no engine coupling. The web
// player (web/player.html) reads this; this file never reads anything back.
//
// WHAT THE HARDWARE IS
// --------------------
// Unlike Donkey Kong's discrete + DAC sound hardware, The Pit hands a single COMMAND
// BYTE to a second Z80 over one soundlatch at 0xB800 (boards/thepit/io.js
// `writeSoundLatch`). That CPU, with its two AY-3-8910s, turns each command into an
// effect or a tune. The soundlatch write does NOT assert the audio IRQ -- the audio
// CPU polls the latch on its own VSYNC interrupt -- so a command just needs to be
// held for a frame to register.
//
// HOW WE PRODUCE SOUND (the "audio above emulation" hack)
// -------------------------------------------------------
// We do NOT emulate the audio CPU or the AY chips. The local recorder
// (games/thepit/tools/record_samples.py) drives real MAME once, injects each command
// to 0xB800, and captures ONE WAV PER COMMAND into audio/samples/, writing an
// index.json that records which commands sound, the file each landed in, and whether
// the clip loops. The player plays a command's clip when the ROM writes that command.
//
// WHY THERE IS NO PER-COMMAND TABLE HERE
// --------------------------------------
// That table is a MEASUREMENT OF YOUR OWN ROM, so it lives in the recorder's
// (gitignored) index.json, never in committed source -- exactly as the sample WAVs
// themselves are gitignored. Semantic names (coin, dig, the tune played on each
// board) are not yet grounded in evidence, so none are asserted here. What IS
// committed is the shape of the model the player needs to interpret the recordings:
export default {
  model: "clips",       // one recorded clip per soundlatch command (see player.html)
  soundLatch: 0xb800,   // the single command surface the player listens on
  // Observed in attract: commands >= 130 sound; 0..31 (and 128,129) are silent. The
  // recorder's index.json is authoritative per ROM; this note is orientation only.
};
