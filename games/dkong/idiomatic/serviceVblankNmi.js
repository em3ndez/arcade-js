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

import { u16 } from "../../../core/int.js";
import { NotImplemented } from "../../../boards/dkong/io.js";
import {
  ATTRACT,
  IN2_PORT,
  NMI_ENABLE,
  SPRITE_DMA_SETUP_BLOCK,
} from "./names.js";
import { blitSpritesViaDma } from "./blitSpritesViaDma.js";
import { readControls } from "./readControls.js";
import { perFrame } from "./perFrame.js";

export function serviceVblankNmi(m, sp = m.regs.sp) {
  const { mem8 } = m;

  // Acknowledge the NMI (and lock out re-entry until the tail re-enables it).
  mem8[NMI_ENABLE] = 0;

  // Kick the watchdog (the read is the kick) and reject the SERVICE switch.
  if (mem8[IN2_PORT] & 0x01) {
    throw new NotImplemented(
      "SERVICE switch held: jp 0x4000 at ROM 0x0077 -- out-of-policy input, " +
        "no diagnostic ROM exists on this romset",
    );
  }

  blitSpritesViaDma(m, SPRITE_DMA_SETUP_BLOCK);

  if (mem8[ATTRACT] === 0) {
    readControls(m);
  }

  // Reserve the 12-byte register-save frame the hardware prologue pushed, then run the tail.
  perFrame(m, u16(sp - 12));
}
