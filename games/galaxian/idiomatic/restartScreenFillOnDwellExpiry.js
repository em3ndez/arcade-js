// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { resetScreenFillState } from "./resetScreenFillState.js";

/**
 * restartScreenFillOnDwellExpiry (ROM 0x1d51) -- the outer-dwell tick of the attract-mode animated
 * screen fill, the gate that decides when the whole diagonal-fill effect restarts.
 *
 * WHAT IT IS
 *   The screen fill draws one tile strip per frame and paces itself with a two-tier dwell timer that
 *   lives just below the VRAM write cursor: the low tier (the strip gate) counts frames within a strip,
 *   and this routine ticks the HIGH tier -- the byte one past the strip gate. When that high tier has
 *   already run out, or reaches zero on this tick, the fill has fully painted and is re-seeded from the
 *   top via resetScreenFillState; while it is still counting down the routine does nothing and the frame
 *   ends. See mechanisms.md "Sequence-driven full-screen fills" and "The attract input readout and the
 *   screen fill".
 *
 * ROLE IN THE MACHINE
 *   Entered from the tile-strip fill updater (the gate-zero path of advanceScreenFillStrip, and the
 *   fall-through tail of drawScreenFillStripSecondHalf) with HL = 0x4008, the strip gate. u16(timerBase+1)
 *   forms the address of the high dwell tier (0x4009) one byte past it. resetScreenFillState (0x1d58) is
 *   the re-seed: it rewinds the cursor to VRAM_BASE, re-arms the full-page fill length, clears the
 *   dispatch flag, and (input-gated) loops the whole boot/attract fill cycle.
 *
 * Grounding: [seen] (names.js cert for 0x1d51).
 *
 * LIVE-OUT: high dwell tier decremented (unless already 0); on a zero-crossing or already-zero, the fill
 *   state is fully re-seeded via resetScreenFillState.
 */
export function restartScreenFillOnDwellExpiry(m, timerBase = m.regs.hl) {
  const { mem8 } = m;
  // Address of the high dwell tier: one byte past the strip gate (timerBase, 0x4008), masked to 16 bits.
  const tier = u16(timerBase + 1);

  // Already expired: re-seed without ticking.
  if (mem8[tier] === 0) return resetScreenFillState(m);

  // Tick; keep waiting while nonzero, else re-seed.
  // Decrement the high tier; if it is still counting down the fill continues next frame (return, no-op),
  // and only on the zero-crossing do we restart the whole fill from the top.
  mem8[tier] = mem8[tier] - 1;
  if (mem8[tier] !== 0) return;
  return resetScreenFillState(m);
}
