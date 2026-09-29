// SPDX-License-Identifier: GPL-3.0-only
/**
 * serviceVblankNmi — the vblank NMI handler: one frame of interrupt service. In order:
 * acknowledge (clear the interrupt-enable latch, blocking re-entry), kick the watchdog by
 * reading the input port and reject the SERVICE switch, DMA-blit the sprite shadow buffer,
 * read+debounce the controls when a game is in play (ATTRACT == 0), then run the per-frame work.
 *
 * Fired as a plain JS call once per vblank: the register save/restore and the interrupt return
 * the hardware brackets the handler with carry no game state, so none of it is modelled here.
 *
 * LIVE-OUT: memory-only — the work, sprite and video RAM the frame produces.
 */

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

export function serviceVblankNmi(m) {
  const { mem8 } = m;

  // Acknowledge the NMI (and lock out re-entry until the tail re-enables it).
  mem8[NMI_ENABLE] = 0;

  // Kick the watchdog (the read is the kick) and reject the SERVICE switch.
  if (mem8[IN2_PORT] & 0x01) {
    throw new NotImplemented(
      "SERVICE switch held: out-of-policy service-vector jump, " +
        "no diagnostic ROM exists on this romset",
    );
  }

  blitSpritesViaDma(m, SPRITE_DMA_SETUP_BLOCK);

  if (mem8[ATTRACT] === 0) {
    readControls(m);
  }

  perFrame(m);
}
