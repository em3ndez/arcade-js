// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for advanceBarrelTileAnimation (ROM 0x1FCE) — step an object record's animation prescaler (+0x0f)
 * and, on the visit it expires, flip the lowest bit of the record's OBJ_SPRITE_CODE and reload the
 * prescaler to 4; then jump into the shared object-sprite tail at ROM 0x21BA.
 *
 * WHAT THIS GATE ACTUALLY COVERS, stated plainly:
 *
 *   1. EQUAL (captured, ATTRACT ONLY). 0x1FCE needs no input to reach: a plain 3000-frame attract
 *      run dispatches it 604 times, the first at frame 613. EVERY ONE is replayed — inline at the
 *      dispatch (clone twice, run oracle and rewrite, compare, discard), so nothing is sampled and
 *      nothing is held in memory. The test asserts the coverage it should see and prints the
 *      counts: all four prescaler values attract produces (1, 2, 3 and 4 — and NO other), all six
 *      OBJ_ARRAY_67 record bases it reaches, all three tile-code pairs, and the invariant the
 *      routine's role line rests on (the ORACLE changes the tile code on exactly the dispatches
 *      whose prescaler arrives at 1). Credited gameplay, boards 2-4 and two-player are NOT covered
 *      — the walk this belongs to runs only while BOARD holds 1.
 *
 *      A replay is not one instruction's worth of work. The implementation under test is installed
 *      in the replaying machine's registry, so the whole remaining walk runs through it — including
 *      the frozen tail chain the routine jumps into and every later slot that chain reaches. That
 *      is also what MEASURES the dropped accumulator and flags: the rewrite hands the tail whatever
 *      it found on entry while the oracle hands it freshly computed values, so anything downstream
 *      that read either would diverge here.
 *
 *   2. EQUAL (crafted): A PRESCALER OF 0. Attract only ever delivers 1..4, so the byte wrap at the
 *      bottom — 0 steps to 255 and is NOT expiry — is invisible to every natural capture. The arm
 *      forces 0 on both sides of a REAL capture and is proved live by counting the dispatches on
 *      which forcing it changes what the ORACLE itself does. (Whether the ROM can ever deliver a 0
 *      is NOT claimed — this arm pins the comparison, not reachability.)
 *
 *   3. LIVE-OUT (measured). The rewrite drops the accumulator and every flag the oracle writes.
 *      Two independent measurements back that:
 *      - the unit replay compares the FULL state dump INCLUDING STACK_SCRATCH, plus pc, SP and the
 *        propagated return value. Those hold here rather than being excluded on principle: the
 *        routine's own body pushes and pops nothing (its exit is a jump) and the frozen tail chain
 *        performs the single `ret` on both sides, so the stack and both pointers legitimately agree
 *        and comparing them is free teeth.
 *      - the live arm wires the rewrite at 0x1FCE for a 3000-frame CYCLE-FREE attract run and diffs
 *        every frame against the all-oracle baseline. That baseline is the right control because
 *        this rewrite calls no idiomatic callee — its one exit is into a routine that is still the
 *        frozen oracle — so the only difference between the two runs is the routine under test. The
 *        arm COUNTS its own dispatches and asserts the count, so it cannot pass by never running.
 *
 *   4. TEETH — five broken twins, each of which the suite MUST catch:
 *      (a) zero treated as expiry (the byte wrap dropped). ESCAPES EVERY NATURAL CAPTURE and is
 *          caught only by crafted arm 2; both halves are asserted, which is the whole reason that
 *          arm exists.
 *      (b) the prescaler is stepped and reloaded but the tile code never flips — asserted to be
 *          caught ON the record's OBJ_SPRITE_CODE byte, not incidentally somewhere downstream.
 *      (c) the tile code's lowest bit is SET instead of flipped, so the animation never returns to
 *          the even tile of the pair.
 *      (d) the prescaler reloads to 3 instead of 4.
 *      (e) a spurious return value, whose RAM is byte-identical to the correct routine's, so ONLY
 *          the return half of the contract can catch it.
 *
 * CONTRACT. The full work/sprite/video state dump (STACK_SCRATCH included — see 3), plus pc, SP and
 * the propagated return value. The other registers are not compared: from the tail jump onward they
 * belong to that chain's contract, and this routine's own effect is entirely in the two record
 * bytes it writes.
 *
 * THE RETURN VALUE IS `undefined` ON EVERY REPLAYED DISPATCH — the walk's tail chain always ends at
 * the between-slots step's own fall-through. So the return comparison discriminates nothing on the
 * captured arms; twin (e) exists to prove that half of the contract is nonetheless wired.
 *
 * LIVE-OUT, DERIVED — cross-file, and therefore recorded here rather than in the routine. The
 * routine's only exit is a jump into ROM 0x21BA, so its whole continuation is that chain. ROM
 * 0x21BB overwrites the accumulator one instruction in, before anything reads it. The flags last a
 * little longer — ROM 0x21BF rewrites all but the carry, ROM 0x1F8E's index add rewrites the carry
 * — and the first conditional anywhere on the path is the walk's slot counter at ROM 0x1F90, which
 * reads a counter and not a flag. So neither is ever read, and both are dropped rather than
 * modelled; arm 3 above is the measurement that backs the derivation.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-1fce.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { Machine } from "../../machine.js";
import { loc_1fce as oracle } from "../../translated/loc_1fce.js";
import { advanceBarrelTileAnimation } from "../advanceBarrelTileAnimation.js";
import { OBJ_SPRITE_CODE, OBJ_ARRAY_67 } from "../names.js";
import { runCycleFree } from "../../../../core/frame-stepped.js";
import manifest from "../../manifest.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x1fce;
const PRESCALER = 0x0f; // the record's animation prescaler — no names.js name (see advanceBarrelTileAnimation.js)
const RELOAD = 4; // visits per animation step
const SLOT_STRIDE = 32; // OBJ_ARRAY_67 record stride
const SLOTS = 10; // records the walk visits
const ATTRACT_FRAMES = 3000;

// The prescaler values attract actually delivers, and the one it never does. 0 is the crafted value
// that separates "step the byte" from "count down to expiry".
const NATURAL_PRESCALERS = [1, 2, 3, 4];
const CRAFTED_PRESCALER = 0;
// The tile-code pairs attract animates between; each is written as its even member.
const NATURAL_TILE_PAIRS = [22, 26, 150];
// The record bases the walk reaches here, as slot indices into OBJ_ARRAY_67.
const NATURAL_SLOTS = [0, 1, 2, 3, 4, 5];

// Measured, and asserted rather than merely printed — a live arm that never dispatches the routine
// proves nothing while looking green. Attract is deterministic, so these are exact.
const CAPTURED_DISPATCHES = 604; // cycle-accurate runFrames, 3000 frames
const LIVE_DISPATCHES = 605; // cycle-free runCycleFree, 3000 frames (a different frame clock)

const hx = (v) => "0x" + (v & 0xffff).toString(16);

// -- the sweep: replay INLINE at every real dispatch ---------------------------

/**
 * Boot attract with a hook at 0x1FCE that, at EVERY real dispatch, clones the machine twice, runs
 * the oracle on one clone and `candidate` on the other, compares, and throws both away before
 * letting the host continue on the oracle. O(1) memory, and it replays every dispatch rather than
 * a sample.
 *
 * Each clone gets its OWN 0x1FCE installed in its registry, which is what stops the capture
 * recursing: a clone rebuilds its override map from the host's assets, so without this the walk's
 * loop-back would re-enter the capturing hook and clone again. It also means each replay drives the
 * whole remaining walk through the implementation under test, not just this one slot.
 *
 * `prep` is applied identically to both clones, which is how a crafted arm is built on a REAL
 * captured state rather than from scratch. The tallies and the values carried in a breach report
 * are the state AS CAPTURED, before `prep` — so on a crafted sweep a breach can report the
 * prescaler the ROM delivered while the replay actually ran on the crafted one.
 */
function sweepAttract(candidate, { prep = null, frames = ATTRACT_FRAMES } = {}) {
  let dispatches = 0;
  const breaches = [];
  const prescalers = new Map();
  const bases = new Map();
  const tiles = new Map();
  let firstFrame = null;
  // The invariant the role line rests on, derived from the ORACLE's own behaviour (never from the
  // candidate, which would make it circular): the tile code moves on exactly the dispatches whose
  // prescaler arrives at 1. Only later slots run after this record in a replay, so reading the byte
  // back off the oracle clone still reports this dispatch's effect.
  let flipOnlyOnExpiry = true;
  let oracleFlips = 0;
  // A crafted arm is worthless if it changes nothing; count the dispatches on which it moves the
  // ORACLE's own result, so non-vacuity is a measurement rather than an assumption.
  let prepChangedOracle = 0;

  const tally = (map, k) => map.set(k, (map.get(k) ?? 0) + 1);

  const host = new Machine(ROM, {
    overrides: new Map([[TARGET, (mm) => {
      dispatches++;
      if (firstFrame === null) firstFrame = mm.frames.length;
      const record = mm.regs.ix;
      const prescaler = mm.mem8[(record + PRESCALER) & 0xffff];
      const tile = mm.mem8[(record + OBJ_SPRITE_CODE) & 0xffff];
      tally(prescalers, prescaler);
      tally(bases, record);
      tally(tiles, tile);

      const a = mm.clone();
      a.routines.set(TARGET, oracle);
      const b = mm.clone();
      b.routines.set(TARGET, candidate);
      if (prep) { prep(a); prep(b); }

      let breach = null;
      let oracleValue, oracleDump;
      try {
        oracleValue = oracle(a);
        oracleDump = a.dumpState();
      } catch (err) {
        // The oracle faulting on a crafted state is a defect in the ARM, not in the candidate.
        throw new Error(`the oracle threw on dispatch #${dispatches}: ${err.message}`);
      }
      if (!prep) {
        const flipped = a.mem8[(record + OBJ_SPRITE_CODE) & 0xffff] !== tile;
        if (flipped) oracleFlips++;
        if (flipped !== (prescaler === 1)) flipOnlyOnExpiry = false;
      }

      let candidateValue;
      try {
        candidateValue = candidate(b);
        const candidateDump = b.dumpState();
        for (let i = 0; i < oracleDump.length; i++) {
          if (oracleDump[i] === candidateDump[i]) continue;
          breach = { kind: "RAM", addr: a.stateOffsetToAddr(i), a: oracleDump[i], b: candidateDump[i] };
          break;
        }
        if (!breach && a.pc !== b.pc) breach = { kind: "pc", addr: null, a: a.pc, b: b.pc };
        if (!breach && a.regs.sp !== b.regs.sp) breach = { kind: "SP", addr: null, a: a.regs.sp, b: b.regs.sp };
        if (!breach && oracleValue !== candidateValue) {
          breach = { kind: "return", addr: null, a: String(oracleValue), b: String(candidateValue) };
        }
      } catch (err) {
        // A twin handed a record it should never have accepted can walk a ROM table off its end and
        // THROW rather than diverge. A fault is a result, so record it as the breach.
        breach = { kind: "threw", addr: null, a: "-", b: err.message };
      }

      if (prep) {
        // Same entry, same oracle, WITHOUT the craft: if the result is identical the craft did
        // nothing on this dispatch.
        const plain = mm.clone();
        plain.routines.set(TARGET, oracle);
        oracle(plain);
        const p = plain.dumpState();
        for (let i = 0; i < p.length; i++) if (p[i] !== oracleDump[i]) { prepChangedOracle++; break; }
      }

      if (breach) {
        breaches.push({ dispatch: dispatches, prescaler, base: record, tile, ...breach });
      }
      return oracle(mm); // the HOST always runs the oracle, so attract proceeds normally
    }]]),
  });
  host.runFrames(frames);

  return { dispatches, breaches, prescalers, bases, tiles, firstFrame, flipOnlyOnExpiry, oracleFlips, prepChangedOracle };
}

const describe = (b) =>
  `dispatch #${b.dispatch} (prescaler=${b.prescaler} base=${hx(b.base)} tile=${b.tile}): ` +
  `${b.kind}${b.addr === null ? "" : "@" + hx(b.addr)} oracle=${b.a} cand=${b.b}`;

// The one sweep the first tests share. Node's test runner evaluates the module top to bottom, so
// this runs once at load rather than once per test.
const NATURAL = ROM_PRESENT ? sweepAttract(advanceBarrelTileAnimation) : null;

// -- 1. EQUAL, on every real attract dispatch ----------------------------------

test("EQUAL: advanceBarrelTileAnimation matches the oracle on every one of the real attract dispatches", () => {
  assert.ok(NATURAL.dispatches > 0, "no dispatch of 0x1FCE was captured — the harness never engaged");
  assert.equal(
    NATURAL.dispatches,
    CAPTURED_DISPATCHES,
    `attract dispatched 0x1FCE ${NATURAL.dispatches} times, not the ${CAPTURED_DISPATCHES} this gate claims`,
  );
  assert.equal(
    NATURAL.breaches.length,
    0,
    NATURAL.breaches.length ? `${NATURAL.breaches.length} breach(es), first: ${describe(NATURAL.breaches[0])}` : "",
  );

  // Coverage the walk must show if the capture is honest.
  for (const p of NATURAL_PRESCALERS) {
    assert.ok(NATURAL.prescalers.has(p), `no captured dispatch with the prescaler arriving at ${p}`);
  }
  assert.deepEqual(
    [...NATURAL.prescalers.keys()].sort((x, y) => x - y),
    NATURAL_PRESCALERS,
    "attract delivered a prescaler outside 1..4 — the header's claim and the crafted arm's premise are stale",
  );
  for (const slot of NATURAL_SLOTS) {
    assert.ok(NATURAL.bases.has(OBJ_ARRAY_67 + slot * SLOT_STRIDE),
      `no captured dispatch on the OBJ_ARRAY_67 record at slot ${slot}`);
  }
  for (const base of NATURAL.bases.keys()) {
    const slot = (base - OBJ_ARRAY_67) / SLOT_STRIDE;
    assert.ok(Number.isInteger(slot) && slot >= 0 && slot < SLOTS,
      `a captured dispatch used a record base ${hx(base)} that is not an OBJ_ARRAY_67 slot`);
  }
  // Both tiles of each pair must be seen arriving, or "flip" would be indistinguishable from "set".
  for (const even of NATURAL_TILE_PAIRS) {
    assert.ok(NATURAL.tiles.has(even), `no captured dispatch arrived with tile code ${even}`);
    assert.ok(NATURAL.tiles.has(even + 1), `no captured dispatch arrived with tile code ${even + 1}`);
  }
  assert.deepEqual(
    [...NATURAL.tiles.keys()].sort((x, y) => x - y),
    NATURAL_TILE_PAIRS.flatMap((e) => [e, e + 1]).sort((x, y) => x - y),
    "attract animated a tile code outside the three pairs this gate claims",
  );
  // The invariant the role line rests on, produced here rather than asserted in prose.
  assert.ok(NATURAL.flipOnlyOnExpiry,
    "the oracle changed the tile code on a dispatch whose prescaler did not arrive at 1, or left it " +
      "unchanged on one that did — the routine's role line is wrong");
  assert.equal(NATURAL.oracleFlips, NATURAL.prescalers.get(1),
    "the number of tile-code changes does not match the number of expiring dispatches");

  const byPrescaler = [...NATURAL.prescalers].sort((p, q) => p[0] - q[0]).map(([v, n]) => `${v}x${n}`).join(" ");
  console.log(
    `  EQUAL: all ${NATURAL.dispatches} real 0x1FCE dispatches in ${ATTRACT_FRAMES} attract frames replayed inline ` +
      `(first at frame ${NATURAL.firstFrame}); prescalers ${byPrescaler}; ${NATURAL.bases.size} record bases; ` +
      `tile codes ${[...NATURAL.tiles.keys()].sort((x, y) => x - y).join(",")}; ` +
      `${NATURAL.oracleFlips} tile changes, all on an arriving prescaler of 1; ` +
      "full state dump INCLUDING STACK_SCRATCH, plus pc, SP and the return value",
  );
});

// -- 2. EQUAL (crafted): the byte wrap attract never reaches --------------------

/** Real capture, one surgical poke: the prescaler arrives at 0, so stepping it wraps to 255. */
const craftPrescalerZero = (m) => { m.mem8[(m.regs.ix + PRESCALER) & 0xffff] = CRAFTED_PRESCALER; };

const CRAFTED = ROM_PRESENT ? sweepAttract(advanceBarrelTileAnimation, { prep: craftPrescalerZero }) : null;

test("EQUAL (crafted): a prescaler of 0 — a value attract never delivers — matches the oracle", () => {
  assert.ok(CRAFTED.prepChangedOracle > 0,
    "forcing the prescaler to 0 changed nothing the oracle does on any dispatch — the arm would be vacuous");
  assert.equal(CRAFTED.breaches.length, 0,
    CRAFTED.breaches.length ? `${CRAFTED.breaches.length} breach(es), first: ${describe(CRAFTED.breaches[0])}` : "");
  console.log(
    `  EQUAL/crafted prescaler=0: ${CRAFTED.dispatches} dispatches replayed with the prescaler forced to 0 ` +
      `(attract delivers only ${NATURAL_PRESCALERS.join(",")}); the craft moves the oracle's own result on ` +
      `${CRAFTED.prepChangedOracle} of them`,
  );
});

// -- 3. TEETH ------------------------------------------------------------------

/** (a) drops the byte wrap: a prescaler of 0 is treated as expiry instead of stepping to 255. */
function brokenZeroIsExpiry(m) {
  const { mem8 } = m;
  const record = m.regs.ix;
  let remaining = mem8[record + PRESCALER] - 1;
  if (remaining <= 0) {
    mem8[record + OBJ_SPRITE_CODE] = mem8[record + OBJ_SPRITE_CODE] ^ 1;
    remaining = RELOAD;
  }
  mem8[record + PRESCALER] = remaining;
  return m.call(0x21ba);
}

/** (b) steps and reloads the prescaler correctly, but never changes the tile. */
function brokenNoFlip(m) {
  const { mem8 } = m;
  const record = m.regs.ix;
  let remaining = (mem8[record + PRESCALER] - 1) & 0xff;
  if (remaining === 0) remaining = RELOAD;
  mem8[record + PRESCALER] = remaining;
  return m.call(0x21ba);
}

/** (c) SETS the tile code's lowest bit instead of flipping it — the animation sticks on one tile. */
function brokenSetTileBit(m) {
  const { mem8 } = m;
  const record = m.regs.ix;
  let remaining = (mem8[record + PRESCALER] - 1) & 0xff;
  if (remaining === 0) {
    mem8[record + OBJ_SPRITE_CODE] = mem8[record + OBJ_SPRITE_CODE] | 1;
    remaining = RELOAD;
  }
  mem8[record + PRESCALER] = remaining;
  return m.call(0x21ba);
}

/** (d) reloads the prescaler to 3, so the animation runs a quarter faster. */
function brokenReloadThree(m) {
  const { mem8 } = m;
  const record = m.regs.ix;
  let remaining = (mem8[record + PRESCALER] - 1) & 0xff;
  if (remaining === 0) {
    mem8[record + OBJ_SPRITE_CODE] = mem8[record + OBJ_SPRITE_CODE] ^ 1;
    remaining = 3;
  }
  mem8[record + PRESCALER] = remaining;
  return m.call(0x21ba);
}

/** (e) correct in RAM, wrong at the boundary: hands its caller a value it never had. */
function brokenSpuriousReturn(m) {
  advanceBarrelTileAnimation(m);
  return false;
}

test("TEETH: the twins a natural capture must catch are caught", () => {
  const report = [];
  for (const [name, twin] of [
    ["no tile flip", brokenNoFlip],
    ["tile bit set not flipped", brokenSetTileBit],
    ["prescaler reloads to 3", brokenReloadThree],
    ["spurious return value", brokenSpuriousReturn],
  ]) {
    const s = sweepAttract(twin);
    assert.ok(s.breaches.length > 0,
      `the "${name}" twin escaped all ${s.dispatches} natural captures — the gate is worthless`);
    report.push(`${name} ${s.breaches.length}/${s.dispatches} (${s.breaches[0].kind})`);

    if (twin === brokenNoFlip) {
      // It must be caught ON the tile code, not incidentally on something the walk stages later.
      const { base, addr } = s.breaches[0];
      assert.equal(addr, base + OBJ_SPRITE_CODE,
        `the no-flip twin was caught at ${hx(addr ?? 0)}, not on the record's tile code ${hx(base + OBJ_SPRITE_CODE)}`);
    }
    if (twin === brokenSpuriousReturn) {
      // It must be caught by the RETURN half of the contract and by nothing else — that is what
      // proves the return comparison is wired rather than decorative.
      assert.equal(s.breaches.length, s.dispatches, "the spurious return must be caught on every dispatch");
      assert.equal(s.breaches[0].kind, "return",
        `the spurious-return twin must be caught by the return comparison, not by ${s.breaches[0].kind}`);
    }
  }
  console.log(`  TEETH/natural: ${report.join("; ")}`);
});

test("TEETH: the dropped-byte-wrap twin ESCAPES every natural capture and is caught only by the crafted 0", () => {
  const natural = sweepAttract(brokenZeroIsExpiry);
  assert.equal(natural.breaches.length, 0,
    `the zero-is-expiry twin was expected to escape every natural capture (attract's prescalers are ` +
      `${NATURAL_PRESCALERS.join(",")}), but ${natural.breaches.length} of ${natural.dispatches} caught it — ` +
      "the crafted arm's premise is wrong");
  const crafted = sweepAttract(brokenZeroIsExpiry, { prep: craftPrescalerZero });
  assert.ok(crafted.breaches.length > 0,
    "the crafted prescaler=0 arm failed to catch the zero-is-expiry twin — that arm exists for exactly this");
  console.log(
    `  TEETH/dropped byte wrap: 0/${natural.dispatches} natural, ${crafted.breaches.length}/${crafted.dispatches} ` +
      `crafted (${describe(crafted.breaches[0])})`,
  );
});

// -- 4. LIVE-OUT: wired live for a whole attract run ---------------------------

/**
 * Drive a whole attract run CYCLE-FREE — the frame boundary is the main loop's vblank poll, not a
 * T-state count — and sample every frame. Both sides use the same vehicle, so a cycle-free rewrite
 * shifts no interrupt and there is no cycle cost to restore.
 */
function runFramesCycleFree(overrides) {
  const m = new Machine(ROM, overrides ? { overrides } : {});
  const frames = [];
  const result = runCycleFree(m, {
    pollPCs: manifest.convergence.pollPCs,
    maxFrames: ATTRACT_FRAMES,
    stepBudget: ATTRACT_FRAMES * 200000,
    onFrame: (mm) => frames.push(Buffer.from(mm.dumpState())),
  });
  return { m, frames, result };
}

test("LIVE-OUT: wired live for a whole attract run, the rewrite leaves the same trace as the oracle", () => {
  const baseline = runFramesCycleFree(null);
  let dispatches = 0;
  const live = runFramesCycleFree(new Map([[TARGET, (m) => { dispatches++; return advanceBarrelTileAnimation(m); }]]));

  // Without this the run can be byte-identical because the routine never executed. Measured on a
  // sibling routine: 800 frames of attract went green against a deliberately broken rewrite whose
  // first dispatch is at frame 1163.
  assert.ok(dispatches > 0, "0x1FCE was never dispatched in the live run — the arm proves nothing");
  assert.equal(dispatches, LIVE_DISPATCHES,
    `the live run dispatched 0x1FCE ${dispatches} times, not the ${LIVE_DISPATCHES} this gate claims`);

  assert.equal(baseline.result.stop, "reached maxFrames", `baseline stopped early: ${baseline.result.stop}`);
  assert.equal(live.result.stop, "reached maxFrames", `live run stopped early: ${live.result.stop}`);
  assert.equal(live.frames.length, baseline.frames.length, "the two runs did not reach the same frame count");

  for (let f = 0; f < baseline.frames.length; f++) {
    const a = baseline.frames[f];
    const b = live.frames[f];
    for (let i = 0; i < a.length; i++) {
      if (a[i] === b[i]) continue;
      assert.fail(`frame ${f}: ${hx(baseline.m.stateOffsetToAddr(i))} baseline=${a[i]} live=${b[i]}`);
    }
  }
  console.log(
    `  LIVE-OUT: ${baseline.frames.length} sampled frames (power-on + ${ATTRACT_FRAMES}) byte-identical ` +
      `cycle-free with 0x1FCE wired live (${dispatches} dispatches) — the accumulator and flags the ` +
      "rewrite drops are read back by nobody attract reaches",
  );
});
