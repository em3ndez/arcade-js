// SPDX-License-Identifier: GPL-3.0-only
// Pooyan sound map -- DATA ONLY, read by web/player.html. Clips model: 2nd Z80 (timeplt_audio) turns each
// 0xA100 command into sound; record_samples.py captures one gitignored WAV per command (no table here).
// NO ports.control: io.js forwards only the 0xA100 write, so the player keys off the latch (like Time Pilot).
export default {
  model: "clips",
  soundLatch: 0xa100,
  // Per-game SFX master (+8.1 dB over the 0.7 default) to hit MAME's SFX level; player reads SOUNDS.masterGain.
  masterGain: 1.79,
  // Looping background music ("stem jukebox"): the melody is sequenced by the unemulated 2nd Z80 (its music-run
  // codes sound nothing alone), so record_samples.py --background captures one MUSIC-ONLY bed per context; the
  // player loops the bed the music-select code picks UNDER the effects. beds key on the run lead (0x1c intro,
  // 0x1a board-1, 0x1e-0x21 round music -> board-2 bed); stop 0x00; 0x82 is a per-kill accent, NOT music.
  backgroundMusic: {
    beds: {
      0x1c: "bed_intro",
      0x1a: "bed_board1",
      0x1e: "bed_board2",
      0x1f: "bed_board2",
      0x20: "bed_board2",
      0x21: "bed_board2",
    },
    stop: [0x00],
    bedGain: 0.559, // 1/masterGain: cancels the SFX boost so music plays at its natural (quiet, faithful) level
    xfadeMs: 120,
    loop: true,
  },
};
