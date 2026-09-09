// SPDX-License-Identifier: GPL-3.0-only
// Whole-machine convergence for centiped (--mode state | pixel): the cycle-driven oracle vs a MAME golden,
// entropy-matched by REPLAYING MAME's exact $100a POKEY-RANDOM stream (captured observe-only) so RNG cannot
// fork the two, then compared with the drift-tolerant reconverge rule (each frame vs its nearest golden frame
// within ±W, since the oracle snapshots a sub-frame instant off MAME's notifier). state mode diffs RAM; pixel
// mode diffs the rendered frame vs the golden AVI. PASS requires: RNG read-count in sync (the oracle consumes
// $100a bit-for-bit like MAME — a control-flow tooth), full frame count + clean stop, the drift residual under
// a floor calibrated ABOVE the measured correct residual and BELOW a bug, distinct frames, and a baked-in
// NULL-MUTANT that MUST fail (a gate that cannot fail is decoration).
//
//   node games/centiped/tools/convergence.mjs [--mode state|pixel] [--golden DIR] [--seconds N] [--drift W]
//   state captures its own golden (or --golden); pixel REQUIRES --golden (frames.rgb+rng.bin from pixel_suite.py).
//   exit 0 = PASS (prints "centiped_convergence: PASS"), 1 = FAIL, 2 = setup/IO error.
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Machine, resolveAllIdiomatic } from "../machine.js";
import { runIdiomaticIrqGame } from "../../../core/frame-stepped.js";
import { STACK_SCRATCH } from "../idiomatic/names.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const STACK_LO = STACK_SCRATCH.lo, STACK_HI = STACK_SCRATCH.hi; // the guest return-stack window (page-1
// tail): the idiomatic engine's stack ops land here and are excluded from the diff, exactly as the eq tests
// do. It is the ONLY region excluded -- real state elsewhere in page 1 (high scores, trackball) is diffed.
const IRQ_VBLANK = [0, 0, 0, 1]; // per-slot io.vblank for the four 32V IRQs; only scanline 240 is in vblank
const GAME = dirname(HERE);
const REPO = dirname(dirname(GAME));
const FRAME = 2048;
const FPX = 256 * 240 * 3; // one rendered RGB frame

function parseArgs(argv) {
  const a = { seconds: 120, drift: 2, mode: "state", layer: "oracle", rompath: join(process.env.HOME || "", "Downloads"),
    mame: "/opt/homebrew/bin/mame", set: "centiped3", golden: null,
    tAvg: 70, tMax: 130, pxAvg: 0.15, pxMax: 0.30, minDistinct: 100 };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === "--seconds") a.seconds = parseInt(argv[++i], 10);
    else if (k === "--drift") a.drift = parseInt(argv[++i], 10);
    else if (k === "--mode") a.mode = argv[++i];
    else if (k === "--layer") a.layer = argv[++i]; // "oracle" (translated, cycle-driven) | "idiomatic" (clock-free)
    else if (k === "--rompath") a.rompath = argv[++i];
    else if (k === "--mame") a.mame = argv[++i];
    else if (k === "--set") a.set = argv[++i];
    else if (k === "--golden") a.golden = argv[++i];
    else if (k === "--t-avg") a.tAvg = parseFloat(argv[++i]);
    else if (k === "--t-max") a.tMax = parseFloat(argv[++i]);
    else if (k === "--px-avg") a.pxAvg = parseFloat(argv[++i]);
    else if (k === "--px-max") a.pxMax = parseFloat(argv[++i]);
  }
  return a;
}

function fail(msg) { console.log(`centiped_convergence: FAIL -- ${msg}`); process.exit(1); }
function ioerr(msg) { console.error(`convergence: ${msg}`); process.exit(2); }

// Capture a fresh MAME golden (state + RNG stream) into `dir`, or reuse an existing one.
function captureGolden(opts) {
  const dir = opts.golden || join(HERE, `.golden-${opts.seconds}s`);
  const stateOut = join(dir, "state.bin");
  const rngOut = join(dir, "rng.bin");
  if (opts.golden && existsSync(stateOut) && existsSync(rngOut)) return { dir, stateOut, rngOut };
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const lua = join(HERE, "lua", "dump_state_rng.lua");
  try {
    execFileSync(opts.mame, [opts.set, "-rompath", opts.rompath, "-norotate", "-video", "none",
      "-sound", "none", "-nothrottle", "-frameskip", "0", "-nonvram_save", "-nocheat", "-noautosave",
      "-seconds_to_run", String(opts.seconds), "-autoboot_script", lua, "-autoboot_delay", "0"],
      { env: { ...process.env, STATE_OUT: stateOut, RNG_OUT: rngOut }, stdio: "ignore", timeout: 300000 });
  } catch (e) { ioerr(`MAME capture failed (rompath ${opts.rompath}, set ${opts.set}): ${e.message}`); }
  return { dir, stateOut, rngOut };
}

// Run the oracle replaying `rng`; return sampled frames + how many RNG values it consumed / over-consumed.
function runOracle(rom, gfx1, rng, frames, mutate) {
  const m = new Machine(rom, { gfx1 });
  let ri = 0, over = 0;
  const orig = m.io.pokeyRandom.bind(m.io);
  m.io.pokeyRandom = (c) => { if (ri < rng.length) return rng[ri++]; over++; return orig(c); };
  if (mutate) { const w = m.mem.write8.bind(m.mem); m.mem.write8 = (a, v) => w(a, (a & 0xffff) === 0x0056 ? (v + 3) & 0xff : v); }
  const out = m.runFrames(frames);
  return { out, ri, over, stoppedBy: m.stoppedBy };
}

function diff(a, b) { let n = 0; for (let i = 0; i < FRAME; i++) if (a[i] !== b[i]) n++; return n; }
function diffNoStack(a, b) { let n = 0; for (let i = 0; i < FRAME; i++) { if (i >= STACK_LO && i < STACK_HI) continue; if (a[i] !== b[i]) n++; } return n; }

// Run the IDIOMATIC layer on the clock-free coroutine engine (runIdiomaticIrqGame), replaying `rng`. Same
// teeth as runOracle (RNG count, clean stop, distinct frames, mutant); the stack page is excluded downstream.
async function runIdiomatic(rom, gfx1, rng, frames, mutate) {
  const overrides = await resolveAllIdiomatic();
  const m = new Machine(rom, { gfx1, overrides });
  m.booted = true;
  let ri = 0, over = 0;
  const orig = m.io.pokeyRandom.bind(m.io);
  m.io.pokeyRandom = (c) => { if (ri < rng.length) return rng[ri++]; over++; return orig(c); };
  if (mutate) { const w = m.mem.write8.bind(m.mem); m.mem.write8 = (a, v) => w(a, (a & 0xffff) === 0x0056 ? (v + 3) & 0xff : v); }
  const out = [];
  const res = runIdiomaticIrqGame(m, { bootAddr: 0x3b04, irqVblank: IRQ_VBLANK, maxFrames: frames, onFrame: (mm) => out.push(mm.mem.dumpState()) });
  return { out, ri, over, stoppedBy: res.stopError || null };
}

// Drift-tolerant score: each oracle frame vs its nearest golden frame within ±W (byte diff for state, %px
// for pixel). `cmp` maps two Uint8Arrays to a scalar distance; `gframe` yields golden frame i.
function drift(out, gframe, gN, W, cmp) {
  let s = 0, c = 0, mx = 0;
  for (let k = W + 2; k < out.length - W - 2 && k < gN - W; k++) {
    if (!out[k]) continue;
    let best = Infinity;
    for (let o = -W; o <= W; o++) { const d = cmp(out[k], gframe(k + o)); if (d < best) best = d; }
    s += best; c++; if (best > mx) mx = best;
  }
  return { avg: s / c, max: mx };
}
const score = (out, gframe, gN, W) => drift(out, gframe, gN, W, diff);

function pxDiff(a, b) { let n = 0; for (let i = 0; i < FPX; i++) if (a[i] !== b[i]) n++; return (100 * n) / FPX; }

// Render the oracle replaying `rng`, capturing renderFrame() at each frame boundary (dumpState fires once per
// boundary in tick()). Returns the rendered frames + RNG consumption + stop reason (same teeth as runOracle).
function renderOracle(rom, gfx1, rng, frames, mutate) {
  const m = new Machine(rom, { gfx1 });
  let ri = 0, over = 0;
  const orig = m.io.pokeyRandom.bind(m.io);
  m.io.pokeyRandom = (c) => { if (ri < rng.length) return rng[ri++]; over++; return orig(c); };
  if (mutate) { const w = m.mem.write8.bind(m.mem); m.mem.write8 = (a, v) => w(a, (a & 0xffff) === 0x0056 ? (v + 3) & 0xff : v); }
  const rendered = [];
  const origDump = m.mem.dumpState.bind(m.mem);
  m.mem.dumpState = () => { try { rendered.push(m.renderFrame()); } catch { rendered.push(null); } return origDump(); };
  m.runFrames(frames);
  return { rendered, ri, over, stoppedBy: m.stoppedBy };
}

// --mode pixel: diff the RNG-replayed oracle's RENDERED frame vs the golden AVI (frames.rgb, from pixel_suite.py).
function pixelMain(opts, rom, gfx1) {
  if (!opts.golden) ioerr("--mode pixel requires --golden DIR (frames.rgb + rng.bin from pixel_suite.py)");
  const framesP = join(opts.golden, "frames.rgb"), rngP = join(opts.golden, "rng.bin");
  if (!existsSync(framesP) || !existsSync(rngP)) ioerr(`--golden ${opts.golden} is missing frames.rgb or rng.bin`);
  const gpxBuf = readFileSync(framesP), rng = readFileSync(rngP);
  const gN = Math.floor(gpxBuf.length / FPX);
  const gpx = (i) => gpxBuf.subarray(i * FPX, (i + 1) * FPX);
  if (gN < opts.minDistinct * 2) ioerr(`golden too short: ${gN} frames`);
  // Frozen-screen guard: rendered attract is far less distinct than RAM (static title/score screens), so the
  // pixel floor is lower than state's -- it only needs to prove the screen is NOT frozen (a frozen golden = 1).
  const pxMin = 12;
  // distinctness: strided sample across the WHOLE frame (the top rows are static border in attract).
  const psig = (f) => { let s = ""; for (let i = 0; i < FPX; i += 499) s += f[i] + ","; return s; };
  const gsigs = new Set(); for (let k = 0; k < gN; k += 7) gsigs.add(psig(gpx(k)));
  if (gsigs.size < pxMin) fail(`golden has only ${gsigs.size} distinct rendered frames (frozen?)`);

  const frames = gN - 1;
  const good = renderOracle(rom, gfx1, rng, frames, false);
  if (good.stoppedBy) fail(`oracle did not run clean to budget: stoppedBy=${good.stoppedBy.message || good.stoppedBy} -- a gap or crash`);
  if (good.over > 0) fail(`RNG OVER-READ: oracle ${good.ri + good.over}x vs MAME ${rng.length}x -- diverged`);
  if (good.ri !== rng.length) fail(`RNG UNDER-READ: oracle ${good.ri}x vs MAME ${rng.length}x -- truncated/diverged`);
  if (good.rendered.length < frames) fail(`oracle rendered ${good.rendered.length}/${frames} frames -- truncated`);
  const gs = drift(good.rendered, gpx, gN, opts.drift, pxDiff);

  const osigs = new Set(); for (let k = 1; k < good.rendered.length; k += 7) if (good.rendered[k]) osigs.add(psig(good.rendered[k]));
  if (osigs.size < pxMin) fail(`oracle rendered only ${osigs.size} distinct frames (froze/crashed)`);

  const bad = renderOracle(rom, gfx1, rng, frames, true);
  const bs = drift(bad.rendered, gpx, gN, opts.drift, pxDiff);
  const mutantCaught = bs.avg >= opts.pxAvg || bad.over > 0;

  console.log(`  golden ${gN} frames, ${gsigs.size} distinct; RNG reads oracle ${good.ri} / MAME ${rng.length}; rendered ${good.rendered.length}/${frames}.`);
  console.log(`  correct: avg=${gs.avg.toFixed(3)}% max=${gs.max.toFixed(3)}%   null-mutant: avg=${bs.avg.toFixed(3)}% max=${bs.max.toFixed(3)}%`);
  console.log(`  thresholds: avg<${opts.pxAvg}% max<${opts.pxMax}%`);
  if (!mutantCaught) fail(`NULL-MUTANT NOT CAUGHT (avg ${bs.avg.toFixed(3)}% < ${opts.pxAvg}%) -- the gate has no teeth`);
  if (gs.avg >= opts.pxAvg) fail(`pixel residual avg ${gs.avg.toFixed(3)}% >= ${opts.pxAvg}%`);
  if (gs.max >= opts.pxMax) fail(`pixel residual max ${gs.max.toFixed(3)}% >= ${opts.pxMax}%`);
  console.log("centiped_convergence: PASS");
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const romP = join(GAME, "rom", "maincpu.bin"), gfxP = join(GAME, "rom", "gfx1.bin");
  if (!existsSync(romP) || !existsSync(gfxP)) ioerr(`ROM not built -- run: node ${join(REPO, "tools/build-rom.mjs")} centiped <zip>`);
  const rom = readFileSync(romP), gfx1 = readFileSync(gfxP);

  if (opts.mode === "pixel") { pixelMain(opts, rom, gfx1); return; }

  const { stateOut, rngOut } = captureGolden(opts);
  const golden = readFileSync(stateOut), rng = readFileSync(rngOut);
  const gN = Math.floor(golden.length / FRAME);
  const gframe = (i) => golden.subarray(i * FRAME, (i + 1) * FRAME);
  if (gN < opts.minDistinct * 2) ioerr(`golden too short: ${gN} frames`);
  // A fresh capture that silently under-runs (MAME exits early) would let the oracle match a short golden.
  if (!opts.golden) { const want = opts.seconds * 60; if (gN < want * 0.9) fail(`golden under-ran: ${gN} frames for --seconds ${opts.seconds} (expected ~${want}) -- capture cut short`); }
  // certify: state[0] all-zero (power-on invariant), and distinct golden frames (not a frozen screen).
  if (gframe(0).some((b) => b !== 0)) fail("golden state[0] is not all-zero (poisoned capture)");
  const gsigs = new Set(); for (let k = 0; k < gN; k += 7) gsigs.add(gframe(k).slice(0, 0x40).join(","));
  if (gsigs.size < opts.minDistinct) fail(`golden has only ${gsigs.size} distinct frames (frozen?)`);

  // Layer select: oracle = the translated layer cycle-driven; idiomatic = the §4 layer on the clock-free
  // coroutine engine, whose guest-stack scratch (page 1) is excluded from the diff.
  const idio = opts.layer === "idiomatic";
  const runLayer = idio ? runIdiomatic : (rom, g, r, f, mut) => Promise.resolve(runOracle(rom, g, r, f, mut));
  const cmp = idio ? diffNoStack : diff;
  const scoreL = (out, gf, gn, w) => drift(out, gf, gn, w, cmp);

  const frames = gN - 1;
  const good = await runLayer(rom, gfx1, rng, frames, false);
  // The read-count tooth is TWO-SIDED: over-read AND under-read both mean the layer diverged from MAME's
  // control flow. Under-read is the important case -- a translation gap/crash truncates runFrames, which
  // returns the partial frames it sampled; those few frames still match the golden, so without this the
  // most likely regression (a gap) certifies PASS. Also require the full frame count + a clean stop.
  if (good.stoppedBy) fail(`${opts.layer} did not run clean to budget: stoppedBy=${good.stoppedBy.message || good.stoppedBy} -- a gap or crash`);
  if (good.over > 0) fail(`RNG OVER-READ: ${opts.layer} read $100a ${good.ri + good.over}x, MAME captured ${rng.length}x -- diverged from MAME's control flow`);
  if (good.ri !== rng.length) fail(`RNG UNDER-READ: ${opts.layer} read $100a ${good.ri}x, MAME captured ${rng.length}x -- truncated/diverged (a gap or control-flow change)`);
  if (good.out.length < frames) fail(`${opts.layer} produced ${good.out.length}/${frames} frames -- truncated (gap or crash)`);
  const gs = scoreL(good.out, gframe, gN, opts.drift);

  // positive control #1: the layer's frames are distinct (not frozen).
  const osigs = new Set(); for (let k = 1; k < good.out.length; k += 7) if (good.out[k]) osigs.add(good.out[k].slice(0, 0x40).join(","));
  if (osigs.size < opts.minDistinct) fail(`${opts.layer} produced only ${osigs.size} distinct frames (froze/crashed early)`);

  // positive control #2 (NULL-MUTANT): a corrupted layer MUST break past the floor -- proves teeth.
  const bad = await runLayer(rom, gfx1, rng, frames, true);
  const bs = scoreL(bad.out, gframe, gN, opts.drift);
  const mutantCaught = bs.avg >= opts.tAvg || bad.over > 0;

  console.log(`  golden ${gN} frames, ${gsigs.size} distinct; RNG reads ${opts.layer} ${good.ri} / MAME ${rng.length} (over ${good.over}); ${opts.layer} ran ${good.out.length}/${frames} frames.`);
  console.log(`  correct: avg=${gs.avg.toFixed(1)}B max=${gs.max}B   null-mutant: avg=${bs.avg.toFixed(1)}B max=${bs.max}B over=${bad.over}`);
  console.log(`  thresholds: avg<${opts.tAvg} max<${opts.tMax}`);

  if (!mutantCaught) fail(`NULL-MUTANT NOT CAUGHT (avg ${bs.avg.toFixed(1)} < ${opts.tAvg}) -- the gate has no teeth`);
  if (gs.avg >= opts.tAvg) fail(`residual avg ${gs.avg.toFixed(1)}B >= ${opts.tAvg}B`);
  if (gs.max >= opts.tMax) fail(`residual max ${gs.max}B >= ${opts.tMax}B`);
  console.log("centiped_convergence: PASS");
}

main();
