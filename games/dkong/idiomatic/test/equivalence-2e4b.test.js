// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for loc_2e4b (ROM 0x2E4B) — the per-object scan's animation-string
 * store + end-of-walk transition.
 *
 * loc_2e4b stores the animation-string pointer back into the object record (low +0x0e,
 * high +0x0f), then — only when the object has reached the far X limit (>= 0xB7) AND the
 * last string byte read was the terminator (0x7F) — switches the object to state 4 (+0x0d)
 * and fires a transition sound (SND_TRIGGER+3 := 0, SND_TRIGGER+4 := 3). Every path falls
 * straight into mirrorObjectPositionToSprite (0x2E6C), which copies the object's X/Y into
 * the paired sprite record and advances both scan cursors (object +16, sprite +4, count
 * preserved, step 4). The idiomatic routine dissolves the oracle's fall-through
 * `m.call(0x2e6c)` into a direct mirrorObjectPositionToSprite call — the callee is already
 * idiomatic (as is its own tail advanceToNextObject, 0x2E78).
 *
 * CONTRACT (memory-equivalence): RAM (whole dump — the oracle chain performs NO push/pop/ret,
 * so there is no dead stack churn and NO STACK_SCRATCH exclusion is needed), SP (unchanged),
 * and the routine's declared REGISTER live-out — the two advanced cursors (ix, iy), the
 * remaining-object count (b) the loop feeds its djnz, and (conservatively) the leftover step
 * (de). The oracle's residual accumulator byte, its arithmetic flags, and its landing pc are
 * DEAD (the loop drives control flow through its own counter and reloads the accumulator for
 * the next object before any test), so none of those is compared.
 *
 * The effect factorises: the two pointer stores depend only on l/h; the transition depends
 * only on object X (>= 0xB7) and c (== 0x7F); the sprite writes + cursor advance are the
 * already-proven mirror tail. loc_2e4b dereferences the object/sprite cursors, so a naive
 * 0..65535 sweep would fault on unmapped addresses; coverage instead comes from:
 *
 *   1. EQUAL (byte sweeps) — at a real (object, sprite) record pair:
 *        X-sweep:  object X over 0..255 with c = 0x7F (crosses the 0xB7 boundary; pins it
 *                  exactly, exercises the transition AND no-transition arms).
 *        C-sweep:  c over 0..255 with X = 0xC0 (>= boundary; pins the 0x7F terminator test,
 *                  and catches an OR-vs-AND transition condition where the X-sweep can't).
 *        L-sweep / H-sweep: pointer low / high over 0..255 with a no-transition X (pins both
 *                  +0x0e/+0x0f stores value-faithfully and rules out a swap or a dropped byte).
 *      Effect/dest cells (state +0x0d, sound latches, sprite X/Y) are pre-stamped with
 *      sentinels so a dropped, misplaced, or spurious write shows. Each run must match the
 *      oracle on the whole contract.
 *   2. EQUAL (grid) — the EXACT in-game cursor sequence (object = 0x6500+16k, sprite =
 *      0x6980+4k) cross-producted, distinct per-record source bytes, to pin the read/write
 *      addressing to the two cursors across the real record positions.
 *   3. EQUAL (independence) — hold the inputs fixed and vary the ignored registers (de, b,
 *      a, and other scratch) and an unrelated RAM byte: the output is unchanged.
 *   4. REALISM (captured) — attract never reaches update75mActorObjects's object loop. Nudge the 10
 *      objects active + non-4 state with a real ROM string pointer and let the game's OWN
 *      code (obj_2e12 / loc_2e9c) drive each one into 0x2e4b; hook it to capture the real
 *      dispatch states — the true cursor sequence and the l/h/c the string walk produces —
 *      and replay oracle vs candidate on each.
 *   5. TEETH — eight deliberately-broken twins (swapped pointer stores, dropped high store,
 *      off-by-one boundary, inverted terminator test, OR-instead-of-AND, wrong next-state,
 *      dropped sound write, dropped mirror tail); the SAME sweeps must catch every one, or the
 *      gate proves nothing.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-2e4b.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_2e4b as oracle } from "../../translated/loc_2e4b.js";
import { loc_2e4b } from "../loc_2e4b.js";
import { mirrorObjectPositionToSprite } from "../mirrorObjectPositionToSprite.js"; // ROM 0x2E6C (for the twins)
import { loc_2e04 } from "../../translated/loc_2e04.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { OBJ_ACTIVE, OBJ_X, OBJ_Y, SPRITE_X, SPRITE_Y, SND_TRIGGER, OBJ_ARRAY_65, ACTOR_SPRITES } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

// Object-record field offsets without a names.js name.
const OBJ_STATE = 0x0d;   // object state field
const OBJ_STR_LO = 0x0e;  // string pointer: low at +0x0e, high at +0x0f

const X_BOUNDARY = 0xb7;        // object X at/past which the walk can finish
const TERMINATOR = 0x7f;        // last-string-byte value that arms the transition
const NEXT_STATE = 4;           // state written on the transition path

const OBJ_BASE = OBJ_ARRAY_65;  // 0x6500 — object-record scan base (object cursor / IX)
const SPR_BASE = ACTOR_SPRITES; // 0x6980 — paired sprite-record scan base (sprite cursor / IY)
const LOOP_COUNT = 0x0a;  // remaining-object count the loop holds while this convergence runs
const JUNK_DE = 0x1234;   // nonzero incoming step: a twin that forgets to set it would be caught
const SAFE_SP = 0x6bf8;   // work-RAM stack; the routine never touches it, kept well-defined

const SPR_SENTINEL = 0xee;   // pre-stamped into sprite X/Y so a dropped/misplaced mirror write shows
const STATE_SENTINEL = 0xc3; // pre-stamped into +0x0d so a spurious/missing state write shows (not 4)
const SND_SENTINEL = 0x55;   // pre-stamped into the sound latches so a spurious/missing write shows

const hx = (v) => "0x" + (v & 0xff).toString(16).padStart(2, "0");
const hx16 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");

// Set the register live-ins + cursors on a clone (frame machinery already neutralised by
// clone(); re-asserted so the oracle's internal stepping can never fire an NMI/frame).
function setInput(m, ix, iy) {
  m.regs.ix = ix;
  m.regs.iy = iy;
  m.regs.b = LOOP_COUNT;
  m.regs.de = JUNK_DE;
  m.regs.sp = SAFE_SP;
  m.nextNmi = Infinity;
  m.nextBoundary = Infinity;
}

// Prepare a fresh entry: cursors + string-pointer/last-byte live-ins set, object X/Y source
// fields seeded, and every dest/effect cell stamped with a sentinel. Applied identically to
// the oracle and candidate clones. `p` = { X, C, L, H, Y }.
function prep(m, ix, iy, p) {
  setInput(m, ix, iy);
  m.regs.l = p.L;
  m.regs.h = p.H;
  m.regs.c = p.C;
  m.mem.write8(ix + OBJ_X, p.X);
  m.mem.write8(ix + OBJ_Y, p.Y);
  // dest / effect cells pre-stamped so a wrong write is visible in the RAM diff
  m.mem.write8(iy + SPRITE_X, SPR_SENTINEL);
  m.mem.write8(iy + SPRITE_Y, SPR_SENTINEL);
  m.mem.write8(ix + OBJ_STATE, STATE_SENTINEL);
  m.mem.write8(ix + OBJ_STR_LO, 0x00);
  m.mem.write8(ix + OBJ_STR_LO + 1, 0x00);
  m.mem.write8(SND_TRIGGER + 3, SND_SENTINEL);
  m.mem.write8(SND_TRIGGER + 4, SND_SENTINEL);
}

// The register live-out contract (what the scan loop consumes) + de (conservative). null | string.
function regLiveOutDiff(o, c) {
  if (o.regs.ix !== c.regs.ix) return `ix oracle=${hx16(o.regs.ix)} cand=${hx16(c.regs.ix)}`;
  if (o.regs.iy !== c.regs.iy) return `iy oracle=${hx16(o.regs.iy)} cand=${hx16(c.regs.iy)}`;
  if (o.regs.b !== c.regs.b) return `b oracle=${hx(o.regs.b)} cand=${hx(c.regs.b)}`;
  if (o.regs.de !== c.regs.de) return `de oracle=${hx16(o.regs.de)} cand=${hx16(c.regs.de)}`;
  return null;
}

// Full contract: RAM (whole dump — no stack churn to mask) + SP (unchanged) + live-out.
function contractDiff(o, c) {
  const ram = firstStateDiff(o.dumpState(), c.dumpState(), (off) => o.stateOffsetToAddr(off));
  if (ram) return `RAM@0x${(ram.addr ?? 0).toString(16)} oracle=${ram.a} cand=${ram.b}`;
  if (o.regs.sp !== c.regs.sp) return `SP oracle=${hx16(o.regs.sp)} cand=${hx16(c.regs.sp)}`;
  return regLiveOutDiff(o, c);
}

// Run oracle vs candidate on two fresh, byte-identical entries at (ix, iy) with inputs `p`
// and return the contract diff (or null).
function runOne(base, ix, iy, p, candidate) {
  const om = base.clone();
  const cm = base.clone();
  prep(om, ix, iy, p);
  prep(cm, ix, iy, p);
  oracle(om);
  candidate(cm);
  return contractDiff(om, cm);
}

// The four factored byte sweeps, run in sequence at a real record pair. Returns the first
// mismatch (or null) and the number of combos compared. Reused by the EQUAL proof and TEETH.
function fullSweep(base, candidate) {
  const ix = OBJ_BASE, iy = SPR_BASE;
  let count = 0;

  // X-sweep: object X over 0..255, terminator held (c = 0x7F) so the transition tracks X only.
  for (let X = 0; X < 256; X++) {
    const d = runOne(base, ix, iy, { X, C: TERMINATOR, L: 0x12, H: 0x39, Y: 0x40 }, candidate);
    count++;
    if (d) return { mismatch: `X=${hx(X)}: ${d}`, count };
  }
  // C-sweep: last-string-byte over 0..255, X past the boundary (0xC0) so the transition tracks c only.
  for (let C = 0; C < 256; C++) {
    const d = runOne(base, ix, iy, { X: 0xc0, C, L: 0x12, H: 0x39, Y: 0x41 }, candidate);
    count++;
    if (d) return { mismatch: `C=${hx(C)}: ${d}`, count };
  }
  // L-sweep: pointer low over 0..255, no-transition X (0x50) so only the two stores + mirror run.
  for (let L = 0; L < 256; L++) {
    const d = runOne(base, ix, iy, { X: 0x50, C: 0x00, L, H: 0x39, Y: 0x42 }, candidate);
    count++;
    if (d) return { mismatch: `L=${hx(L)}: ${d}`, count };
  }
  // H-sweep: pointer high over 0..255, no-transition X.
  for (let H = 0; H < 256; H++) {
    const d = runOne(base, ix, iy, { X: 0x50, C: 0x00, L: 0x12, H, Y: 0x43 }, candidate);
    count++;
    if (d) return { mismatch: `H=${hx(H)}: ${d}`, count };
  }
  return { mismatch: null, count };
}

// -- 1. EQUAL (byte sweeps) ---------------------------------------------------

test("EQUAL (byte sweeps): loc_2e4b == oracle over the X / terminator / pointer-low / pointer-high sweeps", () => {
  const base = new Machine(ROM).clone();
  const { mismatch, count } = fullSweep(base, loc_2e4b);
  assert.equal(mismatch, null, mismatch || "");
  assert.equal(count, 4 * 256, "must have swept all four factored fields over their full 256-value range");

  // Non-vacuity: the oracle really transitions at (X>=0xB7, C=0x7F) and stores the pointer,
  // and really does NOT transition just below the boundary — so a green sweep means agreement
  // on real work, not two no-ops.
  const on = base.clone();
  prep(on, OBJ_BASE, SPR_BASE, { X: 0xc0, C: TERMINATOR, L: 0xab, H: 0xcd, Y: 0x40 });
  oracle(on);
  assert.equal(on.mem.read8(OBJ_BASE + OBJ_STATE), NEXT_STATE, "oracle must set state 4 at the boundary+terminator");
  assert.equal(on.mem.read8(SND_TRIGGER + 3), 0, "oracle must clear SND_TRIGGER+3 on transition");
  assert.equal(on.mem.read8(SND_TRIGGER + 4), 3, "oracle must assert SND_TRIGGER+4 on transition");
  assert.equal(on.mem.read8(OBJ_BASE + OBJ_STR_LO), 0xab, "oracle must store pointer low into +0x0e");
  assert.equal(on.mem.read8(OBJ_BASE + OBJ_STR_LO + 1), 0xcd, "oracle must store pointer high into +0x0f");

  const off = base.clone();
  prep(off, OBJ_BASE, SPR_BASE, { X: 0xb6, C: TERMINATOR, L: 0x00, H: 0x00, Y: 0x40 });
  oracle(off);
  assert.equal(off.mem.read8(OBJ_BASE + OBJ_STATE), STATE_SENTINEL, "just below 0xB7 must NOT transition (proves >=, not >)");
  console.log(`  EQUAL/byte-sweeps: ${count} field values — RAM + SP + live-out identical to the oracle`);
});

// -- 2. EQUAL (grid over the in-game cursor sequence) -------------------------

test("EQUAL (grid): the exact in-game cursor sequence, cross-producted, matches the oracle", () => {
  const base = new Machine(ROM).clone();
  let count = 0;
  for (let k = 0; k < 10; k++) {
    for (let j = 0; j < 10; j++) {
      const ix = (OBJ_BASE + 16 * k) & 0xffff;
      const iy = (SPR_BASE + 4 * j) & 0xffff;
      // Distinct, position-dependent source/pointer bytes so a wrong offset would diverge.
      // Mix transition and no-transition arms across the grid via the X value.
      const p = { X: (0x40 + 0x18 * k) & 0xff, C: TERMINATOR, L: (0x10 + k) & 0xff, H: (0x39 + j) & 0xff, Y: (0xc0 + k) & 0xff };
      const d = runOne(base, ix, iy, p, loc_2e4b);
      assert.equal(d, null, d ? `grid k=${k} j=${j} (ix=${hx16(ix)} iy=${hx16(iy)}): ${d}` : "");
      count++;
    }
  }
  assert.equal(count, 100);
  console.log(`  EQUAL/grid: ${count} in-game (object, sprite) cursor combos identical to the oracle`);
});

// -- 3. EQUAL (input independence) --------------------------------------------

test("EQUAL (independence): output depends ONLY on the cursors, l/h/c, and object X/Y — not de/b/a/scratch/RAM", () => {
  const base = new Machine(ROM).clone();
  const ix = OBJ_BASE, iy = SPR_BASE;
  let count = 0;
  for (const de of [0x0000, 0x0004, 0x1234, 0xffff]) {
    for (const b of [0x01, 0x0a, 0xff]) {
      const om = base.clone();
      const cm = base.clone();
      for (const mm of [om, cm]) {
        prep(mm, ix, iy, { X: 0xc0, C: TERMINATOR, L: 0x9c, H: 0x3a, Y: 0x77 });
        mm.regs.de = de;
        mm.regs.b = b;
        mm.regs.a = 0x11; // dead scratch the oracle overwrites
        mm.mem.write8(0x6100, 0xa5); // a work-RAM byte the routine must not read or write
      }
      oracle(om);
      loc_2e4b(cm);
      const d = contractDiff(om, cm);
      assert.equal(d, null, d ? `de=${hx16(de)} b=${hx(b)}: ${d}` : "");
      // And the transition + mirror land as expected regardless of the ignored inputs.
      assert.equal(cm.mem.read8(ix + OBJ_STATE), NEXT_STATE, "state 4 written regardless of de/b/a");
      assert.equal(cm.mem.read8(ix + OBJ_STR_LO), 0x9c, "pointer low stored regardless of de/b/a");
      assert.equal(cm.mem.read8(ix + OBJ_STR_LO + 1), 0x3a, "pointer high stored regardless of de/b/a");
      assert.equal(cm.mem.read8(iy + SPRITE_X), 0xc0, "sprite X mirrored from object X");
      assert.equal(cm.mem.read8(iy + SPRITE_Y), 0x77, "sprite Y mirrored from object Y");
      assert.equal(cm.regs.ix, (ix + 16) & 0xffff, "object cursor must advance by 16");
      assert.equal(cm.regs.iy, (iy + 4) & 0xffff, "sprite cursor must advance by 4");
      assert.equal(cm.regs.de, 4, "leftover step must be 4 regardless of incoming de");
      assert.equal(cm.regs.b, b, "remaining-object count must be preserved");
      count++;
    }
  }
  console.log(`  EQUAL/independence: ${count} (de,b,a,RAM) variations — output unchanged`);
});

// -- 4. REALISM (real captured dispatches) ------------------------------------

// Attract never reaches update75mActorObjects's object loop. Nudge all 10 objects active + non-4 state
// with a real ROM string pointer and let the game's OWN code (obj_2e12, or loc_2e9c on the
// terminator) drive each one into 0x2e4b. Hook 0x2e4b to capture the real dispatch states —
// the true cursor sequence and the l/h/c the string walk produces — and return the clones.
function captureRealDispatches() {
  const host = new Machine(ROM);
  host.runFrames(700); // realistic work RAM (0x2e4b does not dispatch in attract, so no captures yet)
  const m = host.clone();
  m.regs.sp = 0x6c00;
  m.push16(0x4d17); // sentinel caller-return for update75mActorObjects
  m.mem.write8(0x6227, 3); // board = 3   -> rst 0x30 (A=0x04) passes
  m.mem.write8(0x6200, 1); // enable bit0 -> rst 0x10 passes -> full 10-object loop
  for (let k = 0; k < 10; k++) {
    const ix = OBJ_BASE + 16 * k;
    m.mem.write8(ix + OBJ_ACTIVE, 0x01);            // active (bit0) -> processed, not the inactive path
    m.mem.write8(ix + OBJ_STATE, 0x00);       // state != 4 -> the string-walk fall-through into 0x2e4b
    m.mem.write8(ix + OBJ_STR_LO, 0xaa);      // string pointer -> 0x39AA, a real ROM animation string
    m.mem.write8(ix + OBJ_STR_LO + 1, 0x39);
    m.mem.write8(ix + OBJ_X, (0x30 + 0x14 * k) & 0xff); // spread X across / past the 0xB7 boundary
    m.mem.write8(ix + OBJ_Y, (0x40 + k) & 0xff);        // distinct object Y
  }
  const caps = [];
  const hook = (mm) => {
    caps.push(mm.clone());
    return oracle(mm);
  };
  m.overrides.set(0x2e4b, hook);
  m.routines.set(0x2e4b, hook);
  loc_2e04(m);
  return caps;
}

test("REALISM: real captured 0x2e4b dispatches — loc_2e4b matches the oracle", () => {
  const caps = captureRealDispatches();
  assert.equal(caps.length, 10, "the steered full-loop update75mActorObjects should dispatch 0x2e4b once per object (10)");

  caps.forEach((cap, i) => {
    // The captured cursors are the exact in-game scan sequence.
    assert.equal(cap.regs.ix, (OBJ_BASE + 16 * i) & 0xffff, `dispatch ${i}: unexpected object cursor`);
    assert.equal(cap.regs.iy, (SPR_BASE + 4 * i) & 0xffff, `dispatch ${i}: unexpected sprite cursor`);
    const o = cap.clone();
    const c = cap.clone();
    o.nextNmi = Infinity; o.nextBoundary = Infinity;
    c.nextNmi = Infinity; c.nextBoundary = Infinity;
    oracle(o);
    loc_2e4b(c);
    const d = contractDiff(o, c);
    assert.equal(d, null, d ? `real dispatch ${i} (ix=${hx16(cap.regs.ix)} c=${hx(cap.regs.c)}): ${d}` : "");
  });
  console.log(`  REALISM: ${caps.length} real full-loop 0x2e4b dispatches — RAM + SP + live-out == oracle`);
});

// -- 5. TEETH -----------------------------------------------------------------

/** (a) swaps the two pointer stores: low -> +0x0f, high -> +0x0e. */
function brokenSwapPtr(m) {
  const { regs, mem } = m;
  const ix = regs.ix;
  mem.write8(ix + OBJ_STR_LO, regs.h);
  mem.write8(ix + OBJ_STR_LO + 1, regs.l);
  if (mem.read8(ix + OBJ_X) >= X_BOUNDARY && regs.c === TERMINATOR) {
    mem.write8(ix + OBJ_STATE, NEXT_STATE);
    mem.write8(SND_TRIGGER + 3, 0);
    mem.write8(SND_TRIGGER + 4, 3);
  }
  mirrorObjectPositionToSprite(m);
}
/** (b) drops the high pointer store entirely. */
function brokenDropHigh(m) {
  const { regs, mem } = m;
  const ix = regs.ix;
  mem.write8(ix + OBJ_STR_LO, regs.l);
  if (mem.read8(ix + OBJ_X) >= X_BOUNDARY && regs.c === TERMINATOR) {
    mem.write8(ix + OBJ_STATE, NEXT_STATE);
    mem.write8(SND_TRIGGER + 3, 0);
    mem.write8(SND_TRIGGER + 4, 3);
  }
  mirrorObjectPositionToSprite(m);
}
/** (c) off-by-one boundary: `>` instead of `>=`, so X == 0xB7 fails to transition. */
function brokenBoundaryStrict(m) {
  const { regs, mem } = m;
  const ix = regs.ix;
  mem.write8(ix + OBJ_STR_LO, regs.l);
  mem.write8(ix + OBJ_STR_LO + 1, regs.h);
  if (mem.read8(ix + OBJ_X) > X_BOUNDARY && regs.c === TERMINATOR) {
    mem.write8(ix + OBJ_STATE, NEXT_STATE);
    mem.write8(SND_TRIGGER + 3, 0);
    mem.write8(SND_TRIGGER + 4, 3);
  }
  mirrorObjectPositionToSprite(m);
}
/** (d) inverts the terminator test: `!==` instead of `===`. */
function brokenTermInverted(m) {
  const { regs, mem } = m;
  const ix = regs.ix;
  mem.write8(ix + OBJ_STR_LO, regs.l);
  mem.write8(ix + OBJ_STR_LO + 1, regs.h);
  if (mem.read8(ix + OBJ_X) >= X_BOUNDARY && regs.c !== TERMINATOR) {
    mem.write8(ix + OBJ_STATE, NEXT_STATE);
    mem.write8(SND_TRIGGER + 3, 0);
    mem.write8(SND_TRIGGER + 4, 3);
  }
  mirrorObjectPositionToSprite(m);
}
/** (e) OR instead of AND — transitions if EITHER condition holds. */
function brokenOrGate(m) {
  const { regs, mem } = m;
  const ix = regs.ix;
  mem.write8(ix + OBJ_STR_LO, regs.l);
  mem.write8(ix + OBJ_STR_LO + 1, regs.h);
  if (mem.read8(ix + OBJ_X) >= X_BOUNDARY || regs.c === TERMINATOR) {
    mem.write8(ix + OBJ_STATE, NEXT_STATE);
    mem.write8(SND_TRIGGER + 3, 0);
    mem.write8(SND_TRIGGER + 4, 3);
  }
  mirrorObjectPositionToSprite(m);
}
/** (f) writes the wrong next-state value (5 instead of 4). */
function brokenNextState(m) {
  const { regs, mem } = m;
  const ix = regs.ix;
  mem.write8(ix + OBJ_STR_LO, regs.l);
  mem.write8(ix + OBJ_STR_LO + 1, regs.h);
  if (mem.read8(ix + OBJ_X) >= X_BOUNDARY && regs.c === TERMINATOR) {
    mem.write8(ix + OBJ_STATE, 5);
    mem.write8(SND_TRIGGER + 3, 0);
    mem.write8(SND_TRIGGER + 4, 3);
  }
  mirrorObjectPositionToSprite(m);
}
/** (g) drops the SND_TRIGGER+4 assert. */
function brokenDropSound(m) {
  const { regs, mem } = m;
  const ix = regs.ix;
  mem.write8(ix + OBJ_STR_LO, regs.l);
  mem.write8(ix + OBJ_STR_LO + 1, regs.h);
  if (mem.read8(ix + OBJ_X) >= X_BOUNDARY && regs.c === TERMINATOR) {
    mem.write8(ix + OBJ_STATE, NEXT_STATE);
    mem.write8(SND_TRIGGER + 3, 0);
  }
  mirrorObjectPositionToSprite(m);
}
/** (h) drops the mirror tail — no sprite write, no cursor advance. */
function brokenDropMirror(m) {
  const { regs, mem } = m;
  const ix = regs.ix;
  mem.write8(ix + OBJ_STR_LO, regs.l);
  mem.write8(ix + OBJ_STR_LO + 1, regs.h);
  if (mem.read8(ix + OBJ_X) >= X_BOUNDARY && regs.c === TERMINATOR) {
    mem.write8(ix + OBJ_STATE, NEXT_STATE);
    mem.write8(SND_TRIGGER + 3, 0);
    mem.write8(SND_TRIGGER + 4, 3);
  }
}

test("TEETH: the same byte sweeps CATCH every broken twin", () => {
  const base = new Machine(ROM).clone();
  const twins = [
    ["swapped pointer stores", brokenSwapPtr, "RAM"],
    ["dropped high store", brokenDropHigh, "RAM"],
    ["off-by-one boundary (> not >=)", brokenBoundaryStrict, "RAM"],
    ["inverted terminator test", brokenTermInverted, "RAM"],
    ["OR instead of AND", brokenOrGate, "RAM"],
    ["wrong next-state value", brokenNextState, "RAM"],
    ["dropped sound write", brokenDropSound, "RAM"],
    ["dropped mirror tail", brokenDropMirror, "RAM"], // no sprite write -> RAM diverges at the sprite cell
  ];
  for (const [name, twin, surface] of twins) {
    const { mismatch } = fullSweep(base, twin);
    assert.notEqual(mismatch, null, `the sweep FAILED to catch "${name}" — the gate is worthless`);
    assert.ok(
      mismatch.includes(surface),
      `"${name}" should be caught on ${surface}, got: ${mismatch}`,
    );
    console.log(`  TEETH/${name}: caught — ${mismatch}`);
  }
});
