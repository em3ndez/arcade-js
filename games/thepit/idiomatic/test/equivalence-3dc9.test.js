// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for deriveTileWriteCursors (ROM 0x3dc9) — the cursor-derivation
 * step that turns a tile's tilemap offset (0x805a) into its colour-RAM write cursor
 * (0x805e = colour base 0x8800 + offset) and video-RAM write cursor (0x8060 = video
 * base 0x9000 + offset).
 *
 * The routine reads one 16-bit RAM word (0x805a) and writes two 16-bit RAM words
 * (0x805e, 0x8060), so it is gated on MEMORY-equivalence, not on a returned register,
 * and its declared live-out is memory-only: every caller re-reads the two cursors from
 * memory to stamp cells, never from a leftover register, so the pointer/flag registers
 * the oracle leaves behind are dead and not reproduced.
 *
 * Its VISIBLE behaviour is a pure function of the one input word, so it is proven the
 * strongest practical way:
 *
 *   0. IDENTITY — run the unit gate with both arms = the oracle; EQUAL proves the
 *      harness wiring (construct-with-override -> host run -> capture -> clone -> diff)
 *      works on The Pit at all.
 *   1. EQUAL (exhaustive) — poke all 65,536 tilemap-offset words onto a real captured
 *      entry and confirm deriveTileWriteCursors writes the SAME 0x805e and 0x8060
 *      cursors as the oracle over the whole input domain.
 *   2. EQUAL (real dispatches, full contract) — hook 0x3dc9 in a real attract run (the
 *      panel/record plotters feed it different offsets) and, for each capture, run the
 *      oracle on one clone and deriveTileWriteCursors on another and confirm they leave
 *      identical RAM + pc + SP. This proves the candidate writes ONLY 0x805e / 0x8060 on
 *      the real surrounding state — i.e. the memory-only signature is honest.
 *   3. TEETH — a deliberately-broken twin (skips the colour-to-video bump, so its video
 *      cursor equals its colour cursor) MUST be caught, both by the exhaustive sweep and
 *      on a crafted entry.
 *
 * The idiomatic routine models the return as a plain JS return (no stack modelling), so
 * the contract check performs one m.ret() on the candidate clone AFTER the call to line
 * pc + SP up with the oracle (which rets internally).
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-3dc9.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_3dc9 as oracle } from "../../translated/loc_3dc9.js";
import { deriveTileWriteCursors } from "../deriveTileWriteCursors.js";
import { makeMachineFactory } from "../../machine.js";
import { unitEquivalence, firstStateDiff } from "../../../../core/equivalence.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const TARGET = 0x3dc9;
const IN = 0x805a; // the 16-bit tilemap-offset input word
const COLOUR_OUT = 0x805e; // colour-RAM write cursor
const VIDEO_OUT = 0x8060; // video-RAM write cursor
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// The engine drives makeMachine(overrides) synchronously; The Pit's registry is
// async, so build the factory once (it closes over the built registry).
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

// -- helpers ------------------------------------------------------------------

/** Read a little-endian 16-bit word out of the machine's RAM. */
function read16(m, addr) {
  return m.mem.read8(addr) | (m.mem.read8(addr + 1) << 8);
}

/** The two output cursors the routine stored (colour, video). */
function readCursors(m) {
  return { colour: read16(m, COLOUR_OUT), video: read16(m, VIDEO_OUT) };
}

/**
 * Hook 0x3dc9 in a real attract run and clone the machine at up to K real dispatches.
 * The wrapper snapshots the entry state, then runs the oracle so the host game proceeds
 * undisturbed. Attract's title/panel draws dispatch it from several plotters (drawPlayerLabel,
 * paintPlayfieldStripCol1Row11, drawMenLeftPanel, drawCreditsDisplay, showSetupScreen, loc_4df8) with varied offsets.
 */
function captureDispatches(K, maxFrames) {
  const caps = [];
  const snapshot = new Map([[TARGET, (mm) => {
    if (caps.length < K) caps.push(mm.clone());
    return oracle(mm);
  }]]);
  const host = makeMachine(snapshot);
  host.runFrames(maxFrames);
  return caps;
}

/** First differing RAM byte between two machines (or null). */
function firstRamDiff(a, b) {
  return firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
}

/**
 * Compare a candidate against the oracle over the memory-equivalence contract for one
 * entry: RAM + pc + SP (value registers are the declared-dead live-out and excluded).
 * The oracle rets internally; the candidate's return is modelled with one m.ret().
 */
function contractDiffs(entry, fn) {
  const o = entry.clone();
  oracle(o);
  const c = entry.clone();
  fn(c);
  c.ret();

  const diffs = [];
  const ram = firstRamDiff(o, c);
  if (ram) diffs.push(`RAM@0x${(ram.addr ?? ram.offset).toString(16)} oracle=${ram.a} cand=${ram.b}`);
  if (o.pc !== c.pc) diffs.push(`pc oracle=${hx(o.pc)} cand=${hx(c.pc)}`);
  if (o.regs.sp !== c.regs.sp) diffs.push(`SP oracle=${hx(o.regs.sp)} cand=${hx(c.regs.sp)}`);
  return diffs;
}

/**
 * Exhaustive sweep of the input domain: for every 16-bit offset word, poke it at 0x805a
 * on a reused clone and compare the two cursors the candidate stores against the oracle's.
 * The reused oracle clone rets internally, so reset its SP each pass so the pop cannot
 * drift across the 65,536 iterations; nothing else accumulates (both sides overwrite only
 * 0x805e / 0x8060). Returns the first mismatch or null.
 */
function sweep(candidate, seed) {
  const oM = seed.clone();
  const cM = seed.clone();
  const sp0 = oM.regs.sp;
  let count = 0;
  for (let word = 0; word < 65536; word++) {
    oM.mem.write16(IN, word);
    oM.regs.sp = sp0; // keep the internal ret's pop from drifting SP across passes
    oracle(oM);
    const want = readCursors(oM);

    cM.mem.write16(IN, word);
    candidate(cM);
    const got = readCursors(cM);

    count++;
    if (want.colour !== got.colour || want.video !== got.video) {
      return { mismatch: { word, want, got }, count };
    }
  }
  return { mismatch: null, count };
}

/** Broken twin: skips the colour-to-video bump, so the video cursor wrongly equals the colour cursor. */
function brokenDeriveTileWriteCursors(m) {
  const { mem } = m;
  const offset = mem.read16(IN);
  mem.write16(COLOUR_OUT, 0x8800 + offset);
  mem.write16(VIDEO_OUT, 0x8800 + offset); // BUG: forgot the +0x0800 bump to the video-RAM base
}

// -- 0. IDENTITY --------------------------------------------------------------

test("IDENTITY: the unit gate runs on The Pit and reports EQUAL when both arms are the oracle", () => {
  const res = unitEquivalence(makeMachine, TARGET, oracle, oracle);
  assert.equal(
    res.equal,
    true,
    `gate reported a diff for identical arms: ram=${JSON.stringify(res.ram)} regs=${JSON.stringify(res.regs)}`,
  );
  console.log("  IDENTITY: captured 0x3dc9, cloned, ran oracle vs oracle -> EQUAL");
});

// -- 1. EQUAL (exhaustive) ----------------------------------------------------

test("EQUAL (exhaustive): deriveTileWriteCursors == oracle over all 65,536 offset words", () => {
  const seed = captureDispatches(1, 400)[0];
  assert.ok(seed, "expected at least one real 0x3dc9 dispatch during attract");

  const { mismatch, count } = sweep(deriveTileWriteCursors, seed);
  assert.equal(
    mismatch,
    null,
    mismatch &&
      `mismatch at offset=${hx(mismatch.word)}: oracle colour=${hx(mismatch.want.colour)} ` +
        `video=${hx(mismatch.want.video)} cand colour=${hx(mismatch.got.colour)} video=${hx(mismatch.got.video)}`,
  );
  assert.equal(count, 65536, "must have compared the full 65,536-word domain");
  console.log(`  EQUAL/exhaustive: ${count} offset words store identical colour+video cursors to the oracle`);
});

// -- 2. EQUAL (real dispatches, full contract) --------------------------------

test("EQUAL (real dispatches): deriveTileWriteCursors == oracle on every captured 0x3dc9 entry", () => {
  const caps = captureDispatches(64, 1200);
  assert.ok(caps.length >= 1, "expected at least one real 0x3dc9 dispatch during attract");
  for (const cap of caps) {
    const diffs = contractDiffs(cap, deriveTileWriteCursors); // fresh clones inside — cap untouched
    assert.equal(diffs.length, 0, diffs.join("; "));
  }
  const s = caps[0];
  console.log(
    `  EQUAL/real: ${caps.length} captured dispatches identical over RAM+pc+SP ` +
      `(sample offset=${hx(read16(s, IN))})`,
  );
});

// -- 3. TEETH -----------------------------------------------------------------

test("TEETH: the missing-video-bump twin is CAUGHT", () => {
  const caps = captureDispatches(8, 1200);
  assert.ok(caps.length >= 1, "need a real capture to seed the teeth check");

  // Exhaustive sweep must catch the twin somewhere in the domain.
  const { mismatch, count } = sweep(brokenDeriveTileWriteCursors, caps[0]);
  assert.notEqual(mismatch, null, "the exhaustive sweep FAILED to catch a wrong video cursor — it is worthless");

  // And on a crafted entry (offset = 0x0123), the full contract must fail too.
  const crafted = caps[0].clone();
  crafted.mem.write16(IN, 0x0123);
  const craftedDiffs = contractDiffs(crafted, brokenDeriveTileWriteCursors);
  assert.ok(craftedDiffs.length > 0, "the twin escaped the full-contract check on a crafted offset entry");

  console.log(
    `  TEETH: missing-bump twin caught after ${count} sweep words ` +
      `at offset=${hx(mismatch.word)} (oracle video=${hx(mismatch.want.video)} broken=${hx(mismatch.got.video)}) ` +
      `and on the crafted entry (${craftedDiffs[0]})`,
  );
});
