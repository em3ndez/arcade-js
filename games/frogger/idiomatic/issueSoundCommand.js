// SPDX-License-Identifier: GPL-3.0-only
/**
 * issueSoundCommand — issue one sound command: latch A to the sound-data port, then pulse the /INT edge.
 * LIVE-OUT: IO-only — the sound-data latch and the control-port edge (invisible to a RAM dump).
 */
import { loc_d000, loc_d002, loc_83d9 } from "./names.js";

const BUS_LD_NN_A = 10;

export function issueSoundCommand(m) {
  const { regs, mem } = m;
  mem.write8(loc_d000, regs.a, BUS_LD_NN_A);
  const control = mem.read8(loc_83d9);
  mem.write8(loc_d002, control & 0xf7, BUS_LD_NN_A); // bit 3 low: the falling edge raises the audio /INT
  mem.write8(loc_d002, control | 0x08, BUS_LD_NN_A);
}
