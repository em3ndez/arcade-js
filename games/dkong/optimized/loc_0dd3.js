// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0dd3 — hand-optimized rewrite of the translated routine at ROM 0x0DD3,
 * proven equal to its oracle by the equivalence harness. It touches only board-render
 * scratch (0x63AB/0x63AD/0x63AF/0x63B0/0x63B1/0x63B2/0x63B3, currently unnamed) and
 * video RAM, so no ram.js name is imported.
 */

/**
 * loc_0dd3 -- decode one layout record and draw its endpoints.  [ROM 0x0DD3-0x0E18]
 *
 * The main draw primitive of the board-layout renderer sub_0da7. From the record kind
 * already in A (stored to 0x63B1), it reads two more layout bytes: the run LENGTH
 * (0x63B2 = byte - C) and the sub-tile phase (0x63B0 = byte & 7). It calls sub_2ff0
 * (0x2FF0) to resolve the tilemap start pointer (saved to 0x63AD), then, unless the
 * record kind is >= 2 (delegated to loc_0e4f), computes and stamps the record's first
 * two tiles (bases derived from 0x63AF via +0xF0 / -0x30) at the pointer held in
 * 0x63AB, and — for a length-1 record (0x63B3 == 1) — zeroes the run counter 0x63B2.
 * It finishes by falling into loc_0e19 (the vertical-run drawer), which walks the run
 * and tail-jumps back to sub_0da7 for the next record.
 *
 * CYCLES -- COLLAPSED to one m.step per basic block (the per-instruction charges of
 * each straight-line run folded into a single charge at the block's exit PC). Each
 * block's TOTAL is the oracle's, EXACTLY: prologue-thru-`push de` 85 t (exit 0x0de4,
 * the `call 0x2ff0` instruction); the `call 0x2ff0` scaffolding itself keeps its own
 * push16/step/m.call (17 t, untouched); `pop de` + the two loads + `cp 0x02` fold to
 * 46 t (exit 0x0df0, the `jp p` decision); the `jp p` taken arm is a single
 * already-atomic instruction (10 t, tail to loc_0e4f); the not-taken arm plus the
 * whole endpoint-stamping run folds to 145 t (exit 0x0e12, the `cp 0x01` / `jp nz`
 * decision); the `jp nz` taken arm is a single instruction (10 t); the not-taken arm
 * (fall through to zero the run counter) folds to 27 t. Total-preservation on every
 * arm keeps the main loop's spin count (0x6019, the PRNG entropy) deterministic.
 * `call 0x2ff0` keeps its push16/step/m.call scaffolding untouched; the tail into
 * loc_0e19 is unchanged (a fall-through `m.call`, no push16 -- its `ret` returns to
 * OUR caller). All callees are reached through m.call (the registry).
 *
 * loc_0dd3 is a draw primitive of sub_0da7, whose call graph includes callers
 * (loc_17b6/loc_1880) not analytically pinned to the mask-cleared NMI, so the
 * collapse coarsens where an in-flight NMI's PC would land (a block-exit address,
 * not the exact instruction) -- the CONVERGENT gate's license (docs/06). "Atomic" is
 * a property of the SCENARIO tested, not of the routine, so even though the OLD
 * strict whole-machine test happened to pass unchanged after this collapse, that is
 * a brittle guarantee that could false-fail on a benign tear under a different
 * scenario -- equivalence-0dd3.test.js therefore gates this routine with
 * convergentGate (SCENARIOS.attract) rather than the strict comparison.
 */
export function loc_0dd3(m) {
  const { regs, mem } = m;

  // Block A: decode the record (kind/length/phase to 0x63B1/0x63B2/0x63B0), then
  // `push de` to preserve it across sub_2ff0.  13+6+7+4+4+13+7+7+13+11 = 85 t.
  mem.write8(0x63b1, regs.a);
  regs.de = (regs.de + 1) & 0xffff;
  regs.a = mem.read8(regs.de);
  regs.l = regs.a;
  regs.sub(regs.c);
  mem.write8(0x63b2, regs.a);
  regs.a = mem.read8(regs.de);
  regs.and(0x07);
  mem.write8(0x63b0, regs.a);
  m.push16(regs.de);
  m.step(0x0de4, 85);

  // resolve the tilemap start pointer via sub_2ff0 -- call scaffolding, untouched.
  m.push16(0x0de7);
  m.step(0x2ff0, 17);
  m.call(0x2ff0);

  // Block B: `pop de`, stash the pointer at 0x63AD, read the record kind, and
  // compare it to 0x02 (sets the flags the branch below reads).  10+16+13+7 = 46 t.
  regs.de = m.pop16();
  mem.write16(0x63ad, regs.hl);
  regs.a = mem.read8(0x63b3);
  regs.cp(0x02);
  m.step(0x0df0, 46);

  // record kind >= 2 (sign/parity even by cp 0x02) -> delegate to loc_0e4f.
  if (regs.fP) {
    m.step(0x0e4f, 10); // jp p taken -- already one instruction, nothing to fold
    return m.call(0x0e4f);
  }

  // Block C (jp p not taken): adjust the run length (0x63B2 += 0x63AF - 0x10), stamp
  // the endpoint tiles (0x63AF+0xF0, then that -0x30) at 0x63AB, and read+compare the
  // record kind against 0x01 (sets the flags the branch below reads).
  //   10+13+7+4+13+4+13+13+7+16+7+4+7+7+13+7 = 145 t.
  regs.a = mem.read8(0x63b2);
  regs.sub(0x10);
  regs.b = regs.a;
  regs.a = mem.read8(0x63af);
  regs.add(regs.b);
  mem.write8(0x63b2, regs.a);
  regs.a = mem.read8(0x63af);
  regs.add(0xf0);
  regs.hl = mem.read16(0x63ab);
  mem.write8(regs.hl, regs.a);
  regs.l = regs.inc8(regs.l); // inc l (wraps within the page), NOT inc hl
  regs.sub(0x30);
  mem.write8(regs.hl, regs.a);
  regs.a = mem.read8(0x63b3);
  regs.cp(0x01);
  m.step(0x0e12, 145);

  // length-1 record (0x63B3 == 1): zero the run counter before the vertical walk.
  if (regs.fNZ) {
    m.step(0x0e19, 10); // jp nz taken -- already one instruction, nothing to fold
  } else {
    // jp nz not taken(10) + xor a(4) + ld (0x63b2),a(13) = 27 t.
    regs.xor(regs.a);
    mem.write8(0x63b2, regs.a);
    m.step(0x0e19, 27);
  }

  // fall into loc_0e19 (the vertical-run drawer); its tail returns to our caller.
  m.call(0x0e19);
}
