// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0426 — hand-optimized rewrite of the translated routine at ROM 0x0426,
 * proven equal to its oracle by the equivalence harness.
 *
 * One routine per file. Every callee (0x0464 loc_0464, 0x0486 loc_0486, 0x004e
 * the template block-copy, 0x0450 loc_0450) is reached through `m.call`, the
 * routine registry (games/dkong/routines.js), so each resolves to the oracle or
 * to a future optimized rewrite — never a copy. Only the RAM name SND_TRIGGER is
 * imported (from ram.js).
 */

import { SND_TRIGGER } from "./ram.js";

/**
 * loc_0426 -- advance the colour-cycle animation's own frame counter (0x6390),
 * and every 32 frames refresh the animation table.
 * [ROM 0x0426-0x044F, then falls into loc_0450 @ 0x0450]
 *
 *   0426  21 90 63   ld  hl,0x6390    ; HL -> colour-cycle frame counter
 *   0429  34         inc (hl)         ; (0x6390)++  (the running animation phase)
 *   042a  7e         ld  a,(hl)
 *   042b  fe 80      cp  0x80         ; counter wrapped to 0x80?
 *   042d  ca 64 04   jp  z,0x0464     ;   yes -> loc_0464 (reset counter + latch)
 *   0430  3a 93 63   ld  a,(0x6393)   ; A = colour-cycle "suppress table copy" flag
 *   0433  a7         and a
 *   0434  c2 86 04   jp  nz,0x0486    ;   flag set -> just redraw the colour tail
 *   0437  7e         ld  a,(hl)       ; A = counter again (HL still 0x6390)
 *   0438  47         ld  b,a
 *   0439  e6 1f      and 0x1f         ; on a 32-frame boundary?
 *   043b  c2 86 04   jp  nz,0x0486    ;   no -> just redraw the colour tail
 *   043e  21 cf 39   ld  hl,0x39cf    ; 32-boundary: pick animation table A (0x39CF)...
 *   0441  cb 6b      bit 5,b
 *   0443  20 03      jr  nz,0x0448    ;   ...unless counter bit5 clear ->
 *   0445  21 f7 39   ld  hl,0x39f7    ;      table B (0x39F7)
 *   0448  cd 4e 00   call 0x004e      ; block-copy the chosen table into the sprite block
 *   044b  3e 03      ld  a,0x03
 *   044d  32 82 60   ld  (0x6082),a   ; SND_TRIGGER[2] := 3 (a 3-frame sound assert)
 *   0450             (falls into loc_0450, the (0x6227) bit-dispatch colour tail)
 *
 * WHAT IT DOES. This is the body the colour-cycle gate loc_0413 falls into once
 * per frame while the animation "active" latch (0x6391) is set. It bumps the
 * animation's private frame counter 0x6390 (0->0x80 over 128 frames) and routes
 * on it:
 *
 *   - counter reached 0x80        -> loc_0464 (reset 0x6390/0x6391, one full cycle done)
 *   - 0x6393 flag set             -> loc_0486 (idle: redraw the colour columns only)
 *   - counter not a 32-multiple   -> loc_0486 (idle redraw)
 *   - counter IS a 32-multiple    -> reload the animation table (block-copy 0x004e),
 *                                    fire a sound trigger, then fall into loc_0450
 *                                    (which itself ends in the loc_0486 colour tail)
 *
 * The 32-boundary table pick keys off bit 5 of the counter: counter&0x1f==0
 * restricts it to {0x20,0x40,0x60}; bit5 set (0x20,0x60) keeps table 0x39CF,
 * bit5 clear (0x40) swaps to 0x39F7 -- so the two ROM animation tables alternate
 * across the 128-frame cycle. 0x6393 acts as a "skip the table copy this cycle"
 * suppressor; observed set (=1) throughout normal gameplay, which is why the
 * table-copy arm is the COLD path (see CYCLES/coverage below).
 *
 * INPUTS:  reads 0x6390 (colour-cycle frame counter) and 0x6393 (table-copy
 *          suppress flag) -- both currently UNNAMED in ram.js (the world verifier
 *          left the 0x6390/0x6391/0x6393 block hex), so they stay hex literals
 *          here and are reported as naming candidates; only SND_TRIGGER is an
 *          established name.
 * OUTPUTS: writes 0x6390 (the ++), and on the 32-boundary arm SND_TRIGGER[2]
 *          (0x6082) = 3 plus whatever the 0x004e block-copy lands in the sprite
 *          object block. All are WORK RAM -- there is NO 0x7Dxx hardware-latch
 *          write on any path, so no bus-cycle-positioned write and no write-trace
 *          concern (SND_TRIGGER[2] is the work-RAM trigger COUNTER at 0x6082, not
 *          the ls259.6h latch at 0x7D02 that sub_00e0 drives from it).
 *
 * FLAGS. The routine never returns a `cc` -- every exit tail-calls, so its
 * observable "return" is whatever loc_0464 / loc_0486 / loc_0450 leave. Each
 * flag-setting op here (`inc (hl)`, `cp 0x80`, `and a`, `and 0x1f`, `bit 5,b`)
 * has its Z/carry consumed by the very next `jp`/`jr` and then overwritten before
 * anything downstream reads it. They are nonetheless kept VERBATIM so A, B, HL
 * and F match the oracle bit-for-bit at every point -- the unit gate compares the
 * whole register file, F included.
 *
 * CYCLES -- COLLAPSED to one m.step per basic block. loc_0426 is a LEAF reached
 * only via `m.call`; its sole caller loc_0413 is itself interruptible with the
 * NMI mask ENABLED (main-loop cascade loc_197a<-entry_03fb, + the dispatchTask
 * entry_0400), so the vblank NMI CAN land inside loc_0426 and push a live
 * (now-coarser) PC into the diffed stack RAM -- exactly the mistimed-NMI raster
 * tear the CONVERGENT gate exists for (docs/06; see sub_0350). Each block total
 * below is the exact SUM of the oracle's per-instruction charges for that block:
 * ld-hl+inc(hl)+ld-a,(hl)+cp+jpz 45 t; ld-a,(0x6393)+and-a+jpnz 27 t;
 * ld-a,(hl)+ld-b,a+and-0x1f+jpnz 28 t; ld-hl,0x39cf+bit5+jrnz 30 t (taken) / 25 t
 * (not taken); ld-hl,0x39f7 10 t (lone instr -- 0x0448 is a merge point, reached
 * both from the taken jr and from here); the `call 0x004e` keeps its own
 * push16/step/m.call scaffolding, never folded; ld-a,3+ld-(0x6082),a 20 t before
 * the loc_0450 tail-call. Total-preservation keeps the main loop's PRNG spin
 * count (0x6019) deterministic; the collapse is licensed by the convergent gate,
 * not the strict whole-machine one.
 */
export function loc_0426(m) {
  const { regs, mem } = m;

  // Block: ld hl,0x6390 [10] + inc (hl) [11] + ld a,(hl) [7] + cp 0x80 [7] + jp z,0x0464 [10] = 45 t
  regs.hl = 0x6390;
  mem.write8(regs.hl, regs.inc8(mem.read8(regs.hl)));
  regs.a = mem.read8(regs.hl);
  regs.cp(0x80);
  if (regs.fZ) {
    // jp z,0x0464 taken: reset the counter + the active latch.
    m.step(0x0464, 45);
    return m.call(0x0464);
  }
  m.step(0x0430, 45); // jp z NOT taken

  // Block: ld a,(0x6393) [13] + and a [4] + jp nz,0x0486 [10] = 27 t
  regs.a = mem.read8(0x6393);
  regs.and(regs.a);
  if (regs.fNZ) {
    // jp nz,0x0486 taken: flag set -- idle redraw of the colour tail.
    m.step(0x0486, 27);
    return m.call(0x0486);
  }
  m.step(0x0437, 27); // jp nz NOT taken

  // Block: ld a,(hl) [7] + ld b,a [4] + and 0x1f [7] + jp nz,0x0486 [10] = 28 t
  regs.a = mem.read8(regs.hl); // hl still 0x6390
  regs.b = regs.a;
  regs.and(0x1f);
  if (regs.fNZ) {
    // jp nz,0x0486 taken: not a boundary -- idle redraw of the colour tail.
    m.step(0x0486, 28);
    return m.call(0x0486);
  }
  m.step(0x043e, 28); // jp nz NOT taken -- 32-frame boundary

  // Block: ld hl,0x39cf [10] + bit 5,b [8] + jr nz,0x0448 [12 taken / 7 not] = 30 / 25 t
  regs.hl = 0x39cf; // table A (default)
  const bit5 = regs.bit(5, regs.b);
  if (bit5) {
    m.step(0x0448, 30); // jr nz taken -- keep table 0x39cf
  } else {
    m.step(0x0445, 25); // jr nz NOT taken
    // Block: ld hl,0x39f7 [10] -- lone instr: 0x0448 is a merge point (also
    // reached directly from the taken jr above).
    regs.hl = 0x39f7; // table B
    m.step(0x0448, 10);
  }

  // call 0x004e -- block-copy the chosen ROM table into the sprite object block.
  m.push16(0x044b);
  m.step(0x004e, 17); // call 0x004e
  m.call(0x004e);

  // Block: ld a,0x03 [7] + ld (0x6082),a [13] = 20 t, then fall into loc_0450.
  regs.a = 0x03;
  mem.write8(SND_TRIGGER + 2, regs.a); // 0x6082 -- falls into loc_0450
  m.step(0x0450, 20);
  return m.call(0x0450);
}
