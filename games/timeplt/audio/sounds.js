// SPDX-License-Identifier: GPL-3.0-only
// Time Pilot sound map -- DATA ONLY, read by web/player.html. The hardware and the recording process
// are documented in games/timeplt/tools/README-samples.md and record_samples.py: the main CPU writes
// a command to 0xC000 and pulses the 0xC304 attention edge; we play the recorded clip per command
// (the 2nd Z80 tm7 + its two AY-3-8910s are NOT emulated). The player needs only the model shape:
export default {
  model: "clips",
  soundLatch: 0xc000,
};
