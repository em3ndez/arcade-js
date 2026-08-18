// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0c4a  —  ROM 0x0C4A-0x0C50  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   A one-cell work-RAM store helper. Given a RAM page (H), a row base (D), an offset (C), and a byte
 *   value (E), it writes E into RAM at page H, row (D - C) — and writes NOTHING at all when the offset
 *   C is zero. That is the whole routine: a guarded single-byte poke into a caller-chosen page.
 *
 * WHERE IT SITS
 *   The row helper for the attract-mode SCORE RANKING screen. Its sole caller is placeScoreRankMarkers
 *   (ROM 0x0c3d), which invokes it twice — once per byte of the packed rank field INTRO_DIGIT_FIELD
 *   (0x83fb) — to stamp the "your rank" markers. On each call the caller supplies H=0x80 (the work-RAM
 *   page), D=48 (the row base), E=4 (the constant marker tile), and C = one rank code. So the effect is:
 *   for a nonzero rank code, write marker tile 4 into work RAM at 0x80(48 - code); a zero code writes
 *   nothing. The rank is encoded as a *position* (which row got the mark), never as a rendered numeral —
 *   which is exactly why the C==0 skip below exists: an absent code leaves its slot untouched.
 *
 *   GROUNDING NOTE: despite resembling the intro-digit *tilemap* writer, this is a WORK-RAM store, not a
 *   VRAM/tile poke — grounded [seen] via its H=0x80 caller (overturning the earlier intro-digit reading).
 *   With the caller's D=48 and rank code 5, the target row is 48-5 = 0x2b, i.e. 0x802b, which is
 *   INTRO_COUNTER_802B (0x802b) — a work-RAM cell, confirming the page-0x80 destination.
 *
 * LIVE-OUT
 *   Memory only. It returns nothing and leaves no register the caller reads: renderMode3ScoreRankingScreen
 *   (0x0bb3) reloads HL immediately after the call, and A/L are dead. The single RAM byte is the only
 *   observable effect.
 *
 * REGISTER ABI (parameters default to the live Z80 registers, so the caller may pass them positionally)
 *   c = offset into the row  ·  d = row base  ·  h = RAM page  ·  e = byte to store
 */
export function loc_0c4a(m, c = m.regs.c, d = m.regs.d, h = m.regs.h, e = m.regs.e) {
  const { mem8 } = m;

  // ── The C==0 skip: no offset, no write ───────────────────────────────────────────────
  // In the ROM (0x0C4B-0x0C4D) this is `A = D - C; cp D` — comparing the difference back against D. The
  // Z flag is set exactly when D - C == D, i.e. when C == 0 (mod 256, and C is an 8-bit register, so only
  // C==0 qualifies), and the routine `ret`s without touching memory. Idiomatically that is just c === 0.
  // WHY: the caller feeds a rank code in as C; a zero code means "this rank slot is empty," so no marker
  // is stamped for it. The skip is what makes an absent rank simply leave its cell alone.
  if (c === 0) return;

  // ── Compute the target row: (D - C) with 8-bit wrap ───────────────────────────────────
  // ROM 0x0C4E-0x0C4F does `L = A` where A already holds D - C, forming the low byte of the destination
  // address (HL). The & 0xff reproduces the Z80's 8-bit subtraction wrap, so when D < C the row wraps
  // through 256 (e.g. D=3, C=9 -> row 0xfa) rather than going negative — behaviour the equivalence test
  // exercises directly.
  const row = (d - c) & 0xff;

  // ── The store: one byte into page H at that row ───────────────────────────────────────
  // ROM 0x0C50 `ld (hl), e`. The address is (H<<8) | row: H is the RAM page (the caller passes 0x80, the
  // work-RAM page — NOT a tilemap page), row is the low byte computed above, and E is the value (the
  // caller's constant marker tile 4). This is the single memory effect of the routine.
  mem8[(h << 8) | row] = e;
}
