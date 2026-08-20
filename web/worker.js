// SPDX-License-Identifier: GPL-3.0-only
// Live in-browser engine driver — game-agnostic. Reads games/<id>/manifest.js, imports
// the game's machine + board Inputs, takes the page's sha256-verified ROMs (web/romzip.js)
// or fetches the built .bin, and runs the real engine unedited.

const C_IN0 = 0, C_IN1 = 1, C_IN2 = 2, C_PAUSED = 3, C_COUNTER = 4,
      C_RUNNING = 5, C_RESET = 6, C_SLEEP = 7;

let ctrl = null;
let fb = null;
let FRAME_BYTES = 0;
let PORTS = null;  // {in0,in1,in2} input port addresses, from manifest.inputs.ports

// SOUND EVENTS. The board exposes an optional write tap (io.onSoundWrite), armed here only
// when the page has samples (default/headless runs stay byte-identical). Only a CHANGED latch
// value ships -- the ROM rewrites every latch each frame (~600/s), and an edge is what a player
// needs. DK's 0x7D80 death-tune surface has no tap (shared ls259), so it is POLLED once per
// frame on the same rule (safe: the ROM holds it 3 frames). Only (addr,value) pairs cross here.
let audioOn = false;
let live = null;               // the LiveMachine currently running, for re-arming
const soundLast = new Map();   // addr -> last value emitted (edge dedup, game-agnostic)
const IRQ_ADDR = 0x7d80;
let soundQueue = [];           // [addr, value, ...] for this frame

function emitSound(addr, value) {
  if (soundLast.get(addr) === value) return; // unchanged at this address -> no edge
  soundLast.set(addr, value);
  soundQueue.push(addr, value);
}

/** Arm or disarm the board tap on the live machine, per the page's request. */
function syncSoundTap() {
  if (!live) return;
  live.io.onSoundWrite = audioOn ? emitSound : null;
}

// PER-FRAME SEAMS, shared by both runtimes (cycle-driven runFrames seams and the idiomatic
// onFrame): live-key read, framebuffer publish, sound flush, 60fps pace.

function readInputsInto(machine) {
  if (Atomics.load(ctrl, C_RESET) === 1) {
    Atomics.store(ctrl, C_RESET, 0);
    throw new Error("__reset__"); // unwinds the run; worker reboots to attract
  }
  machine.io.inputAssert = {
    [PORTS.in0]: Atomics.load(ctrl, C_IN0) & 0xff,
    [PORTS.in1]: Atomics.load(ctrl, C_IN1) & 0xff,
    [PORTS.in2]: Atomics.load(ctrl, C_IN2) & 0xff,
  };
}

/** Publish an RGB frame to the shared double-buffered framebuffer. */
function publishFrame(frame) {
  const counter = Atomics.load(ctrl, C_COUNTER);
  fb.set(frame, (counter % 2) * FRAME_BYTES);
  Atomics.store(ctrl, C_COUNTER, counter + 1);
}

/** Ship this frame's sound edges (+ the polled IRQ surface for boards that have one). */
function flushSound(machine) {
  if (audioOn && machine.io.audioIrq !== undefined) emitSound(IRQ_ADDR, machine.io.audioIrq & 1);
  if (soundQueue.length) {
    postMessage({ type: "sound", ev: soundQueue });
    soundQueue = [];
  }
}

/** Pace to 60fps and honour pause, clocking off machine._next. */
function pace(machine) {
  while (
    Atomics.load(ctrl, C_PAUSED) === 1 &&
    Atomics.load(ctrl, C_RUNNING) === 1 &&
    Atomics.load(ctrl, C_RESET) === 0
  ) {
    Atomics.wait(ctrl, C_SLEEP, 0, 80);
    machine._next = performance.now();
  }
  const now = performance.now();
  if (machine._next === undefined) machine._next = now;
  const delay = machine._next - now;
  if (delay > 1) Atomics.wait(ctrl, C_SLEEP, 0, delay);
  machine._next += 1000 / 60;
  if (performance.now() - machine._next > 500) machine._next = performance.now();
}

function makeLive(Machine) {
  return class LiveMachine extends Machine {
    applyInputs(_frameIndex) { readInputsInto(this); }

    finishRasterFrame() {
      super.finishRasterFrame();
      const vf = this.videoFrames;
      if (vf.length) { publishFrame(vf[vf.length - 1]); vf.length = 0; }
      const fl = this.frames.length;         // bound memory over a long session
      if (fl >= 3) this.frames[fl - 3] = null;
      flushSound(this);
      pace(this);
    }
  };
}

// The idiomatic runtime's per-frame seam, called at each vblank-poll yield (pre-NMI) for the
// just-finished frame. Frame 0 is power-on -- latch + pace only.
function serviceIdiomaticFrame(machine, frameIndex) {
  readInputsInto(machine);
  // Beam-sync render (generic, opt-in): a game that changes video mid-frame (Time Pilot's cloud
  // multiplexer) accumulates bands during the frame -- publish the assembled buffer and open the
  // next; no beam methods -> a single snapshot. See docs/beam-sync.md.
  const beam =
    typeof machine.startBeamFrame === "function" && typeof machine.finishBeamFrame === "function";
  if (frameIndex > 0) publishFrame(beam ? machine.finishBeamFrame() : machine.renderFrame());
  if (beam) machine.startBeamFrame();
  flushSound(machine);
  pace(machine);
}

async function fetchBin(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`fetch ${url} -> ${r.status}`);
  return new Uint8Array(await r.arrayBuffer());
}

// Warm the browser's module cache in PARALLEL before the (serial) resolve loop imports each
// routine module. Computes the SAME URLs resolveOverrides/resolveAllIdiomatic will use, so the
// resolve then cache-hits. Posts {type:"loading", loaded, total} for the player's progress bar;
// an import error is swallowed here (the real resolve surfaces it) — this is a pure warm-up.
async function prewarmModules(idiomatic, gameId, manifest, machineBase, manifestBase) {
  let urls;
  if (idiomatic) {
    const { ROUTINES } = await import(`../games/${gameId}/idiomatic/names.js`);
    urls = Object.values(ROUTINES).map((m) => new URL(`./idiomatic/${m.name}.js`, machineBase).href);
  } else {
    urls = Object.values(manifest.optimized || {}).map((e) => new URL(e.module, manifestBase).href);
  }
  urls = [...new Set(urls)]; // many routine addresses can share one module
  const total = urls.length;
  if (!total) return;
  let loaded = 0, lastPct = -1;
  postMessage({ type: "loading", loaded, total });
  await Promise.all(urls.map(async (u) => {
    try { await import(u); } catch { /* the resolve loop will surface a genuine error */ }
    loaded++;
    const pct = Math.round((loaded / total) * 100); // coalesce: post only when the percent ticks
    if (pct !== lastPct || loaded === total) { lastPct = pct; postMessage({ type: "loading", loaded, total }); }
  }));
}

async function run(gameId, provided) {
  const manifest = (await import(`../games/${gameId}/manifest.js`)).default;
  PORTS = manifest.inputs.ports;
  const machineMod = await import(`../games/${gameId}/machine.js`);
  const { Machine } = machineMod;
  const { Inputs } = await import(`../boards/${manifest.board}/io.js`);

  // manifest.runtime "idiomatic" runs the readable idiomatic layer on the coroutine engine
  // (generators yielding at each vblank); absent/other runs the translated layer on the
  // cycle-driven engine. Idiomatic is validated byte-for-byte vs the oracle (idiomatic/test/).
  const idiomatic = manifest.runtime === "idiomatic";
  const liveCfg = manifest.convergence?.idiomatic;
  if (idiomatic && !liveCfg) throw new Error(`${gameId}: runtime "idiomatic" needs manifest.convergence.idiomatic`);
  const runIdiomaticGame = idiomatic ? (await import("../core/frame-stepped.js")).runIdiomaticGame : null;
  const LiveMachine = idiomatic ? null : makeLive(Machine);

  // Resolved ONCE and reused for every (re)boot: idiomatic wires every routine to its
  // idiomatic/<name>.js; cycle-driven uses manifest.optimized (proven-equal routines).
  // resolveOverrides imports each routine module with an AWAITED loop (serial); a game has
  // hundreds, so pre-warm the browser's module cache in PARALLEL first (same URLs, so the
  // resolve loop then cache-hits) and report progress so a long first-load is visibly alive.
  const machineBase = new URL(`../games/${gameId}/machine.js`, import.meta.url);
  const manifestBase = new URL(`../games/${gameId}/manifest.js`, import.meta.url);
  await prewarmModules(idiomatic, gameId, manifest, machineBase, manifestBase);
  const overrides = idiomatic
    ? await machineMod.resolveAllIdiomatic(machineBase)
    : await machineMod.resolveOverrides(manifest.optimized, manifestBase);

  // Each declared ROM image: the page's sha256-checked copy if supplied, else the built .bin.
  const names = Object.keys(manifest.rom.images);
  const bins = await Promise.all(names.map((n) => {
    const supplied = provided && provided[n];
    if (supplied) return new Uint8Array(supplied);
    return fetchBin(`../games/${gameId}/rom/${n}.bin`);
  }));
  const images = Object.fromEntries(names.map((n, i) => [n, bins[i]]));
  const { maincpu, ...gfx } = images;

  const sw = manifest.screen?.width ?? 256, sh = manifest.screen?.height ?? 224;
  FRAME_BYTES = sw * sh * 3;
  postMessage({ type: "ready" });

  while (Atomics.load(ctrl, C_RUNNING) === 1) {
    const m = idiomatic
      ? new Machine(maincpu, { inputs: new Inputs(), ...gfx, overrides })
      : new LiveMachine(maincpu, { inputs: new Inputs(), ...gfx, overrides });
    if (!idiomatic) m.captureVideo = true; // idiomatic renders on demand in serviceIdiomaticFrame
    m._next = performance.now();
    // A fresh machine has fresh latches -- clear the remembered edge state or the first frame
    // after a reboot would suppress real events.
    live = m;
    soundLast.clear();
    soundQueue = [];
    syncSoundTap();
    let reason = null;
    try {
      if (idiomatic) {
        // runIdiomaticGame drives the main generator frame by frame, calling serviceIdiomaticFrame
        // at each pre-NMI yield; it catches its own unwinds, so read the returned stop reason.
        const r = runIdiomaticGame(m, {
          nmiReturnPC: liveCfg.nmiReturnPC,
          onFrame: serviceIdiomaticFrame,
        });
        if (r.stopError) {
          if (r.stopError.message === "__reset__") { postMessage({ type: "reset" }); continue; }
          reason = r.stopError.message;
        } else {
          reason = r.stop;
        }
      } else {
        m.runFrames(5_000_000); // huge budget; every frame paced to 1/60s
        reason = m.stoppedBy || "budget reached";
      }
    } catch (e) {
      const msg = String((e && e.message) || e);
      if (msg === "__reset__") { postMessage({ type: "reset" }); continue; }
      reason = msg;
    }
    if (Atomics.load(ctrl, C_RUNNING) === 0) break;
    postMessage({ type: "restart", reason }); // translation gap or budget: reboot
  }
}

onmessage = (e) => {
  const d = e.data;
  if (d.type === "init") {
    ctrl = new Int32Array(d.ctrl);
    fb = new Uint8Array(d.fb);
    run(d.game, d.images).catch((err) =>
      postMessage({ type: "error", reason: String((err && err.stack) || err) }));
  } else if (d.type === "audio") {
    // The page owns the AudioContext and tells us when samples load; until then the tap stays off.
    audioOn = !!d.enabled;
    soundLast.clear(); // re-announce the current latch state on the next write
    soundQueue = [];
    syncSoundTap();
  }
};
