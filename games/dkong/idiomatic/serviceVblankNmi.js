// SPDX-License-Identifier: GPL-3.0-only
/**
 * serviceVblankNmi — the vblank NMI handler: one frame of interrupt service. In order:
 * acknowledge (clear the interrupt-enable latch, blocking re-entry), kick the watchdog by
 * reading the input port and reject the SERVICE switch, DMA-blit the sprite shadow buffer,
 * read+debounce the controls when a game is in play (ATTRACT == 0), then reserve the 12-byte
 * register-save stack frame the hardware prologue pushed and run the per-frame work + epilogue.
 *
 * The stack reserve keeps the epilogue's pops in mapped RAM: SP and the return address stay
 * faithful while the popped register values are dead scratch.
 *
 * LIVE-OUT: memory-only — the work, sprite and video RAM the frame produces.
 */

import { NotImplemented } from "../../../boards/dkong/io.js";
import { ATTRACT } from "./names.js";
import { blitSpritesViaDma } from "./blitSpritesViaDma.js";
import { readControls } from "./readControls.js";
import { perFrame } from "./perFrame.js";

// Board control ports (io side, NOT work RAM).
const NMI_ENABLE = 0x7d84; // interrupt-enable latch; cleared to ack, re-enabled by the tail
const IN2_WATCHDOG = 0x7d00; // read kicks the watchdog; bit 0 = SERVICE switch
const DMA_SETUP_BLOCK = 0x0138; // 9-byte i8257 setup block

export function serviceVblankNmi(m) {
  const { regs, mem, mem8 } = m;

  // Acknowledge the NMI (and lock out re-entry until the tail re-enables it).
  mem.write8(NMI_ENABLE, 0);

  // Kick the watchdog (the read is the kick) and reject the SERVICE switch.
  if (mem.read8(IN2_WATCHDOG) & 0x01) {
    throw new NotImplemented(
      "SERVICE switch held: jp 0x4000 at ROM 0x0077 -- out-of-policy input, " +
        "no diagnostic ROM exists on this romset",
    );
  }

  regs.hl = DMA_SETUP_BLOCK;
  blitSpritesViaDma(m);

  if (mem8[ATTRACT] === 0) {
    readControls(m);
  }

  // Reserve the 12-byte register-save frame the hardware prologue pushed, then run the tail.
  regs.sp = (regs.sp - 12) & 0xffff;
  perFrame(m);
}
