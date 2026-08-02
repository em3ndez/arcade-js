// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for loc_2e9c (ROM 0x2E9C) — the per-object scan's animation-string
 * terminator handler.
 *
 * loc_2e9c is reached from obj_2e12 the moment an object's animation-string walk reads the
 * 0x7F terminator. It rewinds the string pointer to the base of the string (0x39AA), fires a
 * wrap sound (SND_TRIGGER+3 := 3), and falls straight into loc_2e4b (0x2E4B), the object-update
 * convergence point — which stores the (rewound) pointer back into the object record (+0x0e/+0x0f),
 * runs the end-of-walk transition test (object X >= 0xB7 AND last-string-byte == 0x7F -> state 4 +
 * transition sound, which re-clears SND_TRIGGER+3 to 0 and sets SND_TRIGGER+4 := 3), and mirrors the
 * object's position to the paired sprite while advancing both scan cursors (object +16, sprite +4).
 *
 * The idiomatic routine forces the pointer to 0x39AA in registers and calls loc_2e4b DIRECTLY (both
 * loc_2e4b and its own mirror tail are already idiomatic and separately proven memory-equivalent), so
 * the oracle's fall-through `jp 0x2e4b` dissolves into a direct call.
 *
 * The distinguishing behaviour of loc_2e9c vs loc_2e4b is: (a) the STORED pointer is ALWAYS 0x39AA —
 * the incoming pointer is dead; and (b) SND_TRIGGER+3 is written to 3 BEFORE loc_2e4b runs, so it
 * survives on the non-transition path and is overwritten to 0 on the transition path.
 *
 * CONTRACT (memory-equivalence): RAM (whole dump — the oracle chain performs NO push/pop/ret, so
 * there is no dead stack churn and NO STACK_SCRATCH exclusion), SP (unchanged), and the routine's
 * declared REGISTER live-out — the two advanced cursors (ix, iy), the remaining-object count (b) the
 * loop feeds its djnz, and (conservatively) the leftover step (de). The oracle's residual accumulator
 * byte, its flags, and its landing pc are DEAD (the loop reloads the accumulator for the next object
 * before any test), so none of those is compared.
 *
 * loc_2e9c dereferences the object/sprite cursors, so a naive 0..65535 sweep would fault on unmapped
 * addresses; coverage instead comes from:
 *
 *   1. EQUAL (byte sweeps) — at a real (object, sprite) record pair:
 *        X-sweep:  object X over 0..255 with c = 0x7F (crosses the 0xB7 boundary; exercises BOTH the
 *                  transition arm — SND_TRIGGER+3 ends 0 — and the non-transition arm — the wrap
 *                  sound survives at 3).
 *        C-sweep:  c over 0..255 with X = 0xC0 (>= boundary; pins the 0x7F terminator test loc_2e4b
 *                  makes with the pointer forced).
 *        L-sweep / H-sweep: incoming pointer low / high over 0..255 with a no-transition X — proving
 *                  the stored pointer is ALWAYS 0x39AA regardless of the incoming pointer.
 *      Dest/effect cells (state +0x0d, sound latches, pointer store, sprite X/Y) are pre-stamped with
 *      sentinels so a dropped, misplaced, or spurious write shows. Each run must match the oracle on
 *      the whole contract.
 *   2. EQUAL (grid) — the EXACT in-game cursor sequence (object = 0x6500+16k, sprite = 0x6980+4k)
 *      cross-producted, to pin the read/write addressing to the two cursors across the real records.
 *   3. EQUAL (independence) — hold the inputs fixed and vary the ignored registers (de, b, a) and an
 *      unrelated RAM byte: the output is unchanged.
 *   4. REALISM (captured) — attract never reaches loc_2e04's object loop. Nudge the 10 objects active
 *      + non-4 state with a string pointer aimed at a REAL 0x7F terminator in the 0x39xx ROM string
 *      table (0x39C2), and let the game's OWN code (obj_2e12) drive each object into 0x2e9c; hook it to
 *      capture the real dispatch states and replay oracle vs candidate on each.
 *   5. TEETH — six deliberately-broken twins (no rewind / wrong base / dropped sound / wrong sound
 *      value / dropped convergence call / swapped-into-the-store); the SAME sweeps must catch every one,
 *      or the gate proves nothing.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-2e9c.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_2e9c as oracle } from "../../translated/loc_2e9c.js";
import { loc_2e9c } from "../loc_2e9c.js";
import { loc_2e4b } from "../loc_2e4b.js"; // ROM 0x2E4B (for the twins)
import { loc_2e04 } from "../../translated/loc_2e04.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { OBJ_X, OBJ_Y, SPRITE_X, SPRITE_Y, SND_TRIGGER, OBJ_ARRAY_65, ACTOR_SPRITES } from "../ram.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

// Object-record field offsets without a ram.js name.
const OBJ_STATE = 0x0d;   // object state field
const OBJ_STR_LO = 0x0e;  // string pointer: low at +0x0e, high at +0x0f

const STRING_BASE = 0x39aa;    // the base the walk pointer is ALWAYS rewound to (low 0xAA, high 0x39)
const STRING_BASE_LO = 0xaa;
const STRING_BASE_HI = 0x39;
const X_BOUNDARY = 0xb7;       // object X at/past which the walk can finish (in loc_2e4b)
const TERMINATOR = 0x7f;       // last-string-byte value that arms the transition
const WRAP_SOUND = 0x03;       // value loc_2e9c writes to SND_TRIGGER+3 (survives off the transition)
const NEXT_STATE = 4;          // state written on the transition path (by loc_2e4b)

const OBJ_BASE = OBJ_ARRAY_65;  // 0x6500 — object-record scan base (object cursor / IX)
const SPR_BASE = ACTOR_SPRITES; // 0x6980 — paired sprite-record scan base (sprite cursor / IY)
const LOOP_COUNT = 0x0a;  // remaining-object count the loop holds while this convergence runs
const JUNK_DE = 0x1234;   // nonzero incoming step: a twin that forgets to set it would be caught
const SAFE_SP = 0x6bf8;   // work-RAM stack; the routine never touches it, kept well-defined

// Incoming pointer that is NOT the base, so a twin that stores the incoming pointer (rather than
// forcing 0x39AA) diverges everywhere the sweeps run.
const INCOMING_L = 0x11;
const INCOMING_H = 0x22;

const SPR_SENTINEL = 0xee;   // pre-stamped into sprite X/Y so a dropped/misplaced mirror write shows
const STATE_SENTINEL = 0xc3; // pre-stamped into +0x0d so a spurious/missing state write shows (not 4)
const SND_SENTINEL = 0x55;   // pre-stamped into the sound latches so a spurious/missing write shows
const PTR_SENTINEL = 0x00;   // pre-stamped into +0x0e/+0x0f so a dropped/wrong pointer store shows

const hx = (v) => "0x" + (v & 0xff).toString(16).padStart(2, "0");
const hx16 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");

// Set the register live-ins + cursors on a clone (frame machinery already neutralised by clone();
// re-asserted so the oracle's internal stepping can never fire an NMI/frame).
function setInput(m, ix, iy) {
  m.regs.ix = ix;
  m.regs.iy = iy;
  m.regs.b = LOOP_COUNT;
  m.regs.de = JUNK_DE;
  m.regs.sp = SAFE_SP;
  m.nextNmi = Infinity;
  m.nextBoundary = Infinity;
}

// Prepare a fresh entry: cursors + incoming pointer/last-byte live-ins set, object X/Y source fields
// seeded, and every dest/effect cell stamped with a sentinel. Applied identically to the oracle and
// candidate clones. `p` = { X, C, L, H, Y }.
function prep(m, ix, iy, p) {
  setInput(m, ix, iy);
  m.regs.l = p.L;   // incoming pointer low — IGNORED (rewound to 0xAA)
  m.regs.h = p.H;   // incoming pointer high — IGNORED (rewound to 0x39)
  m.regs.c = p.C;   // last-read string byte (terminator test in loc_2e4b)
  m.mem.write8(ix + OBJ_X, p.X);
  m.mem.write8(ix + OBJ_Y, p.Y);
  // dest / effect cells pre-stamped so a wrong write is visible in the RAM diff
  m.mem.write8(iy + SPRITE_X, SPR_SENTINEL);
  m.mem.write8(iy + SPRITE_Y, SPR_SENTINEL);
  m.mem.write8(ix + OBJ_STATE, STATE_SENTINEL);
  m.mem.write8(ix + OBJ_STR_LO, PTR_SENTINEL);
  m.mem.write8(ix + OBJ_STR_LO + 1, PTR_SENTINEL);
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
// and return the contract diff (or null). The oracle's `jp 0x2e4b` resolves through the default
// ORACLE_ROUTINES registry to the frozen translated loc_2e4b chain.
function runOne(base, ix, iy, p, candidate) {
  const om = base.clone();
  const cm = base.clone();
  prep(om, ix, iy, p);
  prep(cm, ix, iy, p);
  oracle(om);
  candidate(cm);
  return contractDiff(om, cm);
}

// The four factored byte sweeps, run in sequence at a real record pair. Returns the first mismatch
// (or null) and the number of combos compared. Reused by the EQUAL proof and TEETH. All sweeps use a
// non-base incoming pointer so a "store the incoming pointer" twin is caught anywhere.
function fullSweep(base, candidate) {
  const ix = OBJ_BASE, iy = SPR_BASE;
  let count = 0;

  // X-sweep: object X over 0..255, terminator held (c = 0x7F) so loc_2e4b's transition tracks X.
  for (let X = 0; X < 256; X++) {
    const d = runOne(base, ix, iy, { X, C: TERMINATOR, L: INCOMING_L, H: INCOMING_H, Y: 0x40 }, candidate);
    count++;
    if (d) return { mismatch: `X=${hx(X)}: ${d}`, count };
  }
  // C-sweep: last-string-byte over 0..255, X past the boundary (0xC0) so the transition tracks c only.
  for (let C = 0; C < 256; C++) {
    const d = runOne(base, ix, iy, { X: 0xc0, C, L: INCOMING_L, H: INCOMING_H, Y: 0x41 }, candidate);
    count++;
    if (d) return { mismatch: `C=${hx(C)}: ${d}`, count };
  }
  // L-sweep: incoming pointer low over 0..255, no-transition X (0x50) — the stored pointer must stay
  // 0x39AA regardless (proves the incoming low is ignored).
  for (let L = 0; L < 256; L++) {
    const d = runOne(base, ix, iy, { X: 0x50, C: 0x00, L, H: INCOMING_H, Y: 0x42 }, candidate);
    count++;
    if (d) return { mismatch: `L=${hx(L)}: ${d}`, count };
  }
  // H-sweep: incoming pointer high over 0..255, no-transition X — stored pointer must stay 0x39AA.
  for (let H = 0; H < 256; H++) {
    const d = runOne(base, ix, iy, { X: 0x50, C: 0x00, L: INCOMING_L, H, Y: 0x43 }, candidate);
    count++;
    if (d) return { mismatch: `H=${hx(H)}: ${d}`, count };
  }
  return { mismatch: null, count };
}

// -- 1. EQUAL (byte sweeps) ---------------------------------------------------

test("EQUAL (byte sweeps): loc_2e9c == oracle over the X / terminator / incoming-low / incoming-high sweeps", () => {
  const base = new Machine(ROM).clone();
  const { mismatch, count } = fullSweep(base, loc_2e9c);
  assert.equal(mismatch, null, mismatch || "");
  assert.equal(count, 4 * 256, "must have swept all four factored fields over their full 256-value range");

  // Non-vacuity: the oracle rewinds the pointer to 0x39AA, fires the wrap sound off the transition,
  // and — at the boundary + terminator — transitions (state 4, wrap sound re-cleared), so a green
  // sweep means agreement on real work, not two no-ops.
  const off = base.clone(); // no-transition arm (X below boundary): wrap sound survives at 3
  prep(off, OBJ_BASE, SPR_BASE, { X: 0x50, C: TERMINATOR, L: INCOMING_L, H: INCOMING_H, Y: 0x40 });
  oracle(off);
  assert.equal(off.mem.read8(OBJ_BASE + OBJ_STR_LO), STRING_BASE_LO, "oracle must rewind pointer low to 0xAA");
  assert.equal(off.mem.read8(OBJ_BASE + OBJ_STR_LO + 1), STRING_BASE_HI, "oracle must rewind pointer high to 0x39");
  assert.equal(off.mem.read8(SND_TRIGGER + 3), WRAP_SOUND, "oracle must fire the wrap sound (SND_TRIGGER+3 = 3) off the transition");
  assert.equal(off.mem.read8(OBJ_BASE + OBJ_STATE), STATE_SENTINEL, "below the boundary must NOT transition");

  const on = base.clone(); // transition arm (X past boundary): loc_2e4b re-clears the wrap sound
  prep(on, OBJ_BASE, SPR_BASE, { X: 0xc0, C: TERMINATOR, L: INCOMING_L, H: INCOMING_H, Y: 0x40 });
  oracle(on);
  assert.equal(on.mem.read8(OBJ_BASE + OBJ_STATE), NEXT_STATE, "oracle must set state 4 at the boundary+terminator");
  assert.equal(on.mem.read8(SND_TRIGGER + 3), 0, "the transition path re-clears SND_TRIGGER+3 to 0");
  assert.equal(on.mem.read8(SND_TRIGGER + 4), 3, "the transition path asserts SND_TRIGGER+4 = 3");
  assert.equal(on.mem.read8(OBJ_BASE + OBJ_STR_LO), STRING_BASE_LO, "pointer still rewound to 0xAA on the transition");
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
      // Distinct, position-dependent source bytes so a wrong offset would diverge. Mix transition
      // and no-transition arms across the grid via the X value; terminator held.
      const p = { X: (0x40 + 0x18 * k) & 0xff, C: TERMINATOR, L: (0x10 + k) & 0xff, H: (0x20 + j) & 0xff, Y: (0xc0 + k) & 0xff };
      const d = runOne(base, ix, iy, p, loc_2e9c);
      assert.equal(d, null, d ? `grid k=${k} j=${j} (ix=${hx16(ix)} iy=${hx16(iy)}): ${d}` : "");
      count++;
    }
  }
  assert.equal(count, 100);
  console.log(`  EQUAL/grid: ${count} in-game (object, sprite) cursor combos identical to the oracle`);
});

// -- 3. EQUAL (input independence) --------------------------------------------

test("EQUAL (independence): output depends ONLY on the cursors, c, and object X/Y — not the incoming pointer, de/b/a/RAM", () => {
  const base = new Machine(ROM).clone();
  const ix = OBJ_BASE, iy = SPR_BASE;
  let count = 0;
  for (const de of [0x0000, 0x0004, 0x1234, 0xffff]) {
    for (const b of [0x01, 0x0a, 0xff]) {
      const om = base.clone();
      const cm = base.clone();
      for (const mm of [om, cm]) {
        prep(mm, ix, iy, { X: 0xc0, C: TERMINATOR, L: 0x9c, H: 0x3a, Y: 0x77 }); // incoming pointer noise
        mm.regs.de = de;
        mm.regs.b = b;
        mm.regs.a = 0x11; // dead scratch the oracle overwrites
        mm.mem.write8(0x6100, 0xa5); // a work-RAM byte the routine must not read or write
      }
      oracle(om);
      loc_2e9c(cm);
      const d = contractDiff(om, cm);
      assert.equal(d, null, d ? `de=${hx16(de)} b=${hx(b)}: ${d}` : "");
      // And the rewind + transition + mirror land as expected regardless of the ignored inputs.
      assert.equal(cm.mem.read8(ix + OBJ_STATE), NEXT_STATE, "state 4 written regardless of de/b/a");
      assert.equal(cm.mem.read8(ix + OBJ_STR_LO), STRING_BASE_LO, "pointer rewound to 0xAA regardless of incoming pointer / de/b/a");
      assert.equal(cm.mem.read8(ix + OBJ_STR_LO + 1), STRING_BASE_HI, "pointer rewound to 0x39 regardless of incoming pointer / de/b/a");
      assert.equal(cm.mem.read8(iy + SPRITE_X), 0xc0, "sprite X mirrored from object X");
      assert.equal(cm.mem.read8(iy + SPRITE_Y), 0x77, "sprite Y mirrored from object Y");
      assert.equal(cm.regs.ix, (ix + 16) & 0xffff, "object cursor must advance by 16");
      assert.equal(cm.regs.iy, (iy + 4) & 0xffff, "sprite cursor must advance by 4");
      assert.equal(cm.regs.de, 4, "leftover step must be 4 regardless of incoming de");
      assert.equal(cm.regs.b, b, "remaining-object count must be preserved");
      count++;
    }
  }
  console.log(`  EQUAL/independence: ${count} (de,b,a,RAM,incoming-pointer) variations — output unchanged`);
});

// -- 4. REALISM (real captured dispatches) ------------------------------------

// Attract never reaches loc_2e04's object loop. Nudge all 10 objects active + non-4 state with a
// string pointer aimed at a REAL 0x7F terminator in the 0x39xx ROM string table (0x39C2), and let the
// game's OWN code (obj_2e12) read the terminator and dispatch 0x2e9c. Hook 0x2e9c to capture the real
// dispatch states (the true cursor sequence and the c the walk produces) and return the clones.
function captureRealDispatches() {
  const host = new Machine(ROM);
  host.runFrames(700); // realistic work RAM (0x2e9c does not dispatch in attract, so no captures yet)
  const m = host.clone();
  m.regs.sp = 0x6c00;
  m.push16(0x4d17); // sentinel caller-return for loc_2e04
  m.mem.write8(0x6227, 3); // board = 3   -> rst 0x30 (A=0x04) passes
  m.mem.write8(0x6200, 1); // enable bit0 -> rst 0x10 passes -> full 10-object loop
  for (let k = 0; k < 10; k++) {
    const ix = OBJ_BASE + 16 * k;
    m.mem.write8(ix + 0x00, 0x01);            // active (bit0) -> processed, not the inactive path
    m.mem.write8(ix + OBJ_STATE, 0x00);       // state != 4 -> the string-walk path
    m.mem.write8(ix + OBJ_STR_LO, 0xc2);      // string pointer -> 0x39C2, a REAL 0x7F terminator byte
    m.mem.write8(ix + OBJ_STR_LO + 1, 0x39);
    m.mem.write8(ix + OBJ_X, (0x30 + 0x14 * k) & 0xff); // spread X across / past the 0xB7 boundary
    m.mem.write8(ix + OBJ_Y, (0x40 + k) & 0xff);        // distinct object Y
  }
  const caps = [];
  const hook = (mm) => {
    caps.push(mm.clone());
    return oracle(mm);
  };
  m.overrides.set(0x2e9c, hook);
  m.routines.set(0x2e9c, hook);
  loc_2e04(m);
  return caps;
}

test("REALISM: real captured 0x2e9c dispatches — loc_2e9c matches the oracle", () => {
  const caps = captureRealDispatches();
  assert.equal(caps.length, 10, "the steered full-loop loc_2e04 should dispatch 0x2e9c once per object (10)");

  caps.forEach((cap, i) => {
    // The captured cursors are the exact in-game scan sequence; c is the terminator the walk read.
    assert.equal(cap.regs.ix, (OBJ_BASE + 16 * i) & 0xffff, `dispatch ${i}: unexpected object cursor`);
    assert.equal(cap.regs.iy, (SPR_BASE + 4 * i) & 0xffff, `dispatch ${i}: unexpected sprite cursor`);
    assert.equal(cap.regs.c, TERMINATOR, `dispatch ${i}: 0x2e9c should only be reached with the terminator in c`);
    const o = cap.clone();
    const c = cap.clone();
    o.nextNmi = Infinity; o.nextBoundary = Infinity;
    c.nextNmi = Infinity; c.nextBoundary = Infinity;
    oracle(o);
    loc_2e9c(c);
    const d = contractDiff(o, c);
    assert.equal(d, null, d ? `real dispatch ${i} (ix=${hx16(cap.regs.ix)} X=${hx(cap.mem.read8(cap.regs.ix + OBJ_X))}): ${d}` : "");
  });
  console.log(`  REALISM: ${caps.length} real full-loop 0x2e9c dispatches — RAM + SP + live-out == oracle`);
});

// -- 5. TEETH -----------------------------------------------------------------

/** (a) no rewind: stores the INCOMING pointer instead of forcing 0x39AA. */
function brokenNoRewind(m) {
  const { mem } = m;
  mem.write8(SND_TRIGGER + 3, WRAP_SOUND);
  loc_2e4b(m); // incoming l/h left as-is -> loc_2e4b stores the incoming pointer
}
/** (b) wrong base: rewinds to 0x39AB (off by one) instead of 0x39AA. */
function brokenWrongBase(m) {
  const { regs, mem } = m;
  regs.hl = 0x39ab; // BUG: base + 1
  mem.write8(SND_TRIGGER + 3, WRAP_SOUND);
  loc_2e4b(m);
}
/** (c) dropped sound: never writes the wrap sound. */
function brokenDropSound(m) {
  const { regs } = m;
  regs.hl = STRING_BASE;
  loc_2e4b(m); // BUG: SND_TRIGGER+3 write dropped
}
/** (d) wrong sound value: writes 2 instead of 3. */
function brokenWrongSound(m) {
  const { regs, mem } = m;
  regs.hl = STRING_BASE;
  mem.write8(SND_TRIGGER + 3, 0x02); // BUG: wrong value
  loc_2e4b(m);
}
/** (e) dropped convergence: skips loc_2e4b entirely (no pointer store, no mirror, no advance). */
function brokenDropConvergence(m) {
  const { regs, mem } = m;
  regs.hl = STRING_BASE;
  mem.write8(SND_TRIGGER + 3, WRAP_SOUND); // BUG: loc_2e4b never called
}
/** (f) swapped rewind: loads the base with the bytes swapped (0x39 low, 0xAA high). */
function brokenSwappedBase(m) {
  const { regs, mem } = m;
  regs.hl = 0xaa39; // BUG: low 0x39, high 0xAA
  mem.write8(SND_TRIGGER + 3, WRAP_SOUND);
  loc_2e4b(m);
}

test("TEETH: the same byte sweeps CATCH every broken twin", () => {
  const base = new Machine(ROM).clone();
  const twins = [
    ["no rewind (stores incoming pointer)", brokenNoRewind],
    ["wrong base (0x39AB)", brokenWrongBase],
    ["dropped wrap sound", brokenDropSound],
    ["wrong sound value", brokenWrongSound],
    ["dropped convergence call", brokenDropConvergence],
    ["swapped rewind bytes", brokenSwappedBase],
  ];
  for (const [name, twin] of twins) {
    const { mismatch } = fullSweep(base, twin);
    assert.notEqual(mismatch, null, `the sweep FAILED to catch "${name}" — the gate is worthless`);
    assert.ok(mismatch.includes("RAM"), `"${name}" should be caught on RAM, got: ${mismatch}`);
    console.log(`  TEETH/${name}: caught — ${mismatch}`);
  }
});
