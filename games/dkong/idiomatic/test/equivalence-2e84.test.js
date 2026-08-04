// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for loc_2e84 (ROM 0x2E84) — object update state 4: step Y by 3,
 * deactivate at the travel limit, mirror to sprite.
 *
 * loc_2e84 advances the object record's Y (+5) by 3. If the new Y is below the travel limit
 * (248) the object simply keeps moving; at or past 248 the object is retired — its X (+3) and
 * active flag (+0) are cleared. Either way the position is then mirrored into the paired
 * sprite record and both scan cursors advance, via mirrorObjectPositionToSprite (0x2E6C ->
 * 0x2E78). The idiomatic routine dissolves the oracle's tail `m.call(0x2e6c)` (taken on BOTH
 * arms) into a direct mirrorObjectPositionToSprite call — that callee is already idiomatic.
 *
 * CONTRACT (memory-equivalence): RAM (whole dump — the oracle performs NO push/pop/ret across
 * loc_2e84 -> loc_2e6c -> loc_2e78, so there is no dead stack churn and NO STACK_SCRATCH
 * exclusion is needed), SP (unchanged), and the routine's declared REGISTER live-out. Live-out
 * — what the still-translated scan loop consumes after this state's tail — is the two advanced
 * cursors (ix, iy), the remaining-object count (b) it feeds to its djnz, and (conservatively)
 * the leftover step (de). The oracle's residual accumulator byte and arithmetic flags are DEAD
 * (the next object's processing overwrites them before any test), and its landing pc is dead
 * (the loop drives control flow through its own counter), so none of those is compared.
 *
 * COVERAGE. The branch turns on the object's Y, so that field is swept over its whole 0..255
 * range at a real record pair — pinning the +3 step, the exact 248 boundary (retire only for
 * Y in 0xF5..0xFC, where Y+3 lands in 0xF8..0xFF), and both arms. X is swept over 0..255 in
 * each arm (copied to the sprite when moving; forced to 0 and mirrored as 0 when retiring).
 * The routine DEREFERENCES the cursors, so a naive 0..65535 cursor sweep would fault on
 * unmapped addresses; cursor coverage comes from the exact in-game sequence (grid) plus real
 * captured dispatches instead.
 *
 *   1. EQUAL (byte sweeps) — Y over 256 (X held), X over 256 at a moving Y, X over 256 at a
 *      retiring Y. Each run must match the oracle on the whole contract. Together these pin
 *      the step, the limit, both arms, the X copy, and the X-zeroing.
 *   2. EQUAL (grid) — the EXACT in-game cursor sequence (object = 0x6500+16k, sprite =
 *      0x6980+4j) cross-producted with distinct per-record source bytes, to pin the read/write
 *      addresses to the two cursors and rule out a cross term.
 *   3. EQUAL (independence) — hold cursors + source bytes fixed and vary de, b, scratch
 *      registers, and an unrelated RAM byte: output unchanged.
 *   4. REALISM (captured) — steer update75mActorObjects into its full 10-object pass with every object
 *      active + state 4 (five below the limit, five at it), let the game's OWN code (obj_2e12)
 *      dispatch 0x2e84, hook it to capture the 10 real dispatches, and replay oracle vs
 *      candidate on each — both retire and move arms, at the true in-game cursor sequence.
 *   5. TEETH — eight deliberately-broken twins (wrong step, off-by-one limit, inverted branch,
 *      dropped retire, dropped active-clear only, dropped X-clear only, wrong cursor stride,
 *      spurious RAM write); the SAME sweeps must catch every one, or the gate proves nothing.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-2e84.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_2e84 as oracle } from "../../translated/loc_2e84.js";
import { loc_2e84 as candidate } from "../loc_2e84.js";
import { mirrorObjectPositionToSprite } from "../mirrorObjectPositionToSprite.js"; // ROM 0x2E6C (for the twins)
import { loc_2e04 } from "../../translated/loc_2e04.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { u8 } from "../../../../core/int.js";
import { OBJ_ACTIVE, OBJ_STATE, OBJ_X, OBJ_Y, SPRITE_X, SPRITE_Y, OBJ_ARRAY_65, ACTOR_SPRITES } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const OBJ_BASE = OBJ_ARRAY_65; // 0x6500 — object-record scan base (the object cursor / IX)
const SPR_BASE = ACTOR_SPRITES; // 0x6980 — paired sprite-record scan base (the sprite cursor / IY)
const LOOP_COUNT = 0x0a;  // remaining-object count the loop holds while this state runs
const JUNK_DE = 0x1234;   // nonzero incoming step: a twin that forgets to set it would be caught
const SAFE_SP = 0x6bf8;   // work-RAM stack; the routine never touches it, kept well-defined
const DEST_SENTINEL = 0xee; // pre-stamped into the sprite X/Y cells so a dropped/misplaced write shows

const MOVE_Y = 0x40;   // an object Y that stays below the limit after +3 (keep-moving arm)
const RETIRE_Y = 0xf6; // an object Y that reaches the limit after +3 (0xf6+3 = 0xf9 >= 248) (retire arm)

const hx = (v) => "0x" + (v & 0xff).toString(16).padStart(2, "0");
const hx16 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");

// Set the compared inputs on a clone (frame machinery already neutralised by clone();
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

// Prepare a fresh entry: cursors set, sprite dest cells stamped with a sentinel, the active
// flag pre-set to 1 (so a missing retire-clear shows), and the two object source fields
// seeded. Applied identically to the oracle and candidate clones.
function prep(m, ix, iy, srcX, srcY) {
  setInput(m, ix, iy);
  m.mem.write8(iy + SPRITE_X, DEST_SENTINEL);
  m.mem.write8(iy + SPRITE_Y, DEST_SENTINEL);
  m.mem.write8(ix + OBJ_ACTIVE, 0x01);
  m.mem.write8(ix + OBJ_X, srcX);
  m.mem.write8(ix + OBJ_Y, srcY);
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

// Run one (srcX, srcY) entry through oracle vs `impl` at the real record pair; full contract.
function compareAt(base, impl, ix, iy, srcX, srcY) {
  const om = base.clone();
  const cm = base.clone();
  prep(om, ix, iy, srcX, srcY);
  prep(cm, ix, iy, srcX, srcY);
  oracle(om);
  impl(cm);
  return contractDiff(om, cm);
}

// Sweep, at a real record pair: object Y over 0..255 (X held), then object X over 0..255 at a
// MOVING Y and again at a RETIRING Y. Covers both arms, the +3 step, the exact limit, the X
// copy, and the X-zeroing. Returns the first mismatch (or null) and the number of combos.
// Reused by both the EQUAL proof and the TEETH twins.
function fullSweep(base, impl) {
  const ix = OBJ_BASE, iy = SPR_BASE;
  let count = 0;

  // Y field: sweep object Y over 0..255 (X held) — the branch input; crosses the limit.
  for (let y = 0; y < 256; y++) {
    const d = compareAt(base, impl, ix, iy, 0x55, y);
    count++;
    if (d) return { mismatch: `Y-src=${hx(y)}: ${d}`, count };
  }
  // X field, MOVING arm: sweep object X over 0..255 with a Y that stays below the limit.
  for (let x = 0; x < 256; x++) {
    const d = compareAt(base, impl, ix, iy, x, MOVE_Y);
    count++;
    if (d) return { mismatch: `X-src(move)=${hx(x)}: ${d}`, count };
  }
  // X field, RETIRE arm: sweep object X over 0..255 with a Y that reaches the limit.
  for (let x = 0; x < 256; x++) {
    const d = compareAt(base, impl, ix, iy, x, RETIRE_Y);
    count++;
    if (d) return { mismatch: `X-src(retire)=${hx(x)}: ${d}`, count };
  }

  return { mismatch: null, count };
}

// -- 1. EQUAL (byte sweeps) ---------------------------------------------------

test("EQUAL (byte sweeps): loc_2e84 == oracle over all Y values (both arms) and all X values", () => {
  const base = new Machine(ROM).clone();
  const { mismatch, count } = fullSweep(base, candidate);
  assert.equal(mismatch, null, mismatch || "");
  assert.equal(count, 768, "must sweep Y (256) + X-moving (256) + X-retiring (256)");

  // Non-vacuity: confirm the oracle actually does the two DIFFERENT things, so a green sweep
  // means agreement on real work. Moving arm keeps the object active and steps Y by 3.
  const move = base.clone();
  prep(move, OBJ_BASE, SPR_BASE, 0x37, MOVE_Y);
  oracle(move);
  assert.equal(move.mem.read8(OBJ_BASE + OBJ_Y), u8(MOVE_Y + 3), "moving arm: Y steps by 3");
  assert.equal(move.mem.read8(OBJ_BASE + OBJ_ACTIVE), 0x01, "moving arm: object stays active");
  assert.equal(move.mem.read8(SPR_BASE + SPRITE_X), 0x37, "moving arm: sprite X = object X");
  assert.equal(move.mem.read8(SPR_BASE + SPRITE_Y), u8(MOVE_Y + 3), "moving arm: sprite Y = stepped Y");

  // Retire arm zeroes X and the active flag; the just-zeroed X is what gets mirrored.
  const retire = base.clone();
  prep(retire, OBJ_BASE, SPR_BASE, 0x37, RETIRE_Y);
  oracle(retire);
  assert.equal(retire.mem.read8(OBJ_BASE + OBJ_Y), u8(RETIRE_Y + 3), "retire arm: Y still steps by 3");
  assert.equal(retire.mem.read8(OBJ_BASE + OBJ_X), 0x00, "retire arm: object X cleared");
  assert.equal(retire.mem.read8(OBJ_BASE + OBJ_ACTIVE), 0x00, "retire arm: active flag cleared");
  assert.equal(retire.mem.read8(SPR_BASE + SPRITE_X), 0x00, "retire arm: sprite X mirrors the cleared 0");
  assert.equal(retire.mem.read8(SPR_BASE + SPRITE_Y), u8(RETIRE_Y + 3), "retire arm: sprite Y = stepped Y");

  console.log(`  EQUAL/byte-sweeps: ${count} entries — RAM + SP + live-out identical to the oracle`);
});

// -- 2. EQUAL (grid over the in-game cursor sequence) -------------------------

test("EQUAL (grid): the exact in-game cursor sequence, cross-producted, matches the oracle", () => {
  const base = new Machine(ROM).clone();
  let count = 0;
  for (let k = 0; k < 10; k++) {
    for (let j = 0; j < 10; j++) {
      const ix = (OBJ_BASE + 16 * k) & 0xffff;
      const iy = (SPR_BASE + 4 * j) & 0xffff;
      // Distinct, position-dependent source bytes; Y kept in the moving arm so a wrong field
      // offset diverges. (Both arms are exhaustively covered by the Y sweep above.)
      const d = compareAt(base, candidate, ix, iy, (0x30 + k) & 0xff, (0x40 + k) & 0xff);
      assert.equal(d, null, d ? `grid k=${k} j=${j} (ix=${hx16(ix)} iy=${hx16(iy)}): ${d}` : "");
      count++;
    }
  }
  assert.equal(count, 100);
  console.log(`  EQUAL/grid: ${count} in-game (object, sprite) cursor combos identical to the oracle`);
});

// -- 3. EQUAL (input independence) --------------------------------------------

test("EQUAL (independence): output depends ONLY on the cursors + their fields, not de/b/scratch/RAM", () => {
  const base = new Machine(ROM).clone();
  const ix = OBJ_BASE, iy = SPR_BASE;
  let count = 0;
  for (const de of [0x0000, 0x0004, 0x1234, 0xffff]) {
    for (const b of [0x01, 0x0a, 0xff]) {
      const om = base.clone();
      const cm = base.clone();
      for (const m of [om, cm]) {
        prep(m, ix, iy, 0x12, MOVE_Y);
        m.regs.de = de; m.regs.b = b;
        m.regs.a = 0x11; m.regs.c = 0x33; m.regs.h = 0x44; m.regs.l = 0x55;
        m.mem.write8(0x6100, 0xa5); // a work-RAM byte the routine must not read or write
      }
      oracle(om);
      candidate(cm);
      const d = contractDiff(om, cm);
      assert.equal(d, null, d ? `de=${hx16(de)} b=${hx(b)}: ${d}` : "");
      // And the output is the expected transform regardless of the ignored inputs.
      assert.equal(cm.mem.read8(iy + SPRITE_X), 0x12, "sprite X must equal object X regardless of de/b");
      assert.equal(cm.mem.read8(iy + SPRITE_Y), u8(MOVE_Y + 3), "sprite Y must equal stepped Y regardless of de/b");
      assert.equal(cm.regs.ix, (ix + 16) & 0xffff, "object cursor must advance by 16");
      assert.equal(cm.regs.iy, (iy + 4) & 0xffff, "sprite cursor must advance by 4");
      assert.equal(cm.regs.de, 4, "leftover step must be 4 regardless of incoming de");
      assert.equal(cm.regs.b, b, "remaining-object count must be preserved");
      count++;
    }
  }
  console.log(`  EQUAL/independence: ${count} (de,b,scratch,RAM) variations — output unchanged`);
});

// -- 4. REALISM (real captured dispatches) ------------------------------------

// Attract never reaches update75mActorObjects's object loop. So nudge all 10 objects active + state 4
// (ix+0d = 4) with distinct positions — the first five below the travel limit (move arm), the
// last five at it (retire arm) — and let the game's OWN code (obj_2e12) dispatch loc_2e84.
// Hook 0x2e84 to capture the real dispatch states (the true cursor sequence the scan produces)
// and return the captured entry clones.
function captureRealDispatches() {
  const host = new Machine(ROM);
  host.runFrames(700); // realistic work RAM (0x2e84 does not dispatch in attract, so no captures yet)
  const m = host.clone();
  m.regs.sp = 0x6c00;
  m.push16(0x4d17); // sentinel caller-return for update75mActorObjects
  m.mem.write8(0x6227, 3); // board = 3   -> rst 0x30 (A=0x04) passes
  m.mem.write8(0x6200, 1); // enable bit0 -> rst 0x10 passes -> full 10-object loop
  for (let k = 0; k < 10; k++) {
    const ix = OBJ_BASE + 16 * k;
    m.mem.write8(ix + OBJ_ACTIVE, 0x01);      // active (bit0) -> processed, not the inactive path
    m.mem.write8(ix + OBJ_STATE, 0x04);            // state 4 -> obj_2e12 dispatches loc_2e84
    m.mem.write8(ix + OBJ_X, (0x20 + k) & 0xff); // distinct object X
    // Objects 0..4 stay below the limit after +3 (move arm); 5..9 reach it (retire arm).
    m.mem.write8(ix + OBJ_Y, k < 5 ? (0x40 + k) & 0xff : (0xf5 + (k - 5)) & 0xff);
  }
  const caps = [];
  const hook = (mm) => {
    caps.push(mm.clone());
    return oracle(mm);
  };
  m.overrides.set(0x2e84, hook);
  m.routines.set(0x2e84, hook);
  loc_2e04(m);
  return caps;
}

test("REALISM: real captured 0x2e84 dispatches — loc_2e84 matches the oracle on both arms", () => {
  const caps = captureRealDispatches();
  assert.equal(caps.length, 10, "the steered full-loop update75mActorObjects should dispatch 0x2e84 once per object (10)");

  let retired = 0;
  caps.forEach((cap, i) => {
    // The captured cursors are the exact in-game scan sequence.
    assert.equal(cap.regs.ix, (OBJ_BASE + 16 * i) & 0xffff, `dispatch ${i}: unexpected object cursor`);
    assert.equal(cap.regs.iy, (SPR_BASE + 4 * i) & 0xffff, `dispatch ${i}: unexpected sprite cursor`);
    const o = cap.clone();
    const c = cap.clone();
    o.nextNmi = Infinity; o.nextBoundary = Infinity;
    c.nextNmi = Infinity; c.nextBoundary = Infinity;
    oracle(o);
    candidate(c);
    const d = contractDiff(o, c);
    assert.equal(d, null, d ? `real dispatch ${i} (ix=${hx16(cap.regs.ix)}): ${d}` : "");
    if (o.mem.read8(cap.regs.ix + OBJ_ACTIVE) === 0) retired++;
  });
  assert.equal(retired, 5, "the five at-limit objects should have taken the retire arm");
  console.log(`  REALISM: ${caps.length} real 0x2e84 dispatches (5 move, 5 retire) — RAM + SP + live-out == oracle`);
});

// -- 5. TEETH -----------------------------------------------------------------

/** (a) steps Y by 2 instead of 3. */
function brokenStep(m) {
  const { regs, mem } = m;
  const newY = u8(mem.read8(regs.ix + OBJ_Y) + 2);
  mem.write8(regs.ix + OBJ_Y, newY);
  if (newY >= 248) { mem.write8(regs.ix + OBJ_X, 0); mem.write8(regs.ix + OBJ_ACTIVE, 0); }
  mirrorObjectPositionToSprite(m);
}
/** (b) off-by-one limit: retires at 247 instead of 248. */
function brokenLimit(m) {
  const { regs, mem } = m;
  const newY = u8(mem.read8(regs.ix + OBJ_Y) + 3);
  mem.write8(regs.ix + OBJ_Y, newY);
  if (newY >= 247) { mem.write8(regs.ix + OBJ_X, 0); mem.write8(regs.ix + OBJ_ACTIVE, 0); }
  mirrorObjectPositionToSprite(m);
}
/** (c) inverts the branch: retires BELOW the limit, keeps moving at/above it. */
function brokenInverted(m) {
  const { regs, mem } = m;
  const newY = u8(mem.read8(regs.ix + OBJ_Y) + 3);
  mem.write8(regs.ix + OBJ_Y, newY);
  if (newY < 248) { mem.write8(regs.ix + OBJ_X, 0); mem.write8(regs.ix + OBJ_ACTIVE, 0); }
  mirrorObjectPositionToSprite(m);
}
/** (d) never retires — drops both clears. */
function brokenNoRetire(m) {
  const { regs, mem } = m;
  const newY = u8(mem.read8(regs.ix + OBJ_Y) + 3);
  mem.write8(regs.ix + OBJ_Y, newY);
  mirrorObjectPositionToSprite(m);
}
/** (e) retire clears X but forgets the active flag. */
function brokenKeepActive(m) {
  const { regs, mem } = m;
  const newY = u8(mem.read8(regs.ix + OBJ_Y) + 3);
  mem.write8(regs.ix + OBJ_Y, newY);
  if (newY >= 248) { mem.write8(regs.ix + OBJ_X, 0); }
  mirrorObjectPositionToSprite(m);
}
/** (f) retire clears the active flag but forgets X. */
function brokenKeepX(m) {
  const { regs, mem } = m;
  const newY = u8(mem.read8(regs.ix + OBJ_Y) + 3);
  mem.write8(regs.ix + OBJ_Y, newY);
  if (newY >= 248) { mem.write8(regs.ix + OBJ_ACTIVE, 0); }
  mirrorObjectPositionToSprite(m);
}
/** (g) advances the object cursor by the wrong stride (15 instead of 16). */
function brokenStride(m) {
  const { regs, mem } = m;
  const newY = u8(mem.read8(regs.ix + OBJ_Y) + 3);
  mem.write8(regs.ix + OBJ_Y, newY);
  if (newY >= 248) { mem.write8(regs.ix + OBJ_X, 0); mem.write8(regs.ix + OBJ_ACTIVE, 0); }
  // Copy to sprite, then advance with a wrong object stride.
  mem.write8(regs.iy + SPRITE_X, mem.read8(regs.ix + OBJ_X));
  mem.write8(regs.iy + SPRITE_Y, mem.read8(regs.ix + OBJ_Y));
  regs.ix = regs.ix + 15;
  regs.iy = regs.iy + 4;
  regs.de = 4;
}
/** (h) writes a byte of work RAM the oracle never touches. */
function brokenRamWrite(m) {
  const { regs, mem } = m;
  const newY = u8(mem.read8(regs.ix + OBJ_Y) + 3);
  mem.write8(regs.ix + OBJ_Y, newY);
  if (newY >= 248) { mem.write8(regs.ix + OBJ_X, 0); mem.write8(regs.ix + OBJ_ACTIVE, 0); }
  mirrorObjectPositionToSprite(m);
  mem.write8(0x6100, 0xff);
}

test("TEETH: the same sweeps CATCH every broken twin", () => {
  const base = new Machine(ROM).clone();
  const twins = [
    ["wrong step (+2)", brokenStep, "RAM"],
    ["off-by-one limit (247)", brokenLimit, "RAM"],
    ["inverted branch", brokenInverted, "RAM"],
    ["dropped retire", brokenNoRetire, "RAM"],
    ["kept active on retire", brokenKeepActive, "RAM"],
    ["kept X on retire", brokenKeepX, "RAM"],
    ["wrong object-cursor stride", brokenStride, "ix"],
    ["spurious RAM write", brokenRamWrite, "RAM"],
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
