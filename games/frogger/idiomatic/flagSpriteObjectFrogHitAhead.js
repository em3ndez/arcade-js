// SPDX-License-Identifier: GPL-3.0-only
/**
 * flagSpriteObjectFrogHitAhead — ROM 0x2ca8 · grounding: [seen,poked]
 *
 * WHAT IT IS
 *   The frog-versus-object proximity test for dispatcher B — the "frog reached / mounted the object"
 *   check. Dispatcher B drives a single-tile sprite object that steers toward a fixed lane target and can
 *   be RIDDEN by the frog. Once per frame, while that object is live and sharing the frog's row, this
 *   routine asks: has the frog closed to within a one-tile window at or just ahead of the object? If so,
 *   it latches the catch — the frog is now holding onto / mounted on the object.
 *
 * WHERE IT SITS
 *   The fourth of dispatcher B's five arms (updateSpriteObject, ROM 0x2b83), which run in fixed order:
 *   spawn → steer-toward-target → write-slot-X → THIS hit-test → write-slot-attribute. It reads the slot
 *   X that write-slot-X staged one arm earlier the same frame, so the position it tests is current.
 *   Dispatcher B itself is run every frame by the cluster driver driveSpriteObjectCluster (ROM 0x2970),
 *   which enters with IX = the object's 16-byte record base and IY = its 4-byte hardware sprite slot.
 *   Inert on almost every frame (the two gates below), so most calls fall straight through the first two
 *   returns without touching memory.
 *
 * LIVE-OUT
 *   Memory only. On a catch it writes HOLD_FLAG (0x8004) = 1 and advances the record's state byte to 2.
 *   Nothing is returned and no register the caller reads is left set.
 *
 *   Why the catch matters: raising HOLD_FLAG blocks the steer arm's despawn, so instead of running on to
 *   its target and vanishing, the object is HELD in state 2 — this is precisely the "frog mounted it"
 *   path, the object frozen under the frog rather than allowed to complete its journey.
 *
 * REGISTER-POINTER PARAMETERS (defaulted from m.regs so the equivalence harness can pass them explicitly)
 *   obj = IX = the object's 16-byte record base; the fields read/written here:
 *     +0x04 object row Y   ·   +0x05 direction bit   ·   +0x06 state (0 idle · 1 armed · 2 = caught)
 *   spr = IY = the object's hardware sprite slot [X, code, color, Y]; field read here: +0x00 = X.
 */
import { FROG_Y, FROG_X, HOLD_FLAG } from "./names.js";

// The object's leading edge sits a different distance from its staged slot X depending on which way it
// travels, so the raw X is projected by a direction-dependent bias before it is compared to the frog. The
// direction bit is record +0x05; the two biases (8-bit wrapped) are the exact ROM constants at 0x2ca8.
const AHEAD_BIAS = 20; // added to the slot X when the direction bit (record +0x05) is clear
const BEHIND_BIAS = 4; // subtracted from the slot X when the direction bit (record +0x05) is set

const HIT_WINDOW = 16; // catch band width in pixels — one 16px tile — measured AT or ahead of the frog X
const HIT_STATE = 2;   // record +0x06 value stamped on a catch: "caught / mounted", held from despawn

export function flagSpriteObjectFrogHitAhead(m, obj = m.regs.ix, spr = m.regs.iy) {
  const { mem8 } = m;

  // ── Gate 1: is this object slot live? ─────────────────────────────────────────────────
  // Record +0x06 is the state byte: 0 = idle. Every dispatcher arm early-returns on an idle record, so a
  // vacant slot can never report a phantom catch.
  if (mem8[obj + 0x06] === 0) return;

  // ── Gate 2: is the object on the frog's row? ──────────────────────────────────────────
  // Record +0x04 is the object's Y row. It must equal the frog row FROG_Y (0x8047) EXACTLY — dispatcher B
  // uses no vertical band, just a same-row test — otherwise there is no vertical overlap and we are done.
  if (mem8[obj + 0x04] !== mem8[FROG_Y]) return;

  // ── Project the object's leading edge in X ────────────────────────────────────────────
  // Start from the slot's staged X (slot +0x00, written by the write-slot-X arm earlier this frame). Which
  // edge of the object can catch the frog depends on its facing, selected by the direction bit
  // (record +0x05): clear → project +20, set → project -4. Kept 8-bit (& 0xff) to match the Z80's byte
  // wrap, so a projection past 0xff folds around exactly as the hardware would.
  let pos = mem8[spr + 0x00];
  pos = mem8[obj + 0x05] !== 0 ? (pos - BEHIND_BIAS) & 0xff : (pos + AHEAD_BIAS) & 0xff;

  // ── Proximity test: is the frog within one tile behind the projected point? ───────────
  // The projected point must sit AT or ahead of the frog X FROG_X (0x8044) and no more than HIT_WINDOW
  // (16px, one tile) past it. Outside that band the frog has not closed onto the object.
  const frogX = mem8[FROG_X];
  if (pos < frogX) return;                          // projected point is behind the frog — no catch
  if (((pos - frogX) & 0xff) >= HIT_WINDOW) return; // more than a tile ahead — not close enough yet

  // ── Catch: the frog has mounted the object ────────────────────────────────────────────
  // Raise HOLD_FLAG (0x8004) so the frog stops taking movement input while it rides, and advance the
  // record state (+0x06) to HIT_STATE = 2. The raised HOLD_FLAG also blocks the steer arm's despawn, so
  // the object is held here rather than continuing to its target and vanishing — the frog is now riding it.
  mem8[HOLD_FLAG] = 1;
  mem8[obj + 0x06] = HIT_STATE;
}
