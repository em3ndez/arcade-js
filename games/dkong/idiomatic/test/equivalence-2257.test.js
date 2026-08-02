// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for loc_2257 (ROM 0x2257) — the "no hit" tail of the sub_2243
 * hit test, a two-level caller-skip.
 *
 * skip_2257 is PURE CONTROL FLOW: in the oracle it drops the parent's return
 * address into a scratch register and returns past it, so both sub_2243's frame and
 * its caller's frame unwind and control resumes at the grandparent. It reads no
 * memory, writes no memory, and calls nothing. Its ONLY observable output is the
 * skip signal — a boolean false — which the idiomatic caller chain propagates with
 * `if (!callee(m)) return;`. So the memory-equivalence contract here is exactly two
 * things: (1) neither side writes any RAM, and (2) both return the same skip signal.
 *
 * The routine is INPUT-INDEPENDENT — it takes the identical action on every machine
 * state — so a handful of real, self-consistent states already covers its whole
 * behaviour. Two sources of states are used:
 *
 *   1. EQUAL (crafted) — a boot/attract base with the stack pointer moved to several
 *      work-RAM values; on each, loc_2257 must leave RAM byte-identical to the oracle
 *      (whole 5120-byte dump, no exclusion — the oracle only READS the stack) and
 *      return the same false. A parallel oracle probe confirms the signal really is
 *      false, so the return check is not vacuous.
 *
 *   2. REALISM (captured) — 0x2257 is a gameplay-only hit-test tail: sub_2243,
 *      loc_2227 and loc_2259 are never reached in attract, so 0x2257 itself never
 *      dispatches there. Real in-play states are therefore captured at the nearest
 *      reachable same-subsystem ancestor, sub_2207 (ROM 0x2207, ~1200 dispatches per
 *      attract run, stack pointer down in the 0x6bxx region where 0x2257 would really
 *      run). loc_2257 must reproduce the oracle on each — again no RAM, same false.
 *
 *   3. TEETH — two broken twins, each of which the SAME contract MUST catch, one per
 *      half of the gate:
 *        (a) wrong skip signal — returns true (a HIT) where the oracle skips; caught
 *            by the return-value check.
 *        (b) a stray RAM write the oracle never makes; caught by the whole-dump RAM
 *            diff at that cell.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-2257.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_2257 as oracle } from "../../translated/loc_2257.js";
import { loc_2257 } from "../loc_2257.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const ANCESTOR = 0x2207; // sub_2207: the reachable same-subsystem ancestor of 0x2257
const TEETH_ADDR = 0x6100; // a plain work-RAM cell (0x6000-0x6BFF) the oracle never writes

/**
 * Run the oracle on one fresh clone and the candidate on another byte-identical
 * clone, with the frame machinery neutralised so a stray NMI can't masquerade as a
 * side effect, and return the contract diffs: any RAM divergence over the whole
 * 5120-byte dump (the oracle only reads the stack, so no STACK_SCRATCH exclusion is
 * needed), and a divergence in the boolean skip signal.
 */
function contractDiffs(entry, candidate) {
  const a = entry.clone(); a.nextNmi = Infinity; a.nextBoundary = Infinity;
  const b = entry.clone(); b.nextNmi = Infinity; b.nextBoundary = Infinity;
  const ro = oracle(a);
  const rc = candidate(b);
  const diffs = [];
  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  if (ram) diffs.push(`RAM@0x${(ram.addr ?? 0).toString(16)} oracle=${ram.a} cand=${ram.b}`);
  if (ro !== rc) diffs.push(`return oracle=${ro} cand=${rc}`);
  return diffs;
}

// A real, self-consistent machine: boot + a stretch of attract so work RAM (and the
// stack) hold realistic values. clone() neutralises the frame machinery.
function attractBase(frames = 180) {
  const m = new Machine(ROM);
  m.runFrames(frames);
  return m.clone();
}

// Capture up to K real machine states at ANCESTOR (sub_2207) during an attract run,
// letting the original routine run afterwards so the game proceeds undisturbed.
function captureAncestorStates(K, frames) {
  const orig = new Machine(ROM).routines.get(ANCESTOR); // the translated sub_2207
  const caps = [];
  const snap = new Map([[ANCESTOR, (mm) => {
    if (caps.length < K) caps.push(mm.clone());
    return orig(mm);
  }]]);
  const host = new Machine(ROM, { overrides: snap });
  host.runFrames(frames);
  return caps;
}

// -- 1. EQUAL (crafted) -------------------------------------------------------

test("EQUAL (crafted): loc_2257 == oracle across varied states — no RAM write, returns false", () => {
  const base = attractBase();
  const sps = [0x6bf8, 0x6be8, 0x6800, 0x6400, 0x6100];
  for (const sp of sps) {
    const entry = base.clone();
    entry.regs.sp = sp;
    const diffs = contractDiffs(entry, loc_2257);
    assert.equal(diffs.length, 0, `SP=0x${sp.toString(16)}: ${diffs.join("; ")}`);
    // Non-vacuity: the oracle's own signal really is the skip (false), so matching it
    // is a real assertion, not a comparison of two undefineds.
    const probe = entry.clone(); probe.nextNmi = Infinity; probe.nextBoundary = Infinity;
    assert.equal(oracle(probe), false, "oracle must return the skip signal false");
  }
  console.log(`  EQUAL/crafted: ${sps.length} states — RAM identical to the oracle, return false`);
});

// -- 2. REALISM (captured) ----------------------------------------------------

test("REALISM (captured): loc_2257 == oracle on real in-play states from sub_2207", () => {
  const caps = captureAncestorStates(200, 2000);
  assert.ok(caps.length >= 1, "expected sub_2207 (0x2207) to dispatch during attract");
  for (const cap of caps) {
    const diffs = contractDiffs(cap, loc_2257);
    assert.equal(diffs.length, 0, `real captured state: ${diffs.join("; ")}`);
  }
  console.log(`  REALISM: ${caps.length} real in-play states (from 0x2207) — RAM == oracle, return false`);
});

// -- 3. TEETH -----------------------------------------------------------------

/** Broken twin (a): returns true — signals a HIT, so the caller would wrongly run
 *  its tail instead of propagating the skip. Caught by the return-value check. */
function brokenReturnsTrue(m) {
  return true;
}

/** Broken twin (b): stamps a byte the oracle never writes. Caught by the RAM diff. */
function brokenWritesRam(m) {
  const { mem } = m;
  mem.write8(TEETH_ADDR, (mem.read8(TEETH_ADDR) + 1) & 0xff);
  return false;
}

test("TEETH: the wrong-return twin and the RAM-writing twin are CAUGHT", () => {
  const base = attractBase();
  const entry = base.clone();
  entry.regs.sp = 0x6bf8;

  const retDiffs = contractDiffs(entry, brokenReturnsTrue);
  assert.ok(retDiffs.length > 0, "the wrong-return twin escaped — the return check is worthless");
  assert.ok(
    retDiffs.some((d) => d.startsWith("return")),
    `expected a return-value diff, got: ${retDiffs.join("; ")}`,
  );

  const ramDiffs = contractDiffs(entry, brokenWritesRam);
  assert.ok(ramDiffs.length > 0, "the RAM-writing twin escaped — the RAM check is worthless");
  assert.ok(
    ramDiffs.some((d) => d.startsWith(`RAM@0x${TEETH_ADDR.toString(16)}`)),
    `expected a RAM diff at 0x${TEETH_ADDR.toString(16)}, got: ${ramDiffs.join("; ")}`,
  );

  console.log(`  TEETH: wrong-return caught (${retDiffs.join("; ")}); RAM-writing caught (${ramDiffs.join("; ")})`);
});
