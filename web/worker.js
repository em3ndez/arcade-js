// SPDX-License-Identifier: GPL-3.0-only
//
// Live in-browser engine driver — game-agnostic.
//
// The init message names a game id. The worker reads games/<id>/manifest.js to
// learn its board + ROM images, dynamically imports the game's machine and the
// board's Inputs, takes the ROM binaries from the init message when the page
// supplied them (assembled + sha256-verified in the page from the visitor's own
// zip — see web/romzip.js) and otherwise fetches the locally-built ones, then
// runs the REAL engine with zero edits: LiveMachine subclasses the game's Machine
// and overrides
// only the two per-frame seams the run loop already calls — applyInputs() (read
// live keys from the shared control buffer) and finishRasterFrame() (publish the
// frame to the shared framebuffer + pace to 60fps).

// ctrl Int32Array indices (shared with the page):
const C_IN0 = 0, C_IN1 = 1, C_IN2 = 2, C_PAUSED = 3, C_COUNTER = 4,
      C_RUNNING = 5, C_RESET = 6, C_SLEEP = 7;

let ctrl = null;   // Int32Array over the shared control buffer
let fb = null;     // Uint8Array over the shared (double-buffered) framebuffer
let FRAME_BYTES = 0;
let PORTS = null;  // {in0,in1,in2} input port addresses, from manifest.inputs.ports

// ---------------------------------------------------------------------------
// SOUND EVENTS. The engine emits nothing by itself; the board exposes an
// optional tap (io.onSoundWrite) and this file is the only thing that ever sets
// it. Two rules keep it honest:
//
//   1. OPT-IN. The tap is installed only after the page says it actually has
//      samples to play, so the default browser run — and every non-browser run
//      — leaves the engine byte-for-byte as it was.
//   2. EDGES ONLY. The ROM's sound service routine rewrites all nine latches
//      EVERY frame (see games/dkong/audio/README.md), so the raw stream is ~600
//      writes/second of mostly-nothing. Only a CHANGE is an event, which is also
//      exactly what a player needs: a level-driven trigger's 0→1 and 1→0.
//
// No audio data crosses this boundary — just (addr, value) pairs, flushed once
// per frame alongside the framebuffer publish.
// ---------------------------------------------------------------------------
//
// THE THIRD SURFACE, 0x7D80, IS POLLED RATHER THAN TAPPED. It carries the death
// tune (see games/dkong/audio/sounds.js `irq`), but it shares its ls259 with
// flipscreen / NMI-mask / DRQ and the board exposes no write tap for it — only
// the stored bit, io.audioIrq. So it is read once per frame here, on exactly the
// same edge rule as the tapped surfaces. Frame granularity is sufficient and
// that is a measurement, not a hope: the ROM's sound service routine holds this
// line for THREE frames (0x6088 is loaded with 3 and decremented per frame), so
// a per-frame poll sees the 0→1 and the 1→0 with two frames to spare. A pulse
// shorter than one frame could be missed; this ROM never writes one.
// ---------------------------------------------------------------------------
let audioOn = false;
let live = null;               // the LiveMachine currently running, for re-arming
// Edge dedup keyed by the raw write address, so it is game-agnostic: DK taps
// several latch surfaces (0x7C00, 0x7D00..0x7D07, the polled 0x7D80), The Pit a
// single soundlatch (0xB800). Only a CHANGED value at an address ships downstream.
const soundLast = new Map();   // addr -> last value emitted
const IRQ_ADDR = 0x7d80;       // DK's polled sound-IRQ surface (see below)
let soundQueue = [];           // [addr, value, addr, value, ...] for this frame

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

// ---------------------------------------------------------------------------
// PER-FRAME SEAMS, shared by both runtimes. The cycle-driven runtime (LiveMachine
// + runFrames, e.g. DK) calls these from the two engine seams runFrames already
// invokes; the idiomatic runtime (runIdiomaticGame, e.g. The Pit) calls them from
// its once-per-frame onFrame. Same live-key read, same framebuffer publish, same
// sound flush, same 60fps pace — only the engine that drives them differs.
// ---------------------------------------------------------------------------

/** Latch the live keys into the machine's input ports; a reset request unwinds the run. */
function readInputsInto(machine) {
  if (Atomics.load(ctrl, C_RESET) === 1) {
    Atomics.store(ctrl, C_RESET, 0);
    throw new Error("__reset__"); // unwinds the run; worker reboots to attract
  }
  machine.io.inputAssert = {
    [PORTS.in0]: Atomics.load(ctrl, C_IN0) & 0xff, // IN0 joystick + jump (P1)
    [PORTS.in1]: Atomics.load(ctrl, C_IN1) & 0xff, // IN1 (P2 / cocktail)
    [PORTS.in2]: Atomics.load(ctrl, C_IN2) & 0xff, // IN2 coin / start
  };
}

/** Publish an RGB frame to the shared double-buffered framebuffer (page reads the front). */
function publishFrame(frame) {
  const counter = Atomics.load(ctrl, C_COUNTER);
  fb.set(frame, (counter % 2) * FRAME_BYTES); // write the back slot
  Atomics.store(ctrl, C_COUNTER, counter + 1); // publish
}

/** Ship this frame's accumulated sound edges (+ the polled IRQ surface for boards that have one). */
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
  if (delay > 1) Atomics.wait(ctrl, C_SLEEP, 0, delay); // precise sleep, no busy-wait
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

// The idiomatic runtime's per-frame seam. runIdiomaticGame calls this at each frame boundary
// (the vblank-poll yield, BEFORE the NMI). The state here is the just-completed frame, so render
// and publish it; then latch the live keys for the coming frame's NMI to read; ship sound; pace.
// Frame 0 is power-on (nothing drawn yet), so only latch + pace there.
function serviceIdiomaticFrame(machine, frameIndex) {
  readInputsInto(machine);
  if (frameIndex > 0) publishFrame(machine.renderFrame());
  flushSound(machine);
  pace(machine);
}

async function fetchBin(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`fetch ${url} -> ${r.status}`);
  return new Uint8Array(await r.arrayBuffer());
}

async function run(gameId, provided) {
  const manifest = (await import(`../games/${gameId}/manifest.js`)).default;
  PORTS = manifest.inputs.ports; // input port addresses -> inputAssert slots (IN0/IN1/IN2)
  const machineMod = await import(`../games/${gameId}/machine.js`);
  const { Machine } = machineMod;
  const { Inputs } = await import(`../boards/${manifest.board}/io.js`);

  // Live runtime (manifest.runtime): "idiomatic" runs the whole readable idiomatic layer on the
  // coroutine engine (the control spine is generators that yield at each vblank; runGeneratorGame
  // drives the current main generator one frame at a time and swaps it on a warm restart, so the
  // host stack stays flat); absent/other runs the faithful translated layer on the cycle-driven
  // engine. The idiomatic runtime is validated byte-for-byte vs the translated oracle over game
  // state (idiomatic/test/{golive,tape,transition}.test.js).
  const idiomatic = manifest.runtime === "idiomatic";
  const golive = manifest.convergence?.golive;
  if (idiomatic && !golive) throw new Error(`${gameId}: runtime "idiomatic" needs manifest.convergence.golive`);
  const runGeneratorGame = idiomatic ? (await import("../core/frame-stepped.js")).runGeneratorGame : null;
  const LiveMachine = idiomatic ? null : makeLive(Machine);

  // The override set, resolved ONCE and reused for every (re)boot below. Idiomatic: every routine
  // wired to its idiomatic/<name>.js (machine.resolveAllIdiomatic). Cycle-driven: the game's
  // declarative manifest.optimized (proven-equal optimized routines; absent -> an empty Map =
  // pure translated). The Machine constructor cannot resolve the { module, export } form itself.
  const overrides = idiomatic
    ? await machineMod.resolveAllIdiomatic(new URL(`../games/${gameId}/machine.js`, import.meta.url))
    : await machineMod.resolveOverrides(manifest.optimized, new URL(`../games/${gameId}/manifest.js`, import.meta.url));

  // Every declared ROM image, per image: use the one the page handed us (already
  // size- and sha256-checked there) if present, else fetch the locally-built
  // .bin — so the `make rom` developer path keeps working untouched.
  const names = Object.keys(manifest.rom.images);
  const bins = await Promise.all(names.map((n) => {
    const supplied = provided && provided[n];
    // Transferred as ArrayBuffers; a Uint8Array copies just as happily.
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
    // A fresh machine has fresh latches, so the remembered edge state has to go
    // with it, or the first frame after a reboot would suppress real events.
    live = m;
    soundLast.clear();
    soundQueue = [];
    syncSoundTap();
    let reason = null;
    try {
      if (idiomatic) {
        // The coroutine engine resumes the current main generator to its next vblank yield and calls
        // serviceIdiomaticFrame at each boundary (PRE-NMI, exactly where the game state is sampled by
        // the gates). It catches its own unwinds — the reset() long-jump and the mid-frame warm
        // restart (RESTART sentinel) — so inspect the returned stop reason rather than relying on a throw.
        const r = runGeneratorGame(m, {
          nmiReturnPC: golive.nmiReturnPC,
          onFrame: serviceIdiomaticFrame,
        });
        if (r.stopError) {
          if (r.stopError.message === "__reset__") { postMessage({ type: "reset" }); continue; }
          reason = r.stopError.message;
        } else {
          reason = r.stop;
        }
      } else {
        m.runFrames(5_000_000); // huge budget; every frame is paced to 1/60s
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
    // The page owns the AudioContext and knows whether any sample actually
    // loaded; it tells us here. Until it does (and forever, if it never does)
    // the board tap stays unset and the engine is untouched.
    audioOn = !!d.enabled;
    soundLast.clear(); // re-announce the current latch state on the next write
    soundQueue = [];
    syncSoundTap();
  }
};
