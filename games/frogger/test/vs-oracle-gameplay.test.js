// SPDX-License-Identifier: GPL-3.0-only
//
// Frogger idiomatic-vs-oracle GAMEPLAY equivalence (the arm idiomatic.test.js lists as a TODO): the whole
// idiomatic layer, wired live, must reproduce the pure-translated oracle DURING GAMEPLAY (coin -> start ->
// hop), not just attract. Both engines index ONE input tape by ordinal and sample PRE-NMI, but the
// cycle-free boot reaches the main loop in fewer yields than the cycle-driven boot, so the idiomatic run is
// a CONSTANT ~50 ordinals ahead -- a phase offset, not a divergence. So (per docs/integration-testing.md
// "nearest golden frame") measure the aligning shift at a settled post-hop landmark, then assert the RAMs
// byte-identical across a window there, masking only the dead stack scratch [0x87e0,0x8800) and the
// free-running attract clock. A real regression diverges at EVERY offset. SKIP-guarded on the BYO ROM.

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { Machine, resolveAllIdiomatic } from "../machine.js";
import { buildRoutines } from "../routines.js";
import { runIdiomaticGame } from "../../../core/frame-stepped.js";
import { FROG_Y, GAME_MODE, PLAY_FLAG, ATTRACT_FRAME_TIMER, ATTRACT_FRAME_INDEX } from "../idiomatic/names.js";
import manifest from "../manifest.js";

const ROM_URL = new URL("../rom/maincpu.bin", import.meta.url);
const GFX_URL = new URL("../rom/gfx.bin", import.meta.url);
const PROMS_URL = new URL("../rom/proms.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_URL);
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "ROM absent at games/frogger/rom/maincpu.bin (BYO)" }, fn);

// The gameplay tape (PRESSED-BIT form; io folds the active-low polarity): coin -> 1P start -> one UP hop,
// bits from manifest.inputs.actions. Bounded length keeps the oracle's deep m.call nesting within the JS stack.
const COIN = 0xe000, START = 0xe002, IN2 = 0xe004;
const TAPE = [
  { frame: 150, port: COIN, bits: 0x80, dur: 6 },
  { frame: 230, port: START, bits: 0x80, dur: 6 },
  { frame: 340, port: IN2, bits: 0x10, dur: 6 }, // a single UP edge: one hop up a row
];
const FRAMES = 460;

// Landmark frog rows (FROG_Y/GAME_MODE/PLAY_FLAG are imported from names.js).
const FROG_IDLE_Y = 0xe0;   // frog settled at road start
const FROG_HOPPED_Y = 0xd0; // one row up: a hop registered

// --- dumpState offset math (boards/frogger/memory.js: work | video | obj, concatenated) -----------
const WORK_BASE = 0x8000, WORK_SIZE = 0x0800;
const VIDEO_BASE = 0xa800, VIDEO_SIZE = 0x0400;
const OBJ_BASE = 0xb000;
function addrToOff(a) {
  if (a >= WORK_BASE && a < WORK_BASE + WORK_SIZE) return a - WORK_BASE;
  if (a >= VIDEO_BASE && a < VIDEO_BASE + VIDEO_SIZE) return WORK_SIZE + (a - VIDEO_BASE);
  return WORK_SIZE + VIDEO_SIZE + (a - OBJ_BASE);
}
function offToAddr(o) {
  if (o < WORK_SIZE) return WORK_BASE + o;
  o -= WORK_SIZE;
  if (o < VIDEO_SIZE) return VIDEO_BASE + o;
  return OBJ_BASE + (o - VIDEO_SIZE);
}
// Masked offsets: dead Z80 stack scratch + the free-running attract-cell frame clock (see header).
const MASK = new Set();
for (let a = 0x87e0; a < 0x8800; a++) MASK.add(addrToOff(a)); // manifest.convergence.stateExclude.stack
MASK.add(addrToOff(ATTRACT_FRAME_TIMER)); // free-running attract clock, carries the boot phase
MASK.add(addrToOff(ATTRACT_FRAME_INDEX));

const OFF_PLAY = addrToOff(PLAY_FLAG), OFF_GM = addrToOff(GAME_MODE), OFF_FY = addrToOff(FROG_Y);

// Reconverge search: the idiomatic run is AHEAD, so the aligning shift is negative; the window brackets
// the ~-50 boot offset with margin. A minimum on an edge means the true offset is outside -> we flag it.
const SHIFT_LO = -70, SHIFT_HI = 5;
const WINDOW = 20; // ordinals of sustained byte-equality asserted at the measured offset

// --- run the two engines from reset on the same tape ---------------------------------------------
function loadRom(url) { return new Uint8Array(readFileSync(url)); }

function runOracle() {
  const rom = loadRom(ROM_URL);
  const opts = { gfx: loadRom(GFX_URL), proms: loadRom(PROMS_URL) };
  const m = new Machine(rom, buildRoutines(), opts);
  m.inputTape = TAPE;
  m.runFrames(FRAMES); // frames[N] = pre-NMI snapshot at ordinal N (frames[0] = power-on)
  return { frames: m.frames, stoppedBy: m.stoppedBy };
}

async function runIdiomatic() {
  const rom = loadRom(ROM_URL);
  const opts = { gfx: loadRom(GFX_URL), proms: loadRom(PROMS_URL), overrides: await resolveAllIdiomatic() };
  const m = await Machine.create(rom, opts);
  m.inputTape = TAPE;
  const snaps = new Map();
  const result = runIdiomaticGame(m, {
    nmiReturnPC: manifest.convergence.idiomatic.nmiReturnPC,
    maxFrames: FRAMES,
    // onFrame fires PRE-NMI at each vblank yield (and at ordinal 0 power-on); apply the tape at this
    // ordinal, same as the oracle's applyInputs(frames.length), then snapshot.
    onFrame: (mm, f) => { mm.applyInputs(f); snaps.set(f, mm.mem.dumpState()); },
  });
  return { snaps, result };
}

function maskedDiffCount(a, b) {
  let n = 0;
  for (let o = 0; o < a.length; o++) { if (MASK.has(o)) continue; if (a[o] !== b[o]) n++; }
  return n;
}
function firstMaskedDiffAddr(a, b) {
  for (let o = 0; o < a.length; o++) { if (MASK.has(o)) continue; if (a[o] !== b[o]) return offToAddr(o); }
  return null;
}
// Did an engine reach in-play AND register a hop? (idle 0xe0 seen, then 0xd0, with PLAY set) — the
// non-vacuity witness: a run that never started or never moved the frog is a worthless "pass".
function reachedGameplay(get, hi) {
  let play = false, idle = false, hopped = false;
  for (let n = 0; n <= hi; n++) {
    const s = get(n);
    if (!s) continue;
    if (s[OFF_PLAY] !== 0) play = true;
    if (s[OFF_FY] === FROG_IDLE_Y) idle = true;
    if (idle && s[OFF_FY] === FROG_HOPPED_Y) hopped = true;
  }
  return { play, idle, hopped };
}

test("gameplay tape reaches in-play and moves the frog on BOTH engines (non-vacuity control)", async () => {
  const oracle = runOracle();
  const idio = await runIdiomatic();

  // A translation gap or a JS crash during the run invalidates the comparison — surface it, don't pass.
  assert.equal(oracle.stoppedBy, null, `oracle stopped mid-run: ${oracle.stoppedBy}`);
  assert.equal(idio.result.stopError, null, `idiomatic run threw: ${idio.result.stopError}`);

  const o = reachedGameplay((n) => oracle.frames[n], FRAMES);
  const i = reachedGameplay((n) => idio.snaps.get(n), FRAMES);
  assert.ok(o.play && o.idle && o.hopped, `oracle never reached in-play+hop: ${JSON.stringify(o)}`);
  assert.ok(i.play && i.idle && i.hopped, `idiomatic never reached in-play+hop: ${JSON.stringify(i)}`);
});

test("idiomatic gameplay RAM == oracle RAM at a reconverged landmark (stack + attract-clock masked)", async () => {
  const oracle = runOracle();
  const idio = await runIdiomatic();
  assert.equal(oracle.stoppedBy, null, `oracle stopped mid-run: ${oracle.stoppedBy}`);
  assert.equal(idio.result.stopError, null, `idiomatic run threw: ${idio.result.stopError}`);

  // Settled post-hop landmark on the oracle: the last sampled ordinal, where FROG_Y is a static 0xd0.
  const L = FRAMES - 1;
  assert.equal(oracle.frames[L][OFF_FY], FROG_HOPPED_Y, "oracle landmark frog is not at the hopped row");
  assert.equal(oracle.frames[L][OFF_PLAY] !== 0, true, "oracle landmark is not in-play");

  // Measure the aligning shift (nearest-frame reconverge): minimise the masked diff over the window.
  let best = Infinity, bestShift = 0;
  for (let k = SHIFT_LO; k <= SHIFT_HI; k++) {
    const i = idio.snaps.get(L + k);
    if (!i) continue;
    const d = maskedDiffCount(oracle.frames[L], i);
    if (d < best) { best = d; bestShift = k; }
  }
  const aligned = idio.snaps.get(L + bestShift);

  // The reconverge must land on the SAME gameplay state, or a low diff is a coincidence, not equivalence.
  assert.ok(aligned, `no idiomatic frame at the aligning shift ${bestShift}`);
  assert.equal(aligned[OFF_FY], FROG_HOPPED_Y, `reconverge aligned on a non-matching frog row (shift ${bestShift})`);
  assert.equal(aligned[OFF_PLAY] !== 0, true, "reconverge aligned on a non-in-play frame");
  assert.ok(bestShift > SHIFT_LO && bestShift < SHIFT_HI,
    `aligning shift ${bestShift} hit the search-window edge; the true offset is outside [${SHIFT_LO},${SHIFT_HI}]`);

  // The equivalence claim: byte-for-byte, everywhere except the masked cells.
  const firstAddr = firstMaskedDiffAddr(oracle.frames[L], aligned);
  assert.equal(best, 0,
    `idiomatic diverges from the oracle in gameplay: ${best} unmasked byte(s) differ at the landmark ` +
      `(shift ${bestShift}); FIRST diverging address 0x${(firstAddr ?? 0).toString(16)} ` +
      `oracle=0x${oracle.frames[L][addrToOff(firstAddr ?? 0x8000)].toString(16)} ` +
      `idio=0x${aligned[addrToOff(firstAddr ?? 0x8000)].toString(16)}`);

  // Teeth: not a lucky single-frame match — byte-equality must HOLD across a window at the fixed offset.
  for (let n = L - WINDOW; n <= L; n++) {
    const i = idio.snaps.get(n + bestShift);
    if (!i) continue;
    const d = maskedDiffCount(oracle.frames[n], i);
    if (d !== 0) {
      const a = firstMaskedDiffAddr(oracle.frames[n], i);
      assert.fail(`byte-equality breaks at oracle ordinal ${n} (shift ${bestShift}): ${d} byte(s) differ, ` +
        `first at 0x${(a ?? 0).toString(16)}`);
    }
  }
});
