// SPDX-License-Identifier: GPL-3.0-only
/**
 * animateFlyEatCollision  —  ROM 0x26a6  ·  grounding: [seen] (MAME-grounded)
 *
 * WHAT IT IS
 *   The bonus-fly state machine, stepped once per in-play frame. Frogger periodically dangles a fly over
 *   the river; if the frog lines up under it, the frog eats it for bonus points. This routine owns the
 *   fly's whole life cycle: arm it (make it appear), patrol it back and forth, test it against the frog,
 *   and — once eaten — stick it to the frog while it is swallowed.
 *
 * WHERE IT SITS
 *   One of the per-frame collision/animation sub-engines fanned out by the master orchestrator
 *   orchestrateCollisionsAndFrogInput (ROM 0x1a55). It runs every in-play frame but does almost nothing
 *   on most of them — the fly is only armed and moving during a short window each ~25s appearance cycle.
 *
 * HOW IT DECIDES (three flags)
 *   The behaviour is a tiny state machine over three work-RAM flags:
 *     - COLLISION_SUBFLAG (0x8134)  — an eat is IN PROGRESS (the fly has been caught and is stuck to the frog)
 *     - COLLISION_LATCH   (0x8135)  — the fly is ARMED / on screen (the tongue is out)
 *     - FLY_EAT_PHASE     (0x813d)  — bit0 set = RETRACT the tongue this frame
 *   FLY_DRIFT_COUNTER (0x811c) is the appearance clock: a slow free-running counter whose wrap to 0 is the
 *   cue to arm the fly.
 *
 * LIVE-OUT
 *   Memory only. It writes the collision flags, the fly sprite descriptor, the patrol timers, and (on a
 *   catch) queues a sound. It returns nothing and leaves no register the caller reads.
 */
import { FROG_X, FROG_Y, FROG_SPRITE_CODE, FLY_SPRITE_X, FLY_SPRITE_CODE, FLY_DRIFT_COUNTER, FLY_TRAVEL_DIR_STEP, FLY_ATTACK_TIMER, COLLISION_SUBFLAG, COLLISION_LATCH, FLY_EAT_PHASE } from "./names.js";
import { clearLatchedCollision } from "./clearLatchedCollision.js";
import { driveFlyPatrol } from "./driveFlyPatrol.js";
import { enqueueSoundCommand } from "./enqueueSoundCommand.js";

// The fly lives in a four-byte sprite descriptor based at FLY_SPRITE_X (0x8040): [X, code, color, Y].
// FLY_SPRITE_CODE (0x8041) is imported by name; the color and Y cells have no exported name, so we
// address them by their offset from the block base.
const FLY_SPRITE_ATTR = FLY_SPRITE_X + 2; // 0x8042 — color / attribute byte
const FLY_SPRITE_Y = FLY_SPRITE_X + 3;    // 0x8043 — sprite Y (bottom byte of the fly block)

// Vertical catch band: the frog row FROG_Y (0x8047) must sit in [0x5a, 0x68) for an eat to register — the
// row range over which the dangling fly overlaps the frog.
const FLY_ROW_BAND_LOW = 0x5a;
const FLY_ROW_BAND_HIGH = 0x68;

// Horizontal catch tolerance: the fly X must land within +/-4px of the frog X FROG_X (0x8044).
const EAT_X_TOLERANCE = 0x04;

// Sound command queued when the frog catches the fly (see enqueueSoundCommand / driveFlyPatrol's sibling
// sound path).
const EAT_SOUND = 0x18;

// Descriptor values written when the fly is (re)armed onto the screen.
const FLY_ARM_SPRITE_CODE = 0x1e;      // the armed-fly tile code
const FLY_ARM_COLOR = 0x04;            // its color / attribute
const FLY_ARM_Y = 0x60;                // its starting screen row
const FLY_ATTACK_TIMER_RELOAD = 0x3c;  // 60 frames of tongue-out patrol before a path step

export function animateFlyEatCollision(m) {
  const { mem8 } = m;

  // ── Eat in progress? ─────────────────────────────────────────────────────────────────
  // COLLISION_SUBFLAG (0x8134) is set once the fly has been caught. While it is set the fly is being
  // swallowed, so there is nothing to test or move — just keep the fly sprite glued to the frog.
  if (mem8[COLLISION_SUBFLAG] !== 0) return trackFlyOntoFrog(m);

  // ── Appearance cue: arm the fly once ─────────────────────────────────────────────────
  // FLY_DRIFT_COUNTER (0x811c) rises slowly and wraps 0xff->0 on a long period; the wrap to 0 is the cue
  // to make the fly appear. armFlyTongue self-guards on COLLISION_LATCH so it only arms once per cycle.
  // Note: no `return` — after arming, the latch is now set and control falls through to the checks below,
  // which pick up the newly-armed fly on this same frame.
  if (mem8[FLY_DRIFT_COUNTER] === 0) armFlyTongue(m);

  // ── Retract phase? ───────────────────────────────────────────────────────────────────
  // FLY_EAT_PHASE (0x813d) bit0, when set, means the tongue should retract this frame. Hand off to the
  // guarded reset clearLatchedCollision (ROM 0x27b3), which clears the collision sub-flag and the fly
  // sprite block when the latch is set.
  if (mem8[FLY_EAT_PHASE] & 0x01) return clearLatchedCollision(m);

  // ── Tongue out: patrol + test ────────────────────────────────────────────────────────
  // COLLISION_LATCH (0x8135) set means the fly is armed / on screen. Drive its patrol and box-test it
  // against the frog. Latch clear means no fly this frame — fall through and do nothing.
  if (mem8[COLLISION_LATCH] !== 0) return boxTestFlyVsFrog(m);
  return;
}

// Move the fly one patrol step, then latch an eat when it lands in the frog's row/column window.
function boxTestFlyVsFrog(m) {
  const { mem8 } = m;

  // Mirror of the top-level guard: if an eat has already latched, skip straight to tracking the fly onto
  // the frog. (Preserves the ROM's block structure, where each arm re-checks the sub-flag.)
  if (mem8[COLLISION_SUBFLAG] !== 0) return trackFlyOntoFrog(m);

  // Walk the fly horizontally along its ROM patrol path (driveFlyPatrol, ROM 0x272f). This re-renders
  // FLY_SPRITE_X (0x8040) from the path table plus the drift base, so the fly paces back and forth.
  driveFlyPatrol(m);

  // Vertical overlap: the frog must be in the fly's catch band [0x5a, 0x68) or there is no eat this frame.
  const frogY = mem8[FROG_Y];
  if (frogY < FLY_ROW_BAND_LOW || frogY >= FLY_ROW_BAND_HIGH) return;

  // Horizontal overlap: the fly X must fall within +/-4px of the frog X FROG_X (0x8044). Two guards reject
  // a non-overlap (8-bit wrap on each edge):
  //   (a) frog's right tolerance edge is left of the fly: (FROG_X + 4) < flyX  — frog too far left
  //   (b) frog's left tolerance edge is at/right of the fly: (FROG_X - 4) >= flyX — frog too far right
  // Anything in between means the fly is within the window → the frog eats it.
  const flyX = mem8[FLY_SPRITE_X];
  if (((mem8[FROG_X] + EAT_X_TOLERANCE) & 0xff) < flyX) return;
  if (((mem8[FROG_X] - EAT_X_TOLERANCE) & 0xff) >= flyX) return;

  // Catch! Latch the eat-in-progress flag COLLISION_SUBFLAG (0x8134), fire the eat sound (command 0x18),
  // and snap the fly onto the frog so it renders being swallowed.
  mem8[COLLISION_SUBFLAG] = 0x01;
  enqueueSoundCommand(m, EAT_SOUND);
  return trackFlyOntoFrog(m);
}

// Glue the fly sprite to the frog: copy the frog's live position/sprite onto the fly descriptor so the
// caught fly rides the frog. The fly Y trails the frog by 2px (FLY_SPRITE_Y 0x8043 = FROG_Y 0x8047 + 2).
function trackFlyOntoFrog(m) {
  const { mem8 } = m;
  mem8[FLY_SPRITE_X] = mem8[FROG_X];
  mem8[FLY_SPRITE_CODE] = mem8[FROG_SPRITE_CODE];
  mem8[FLY_SPRITE_Y] = mem8[FROG_Y] + 0x02;
}

// Arm the tongue once: make the fly appear and start its patrol. Called at the FLY_DRIFT_COUNTER wrap.
function armFlyTongue(m) {
  const { mem8 } = m;

  // Guard: only arm when nothing is already latched. COLLISION_LATCH (0x8135) stays set for the whole
  // appearance, so this fires exactly once at the start of each cycle.
  if (mem8[COLLISION_LATCH] !== 0) return;

  // Advance the eat phase FLY_EAT_PHASE (0x813d) — its bit0 drives the retract check back in the main
  // routine on subsequent frames.
  mem8[FLY_EAT_PHASE] = mem8[FLY_EAT_PHASE] + 1;

  // Stamp the fly sprite descriptor (base FLY_SPRITE_X 0x8040): code, color, and starting Y.
  mem8[FLY_SPRITE_CODE] = FLY_ARM_SPRITE_CODE;
  mem8[FLY_SPRITE_ATTR] = FLY_ARM_COLOR;
  mem8[FLY_SPRITE_Y] = FLY_ARM_Y;

  // Latch the fly as on-screen (COLLISION_LATCH 0x8135), reset its patrol path step to 1
  // (FLY_TRAVEL_DIR_STEP 0x833d), and load the tongue-out timer to 60 (FLY_ATTACK_TIMER 0x833e).
  mem8[COLLISION_LATCH] = 0x01;
  mem8[FLY_TRAVEL_DIR_STEP] = 0x01;
  mem8[FLY_ATTACK_TIMER] = FLY_ATTACK_TIMER_RELOAD;
}
