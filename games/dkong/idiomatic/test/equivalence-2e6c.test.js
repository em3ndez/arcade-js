// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for mirrorObjectPositionToSprite (ROM 0x2E6C) — the per-object scan's
 * position mirror.
 *
 * mirrorObjectPositionToSprite copies the object record's X (+3) and Y (+5) into the paired sprite record's
 * X (+0) and Y (+3), then falls straight into advanceToNextObject (0x2E78), which advances
 * the object cursor by 16, the sprite cursor by 4, preserves the remaining-object count, and
 * leaves 4 as the step amount. The idiomatic routine dissolves the oracle's fall-through
 * `m.call(0x2e78)` into a direct advanceToNextObject call — the callee is already idiomatic.
 *
 * CONTRACT (memory-equivalence): RAM (whole dump — the oracle performs NO push/pop/ret, so
 * there is no dead stack churn and NO STACK_SCRATCH exclusion is needed), SP (unchanged), and
 * the routine's declared REGISTER live-out. Live-out — what the still-translated scan loop
 * consumes after this tail — is the two advanced cursors (ix, iy), the remaining-object count
 * (b) it feeds to its djnz, and (conservatively) the leftover step (de). The oracle's residual
 * accumulator byte and arithmetic flags are DEAD (the next object's processing overwrites them
 * before any test), and its landing pc is dead (the loop drives control flow through its own
 * counter, not this fragment's address), so none of those is compared.
 *
 * The effect factorises cleanly: the two copied VALUES depend only on the bytes at the object
 * cursor's X/Y fields, the write ADDRESSES depend only on the sprite cursor, and the cursor
 * ADVANCE is already proven exhaustively by advanceToNextObject's own gate. Unlike that
 * register-only tail, this routine DEREFERENCES the cursors, so a naive 0..65535 sweep would
 * fault on unmapped addresses; coverage instead comes from:
 *
 *   1. EQUAL (byte sweeps) — at a real (object, sprite) record pair, sweep the object X byte
 *      over all 256 values (Y held at a sentinel) and the object Y byte over all 256 values
 *      (X held at a sentinel). Each run must match the oracle on the whole contract. Together
 *      these pin BOTH copies value-faithfully and rule out a swap, a spurious mask, and any
 *      cross-term between the two fields. Dest cells are pre-stamped with a sentinel so a
 *      dropped or misplaced write is caught.
 *   2. EQUAL (grid) — the EXACT in-game cursor sequence (object = 0x6500+16k, sprite =
 *      0x6980+4j) cross-producted, with distinct per-record source bytes, to pin the read/write
 *      addresses to the two cursors across the real record positions and rule out a cross term.
 *   3. EQUAL (independence) — hold the cursors and source bytes fixed and vary the incoming
 *      de, b, scratch registers, and an unrelated RAM byte: the output is unchanged, proving
 *      the routine reads only the two cursors and their two fields.
 *   4. REALISM (captured) — attract never reaches update75mActorObjects's object loop, and even the
 *      full-loop steer sends zeroed objects down the inactive path (0x2e78, not 0x2e6c). Nudge
 *      the 10 objects active + rise-state (ix+0d = 4) identically, let the game's OWN code
 *      (obj_2e12 -> loc_2e84) drive each one into 0x2e6c, hook it to capture the 10 real
 *      dispatches — the true in-game cursor sequence — and replay oracle vs candidate on each.
 *   5. TEETH — seven deliberately-broken twins (swapped fields, wrong dest offset, dropped Y
 *      copy, spurious value mask, wrong object-cursor stride, clobbered loop counter, spurious
 *      RAM write); the SAME byte sweeps must catch every one, or the gate proves nothing.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-2e6c.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_2e6c as oracle } from "../../translated/loc_2e6c.js";
import { mirrorObjectPositionToSprite } from "../mirrorObjectPositionToSprite.js";
import { advanceToNextObject } from "../advanceToNextObject.js"; // ROM 0x2E78 (for the twins)
import { loc_2e04 } from "../../translated/loc_2e04.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { OBJ_ACTIVE, OBJ_STATE, OBJ_X, OBJ_Y, SPRITE_X, SPRITE_Y, OBJ_ARRAY_65, ACTOR_SPRITES } from "../ram.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const OBJ_BASE = OBJ_ARRAY_65; // 0x6500 — object-record scan base (the object cursor / IX)
const SPR_BASE = ACTOR_SPRITES; // 0x6980 — paired sprite-record scan base (the sprite cursor / IY)
const LOOP_COUNT = 0x0a;  // remaining-object count the loop holds while this tail runs
const JUNK_DE = 0x1234;   // nonzero incoming step: a twin that forgets to set it would be caught
const SAFE_SP = 0x6bf8;   // work-RAM stack; the routine never touches it, kept well-defined
const DEST_SENTINEL = 0xee; // pre-stamped into the sprite X/Y cells so a dropped/misplaced write shows

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

// Prepare a fresh entry: cursors set, sprite dest cells stamped with a sentinel, and the two
// object source fields seeded. Applied identically to the oracle and candidate clones.
function prep(m, ix, iy, srcX, srcY) {
  setInput(m, ix, iy);
  m.mem.write8(iy + SPRITE_X, DEST_SENTINEL);
  m.mem.write8(iy + SPRITE_Y, DEST_SENTINEL);
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

// Sweep each of the two object source fields over all 256 byte values at a real record pair,
// diffing oracle vs candidate on the full contract. Returns the first mismatch (or null) and
// the number of combos compared. Reused by both the EQUAL proof and the TEETH twins.
function sweepSourceBytes(base, candidate) {
  const ix = OBJ_BASE, iy = SPR_BASE;
  let count = 0;

  // X field: sweep object X over 0..255, object Y held at a fixed sentinel.
  for (let x = 0; x < 256; x++) {
    const om = base.clone();
    const cm = base.clone();
    prep(om, ix, iy, x, 0xaa);
    prep(cm, ix, iy, x, 0xaa);
    oracle(om);
    candidate(cm);
    count++;
    const d = contractDiff(om, cm);
    if (d) return { mismatch: `X-src=${hx(x)}: ${d}`, count };
  }

  // Y field: sweep object Y over 0..255, object X held at a fixed sentinel.
  for (let y = 0; y < 256; y++) {
    const om = base.clone();
    const cm = base.clone();
    prep(om, ix, iy, 0x55, y);
    prep(cm, ix, iy, 0x55, y);
    oracle(om);
    candidate(cm);
    count++;
    const d = contractDiff(om, cm);
    if (d) return { mismatch: `Y-src=${hx(y)}: ${d}`, count };
  }

  return { mismatch: null, count };
}

// -- 1. EQUAL (byte sweeps) ---------------------------------------------------

test("EQUAL (byte sweeps): mirrorObjectPositionToSprite == oracle over all 256 values of each copied field", () => {
  const base = new Machine(ROM).clone();
  const { mismatch, count } = sweepSourceBytes(base, mirrorObjectPositionToSprite);
  assert.equal(mismatch, null, mismatch || "");
  assert.equal(count, 512, "must have swept both fields over their full 256-value range");

  // Non-vacuity: confirm the oracle actually performs the two copies (so a green sweep means
  // agreement on real work, not two no-ops). Spot-check one X value and one Y value.
  const om = base.clone();
  prep(om, OBJ_BASE, SPR_BASE, 0x37, 0xaa);
  oracle(om);
  assert.equal(om.mem.read8(SPR_BASE + SPRITE_X), 0x37, "oracle must copy object X into sprite X");
  assert.equal(om.mem.read8(SPR_BASE + SPRITE_Y), 0xaa, "oracle must copy object Y into sprite Y");
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
      const om = base.clone();
      const cm = base.clone();
      // Distinct, position-dependent source bytes so a wrong field offset would diverge.
      prep(om, ix, iy, (0x30 + k) & 0xff, (0xc0 + k) & 0xff);
      prep(cm, ix, iy, (0x30 + k) & 0xff, (0xc0 + k) & 0xff);
      oracle(om);
      mirrorObjectPositionToSprite(cm);
      const d = contractDiff(om, cm);
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
        prep(m, ix, iy, 0x12, 0x9c);
        m.regs.de = de; m.regs.b = b;
        m.regs.a = 0x11; m.regs.c = 0x33; m.regs.h = 0x44; m.regs.l = 0x55;
        m.mem.write8(0x6100, 0xa5); // a work-RAM byte the routine must not read or write
      }
      oracle(om);
      mirrorObjectPositionToSprite(cm);
      const d = contractDiff(om, cm);
      assert.equal(d, null, d ? `de=${hx16(de)} b=${hx(b)}: ${d}` : "");
      // And the output is the expected transform regardless of the ignored inputs.
      assert.equal(cm.mem.read8(iy + SPRITE_X), 0x12, "sprite X must equal object X regardless of de/b");
      assert.equal(cm.mem.read8(iy + SPRITE_Y), 0x9c, "sprite Y must equal object Y regardless of de/b");
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

// Attract never reaches update75mActorObjects's object loop, and even the full-loop steer sends zeroed
// objects down the inactive path (reaching 0x2e78, not 0x2e6c). So nudge all 10 objects active
// + rise-state (ix+0d = 4) with distinct positions and let the game's OWN code (obj_2e12 ->
// loc_2e84) drive each one into 0x2e6c. Hook 0x2e6c to capture the real dispatch states — the
// true cursor sequence the scan produces — and return the captured entry clones.
function captureRealDispatches() {
  const host = new Machine(ROM);
  host.runFrames(700); // realistic work RAM (0x2e6c does not dispatch in attract, so no captures yet)
  const m = host.clone();
  m.regs.sp = 0x6c00;
  m.push16(0x4d17); // sentinel caller-return for update75mActorObjects
  m.mem.write8(0x6227, 3); // board = 3   -> rst 0x30 (A=0x04) passes
  m.mem.write8(0x6200, 1); // enable bit0 -> rst 0x10 passes -> full 10-object loop
  for (let k = 0; k < 10; k++) {
    const ix = OBJ_BASE + 16 * k;
    m.mem.write8(ix + OBJ_ACTIVE, 0x01);            // active (bit0) -> processed, not the inactive path
    m.mem.write8(ix + OBJ_STATE, 0x04);            // state 4 -> obj_2e12 dispatches loc_2e84
    m.mem.write8(ix + OBJ_X, (0x20 + k) & 0xff); // distinct object X
    m.mem.write8(ix + OBJ_Y, (0x40 + k) & 0xff); // distinct object Y (rise +3 keeps it < 0xF8)
  }
  const caps = [];
  const hook = (mm) => {
    caps.push(mm.clone());
    return oracle(mm);
  };
  m.overrides.set(0x2e6c, hook);
  m.routines.set(0x2e6c, hook);
  loc_2e04(m);
  return caps;
}

test("REALISM: real captured 0x2e6c dispatches — mirrorObjectPositionToSprite matches the oracle", () => {
  const caps = captureRealDispatches();
  assert.equal(caps.length, 10, "the steered full-loop update75mActorObjects should dispatch 0x2e6c once per object (10)");

  caps.forEach((cap, i) => {
    // The captured cursors are the exact in-game scan sequence.
    assert.equal(cap.regs.ix, (OBJ_BASE + 16 * i) & 0xffff, `dispatch ${i}: unexpected object cursor`);
    assert.equal(cap.regs.iy, (SPR_BASE + 4 * i) & 0xffff, `dispatch ${i}: unexpected sprite cursor`);
    const o = cap.clone();
    const c = cap.clone();
    o.nextNmi = Infinity; o.nextBoundary = Infinity;
    c.nextNmi = Infinity; c.nextBoundary = Infinity;
    oracle(o);
    mirrorObjectPositionToSprite(c);
    const d = contractDiff(o, c);
    assert.equal(d, null, d ? `real dispatch ${i} (ix=${hx16(cap.regs.ix)}): ${d}` : "");
  });
  console.log(`  REALISM: ${caps.length} real full-loop 0x2e6c dispatches — RAM + SP + live-out == oracle`);
});

// -- 5. TEETH -----------------------------------------------------------------

/** (a) swaps the two fields: object X -> sprite Y and object Y -> sprite X. */
function brokenSwapped(m) {
  const { regs, mem } = m;
  mem.write8(regs.iy + SPRITE_X, mem.read8(regs.ix + OBJ_Y));
  mem.write8(regs.iy + SPRITE_Y, mem.read8(regs.ix + OBJ_X));
  advanceToNextObject(m);
}
/** (b) writes sprite X to the wrong dest offset (+1 instead of +0). */
function brokenDstOffset(m) {
  const { regs, mem } = m;
  mem.write8(regs.iy + SPRITE_X + 1, mem.read8(regs.ix + OBJ_X));
  mem.write8(regs.iy + SPRITE_Y, mem.read8(regs.ix + OBJ_Y));
  advanceToNextObject(m);
}
/** (c) drops the Y copy entirely. */
function brokenDroppedY(m) {
  const { regs, mem } = m;
  mem.write8(regs.iy + SPRITE_X, mem.read8(regs.ix + OBJ_X));
  advanceToNextObject(m);
}
/** (d) applies a spurious low-nibble mask to the copied X value. */
function brokenMaskedX(m) {
  const { regs, mem } = m;
  mem.write8(regs.iy + SPRITE_X, mem.read8(regs.ix + OBJ_X) & 0x0f);
  mem.write8(regs.iy + SPRITE_Y, mem.read8(regs.ix + OBJ_Y));
  advanceToNextObject(m);
}
/** (e) advances the object cursor by the wrong stride (15 instead of 16). */
function brokenIxStride(m) {
  const { regs, mem } = m;
  mem.write8(regs.iy + SPRITE_X, mem.read8(regs.ix + OBJ_X));
  mem.write8(regs.iy + SPRITE_Y, mem.read8(regs.ix + OBJ_Y));
  regs.ix = regs.ix + 15;
  regs.iy = regs.iy + 4;
  regs.de = 4;
}
/** (f) clobbers the remaining-object count the loop's djnz consumes. */
function brokenClobberCounter(m) {
  const { regs, mem } = m;
  mem.write8(regs.iy + SPRITE_X, mem.read8(regs.ix + OBJ_X));
  mem.write8(regs.iy + SPRITE_Y, mem.read8(regs.ix + OBJ_Y));
  advanceToNextObject(m);
  regs.b = 0;
}
/** (g) writes a byte of work RAM the oracle never touches. */
function brokenRamWrite(m) {
  const { regs, mem } = m;
  mem.write8(regs.iy + SPRITE_X, mem.read8(regs.ix + OBJ_X));
  mem.write8(regs.iy + SPRITE_Y, mem.read8(regs.ix + OBJ_Y));
  advanceToNextObject(m);
  mem.write8(0x6100, 0xff);
}

test("TEETH: the same byte sweeps CATCH every broken twin", () => {
  const base = new Machine(ROM).clone();
  const twins = [
    ["swapped fields", brokenSwapped, "RAM"],
    ["wrong dest offset", brokenDstOffset, "RAM"],
    ["dropped Y copy", brokenDroppedY, "RAM"],
    ["spurious value mask", brokenMaskedX, "RAM"],
    ["wrong object-cursor stride", brokenIxStride, "ix"],
    ["clobbered loop counter", brokenClobberCounter, "b"],
    ["spurious RAM write", brokenRamWrite, "RAM"],
  ];
  for (const [name, twin, surface] of twins) {
    const { mismatch } = sweepSourceBytes(base, twin);
    assert.notEqual(mismatch, null, `the sweep FAILED to catch "${name}" — the gate is worthless`);
    assert.ok(
      mismatch.includes(surface),
      `"${name}" should be caught on ${surface}, got: ${mismatch}`,
    );
    console.log(`  TEETH/${name}: caught — ${mismatch}`);
  }
});
