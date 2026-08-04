// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for loc_2591 (ROM 0x2591) — advance and edge-cull the 50m
 * moving-object row.
 *
 * sub_2591 walks the six OBJ_ARRAY_65A0 records (stride 0x10). For each active record it
 * steps the object's X (field +3) and culls it — clearing the active flag, X, and the
 * record's sprite block at 0x69B8 + 4*index — when X runs off the left edge or (for the
 * field +5 == 0x7c center-split mover) reaches dead center. It also leaves the record
 * stride 0x0010 in DE, which its still-oracle caller sub_24ea reuses as its own pointer
 * increment — a genuine register LIVE-OUT compared here in addition to RAM.
 *
 * sub_24ea gates this routine on 50m (board 2) and attract only plays 25m, so 0x2591
 * takes no natural attract dispatch — coverage is by CRAFTED entries on a real attract
 * base (records + step shadows poked, everything else realistic):
 *
 *   0. REACHABILITY — hook 0x2591 in a real run and report the count (expected 0 in
 *      attract; any that DO occur are verified against the oracle, not assumed absent).
 *   1. EQUAL (sweep) — one active record over ALL 256 X values × both movers ×
 *      representative signed steps, the record placed at a rotating index so every
 *      cull-sprite slot is exercised. Covers all arms: left-edge cull (incl. the wrapping
 *      high band), center cull, right/left directional step, plain step.
 *   2. EQUAL (multi-record) — six active records at once, one per arm, proving the loop
 *      processes them independently and each cull clears ITS OWN sprite slot.
 *   3. EQUAL (active-bit) — bit0 clear is skipped (even with other flag bits set), bit0
 *      set is processed.
 *   4. TEETH — four broken twins, each MUST be caught: wrong cull-sprite index, swapped
 *      directional step arms, dropped DE live-out, and a dropped edge-band wrap.
 *
 * RAM is compared over the whole dump (firstStateDiff): the routine has no push16/call, so
 * it never writes STACK_SCRATCH — no exclusion is needed. DE is compared separately.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-2591.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_2591 as oracle } from "../../translated/loc_2591.js";
import { advance50mObjectRow as loc_2591 } from "../advance50mObjectRow.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { u8 } from "../../../../core/int.js";
import {
  OBJ_ARRAY_65A0,
  M50_OBJ2_STEP_POS,
  M50_OBJ2_STEP_NEG,
  M50_OBJ3_STEP,
} from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x2591;
const SLOT_COUNT = 6;
const SLOT_STRIDE = 0x10;
const FIELD_ACTIVE = 0x00;
const FIELD_X = 0x03;
const FIELD_MOVER = 0x05;
const CENTER_SPLIT_MOVER = 0x7c;
const CENTER_X = 0x80;
const CULL_SPRITE_BASE = 0x69b8;
const CULL_SPRITE_STRIDE = 0x04;
const STRIDE_LIVE_OUT = 0x0010; // the value the oracle publishes in DE
const DE_SENTINEL = 0xabcd;     // pre-set DE; a routine that fails to publish the stride leaves this
const SAFE_SP = 0x6bf8;         // oracle's terminal ret pops here (work RAM, never I/O); RAM-irrelevant

const hx = (v) => "0x" + (v & 0xffff).toString(16);

// A real, self-consistent machine: boot + a stretch of attract so work RAM is realistic.
// This routine's array belongs to 50m, which attract (25m) never runs, so the records are
// crafted onto the base.
function attractBase(frames = 180) {
  const m = new Machine(ROM);
  m.runFrames(frames);
  return m.clone(); // clone neutralises the frame machinery (nextNmi/nextBoundary = Infinity)
}

// Zero the six records, mark each record's sprite block (so a cull's clear-to-0 is an
// observable change), poke the requested records + the three step shadows, and set a safe
// stack + a DE sentinel. Returns a ready entry; both sides clone it for a fair start.
function craft(base, specs, { stepPos = 0x01, stepNeg = 0xff, step3 = 0x01 } = {}) {
  const e = base.clone();
  for (let i = 0; i < SLOT_COUNT; i++) {
    const slot = OBJ_ARRAY_65A0 + SLOT_STRIDE * i;
    for (let b = 0; b < SLOT_STRIDE; b++) e.mem.write8(slot + b, 0);
    e.mem.write8(CULL_SPRITE_BASE + CULL_SPRITE_STRIDE * i, 0xff);
  }
  for (const s of specs) {
    const slot = OBJ_ARRAY_65A0 + SLOT_STRIDE * s.i;
    e.mem.write8(slot + FIELD_ACTIVE, s.f0 ?? 0x01); // default: active (bit0 set)
    e.mem.write8(slot + FIELD_X, s.x);
    e.mem.write8(slot + FIELD_MOVER, s.mover ?? 0x00);
  }
  e.mem.write8(M50_OBJ2_STEP_POS, stepPos);
  e.mem.write8(M50_OBJ2_STEP_NEG, stepNeg);
  e.mem.write8(M50_OBJ3_STEP, step3);
  e.regs.sp = SAFE_SP;
  e.regs.de = DE_SENTINEL;
  return e;
}

// Run oracle and candidate on byte-identical clones; diff the contract: RAM + the DE
// live-out. { ram: {addr,a,b}|null, de: {oracle,cand}|null, oracleDe }.
function runPair(entry, candidate) {
  const a = entry.clone(); // oracle
  const b = entry.clone(); // candidate
  oracle(a);
  candidate(b);
  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  const de = a.regs.de !== b.regs.de ? { oracle: a.regs.de, cand: b.regs.de } : null;
  return { ram, de, oracleDe: a.regs.de };
}

const runOracleOn = (entry) => { const a = entry.clone(); oracle(a); return a; };

function diffStr({ ram, de }) {
  const parts = [];
  if (ram) parts.push(`RAM@${hx(ram.addr)} oracle=${ram.a} cand=${ram.b}`);
  if (de) parts.push(`DE oracle=${hx(de.oracle)} cand=${hx(de.cand)}`);
  return parts.join("; ") || "(no diff)";
}

// -- 0. REACHABILITY ----------------------------------------------------------

test("REACHABILITY: report natural 0x2591 dispatches (50m-gated; attract is 25m)", () => {
  let count = 0;
  const caps = [];
  const snap = new Map([[TARGET, (mm) => {
    count++;
    if (caps.length < 32) caps.push(mm.clone());
    return oracle(mm);
  }]]);
  const host = new Machine(ROM, { overrides: snap });
  host.runFrames(1500);
  // NOT asserted > 0: sub_24ea gates 0x2591 on 50m and attract only plays 25m. Any real
  // dispatches that DO occur must still match the oracle.
  for (const cap of caps) {
    cap.regs.de = DE_SENTINEL; // let the DE live-out check bite
    const res = runPair(cap, loc_2591);
    assert.equal(res.ram, null, res.ram && `captured: ${diffStr(res)}`);
    assert.equal(res.de, null, `captured: ${diffStr(res)}`);
  }
  console.log(`  REACHABILITY: ${count} natural 0x2591 dispatches in 1500 frames (${caps.length} verified)`);
});

// -- 1. EQUAL (sweep) ---------------------------------------------------------

test("EQUAL (sweep): every X × mover × step, one active record, matches oracle (RAM + DE)", () => {
  const base = attractBase();
  const triples = [
    { stepPos: 0x01, stepNeg: 0xff, step3: 0x01 }, // +1 / -1 / +1
    { stepPos: 0xff, stepNeg: 0x01, step3: 0xff }, // -1 / +1 / -1
  ];
  let count = 0;
  for (const t of triples) {
    for (const mover of [CENTER_SPLIT_MOVER, 0x00]) {
      for (let x = 0; x < 256; x++) {
        const i = x % SLOT_COUNT; // rotate the record index so every cull-sprite slot is hit
        const res = runPair(craft(base, [{ i, x, mover }], t), loc_2591);
        count++;
        assert.equal(res.ram, null, res.ram && `x=${hx(x)} mover=${hx(mover)} i=${i}: ${diffStr(res)}`);
        assert.equal(res.de, null, `x=${hx(x)} mover=${hx(mover)} i=${i}: ${diffStr(res)}`);
        assert.equal(res.oracleDe, STRIDE_LIVE_OUT, "oracle must leave DE=0x0010");
      }
    }
  }
  console.log(`  EQUAL/sweep: ${count} (x, mover, step) combos — RAM + DE identical to oracle`);
});

// -- 2. EQUAL (multi-record) --------------------------------------------------

test("EQUAL (multi-record): six mixed arms at once, each cull clears its own sprite slot", () => {
  const base = attractBase();
  const specs = [
    { i: 0, x: 0x02, mover: 0x00 },               // left-edge cull (plain)
    { i: 1, x: CENTER_X, mover: CENTER_SPLIT_MOVER }, // center cull
    { i: 2, x: 0xa0, mover: CENTER_SPLIT_MOVER },  // right half -> +step
    { i: 3, x: 0x40, mover: CENTER_SPLIT_MOVER },  // left half -> -step
    { i: 4, x: 0x50, mover: 0x00 },                // plain step
    { i: 5, x: 0xfd, mover: CENTER_SPLIT_MOVER },  // high (wrapping) edge band -> cull
  ];
  const entry = craft(base, specs, { stepPos: 0x01, stepNeg: 0xff, step3: 0x01 });
  const res = runPair(entry, loc_2591);
  assert.equal(res.ram, null, res.ram && diffStr(res));
  assert.equal(res.de, null, diffStr(res));

  // sanity vs the oracle: the culled records cleared their OWN sprite slot; the stepped
  // records left theirs alone.
  const after = runOracleOn(entry);
  for (const i of [0, 1, 5]) {
    assert.equal(after.mem.read8(CULL_SPRITE_BASE + CULL_SPRITE_STRIDE * i), 0, `record ${i} sprite slot not cleared`);
  }
  for (const i of [2, 3, 4]) {
    assert.equal(after.mem.read8(CULL_SPRITE_BASE + CULL_SPRITE_STRIDE * i), 0xff, `record ${i} sprite slot wrongly cleared`);
  }
  console.log("  EQUAL/multi-record: six mixed arms + per-record sprite clears identical to oracle");
});

// -- 3. EQUAL (active-bit) ----------------------------------------------------

test("EQUAL (active-bit): bit0 clear is skipped, bit0 set is processed", () => {
  const base = attractBase();
  const specs = [
    { i: 0, x: 0x50, mover: 0x00, f0: 0x00 }, // inactive -> skip
    { i: 1, x: 0x50, mover: 0x00, f0: 0x02 }, // bit0 clear, bit1 set -> skip
    { i: 2, x: 0x50, mover: 0x00, f0: 0x01 }, // active -> step
    { i: 3, x: 0x02, mover: 0x00, f0: 0x03 }, // active (bit0+bit1) -> cull
  ];
  const entry = craft(base, specs);
  const res = runPair(entry, loc_2591);
  assert.equal(res.ram, null, res.ram && diffStr(res));
  assert.equal(res.de, null, diffStr(res));

  const after = runOracleOn(entry);
  assert.equal(after.mem.read8(OBJ_ARRAY_65A0 + SLOT_STRIDE * 0 + FIELD_X), 0x50, "inactive record 0 was touched");
  assert.equal(after.mem.read8(OBJ_ARRAY_65A0 + SLOT_STRIDE * 1 + FIELD_X), 0x50, "bit0-clear record 1 was touched");
  assert.equal(after.mem.read8(OBJ_ARRAY_65A0 + SLOT_STRIDE * 3 + FIELD_ACTIVE), 0x00, "active record 3 was not culled");
  console.log("  EQUAL/active-bit: skip-vs-process on bit0 identical to oracle");
});

// -- 4. TEETH -----------------------------------------------------------------

/** BUG (a): the cull always clears sprite slot 0, ignoring the record index. */
function brokenSpriteIndex(m) {
  const { regs, mem } = m;
  regs.de = STRIDE_LIVE_OUT;
  for (let i = 0; i < SLOT_COUNT; i++) {
    const slot = OBJ_ARRAY_65A0 + SLOT_STRIDE * i;
    if ((mem.read8(slot + FIELD_ACTIVE) & 0x01) === 0) continue;
    const x = mem.read8(slot + FIELD_X);
    let cull = false;
    if (u8(x + 0x07) < 0x0e) cull = true;
    else if (mem.read8(slot + FIELD_MOVER) === CENTER_SPLIT_MOVER) {
      if (x === CENTER_X) cull = true;
      else mem.write8(slot + FIELD_X, x + (x > CENTER_X ? mem.read8(M50_OBJ2_STEP_POS) : mem.read8(M50_OBJ2_STEP_NEG)));
    } else mem.write8(slot + FIELD_X, x + mem.read8(M50_OBJ3_STEP));
    if (cull) {
      mem.write8(slot + FIELD_ACTIVE, 0);
      mem.write8(slot + FIELD_X, 0);
      mem.write8(CULL_SPRITE_BASE, 0); // BUG: fixed slot 0
    }
  }
}

/** BUG (b): the center-split mover picks the wrong half's step (POS<->NEG swapped). */
function brokenSwappedStep(m) {
  const { regs, mem } = m;
  regs.de = STRIDE_LIVE_OUT;
  for (let i = 0; i < SLOT_COUNT; i++) {
    const slot = OBJ_ARRAY_65A0 + SLOT_STRIDE * i;
    if ((mem.read8(slot + FIELD_ACTIVE) & 0x01) === 0) continue;
    const x = mem.read8(slot + FIELD_X);
    let cull = false;
    if (u8(x + 0x07) < 0x0e) cull = true;
    else if (mem.read8(slot + FIELD_MOVER) === CENTER_SPLIT_MOVER) {
      if (x === CENTER_X) cull = true;
      else mem.write8(slot + FIELD_X, x + (x > CENTER_X ? mem.read8(M50_OBJ2_STEP_NEG) : mem.read8(M50_OBJ2_STEP_POS))); // BUG
    } else mem.write8(slot + FIELD_X, x + mem.read8(M50_OBJ3_STEP));
    if (cull) {
      mem.write8(slot + FIELD_ACTIVE, 0);
      mem.write8(slot + FIELD_X, 0);
      mem.write8(CULL_SPRITE_BASE + CULL_SPRITE_STRIDE * i, 0);
    }
  }
}

/** BUG (c): never publishes the stride in DE (drops the live-out). */
function brokenNoDe(m) {
  const { mem } = m;
  for (let i = 0; i < SLOT_COUNT; i++) {
    const slot = OBJ_ARRAY_65A0 + SLOT_STRIDE * i;
    if ((mem.read8(slot + FIELD_ACTIVE) & 0x01) === 0) continue;
    const x = mem.read8(slot + FIELD_X);
    let cull = false;
    if (u8(x + 0x07) < 0x0e) cull = true;
    else if (mem.read8(slot + FIELD_MOVER) === CENTER_SPLIT_MOVER) {
      if (x === CENTER_X) cull = true;
      else mem.write8(slot + FIELD_X, x + (x > CENTER_X ? mem.read8(M50_OBJ2_STEP_POS) : mem.read8(M50_OBJ2_STEP_NEG)));
    } else mem.write8(slot + FIELD_X, x + mem.read8(M50_OBJ3_STEP));
    if (cull) {
      mem.write8(slot + FIELD_ACTIVE, 0);
      mem.write8(slot + FIELD_X, 0);
      mem.write8(CULL_SPRITE_BASE + CULL_SPRITE_STRIDE * i, 0);
    }
  }
  // BUG: regs.de left at the caller's value
}

/** BUG (d): drops the byte-width wrap on the edge-band test, so the wrapping high band
 *  (X near 0xFF) is not culled. */
function brokenNoWrapBand(m) {
  const { regs, mem } = m;
  regs.de = STRIDE_LIVE_OUT;
  for (let i = 0; i < SLOT_COUNT; i++) {
    const slot = OBJ_ARRAY_65A0 + SLOT_STRIDE * i;
    if ((mem.read8(slot + FIELD_ACTIVE) & 0x01) === 0) continue;
    const x = mem.read8(slot + FIELD_X);
    let cull = false;
    if ((x + 0x07) < 0x0e) cull = true; // BUG: no u8() — misses X in 0xF9..0xFF
    else if (mem.read8(slot + FIELD_MOVER) === CENTER_SPLIT_MOVER) {
      if (x === CENTER_X) cull = true;
      else mem.write8(slot + FIELD_X, x + (x > CENTER_X ? mem.read8(M50_OBJ2_STEP_POS) : mem.read8(M50_OBJ2_STEP_NEG)));
    } else mem.write8(slot + FIELD_X, x + mem.read8(M50_OBJ3_STEP));
    if (cull) {
      mem.write8(slot + FIELD_ACTIVE, 0);
      mem.write8(slot + FIELD_X, 0);
      mem.write8(CULL_SPRITE_BASE + CULL_SPRITE_STRIDE * i, 0);
    }
  }
}

test("TEETH: four broken twins are each CAUGHT", () => {
  const base = attractBase();

  // (a) wrong sprite index — cull at record index 3, so slot 0 vs slot 3 diverges.
  const rA = runPair(craft(base, [{ i: 3, x: 0x02, mover: 0x00 }]), brokenSpriteIndex);
  assert.ok(rA.ram || rA.de, "the wrong-sprite-index twin escaped — the gate is worthless");

  // (b) swapped step arms — right-half center-split step (POS != NEG makes the X diverge).
  const rB = runPair(craft(base, [{ i: 0, x: 0xa0, mover: CENTER_SPLIT_MOVER }], { stepPos: 0x01, stepNeg: 0xff, step3: 0x01 }), brokenSwappedStep);
  assert.ok(rB.ram, "the swapped-step twin escaped — the gate is worthless");
  assert.equal(rB.ram.addr, OBJ_ARRAY_65A0 + FIELD_X, `expected the step diff at record-0 X, got ${diffStr(rB)}`);

  // (c) dropped DE live-out — twin leaves the sentinel; the oracle leaves 0x0010.
  const rC = runPair(craft(base, [{ i: 0, x: 0x50, mover: 0x00 }]), brokenNoDe);
  assert.ok(rC.de, "the dropped-DE-live-out twin escaped — the DE contract is worthless");
  assert.equal(rC.de.cand, DE_SENTINEL, "the DE twin should have left the sentinel");

  // (d) dropped edge-band wrap — high band (X=0xFD) is culled by the oracle, stepped by the twin.
  const rD = runPair(craft(base, [{ i: 0, x: 0xfd, mover: 0x00 }]), brokenNoWrapBand);
  assert.ok(rD.ram || rD.de, "the no-wrap-band twin escaped — the gate is worthless");

  console.log(`  TEETH: wrong-sprite-index (${diffStr(rA)}), swapped-step (${diffStr(rB)}), dropped-DE (${diffStr(rC)}), no-wrap-band (${diffStr(rD)}) all caught`);
});
