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
    // A poll PC reached with the NMI unmasked IS a frame boundary. `inNmi` blocks the
    // handler itself from re-triggering if it happens to cross a poll PC.
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
 * @param {number} [opts.readBudget=6e8]  backstop against an unpolled spin
 * @returns {{frames:number, reads:number, stop:string, stopError:(Error|null)}}
 */
export function runIdiomaticGame(machine, { watchdogPort, nmiReturnPC, maxFrames = Infinity, onFrame, readBudget = 6e8 } = {}) {
  if (watchdogPort == null || nmiReturnPC == null) throw new Error("runIdiomaticGame needs watchdogPort and nmiReturnPC");

  machine.nextBoundary = Infinity;
  machine.maxFrames = Infinity;
  machine.maxCycles = Infinity;
  machine.nextNmi = Infinity;

  const realFire = machine.fireNmi.bind(machine);
  const realRead = machine.mem.read8.bind(machine.mem);
  machine.fireNmi = function () {}; // the scheduler must never fire it; only the watchdog poll does

  let frame = 0;
  let reads = 0;
  let inNmi = false;

  if (onFrame) onFrame(machine, 0); // frame 0 = power-on

  machine.mem.read8 = function (addr) {
    const v = realRead(addr);
    if (++reads > readBudget) throw new RunComplete("read-budget (unpolled spin?)");
    if ((addr & 0xffff) === watchdogPort && !inNmi && machine.io.nmiMask) {
      // Sample the pre-NMI state at the poll (matches runCycleFree's order), then fire the NMI.
      frame += 1;
      if (onFrame) onFrame(machine, frame);
      if (frame >= maxFrames) throw new RunComplete("reached maxFrames");
      inNmi = true;
      machine.pcKnown = true;
      machine.pc = nmiReturnPC;
      try {
        realFire();
      } finally {
        inNmi = false;
      }
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

  return { frames: frame, reads, stop, stopError };
}
