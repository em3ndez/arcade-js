// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for signStepHalfRate (ROM 0x26E9) — the half-rate sign-step leaf.
 *
 * sub_26e9 is a leaf whose observable output is a TOTAL function of just two inputs:
 * FRAME's bit 0 (0x601A, even/odd frame) and bit 7 of the byte at (HL). It reads
 * FRAME + that byte, writes at most that one byte, returns register A, and preserves
 * HL. So it is gated against the frozen oracle three ways:
 *
 *   1. EQUAL (exhaustive) — signStepHalfRate's (byte-written-at-HL, A) == the oracle's
 *      over the FULL 256×256 (frame, byte) grid at a real HL address. That covers
 *      every branch: even frame (A=0, no write), odd·bit7-set (write 0xFF), and
 *      odd·bit7-clear (write 0x01).
 *
 *   2. TEETH (exhaustive) — a deliberately-broken twin that reads bit 6 (0x40) instead
 *      of bit 7 (0x80) for the sign MUST be caught by the same sweep. It agrees with
 *      the oracle whenever bits 6 and 7 of the byte match, so only a real sweep bites.
 *
 *   3. CRAFTED + MEMORY-EQUIVALENCE (real machine states) — attract NEVER dispatches
 *      0x26E9 (the sub_25f2 cascade is `rst 0x30`-gated to 50m/BOARD 2, attract plays
 *      25m), so instead of captured dispatches we take a REAL booted+run attract
 *      machine state and craft entries on it — poking HL to each genuine channel
 *      address (0x62A1/0x62A3/0x62A6), plus FRAME and the target byte, IDENTICALLY on
 *      both sides (doc-06's crafted-entry technique). For each, run the oracle and
 *      signStepHalfRate on independent FRESH clones and diff RAM (dumpState —
 *      work+sprite+video, which excludes pc/SP) + A, and confirm the oracle's memory
 *      footprint is exactly the one byte at HL (nothing else; stack untouched).
 *
 * WHY NOT pc/SP: the idiomatic leaf models the Z80 `ret` as the JS return (doc-06),
 * leaving pc/SP at their entry values while the oracle's `ret` advances them.
 * Comparing pc/SP would measure the absent ret, not the routine's logic. RAM + A is
 * the routine's real contract (HL is preserved by both).
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-26e9.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_26e9 as oracle } from "../../translated/loc_26e9.js";
import { signStepHalfRate } from "../signStepHalfRate.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { FRAME } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

// The three real channel-direction addresses sub_25f2's callees hand to 0x26E9. Any
// writable work-RAM byte other than FRAME behaves identically; these are the genuine
// ones. HL_SWEEP is used for the big grid; all three are exercised by the crafted test.
const HL_ADDRS = [0x62a1, 0x62a3, 0x62a6];
const HL_SWEEP = 0x62a1;

const hx = (v) => "0x" + (v & 0xff).toString(16).padStart(2, "0");

/**
 * Set FRAME + the byte at `hl` + a valid SP, run `fn` (oracle or candidate), and read
 * back the routine's observable outputs. The machine is REUSED across the sweep: both
 * inputs are fully overwritten every call and the routine's only memory write is the
 * byte at `hl` (also overwritten next call), so nothing accumulates. SP is reset into
 * work RAM so the oracle's trailing `ret` pops valid bytes (it reads them, never
 * writes). HL is set as the pointer and read back to confirm it is preserved.
 */
function run(m, fn, hl, frame, byte) {
  const { regs, mem } = m;
  mem.write8(FRAME, frame);
  mem.write8(hl, byte);
  regs.hl = hl;
  regs.sp = 0x6bfe;
  fn(m);
  return { out: mem.read8(hl), a: regs.a & 0xff, hl: regs.hl & 0xffff };
}

/**
 * Compare a candidate against the oracle over the full 256×256 (frame, byte) grid at
 * HL_SWEEP. Returns the first mismatch (or null) and the combo count.
 */
function sweep(candidate) {
  const mo = new Machine(ROM).clone();
  const mc = new Machine(ROM).clone();
  let count = 0;
  for (let frame = 0; frame < 256; frame++) {
    for (let byte = 0; byte < 256; byte++) {
      const want = run(mo, oracle, HL_SWEEP, frame, byte);
      const got = run(mc, candidate, HL_SWEEP, frame, byte);
      count++;
      if (got.out !== want.out || got.a !== want.a || got.hl !== want.hl) {
        return { mismatch: { frame, byte, want, got }, count };
      }
    }
  }
  return { mismatch: null, count };
}

const fmt = (mm) =>
  `frame=${hx(mm.frame)} byte=${hx(mm.byte)}: ` +
  `oracle{out=${hx(mm.want.out)} a=${hx(mm.want.a)} hl=0x${mm.want.hl.toString(16)}} ` +
  `cand{out=${hx(mm.got.out)} a=${hx(mm.got.a)} hl=0x${mm.got.hl.toString(16)}}`;

// -- 1. EQUAL (exhaustive) ----------------------------------------------------

test("EQUAL (exhaustive): signStepHalfRate == oracle over all 65,536 (frame,byte) combos", () => {
  const { mismatch, count } = sweep(signStepHalfRate);
  assert.equal(mismatch, null, mismatch && fmt(mismatch));
  assert.equal(count, 256 * 256, "must have compared the full (frame,byte) grid");
  console.log(`  EQUAL/exhaustive: ${count} (frame,byte) combos identical (byte-written + A + HL)`);
});

// -- 2. TEETH (exhaustive) ----------------------------------------------------

/**
 * Broken twin: reads bit 6 (mask 0x40) instead of bit 7 (0x80) for the sign — a
 * plausible off-by-one-bit bug. Agrees with the oracle whenever bits 6 and 7 of the
 * byte match, so only a real sweep across bytes where they differ catches it.
 */
function brokenSignStep(m) {
  const { regs, mem } = m;
  if ((mem.read8(FRAME) & 0x01) === 0) {
    regs.a = 0x00;
    return;
  }
  const step = (mem.read8(regs.hl) & 0x40) ? 0xff : 0x01; // BUG: 0x40 should be 0x80
  mem.write8(regs.hl, step);
  regs.a = step;
}

test("TEETH (exhaustive): the wrong-sign-bit twin is CAUGHT by the sweep", () => {
  const { mismatch, count } = sweep(brokenSignStep);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a wrong sign bit — it is worthless");
  console.log(`  TEETH: caught after ${count} combos at ${fmt(mismatch)}`);
});

// -- 3. CRAFTED + MEMORY-EQUIVALENCE (real machine states) --------------------

/**
 * A real machine state: boot and run a few hundred attract frames so all of work RAM
 * carries genuine live values, then clone it (frame machinery neutralised). Crafted
 * entries poke HL/FRAME/(HL) onto CLONES of this base — identically on both sides.
 */
function realBaseState(frames) {
  const host = new Machine(ROM);
  host.runFrames(frames);
  return host.clone();
}

test("CRAFTED + MEMORY-EQUIVALENCE: real state, every HL/branch — RAM + A match, footprint = HL byte only", () => {
  const base = realBaseState(300);

  // Every (HL address, frame-parity, sign-bit) combination, on genuine surrounding RAM.
  const FRAMES = [0x00, 0x02, 0xa4, 0x01, 0x03, 0x7f, 0x81, 0xff]; // even and odd
  const BYTES = [0x00, 0x01, 0x7f, 0x80, 0x81, 0xc0, 0xfe, 0xff]; // bit7 clear and set
  let cases = 0;

  for (const hl of HL_ADDRS) {
    for (const frame of FRAMES) {
      for (const byte of BYTES) {
        // FRESH clone per side — this routine writes memory, so snapshots are never shared.
        const a = base.clone(); // oracle
        const b = base.clone(); // idiomatic
        for (const mm of [a, b]) {
          mm.mem.write8(FRAME, frame);
          mm.mem.write8(hl, byte);
          mm.regs.hl = hl;
        }
        const before = a.dumpState();
        oracle(a);
        signStepHalfRate(b);

        // MEMORY-EQUIVALENCE: identical RAM (dumpState excludes pc/SP; neither the
        // oracle's `ret` nor the JS return touches RAM beyond the byte at HL).
        const d = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
        assert.equal(
          d,
          null,
          d && `RAM diverged at 0x${(d.addr ?? 0).toString(16)} (${d.a}->${d.b}) ` +
            `[hl=0x${hl.toString(16)} frame=${hx(frame)} byte=${hx(byte)}]`,
        );

        // LIVE-OUT register A.
        assert.equal(
          b.regs.a & 0xff,
          a.regs.a & 0xff,
          `A diverged [hl=0x${hl.toString(16)} frame=${hx(frame)} byte=${hx(byte)}]`,
        );

        // FOOTPRINT: the oracle changed at most the one byte at HL, nothing else
        // (justifies the single-write idiomatic body). On even frames it changes none.
        const after = a.dumpState();
        const changed = [];
        for (let i = 0; i < before.length; i++) {
          if (before[i] !== after[i]) changed.push(a.stateOffsetToAddr(i));
        }
        assert.ok(
          changed.length <= 1 && (changed.length === 0 || changed[0] === hl),
          `oracle footprint = [${changed.map((x) => "0x" + x.toString(16)).join(",")}], expected only 0x${hl.toString(16)}`,
        );
        cases++;
      }
    }
  }
  console.log(`  CRAFTED: ${cases} real-state entries across 3 HL addresses — RAM + A == oracle, footprint = HL byte`);
});
