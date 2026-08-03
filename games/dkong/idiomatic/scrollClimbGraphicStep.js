// SPDX-License-Identifier: GPL-3.0-only
/**
 * scrollClimbGraphicStep — advance the opening-cutscene climb graphic up one row by
 * one indexed cell-pair, then step the scroll index down.  ROM 0x304a.
 *
 * The opening Kong-climb intro animates by sliding a strip of the playfield up the
 * screen one tilemap row at a time. This routine is ONE cell-pair of that slide. It
 * reads INTRO_SCROLL_INDEX (0x638E) and, using it as the offset into two fixed video-
 * RAM cell columns 0x7600 and 0x75C0 (0x40 = two rows apart), copies each indexed
 * cell to the cell 0x20 bytes lower — 0x20 is one 32-column tilemap row, so each copy
 * moves its cell up one row. It then decrements the index. Called repeatedly by the
 * cutscene it walks the index down, sliding a run of cells up a row cell-by-cell:
 *
 *   - loc_0ae8 (ROM 0x0AE8, INTRO_STEP 2) fires it on every 16th tick — the periodic
 *     scroll while Kong climbs.
 *   - loc_0b06 (ROM 0x0B06) spins `do { this } while (INTRO_SCROLL_INDEX != 0x0A)` — a
 *     synchronous run-down to a fixed index at the phase's end.
 *
 * The two copies are delegated to the addressing primitive copyByteDisplaced (ROM
 * 0x3064): base HL, index BC (B = 0, C = the index), signed displacement DE = 0xFFE0
 * (= −0x20). copyByteDisplaced reads only HL/BC/DE and writes only the one destination
 * byte; it leaves BC/DE untouched, so both calls reuse the index and displacement set
 * once here — exactly as the Z80 sub_3064 preserves BC/DE across sub_304a's two calls.
 * For every real index (0..255) both cell and destination land wholly inside video RAM
 * (0x75A0..0x76DF), so the 16-bit address arithmetic never wraps in practice.
 *
 * Memory-equivalent to the frozen oracle — equivalence-304a.test.js.
 * GATE:     crafted-entry — NOT reached in plain attract (0× through 8000 frames; it
 *           runs only inside the opening Kong-climb cutscene cascade). Real dispatch
 *           states are reproduced by driving the routine the way its caller loc_0b06
 *           does — seed 0x638E on a booted (loc_0fd7) machine with real video RAM and
 *           iterate, capturing each true entry (index, evolving VRAM, a caller-pushed
 *           return address) — plus a crafted index sweep across the range and extremes.
 *           Teeth: an index-not-decremented twin, a dropped-second-copy twin, and a
 *           wrong-direction (+0x20) twin, forced non-vacuous with sentinel bytes.
 * LIVE-OUT: memory-only — the two copied video-RAM bytes and the decremented
 *           INTRO_SCROLL_INDEX (0x638E). The oracle's `dec (hl)` also leaves flags, but BOTH
 *           callers re-read RAM (loc_0ae8 reads 0x690B; loc_0b06 reads INTRO_SCROLL_INDEX)
 *           and derive fresh flags
 *           with a `cp` before any branch, so those residual flags — and the register
 *           churn copyByteDisplaced leaves in HL/A/F — are dead ABI.
 * NAMES:    INTRO_SCROLL_INDEX (0x638E) from ram.js. 0x7600 / 0x75C0 (video-RAM cell bases)
 *           and 0xFFE0 (−0x20 = one tilemap row) are kept as hex; not in ram.js by design.
 */

import { copyByteDisplaced } from "./copyByteDisplaced.js";
import { INTRO_SCROLL_INDEX } from "./ram.js";

const ROW = 0xffe0; // DE = −0x20 = one 32-column tilemap row, upward

export function scrollClimbGraphicStep(m) {
  const { regs, mem } = m;

  // ld a,(0x638e) / ld c,a / ld b,0 -> BC = the index (0..255, B forced to 0).
  regs.bc = mem.read8(INTRO_SCROLL_INDEX);
  // ld de,0xffe0 -> displacement is −0x20; set once, reused across both copies.
  regs.de = ROW;

  // call 0x3064 x2: copy each indexed cell up one row. copyByteDisplaced reads
  // HL/BC/DE and writes the single destination byte, leaving BC/DE for the reuse.
  regs.hl = 0x7600; // ld hl,0x7600
  copyByteDisplaced(m); // mem[0x7600 + index − 0x20] = mem[0x7600 + index]
  regs.hl = 0x75c0; // ld hl,0x75c0
  copyByteDisplaced(m); // mem[0x75c0 + index − 0x20] = mem[0x75c0 + index]

  // ld hl,0x638e / dec (hl): step the scroll index down (8-bit wrap). The copies
  // never touch 0x638E, so this reads back the same index just loaded.
  mem.write8(INTRO_SCROLL_INDEX, (mem.read8(INTRO_SCROLL_INDEX) - 1) & 0xff);
}
