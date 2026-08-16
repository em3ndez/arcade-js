// SPDX-License-Identifier: GPL-3.0-only
/**
 * issueSoundCommand — issue one sound command: latch A to the sound-data port, then pulse the /INT edge.
 * LIVE-OUT: IO-only — the sound-data latch and the control-port edge (invisible to a RAM dump).
 */
import { SOUND_CMD_LATCH, SOUND_CTRL_PORT, SOUND_CTRL_SHADOW } from "./names.js";

const BUS_LD_NN_A = 10;

export function issueSoundCommand(m, cmd = m.regs.a) {
  const { mem } = m;
  mem.write8(SOUND_CMD_LATCH, cmd, BUS_LD_NN_A);
  const control = mem.read8(SOUND_CTRL_SHADOW);
  mem.write8(SOUND_CTRL_PORT, control & 0xf7, BUS_LD_NN_A); // bit 3 low: the falling edge raises the audio /INT
  mem.write8(SOUND_CTRL_PORT, control | 0x08, BUS_LD_NN_A);
}
