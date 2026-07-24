// SPDX-License-Identifier: GPL-3.0-only
/**
 * sub_309f — hand-optimized rewrite of the translated routine at ROM 0x309F,
 * proven equal to its oracle by the equivalence harness. It touches only the task-queue
 * work RAM (head pointer 0x60B0, ring buffer 0x60C0-0x60FF), which lacks settled ram.js
 * names, so those stay hex with descriptive comments.
 */

/**
 * sub_309f -- enqueue a 2-byte message (D,E) into the task ring buffer.  [ROM 0x309F-0x30BC]
 *
 * The shared "post a task" primitive (31 optimized callers so far). The ring lives at
 * 0x60C0-0x60FF; 0x60B0 holds the low byte of the write head (HL's page is fixed at 0x60).
 *   - Load the head into L; if the target slot's high bit is CLEAR the ring is full at that
 *     slot, so the task is DROPPED (restore HL, ret).
 *   - Otherwise write D then E into the slot and its successor, advance the head by 2, and
 *     wrap it back to 0xC0 if it fell below 0xC0 (i.e. ran past 0xFF within the page).
 *   - Store the new head at 0x60B0, restore HL, ret.
 *
 * HL is PRESERVED (push/pop); the L increments are byte-wide (`inc l`, D's page fixed).
 *
 * CYCLES -- COLLAPSED to one m.step per basic block. `jp z`/`jp nc` cost the oracle's 10 t
 * whichever way they go, so each is folded into whichever arm it lands in rather than split
 * at the branch. Per-path totals, summed and cross-checked against this file's own prior
 * per-instruction charges (all previously proven equal):
 *   prologue (push hl + ld hl,0x60c0 + ld a,(0x60b0) + ld l,a + bit 7,(hl)) 50 t;
 *   DROP path (jp z taken + pop hl) 20 t + ret 10 t = 80 t total;
 *   normal path (jp z not-taken + the 6 write/inc/cp ops) 43 t, then either
 *   WRAP (jp nc not-taken + ld a,0xc0) 17 t or NO-WRAP (jp nc taken) 10 t, then the common
 *   tail (ld (0x60b0),a + pop hl) 23 t + ret 10 t -- 143 t (wrap) / 136 t (no wrap) total.
 *   Total-preservation keeps the caller's cycle clock exact; only the mid-block PC snapshot
 *   an NMI would observe is coarsened, same as any collapse.
 *
 * A widely-shared utility (31 call paths), not all provably mask-cleared; see the
 * equivalence test for the (convergent, unconditionally) gate this routine runs under. The
 * push/pop that preserve HL are modelled explicitly.
 */
export function sub_309f(m) {
  const { regs, mem } = m;

  m.push16(regs.hl);
  regs.hl = 0x60c0; // ring buffer base (page fixed at 0x60)
  regs.a = mem.read8(0x60b0); // the write head (low byte)
  regs.l = regs.a;
  const free = regs.bit(7, mem.read8(regs.hl));
  // push hl[11] + ld hl,0x60c0[10] + ld a,(0x60b0)[13] + ld l,a[4] + bit 7,(hl)[12] = 50 t
  m.step(0x30a9, 50);

  if (!free) {
    // jp z TAKEN[10] -- slot occupied, drop the task -- + pop hl[10] = 20 t
    regs.hl = m.pop16();
    m.step(0x30bc, 20);
    m.ret(); // total 80 t on this path
    return;
  }

  mem.write8(regs.hl, regs.d);
  regs.l = (regs.l + 1) & 0xff; // inc l
  mem.write8(regs.hl, regs.e);
  regs.l = (regs.l + 1) & 0xff;
  regs.a = regs.l;
  regs.cp(0xc0);
  // jp z NOT taken[10] + ld (hl),d[7] + inc l[4] + ld (hl),e[7] + inc l[4] + ld a,l[4]
  // + cp 0xc0[7] = 43 t
  m.step(0x30b3, 43);

  if (regs.fC) {
    regs.a = 0xc0;
    m.step(0x30b8, 17); // jp nc NOT taken[10] + ld a,0xc0[7] -- head ran below 0xC0, wrap it up
  } else {
    m.step(0x30b8, 10); // jp nc TAKEN[10]
  }

  mem.write8(0x60b0, regs.a); // store the advanced head
  regs.hl = m.pop16();
  m.step(0x30bc, 23); // ld (0x60b0),a[13] + pop hl[10]
  m.ret(); // total 143 t (wrap) / 136 t (no wrap)
}
