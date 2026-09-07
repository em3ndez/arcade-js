// SPDX-License-Identifier: GPL-3.0-only
//
// advanceSequenceStateAndReseedObjectShadow (ROM 0x0593, [seen]) -- step the sequence counter, then
// re-lay the object shadow.
//
// WHAT IT IS
//   A tiny two-part utility that sits at sequence boundaries in the attract/boot flow. It performs an
//   in-page pointer increment on a counter byte, then falls through to reseed the strided object-RAM
//   shadow from a fixed ROM template. Both of its callers (blankScreenRowsThenAdvanceSequence 0x0583 and
//   clearFlagBlockAndReseedObjectShadow 0x02e8) arrive with the pointer HL = 0x4009, so incrementing the
//   low byte lands on 0x400a = SEQUENCE_STATE and bumps it -- advancing the boot/attract state machine.
//   (mechanisms.md, "Seeding the object shadow from ROM".)
//
// ROLE IN THE MACHINE
//   The pointer math is deliberately Z80-faithful: it increments only the low byte and keeps the high
//   byte fixed (stays within the RAM page, wrapping 0xff -> 0x00 rather than carrying into the page).
//   After bumping the counted byte it calls seedObjectShadowFromRom (ROM template 0x1d71) to refill the
//   stride-2 OBJRAM shadow, so the reseed always rides the same tick the sequence advances.
//
// LIVE-OUT: the counted byte (SEQUENCE_STATE for both callers); object shadow refilled by the delegate.
import { seedObjectShadowFromRom } from "./seedObjectShadowFromRom.js";

export function advanceSequenceStateAndReseedObjectShadow(m, ptr = m.regs.hl) {
  const { mem8 } = m;

  const nextLow = (ptr + 1) & 0xff;            // advance low byte
  const next = (ptr - (ptr & 0xff)) + nextLow; // stay in page
  mem8[next]++;                                 // bump the counted byte (wraps 255 -> 0)
  seedObjectShadowFromRom(m);
}
