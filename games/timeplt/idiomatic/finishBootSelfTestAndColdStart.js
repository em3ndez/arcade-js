// SPDX-License-Identifier: GPL-3.0-only
/** finishBootSelfTestAndColdStart — the tail of the power-on config decode and self-test. Two bits of the rolled config
 * byte land in a work-RAM pair, the watchdog is kicked, an LS259 line is driven from a fixed byte,
 * and the character plane is tiled. A 256-byte block is then summed and compared to a fixed total,
 * and a mismatch derails into the frame handler; a good image cold-starts and does not return.
 * LIVE-OUT: memory, the LS259 latch, and the watchdog kicks. */

import { loc_00b1 } from "./loc_00b1.js";
import { loc_00d8 } from "./loc_00d8.js";
import { loc_32eb } from "./loc_32eb.js";

const CONFIG_LOW3 = 0xa9c4;
const CONFIG_BIT = 0xa9c6;
const WATCHDOG = 0xc200;
const LS259_LINE = 0xc302;
const LS259_SOURCE = 0x0c3e;
const STORE = 10;
const CHECKSUM_BASE = 0x27de;
const CHECKSUM_SPAN = 0x100;
const CHECKSUM_TOTAL = 0xc5;

export function finishBootSelfTestAndColdStart(m) {
  const { regs, mem } = m;

  regs.rrca();
  const rolled = regs.a;
  regs.and(0x07);
  mem.write8(CONFIG_LOW3, regs.a);

  regs.a = rolled;
  regs.rrca();
  regs.rrca();
  regs.rrca();
  regs.and(0x01);
  mem.write8(CONFIG_BIT, regs.a);
  mem.write8(WATCHDOG, regs.a, STORE);

  regs.a = mem.read8(LS259_SOURCE);
  mem.write8(LS259_LINE, regs.a, STORE);

  loc_00b1(m);

  let total = 0;
  for (let i = 0; i < CHECKSUM_SPAN; i++) {
    total = (total + mem.read8((CHECKSUM_BASE + i) & 0xffff)) & 0xff;
  }
  regs.a = (total - CHECKSUM_TOTAL) & 0xff;
  if (regs.a !== 0) return loc_00d8(m); // tampered image: derail into the frame handler
  return loc_32eb(m);
}
