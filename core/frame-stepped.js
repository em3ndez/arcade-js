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
