// SPDX-License-Identifier: GPL-3.0-only
/**
 * Cycle-free ("frame-stepped") engine mode — run a game with NO T-state clock and
 * still track MAME, by firing the vblank NMI at the game's vblank-POLL yield instead
 * of at an absolute cycle count.
 *
 * WHY THIS EXISTS. The shipped Machine is cycle-driven: `tick()` accrues T-states and
 * accepts the NMI the instant `cycles >= nextNmi` (one vblank per CYCLES_PER_FRAME).
 * That is exact, but it *requires* every routine to charge its real cycle cost — which
 * the idiomatic layer deliberately does not (idiomatic routines are cycle-free, so the
 * cycle-driven NMI never fires and a `waitFrames`-style vblank spin hangs forever).
 * The way out is to stop timing the NMI by cycles and time it by CONTROL FLOW: an
 * arcade main loop ends every frame by spinning on a vblank flag (`waitFrames` reading
 * a frame countdown, or the main-loop top), so the instant the CPU *reaches that poll*
 * IS the frame boundary. Fire the NMI there. No cycle count is consulted, so a routine
 * may cost zero cycles and the engine still advances one frame per loop pass.
 *
 * The price (documented in docs/decompiler-pipeline.md): "byte-exact vs MAME" becomes
 * "convergent vs MAME" — the same game logic runs, but a routine's exact intra-frame
 * cycle distribution is gone, so a free-running cycle-proxy counter can hold a small
 * bounded phase offset. Validate with the drift-tolerant convergence gate, not a
 * byte-for-byte per-frame diff. See tools/convergence.mjs.
 *
 * WHAT COUNTS AS A POLL PC. The set of ROM addresses where the main loop yields to
 * wait for vblank — game-specific, and the ONE parameter that matters. The Pit:
 * `{0x4c07, 0x0348}` (the `waitFrames` spin and the in-game main-loop top). Pick the
 * loop-yield points, NOT a busy-delay's inner djnz (that would fire the NMI thousands
 * of times per frame). Getting this wrong shows up immediately as far-too-many or
 * far-too-few frames.
 *
 * This is a TEST/validation seam. The shipped game keeps its cycle-driven engine; this
 * is how you run the idiomatic (or all-translated) layer live and check it against a
 * MAME golden.
 */

/**
 * Thrown internally to unwind out of the translated/idiomatic call tree once the run is
 * done (frame budget reached, or the step-budget backstop trips). Boot + main loop never
 * return, so unwinding is the only way to stop. Not an error — runCycleFree() catches it.
 */
class RunComplete extends Error {
  constructor(reason) {
    super(reason);
    this.name = "RunComplete";
  }
}

/**
 * Run `machine` cycle-free from reset, calling `onFrame(machine, frameIndex)` at frame 0
 * (power-on, before a single instruction) and again at every frame boundary (each time
 * the CPU reaches a poll PC with the NMI unmasked). The callback is where the caller
 * samples whatever it wants — `machine.dumpState()`, `machine.renderFrame()`, a single
 * RAM cell — WITHOUT this module knowing the game.
 *
 * Mechanism: neutralise the cycle scheduler (all boundaries/NMI/budgets → Infinity so
 * `tick()` becomes an inert cycle accumulator), suppress the cycle-driven `fireNmi`, and
 * wrap `step()` so that reaching a poll PC samples the frame and vectors the REAL NMI.
 * The wrap is installed on the passed instance only; construct a fresh Machine per run.
 *
 * @param {object} machine  a constructed game Machine (Machine.create(...)); mutated in place
 * @param {object} opts
 * @param {Iterable<number>} opts.pollPCs   ROM addresses of the vblank-poll yields (see header)
 * @param {number} [opts.maxFrames=Infinity]  stop after this many frame boundaries
 * @param {(machine:object, frameIndex:number)=>void} [opts.onFrame]  per-frame sample hook
 * @param {number} [opts.stepBudget=6e8]  hard backstop against an unpolled infinite spin
 * @returns {{frames:number, steps:number, stop:string, stopError:(Error|null)}}
 */
export function runCycleFree(machine, { pollPCs, maxFrames = Infinity, onFrame, stepBudget = 6e8 } = {}) {
  const poll = pollPCs instanceof Set ? pollPCs : new Set(pollPCs);
  if (poll.size === 0) throw new Error("runCycleFree needs at least one poll PC");

  // Neutralise the cycle-driven scheduler: no frame boundaries, no cycle budget, and
  // never accept the NMI on a cycle count — this engine fires it on control flow only.
  machine.nextBoundary = Infinity;
  machine.maxFrames = Infinity;
  machine.maxCycles = Infinity;
  machine.nextNmi = Infinity;

  const realFire = machine.fireNmi.bind(machine);
  const realStep = machine.step.bind(machine);
  machine.fireNmi = function () {}; // the scheduler must never fire it; only the poll does

  let steps = 0;
  let inNmi = false;
  let frame = 0;

  // frame 0 = power-on, sampled before any instruction runs (the frame-sampling contract
  // in machine.js: state[0] is the power-on state; state[N] follows frames 0..N-1).
  if (onFrame) onFrame(machine, 0);

  machine.step = function (nextAddr, cycles) {
    realStep(nextAddr, cycles);
    if (++steps > stepBudget) throw new RunComplete("step-budget (unpolled spin?)");
    // A poll PC reached with the NMI unmasked IS a frame boundary. `inNmi` blocks the handler
    // itself from re-triggering: the translated handler's final `m.ret` steps back to the poll PC
    // it interrupted, which would otherwise re-fire. (This is the poll-PC engine, for validating
    // TRANSLATED attract runs against the oracle; the whole-game idiomatic runtime with its
    // coin/warm-restart long-jumps is runIdiomaticGame below, which needs no such guard.)
    if (!inNmi && poll.has(this.pc) && this.io.nmiMask) {
      frame += 1;
      if (onFrame) onFrame(this, frame);
      if (frame >= maxFrames) throw new RunComplete("reached maxFrames");
      // The poll PC is a genuine, known next-instruction address (realStep just set it),
      // so fireNmi's pcKnown guard is satisfied — the pushed return lands correctly.
      this.pcKnown = true;
      inNmi = true;
      try {
        realFire();
      } finally {
        inNmi = false;
      }
    }
  };

  let stop = "reached maxFrames";
  let stopError = null;
  try {
    machine.reset(); // enters at PC 0x0000; never returns — unwinds via RunComplete/error
    stop = "returned"; // a main loop that actually returns is itself a signal worth seeing
  } catch (e) {
    if (e instanceof RunComplete) {
      stop = e.message;
    } else {
      // Boot gap / unmapped access / unimplemented device: the frames already sampled are
      // valid. Surface why we stopped so the caller can report it (same intent as
      // Machine.runFrames recording stoppedBy).
      stop = `${e.name}: ${e.message}`;
      stopError = e;
    }
  } finally {
    // Restore the real methods so the instance is inspectable afterwards.
    machine.step = realStep;
    machine.fireNmi = realFire;
  }

  return { frames: frame, steps, stop, stopError };
}

/**
 * runIdiomaticGame — drive the WHOLE game running idiomatic (every routine wired live) with no
 * T-state clock. `runCycleFree` fires the NMI when `m.step` reaches a poll PC, which needs the
 * poll routines (mainLoop/waitFrames) to stay TRANSLATED so they emit that `m.step`. The
 * idiomatic layer is cycle-free and never calls `m.step`, so it cannot use that seam — the poll
 * routines are idiomatic too. Instead we hook the ONE control-flow event those routines already
 * perform once per frame: the WATCHDOG KICK (a read of `watchdogPort`, done exactly once per
 * mainLoop pass and once per waitFrames spin). That read IS the vblank-poll yield: sample the
 * pre-NMI state, then run the real vblank NMI (which ticks the frame countdown, samples inputs,
 * blits sprites). `inNmi` stops the handler's own watchdog kick from re-triggering.
 *
 * This is the go-live engine: it runs the assembled idiomatic game and is validated against the
 * translated oracle (golive.test.js) and, as the capstone, MAME pixels. The only two routines
 * that need a stack op restored for standalone use are the SP re-seat in mainLoop and the `ret`
 * in serviceVblankNmi (both were dropped as no-ops in the translated-caller swap harness).
 *
 * @param {object} machine  a Machine with the FULL idiomatic override set wired (opts.overrides)
 * @param {object} opts
 * @param {number} opts.watchdogPort   the I/O address whose read kicks the watchdog (0xb800)
 * @param {number} opts.nmiReturnPC    a valid ROM PC for the NMI's pushed return (the mainloop top)
 * @param {number} [opts.maxFrames=Infinity]
 * @param {(machine:object, frameIndex:number)=>void} [opts.onFrame]
 * @param {number} [opts.readBudget=5e6]  PER-FRAME read cap (reset each frame) — an unpolled-spin backstop
 * @returns {{frames:number, stop:string, stopError:(Error|null)}}
 */
export function runIdiomaticGame(machine, { watchdogPort, nmiReturnPC, maxFrames = Infinity, onFrame, readBudget = 5e6 } = {}) {
  if (watchdogPort == null || nmiReturnPC == null) throw new Error("runIdiomaticGame needs watchdogPort and nmiReturnPC");

  machine.nextBoundary = Infinity;
  machine.maxFrames = Infinity;
  machine.maxCycles = Infinity;
  machine.nextNmi = Infinity;

  const realFire = machine.fireNmi.bind(machine);
  const realRead = machine.mem.read8.bind(machine.mem);
  machine.fireNmi = function () {}; // the scheduler must never fire it; only the watchdog poll does

  let frame = 0;
  let readsSinceFrame = 0;

  if (onFrame) onFrame(machine, 0); // frame 0 = power-on

  machine.mem.read8 = function (addr) {
    const v = realRead(addr);
    // Per-frame spin backstop: a real frame resolves in ~hundreds-to-thousands of reads, so a
    // huge burst with NO frame boundary is an unpolled spin. Reset each frame, so a long, healthy
    // game never trips it (a total-read cap would kill a multi-hour session; boot/warm-restart
    // frames legitimately read a lot).
    if (++readsSinceFrame > readBudget) throw new RunComplete("per-frame read budget (unpolled spin?)");
    if ((addr & 0xffff) === watchdogPort && machine.io.nmiMask) {
      // The watchdog kick is the vblank-poll yield. Sample the pre-NMI state (matches
      // runCycleFree's order), then fire the NMI. There is deliberately NO "in NMI" guard: a
      // watchdog READ that happens while a prior NMI is still on the JS call stack means that
      // handler LONG-JUMPED into a new forever main loop (The Pit's coin path: serviceVblankNmi
      // banks a credit -> showCreditScreen resets SP and tail-calls holdFixedScreen, which spins
      // on waitFrames). Those reads are genuine frame boundaries and MUST fire the NMI, or the
      // game freezes on the credit screen. Safe because the NMI handler itself never READS the
      // watchdog (it only WRITES 0xb800 for sound), so it cannot re-trigger its own frame. The
      // abandoned outer handler stays on the JS stack — one frame per warm-restart, bounded for a
      // normal session; a coroutine/unwind engine would reclaim it.
      frame += 1;
      readsSinceFrame = 0;
      if (onFrame) onFrame(machine, frame);
      if (frame >= maxFrames) throw new RunComplete("reached maxFrames");
      machine.pcKnown = true;
      machine.pc = nmiReturnPC;
      realFire();
    }
    return v;
  };

  let stop = "returned";
  let stopError = null;
  try {
    machine.reset(); // enters idiomatic boot via the override at 0x0000; never returns
    stop = "returned";
  } catch (e) {
    if (e instanceof RunComplete) stop = e.message;
    else { stop = `${e.name}: ${e.message}`; stopError = e; }
  } finally {
    machine.mem.read8 = realRead;
    machine.fireNmi = realFire;
  }

  return { frames: frame, stop, stopError };
}

/**
 * runGeneratorGame — the COROUTINE go-live engine. The idiomatic control spine (boot, the main
 * loops, the wait/hold loops) are GENERATORS that `yield` at each vblank wait; everything else
 * (per-frame services, physics, render) stays a plain function. The engine drives the CURRENT
 * main generator one frame at a time: resume it to its next vblank `yield`, sample the pre-NMI
 * state, then fire the vblank NMI (a plain handler). A state change — coin, start, level, game
 * over — is a WARM RESTART: the handler (or a spine tail) sets `machine.nextMain` to a factory
 * for the next main generator, and the engine swaps it. The abandoned generator is just
 * garbage-collected, so unlike the nested-NMI engines (runCycleFree/runIdiomaticGame) the JS HOST
 * stack never grows across warm restarts — it stays flat forever. See docs/decompiler-pipeline.md.
 *
 * WHY a second go-live engine. runIdiomaticGame fires the NMI as a NESTED JS call at the watchdog
 * read; a warm restart there long-jumps into a new forever loop that never returns, so the host
 * stack grows ~one frame per restart (bounded, but a leak). The coroutine model removes it
 * structurally — a `yield` suspends the whole call tree wherever it is, and a swapped-out loop is
 * reclaimed. It is also the general model: the yield can sit anywhere (deep waits, interrupt-driven
 * loops), so it ports to any game without per-game "find the forever loops" analysis.
 *
 * @param {object} machine  a Machine with the idiomatic overrides wired (the spine must be generators)
 * @param {object} opts
 * @param {number} [opts.bootAddr=0x0000]     ROM address of the boot entry (a generator)
 * @param {number} [opts.serviceNmiAddr]      ROM address of the vblank NMI handler (a plain fn); fired via machine.fireNmi
 * @param {number} [opts.nmiReturnPC]         a valid ROM PC for the NMI's pushed return (the mainloop top)
 * @param {number} [opts.maxFrames=Infinity]
 * @param {(machine:object, frameIndex:number)=>void} [opts.onFrame]
 * @returns {{frames:number, stop:string, stopError:(Error|null)}}
 */
export function runGeneratorGame(machine, { bootAddr = 0x0000, nmiReturnPC, maxFrames = Infinity, onFrame } = {}) {
  machine.nextBoundary = Infinity;
  machine.maxFrames = Infinity;
  machine.maxCycles = Infinity;
  machine.nextNmi = Infinity;

  const realFire = machine.fireNmi.bind(machine);
  machine.fireNmi = function () {}; // the scheduler must never fire it; only a vblank yield does
  machine.booted = true;
  machine.nextMain = null;

  let frame = 0;
  let stop = "returned";
  let stopError = null;

  if (onFrame) onFrame(machine, 0); // frame 0 = power-on, before the boot generator runs

  // The boot entry is a generator, dispatched through the registry exactly like every inter-routine
  // call (m.call of a generator returns the generator object; a spine tail delegates with `yield*`).
  let gen = machine.call(bootAddr);

  try {
    for (;;) {
      // Apply any pending warm restart BEFORE resuming, so an abandoned loop is never resumed.
      if (machine.nextMain) { gen = machine.nextMain(); machine.nextMain = null; }
      let r;
      try {
        r = gen.next(); // run the current main generator to its next vblank yield (or return)
      } catch (e) {
        // A MID-FRAME warm restart (machine.restartMain): a round-boundary service deep in the
        // plain gameplay tree abandoned the frame and handed us a successor loop. Swap it in and
        // start its first frame; the aborted frame fires no NMI (its vblank never arrived).
        if (e === machine.RESTART && machine.nextMain) continue;
        throw e;
      }
      if (r.done) {
        if (machine.nextMain) continue; // it returned AND handed off (boot -> attract) -> swap
        stop = "returned";              // a main loop that returns with no hand-off is worth seeing
        break;
      }
      frame += 1;
      if (onFrame) onFrame(machine, frame); // sample PRE-NMI, at the vblank yield
      if (frame >= maxFrames) { stop = "reached maxFrames"; break; }
      // Fire the vblank NMI: push16(pc) + run the handler; it may set machine.nextMain (warm restart).
      machine.pcKnown = true;
      if (nmiReturnPC != null) machine.pc = nmiReturnPC;
      realFire();
    }
  } catch (e) {
    stop = `${e.name}: ${e.message}`;
    stopError = e;
  } finally {
    machine.fireNmi = realFire;
  }

  return { frames: frame, stop, stopError };
}
