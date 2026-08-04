// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for stepBallisticMotion (ROM 0x239C) — the airborne ballistic step.
 *
 * sub_239c is a LEAF that mutates only the IX-relative object record (five bytes:
 * +0x03,+0x04,+0x05,+0x06,+0x14), calls nothing, and references no fixed RAM address.
 * It is gated memory-equivalent against the frozen oracle three ways:
 *
 *   1. REAL CAPTURES (memory-equivalence) — hook 0x239c in a real 25m attract run
 *      (it dispatches 1210×/2000 frames, every one IX=0x6200 = Mario's jump/fall),
 *      clone each true entry state, run oracle vs stepBallisticMotion on independent
 *      FRESH clones, and confirm identical RAM (dumpState — work+sprite+video, which
 *      excludes pc/SP) + live-out HL, with the oracle's write footprint being exactly
 *      the five record bytes and nothing else.
 *
 *   2. CRAFTED edge sweep (memory-equivalence) — attract only exercises the Mario-IX
 *      path (VX=0, small VY); the airborne OBJECT handlers (branch_2053/branch_20ec)
 *      and every arithmetic boundary are covered by crafting record fields on a real
 *      machine state at a neutral object-region IX, IDENTICALLY on both sides (doc-06's
 *      crafted-entry technique): coordinate-A add carry + 16-bit wrap, coordinate-B
 *      borrow/underflow wrap, and the gravity ramp t ∈ {0,1,0x7f,0xff} (0xFF drives the
 *      (2t+1)*8 term to 0x0FF8, exercising its high byte, and the counter's inc wrap).
 *      Each case diffs full RAM + HL + footprint on fresh clones.
 *
 *   3. TEETH — a deliberately-broken twin whose gravity term drops the +8 midpoint
 *      constant (16·t instead of (2t+1)·8) MUST be caught by the crafted sweep. The +8
 *      is the subtlest part of the shift-chain decompile and the exact term names.js
 *      documents, so it is the pointed thing to guard.
 *
 * WHY NOT pc/SP: the idiomatic leaf models the Z80 `ret` as the JS return (doc-06),
 * leaving pc/SP at entry while the oracle's `ret` advances them (it only READS the
 * stack — sub_239c has no push, so the stack region is byte-unchanged on both sides).
 * Comparing pc/SP would measure the absent ret, not the routine's logic. RAM + HL is
 * the real contract; A/B/C and the flags are dead (see the routine header's LIVE-OUT).
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-239c.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_239c as oracle } from "../../translated/loc_239c.js";
import { stepBallisticMotion } from "../stepBallisticMotion.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x239c;
const REC_OFFSETS = [0x03, 0x04, 0x05, 0x06, 0x14]; // the five bytes the routine writes
const hx = (v) => "0x" + (v & 0xff).toString(16).padStart(2, "0");
const hx16 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");

/**
 * Run the oracle on clone `a` and the candidate on clone `b` — which the caller has
 * already brought to an IDENTICAL entry state (same RAM, same IX, same SP) — then
 * report the memory-equivalence verdict for one entry:
 *   - ram:       first differing RAM byte (dumpState), or null
 *   - h / l:     oracle-vs-candidate HL live-out bytes
 *   - footprint: RAM addresses the ORACLE changed (to check it wrote only the record)
 * `a` and `b` MUST be independent clones — this routine writes memory.
 */
function comparePair(a, b, candidate, ix) {
  const before = a.dumpState();
  oracle(a);
  candidate(b);
  const after = a.dumpState();

  const changed = [];
  for (let i = 0; i < before.length; i++) {
    if (before[i] !== after[i]) changed.push(a.stateOffsetToAddr(i));
  }
  const allowed = new Set(REC_OFFSETS.map((d) => (ix + d) & 0xffff));

  return {
    ram: firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off)),
    hA: a.regs.h & 0xff, hB: b.regs.h & 0xff,
    lA: a.regs.l & 0xff, lB: b.regs.l & 0xff,
    footprintOk: changed.every((addr) => allowed.has(addr)),
    footprint: changed,
  };
}

// -- 1. REAL CAPTURES (memory-equivalence) ------------------------------------

/**
 * Hook 0x239c in a real attract run and clone the machine at up to K real dispatches.
 * The wrapper clones the entry state, then runs the oracle so the host game proceeds
 * undisturbed to a clean stop.
 */
function captureDispatches(K, maxFrames) {
  const caps = [];
  const snapshot = new Map([[TARGET, (mm) => {
    if (caps.length < K) caps.push(mm.clone());
    return oracle(mm);
  }]]);
  const host = new Machine(ROM, { overrides: snapshot });
  host.runFrames(maxFrames);
  return caps;
}

test("REAL CAPTURES: 25m attract dispatches — RAM + HL == oracle, footprint = record bytes", () => {
  const caps = captureDispatches(96, 1400);
  assert.ok(caps.length >= 1, "expected at least one real 0x239c dispatch during attract");

  for (const cap of caps) {
    const ix = cap.regs.ix;
    const r = comparePair(cap.clone(), cap.clone(), stepBallisticMotion, ix);
    assert.equal(
      r.ram, null,
      r.ram && `RAM diverged at 0x${(r.ram.addr ?? 0).toString(16)} (${r.ram.a}->${r.ram.b}) [ix=${hx16(ix)}]`,
    );
    assert.equal(r.hB, r.hA, `H diverged: oracle=${hx(r.hA)} cand=${hx(r.hB)} [ix=${hx16(ix)}]`);
    assert.equal(r.lB, r.lA, `L diverged: oracle=${hx(r.lA)} cand=${hx(r.lB)} [ix=${hx16(ix)}]`);
    assert.ok(
      r.footprintOk,
      `oracle footprint = [${r.footprint.map((x) => "0x" + x.toString(16)).join(",")}], ` +
        `expected ⊆ record bytes at ix=${hx16(ix)}`,
    );
  }
  console.log(`  REAL CAPTURES: ${caps.length} real dispatches — RAM + HL == oracle, footprint = record bytes`);
});

// -- 2. CRAFTED edge sweep (memory-equivalence) -------------------------------

/** A real machine state (all of work RAM carrying genuine live values), neutralised. */
function realBaseState(frames) {
  const host = new Machine(ROM);
  host.runFrames(frames);
  return host.clone();
}

/** Poke a full IX record (the nine input bytes) onto machine `mm`, plus IX and a valid SP. */
function pokeRecord(mm, ix, f) {
  const { regs, mem } = mm;
  mem.write8((ix + 0x03) & 0xffff, (f.posA >> 8) & 0xff);
  mem.write8((ix + 0x04) & 0xffff, f.posA & 0xff);
  mem.write8((ix + 0x05) & 0xffff, (f.posB >> 8) & 0xff);
  mem.write8((ix + 0x06) & 0xffff, f.posB & 0xff);
  mem.write8((ix + 0x10) & 0xffff, (f.velA >> 8) & 0xff);
  mem.write8((ix + 0x11) & 0xffff, f.velA & 0xff);
  mem.write8((ix + 0x12) & 0xffff, (f.velB >> 8) & 0xff);
  mem.write8((ix + 0x13) & 0xffff, f.velB & 0xff);
  mem.write8((ix + 0x14) & 0xffff, f.t & 0xff);
  regs.ix = ix;
  regs.sp = 0x6bfe; // valid work-RAM stack so the oracle's trailing `ret` pops real bytes
}

// Edge sets: every carry/borrow/16-bit-wrap boundary + the gravity ramp extremes.
const POS_A = [0x0000, 0x00ff, 0x8000, 0xffff];
const VEL_A = [0x0000, 0x0001, 0xff80, 0xffff]; // +vel, -vel (0xff80), and full wrap
const POS_B = [0x0000, 0xf000, 0x4c00, 0xffff];
const VEL_B = [0x0000, 0x0148, 0xffff];         // 0x0148 = the real Mario jump velocity
const T_VALS = [0x00, 0x01, 0x7f, 0xff];        // gravity 8,24,0x7F8,0xFF8; 0xff also wraps inc
const IX_OBJ = 0x6500; // neutral object-region record, off the named Mario block

/** Sweep every crafted combo against `candidate`; return first mismatch (or null) + count. */
function craftedSweep(base, candidate) {
  let count = 0;
  for (const posA of POS_A) {
    for (const velA of VEL_A) {
      for (const posB of POS_B) {
        for (const velB of VEL_B) {
          for (const t of T_VALS) {
            const f = { posA, velA, posB, velB, t };
            const a = base.clone(); // oracle
            const b = base.clone(); // candidate
            pokeRecord(a, IX_OBJ, f);
            pokeRecord(b, IX_OBJ, f);
            const r = comparePair(a, b, candidate, IX_OBJ);
            count++;
            if (r.ram || r.hB !== r.hA || r.lB !== r.lA || !r.footprintOk) {
              return { mismatch: { f, r }, count };
            }
          }
        }
      }
    }
  }
  return { mismatch: null, count };
}

test("CRAFTED edge sweep: object-IX + all carry/borrow/wrap/gravity edges — RAM + HL == oracle", () => {
  const base = realBaseState(300);
  const { mismatch, count } = craftedSweep(base, stepBallisticMotion);
  assert.equal(
    mismatch, null,
    mismatch &&
      `mismatch [posA=${hx16(mismatch.f.posA)} velA=${hx16(mismatch.f.velA)} ` +
        `posB=${hx16(mismatch.f.posB)} velB=${hx16(mismatch.f.velB)} t=${hx(mismatch.f.t)}]: ` +
        (mismatch.r.ram
          ? `RAM at 0x${(mismatch.r.ram.addr ?? 0).toString(16)} ${mismatch.r.ram.a}->${mismatch.r.ram.b}`
          : `HL oracle=${hx(mismatch.r.hA)}${hx(mismatch.r.lA)} cand=${hx(mismatch.r.hB)}${hx(mismatch.r.lB)} ` +
            `footprintOk=${mismatch.r.footprintOk}`),
  );
  assert.equal(count, POS_A.length * VEL_A.length * POS_B.length * VEL_B.length * T_VALS.length);
  console.log(`  CRAFTED: ${count} object-IX edge entries — RAM + HL == oracle, footprint = record bytes`);
});

// -- 3. TEETH -----------------------------------------------------------------

/**
 * Broken twin: gravity = 16·t (drops the +8 midpoint constant that (2·t+1)·8 carries).
 * Everything else is identical. Coordinate B is then off by 8 on every frame, so the
 * crafted sweep must catch it.
 */
function brokenNoGravityOffset(m) {
  const { regs, mem } = m;
  const at = (d) => (regs.ix + d) & 0xffff;
  const posA = (mem.read8(at(0x03)) << 8) | mem.read8(at(0x04));
  const velA = (mem.read8(at(0x10)) << 8) | mem.read8(at(0x11));
  const newA = (posA + velA) & 0xffff;
  mem.write8(at(0x03), newA >> 8);
  mem.write8(at(0x04), newA & 0xff);
  const posB = (mem.read8(at(0x05)) << 8) | mem.read8(at(0x06));
  const velB = (mem.read8(at(0x12)) << 8) | mem.read8(at(0x13));
  const t = mem.read8(at(0x14));
  const gravity = 16 * t; // BUG: should be 16*t + 8
  const newB = (posB - velB + gravity) & 0xffff;
  mem.write8(at(0x05), newB >> 8);
  mem.write8(at(0x06), newB & 0xff);
  mem.write8(at(0x14), (t + 1) & 0xff);
  regs.h = newB >> 8;
  regs.l = newB & 0xff;
}

test("TEETH: the no-+8-gravity twin is CAUGHT by the crafted sweep", () => {
  const base = realBaseState(300);
  const { mismatch, count } = craftedSweep(base, brokenNoGravityOffset);
  assert.notEqual(mismatch, null, "the crafted sweep FAILED to catch a dropped +8 gravity constant — it is worthless");
  console.log(
    `  TEETH: caught after ${count} combos at ` +
      `[posB=${hx16(mismatch.f.posB)} velB=${hx16(mismatch.f.velB)} t=${hx(mismatch.f.t)}]`,
  );
});
