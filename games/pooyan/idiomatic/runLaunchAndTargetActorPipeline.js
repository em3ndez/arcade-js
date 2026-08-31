// SPDX-License-Identifier: GPL-3.0-only
import { dispatchLaunchState } from "./dispatchLaunchState.js";
import { spawnTargetActorOnLaunchTrigger } from "./spawnTargetActorOnLaunchTrigger.js";
import { stepActiveTargetActorRecords } from "./stepActiveTargetActorRecords.js";
/**
 * runLaunchAndTargetActorPipeline — the launch-and-target sub-dispatch of the boot frontier.
 *
 * WHAT IT IS
 *   A tiny ordering routine at ROM 0x2101 (0x2101-0x210a). Each time the frontier reaches it,
 *   it fires the three passes that together drive the arrow/rope "launch" mechanic and the enemy
 *   targets it spawns, in a fixed order, then returns. It owns no state of its own — it exists
 *   purely to run its three children in the one sequence the game depends on.
 *
 * ROLE IN THE MACHINE
 *   This is the launch subsystem's per-frame entry point. Pooyan's arrow rises on a rope; when it
 *   reaches its gate the machine seeds hunter/eagle *target* actors that then travel across the
 *   play area. Splitting that work into three ordered passes lets the state driver decide WHAT
 *   should happen this frame (arm, animate, spawn a hunter, hold, idle), a one-shot pass decide
 *   whether a fresh target slot should be *armed* off the launch trigger, and a final pass CARRY
 *   every live target one step. The order matters: the state may spawn a target, the trigger pass
 *   may claim a slot, and only then does the step pass move whatever is live — so a freshly seeded
 *   record is advanced in the same frame it appears.
 *
 * ROM ADDRESS: 0x2101 (0x2101-0x210a).
 * Grounding: [seen]
 *
 * LIVE-OUT: none. This is a void sequencer — every effect lands inside the three sub-passes'
 *   own memory (the launch state cell, the target/hunter record tables, their timers and tiles);
 *   the caller reads nothing back from it.
 */
export function runLaunchAndTargetActorPipeline(m) {
  // PASS 1 — advance the launch state machine (ROM 0x2778).
  // dispatchLaunchState reads LAUNCH_STATE (0x8f30) [seen] and dispatches its low three bits into
  // one of five handlers. Threading them all is the arrow object's height byte ARROW_Y (0x8ab4)
  // [seen], which the machine treats as a rising gate:
  //   state 0 arms the launch once its preconditions hold and the arrow has risen to its gate;
  //   state 1 flaps the arrow tile while it is high, then seeds a target record once it drops;
  //   state 2 stamps a fresh hunter into the six-slot hunter table and starts its spawn hold;
  //   state 3 drains the spawn countdown and, on expiry, clears the just-seeded hunter record;
  //   state 4 is the idle terminal — a bare return.
  // Running this first lets the rest of the frame react to whatever the machine decided.
  dispatchLaunchState(m);
  // PASS 2 — one-shot target-slot arming off the launch trigger (ROM 0x210b).
  // spawnTargetActorOnLaunchTrigger samples and clears a trigger bit in the actor table. If it was
  // set and the once-latch (0x8f1a) [seen] is still clear, it arms that latch, may mark the first
  // target slot special (when the launch has reached its threshold and the second slot reads
  // ready-idle), then claims the first free target slot and seeds its axes from the actor source
  // plus its two timers, clearing a pair of flash flags. The once-latch keeps this to a single
  // arming per launch trigger — it is re-cleared each frame by PASS 3 so the next trigger can fire.
  spawnTargetActorOnLaunchTrigger(m);
  // PASS 3 — carry every active target actor one step (ROM 0x2157).
  // stepActiveTargetActorRecords walks the two target actor records. A record still in its launch
  // sub-phase creeps its rec+4 field up by 4 each frame until it reaches 0xe8, then blanks itself;
  // other records prime their display command once and then either run a two-axis mover or drain a
  // hit-timer / countdown, blanking the whole 0x18-byte record on expiry. This pass also re-clears
  // the PASS 2 once-latch, re-arming the launch trigger for the next frame.
  stepActiveTargetActorRecords(m);
}
