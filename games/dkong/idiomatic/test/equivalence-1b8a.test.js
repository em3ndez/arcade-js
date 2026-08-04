// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for launchMarioJump (ROM 0x1B8A) — the jump-motion commit.
 *
 * loc_1b8a is a branch-free memory-writer: given the launch horizontal velocity in
 * (B, C) and the current MARIO_SPRITE_CODE / MARIO_Y in RAM, it writes eight RAM
 * bytes (airborne velocity + fractions + frame counter + jump pose + take-off Y +
 * jump sound) and calls nothing. Its observable output is therefore a function of
 * four inputs: vxHi (=B), vxLo (=C), the entry sprite-code byte (only bit 7, facing,
 * survives) and the entry Y (copied to the take-off snapshot). It is gated against
 * the frozen oracle four ways:
 *
 *   1. EQUAL (crafted sweep) — over every velocity arm × facing-bit × take-off-Y
 *      edge, run oracle vs launchMarioJump on FRESH clones of a real captured entry
 *      state and diff the full state dump (work+sprite+video, which excludes pc/SP).
 *      Covers verbatim velocity copy, facing-bit preservation, and the Y snapshot.
 *
 *   2. EQUAL (velocity breadth) — the two velocity bytes are copied verbatim, so
 *      sweep a broad set of (vxHi, vxLo) at a fixed sprite/Y and confirm every pair
 *      lands byte-identically — proving no arm reinterprets the velocity.
 *
 *   3. TEETH — a deliberately-broken twin that DROPS the facing bit (writes 0x0E
 *      regardless of bit 7) MUST be caught. It agrees whenever Mario faces left
 *      (bit 7 clear), so only a sweep that includes facing-right catches it.
 *
 *   4. REALISM + MEMORY-EQUIVALENCE (captured dispatches) — hook 0x1B8A in a real
 *      attract run (Mario jumps naturally, hitting all three velocity arms) and clone
 *      the machine at each true invocation; for each, run the oracle and
 *      launchMarioJump on independent FRESH clones and diff the full state dump. Also
 *      confirm the oracle's memory footprint is a subset of the eight expected
 *      addresses — nothing else, stack untouched.
 *
 * WHY NOT pc/SP or registers: the idiomatic routine models the Z80 `ret` as the JS
 * return and drops the dead register ABI (doc-06). loc_1b8a's live-out is memory-only
 * (dispatchMarioMovement→loc_1b6e→here is a tail-jump chain returning to loc_197a @0x1983, which
 * calls the next cascade routine without reading A/HL/BC/flags). So RAM is the whole
 * contract; comparing pc/SP would measure the absent ret, not the routine's logic.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-1b8a.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_1b8a as oracle } from "../../translated/loc_1b8a.js";
import { launchMarioJump } from "../launchMarioJump.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import {
  MARIO_AIR_VX_HI, MARIO_AIR_VX_LO, MARIO_AIR_VY_HI, MARIO_AIR_VY_LO,
  MARIO_AIR_FRAMES, MARIO_X_FRAC, MARIO_Y_FRAC, MARIO_SPRITE_CODE, MARIO_Y,
  MARIO_AIR_START_Y, SND_TRIGGER,
} from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x1b8a;
const hx = (v) => "0x" + (v & 0xff).toString(16).padStart(2, "0");

// The eight RAM bytes loc_1b8a may write. A footprint MUST be a subset of these.
const FOOTPRINT = [
  MARIO_AIR_VX_HI, MARIO_AIR_VX_LO, MARIO_AIR_VY_HI, MARIO_AIR_VY_LO,
  MARIO_AIR_FRAMES, MARIO_X_FRAC, MARIO_Y_FRAC, MARIO_SPRITE_CODE,
  MARIO_AIR_START_Y, SND_TRIGGER + 1,
];
const FOOTPRINT_SET = new Set(FOOTPRINT);

/**
 * Hook 0x1B8A in a real attract run and clone the machine at up to K real
 * dispatches. Attract plays 25m and Mario jumps, so loc_1b6e tail-jumps here with a
 * real (B, C) and live surrounding RAM. The wrapper clones the entry state, then runs
 * the oracle so the host game proceeds undisturbed.
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

/**
 * Prime a clone with a crafted (vxHi, vxLo, spr, y) entry, run `which`
 * (oracle | candidate), and return its full state dump. The oracle reads B/C from
 * registers and re-poses from MARIO_SPRITE_CODE; the candidate takes (vxHi, vxLo) as
 * args. SP is set into work RAM so the oracle's trailing `ret` pops valid bytes
 * (it reads them, never writes).
 */
function runCrafted(base, which, vxHi, vxLo, spr, y) {
  const m = base.clone();
  m.regs.b = vxHi;
  m.regs.c = vxLo;
  m.regs.sp = 0x6bfe;
  m.mem.write8(MARIO_SPRITE_CODE, spr);
  m.mem.write8(MARIO_Y, y);
  if (which === "oracle") oracle(m);
  else which(m, vxHi, vxLo);
  return m;
}

/**
 * Sweep a candidate against the oracle over VELS × SPRS × YS, on fresh clones of
 * `base`. Returns the first state-dump mismatch (or null) and the combo count.
 */
function craftedSweep(base, candidate, VELS, SPRS, YS) {
  let count = 0;
  for (const [vxHi, vxLo] of VELS) {
    for (const spr of SPRS) {
      for (const y of YS) {
        const a = runCrafted(base, "oracle", vxHi, vxLo, spr, y);
        const b = runCrafted(base, candidate, vxHi, vxLo, spr, y);
        count++;
        const d = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
        if (d) return { mismatch: { vxHi, vxLo, spr, y, d }, count };
      }
    }
  }
  return { mismatch: null, count };
}

// The three real launch velocities (Right/Left/none) plus arbitrary bytes to prove
// the two velocity bytes are copied VERBATIM, not reinterpreted per arm.
const VELS = [[0x00, 0x80], [0xff, 0x80], [0x00, 0x00], [0xff, 0xff], [0x7f, 0x01], [0x80, 0xfe], [0x12, 0x34]];
// Entry sprite codes: facing bit clear/set over varied low bits (only bit 7 survives).
const SPRS = [0x00, 0x80, 0x02, 0x82, 0x0f, 0x8f, 0x7f, 0xff];
// Entry Y values (copied to the take-off snapshot): boundaries + samples.
const YS = [0x00, 0x4c, 0xa0, 0xcc, 0xd0, 0xf0, 0xff];

const fmt = (mm) =>
  `vxHi=${hx(mm.vxHi)} vxLo=${hx(mm.vxLo)} spr=${hx(mm.spr)} y=${hx(mm.y)}: ` +
  `diverged at 0x${(mm.d.addr ?? 0).toString(16)} (oracle=${mm.d.a} cand=${mm.d.b})`;

// -- 1. EQUAL (crafted sweep) -------------------------------------------------

test("EQUAL (crafted sweep): launchMarioJump == oracle over velocity × facing × Y edges", () => {
  const caps = captureDispatches(8, 4000);
  assert.ok(caps.length >= 1, "expected at least one real 0x1b8a dispatch to seed the sweep base");
  const base = caps[0];

  const { mismatch, count } = craftedSweep(base, launchMarioJump, VELS, SPRS, YS);
  assert.equal(mismatch, null, mismatch && fmt(mismatch));
  assert.equal(count, VELS.length * SPRS.length * YS.length, "must have swept the full crafted grid");
  console.log(`  EQUAL/crafted: ${count} (velocity,facing,Y) combos identical state dumps`);
});

// -- 2. EQUAL (velocity breadth) ----------------------------------------------

test("EQUAL (velocity breadth): every (vxHi,vxLo) byte pair is copied verbatim", () => {
  const caps = captureDispatches(8, 4000);
  assert.ok(caps.length >= 1, "expected at least one real 0x1b8a dispatch to seed the base");
  const base = caps[0];

  const BYTES = [0x00, 0x01, 0x0f, 0x10, 0x7f, 0x80, 0x81, 0xff];
  let count = 0;
  let mismatch = null;
  for (const vxHi of BYTES) {
    for (const vxLo of BYTES) {
      const a = runCrafted(base, "oracle", vxHi, vxLo, 0x82, 0xcc);
      const b = runCrafted(base, launchMarioJump, vxHi, vxLo, 0x82, 0xcc);
      count++;
      const d = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
      if (d) { mismatch = { vxHi, vxLo, spr: 0x82, y: 0xcc, d }; break; }
    }
    if (mismatch) break;
  }
  assert.equal(mismatch, null, mismatch && fmt(mismatch));
  console.log(`  EQUAL/velocity-breadth: ${count} (vxHi,vxLo) pairs copied verbatim`);
});

// -- 3. TEETH -----------------------------------------------------------------

/**
 * Broken twin: DROPS the facing bit — writes the bare jump code 0x0E into
 * MARIO_SPRITE_CODE regardless of bit 7. Agrees with the oracle whenever Mario faces
 * left (bit 7 clear), so only a sweep that includes facing-right catches it.
 */
function brokenLaunch(m, vxHi, vxLo) {
  const { mem } = m;
  mem.write8(MARIO_AIR_VX_HI, vxHi);
  mem.write8(MARIO_AIR_VX_LO, vxLo);
  mem.write8(MARIO_AIR_VY_HI, 0x01);
  mem.write8(MARIO_AIR_VY_LO, 0x48);
  mem.write8(MARIO_AIR_FRAMES, 0x00);
  mem.write8(MARIO_X_FRAC, 0x00);
  mem.write8(MARIO_Y_FRAC, 0x00);
  mem.write8(MARIO_SPRITE_CODE, 0x0e); // BUG: facing bit 7 not preserved
  mem.write8(MARIO_AIR_START_Y, mem.read8(MARIO_Y));
  mem.write8(SND_TRIGGER + 1, 0x03);
}

test("TEETH: the facing-bit-dropping twin is CAUGHT by the sweep", () => {
  const caps = captureDispatches(8, 4000);
  assert.ok(caps.length >= 1, "expected at least one real 0x1b8a dispatch to seed the base");
  const base = caps[0];

  const { mismatch, count } = craftedSweep(base, brokenLaunch, VELS, SPRS, YS);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a dropped facing bit — it is worthless");
  console.log(`  TEETH: caught after ${count} combos at ${fmt(mismatch)}`);
});

// -- 4. REALISM + MEMORY-EQUIVALENCE (captured dispatches) --------------------

test("REALISM + MEMORY-EQUIVALENCE: real captured jump dispatches — state dumps match, footprint ⊆ expected", () => {
  const caps = captureDispatches(64, 6000);
  assert.ok(caps.length >= 1, "expected at least one real 0x1b8a dispatch during attract");

  const armsSeen = new Set();
  for (const cap of caps) {
    const vxHi = cap.regs.b;
    const vxLo = cap.regs.c;
    armsSeen.add(`${hx(vxHi)}:${hx(vxLo)}`);

    // FRESH clone per side — this routine writes memory, so snapshots are never shared.
    const a = cap.clone(); // oracle
    const b = cap.clone(); // idiomatic
    const before = a.dumpState();
    oracle(a);
    launchMarioJump(b, vxHi, vxLo);

    // MEMORY-EQUIVALENCE: identical state dump (excludes pc/SP; neither the oracle's
    // `ret` nor the JS return writes RAM beyond the eight bytes above).
    const d = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
    assert.equal(
      d,
      null,
      d && `RAM diverged at 0x${(d.addr ?? 0).toString(16)} (oracle=${d.a} cand=${d.b}) ` +
        `on real dispatch vxHi=${hx(vxHi)} vxLo=${hx(vxLo)}`,
    );

    // FOOTPRINT: every byte the oracle changed vs the captured entry is one of the
    // eight expected addresses — justifies the routine's write set, stack untouched.
    const after = a.dumpState();
    const changed = [];
    for (let i = 0; i < before.length; i++) {
      if (before[i] !== after[i]) changed.push(a.stateOffsetToAddr(i));
    }
    const stray = changed.filter((addr) => !FOOTPRINT_SET.has(addr));
    assert.equal(
      stray.length,
      0,
      `oracle wrote outside its footprint: [${stray.map((x) => "0x" + x.toString(16)).join(",")}]`,
    );
  }
  console.log(
    `  REALISM: ${caps.length} real 0x1b8a dispatches — state dumps == oracle, footprint ⊆ expected; ` +
      `velocity arms seen: ${[...armsSeen].join(", ")}`,
  );
});
