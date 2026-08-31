// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { fetchWordFromTableIndex } from "./fetchWordFromTableIndex.js";
import { setActorAnimation } from "./setActorAnimation.js";
import { fetchByteFromTableIndex } from "./fetchByteFromTableIndex.js";
import { ACTOR_ANIM_TABLE_5657, ACTOR_SPEED_TABLE_55D7, ROUND_COUNTER } from "./names.js";
/**
 * loc_5489 — bring a fresh actor to life: seed its opening record fields, give it a look, and derive
 * its starting speed.
 *
 * ROM 0x5489-0x54c4. Grounding: this routine carries no standalone cert of its own; it is reached only
 * from the [seen] spawn scanners (0x54f9 / 0x5544 / 0x5594) and every input it reads is grounded — the
 * [seen] animation table (0x5657), the [seen] speed table (0x55d7), and the [seen] ROUND_COUNTER.
 *
 * WHAT IT IS. Every moving thing in Pooyan — a hunter, an arrow, an eagle, a falling chunk of meat —
 * lives in a fixed-layout actor record in work RAM. When a spawn path has found a free record and
 * decided WHAT KIND of actor to put there (the kind byte is already stamped into the record at +0x17),
 * it hands the record to this routine. This is the constructor's finishing pass: it writes the fixed
 * opening state, installs the animation the kind calls for, seats a dwell countdown, and computes the
 * actor's initial signed vertical speed. After it runs, the record is a live, drawable, moving actor.
 *
 * ITS ROLE IN THE MACHINE. It is the shared tail of the three spawn scanners: each walks an actor
 * table looking for a free slot, writes the chosen kind into that slot's +0x17, and calls in here.
 * Instead of returning to the scanner, this routine returns ONE FRAME FURTHER UP the call chain — it
 * pops and discards its immediate caller's return address, so control resumes in the scanner's own
 * caller. The scanners return immediately the moment control comes back (this routine always reports
 * back false), so a single successful spawn ends the whole spawn attempt rather than continuing the
 * table walk.
 *
 * LIVE-OUT: memory only — the seeded record fields written below (+0x00, +0x02, +0x03, +0x04, +0x05,
 * +0x06, the animation fields +0x0c..+0x0e via setActorAnimation, the countdown +0x11, and the speed
 * +0x0a). No exit register carries a meaningful result; the boolean return is always false and exists
 * only so the caller returns at once.
 */

// Byte offsets into the 0x18-byte actor record whose base arrives as `rec`. The record layout is
// shared with the other actor constructors; only the handful of fields below are set at birth here —
// the rest are filled in by whichever spawn path allocated the slot.
const ACTIVE_FLAG = 0x00; //    rec+0x00 = 1 marks the record LIVE, so the per-frame actor sweep begins updating and drawing it
const STATE_FIELD = 0x02; //    rec+0x02 = 0 resets the actor's state/phase index to its starting state
const PHASE_FIELD = 0x05; //    rec+0x05 = 0 clears the secondary phase/sub-state byte
const FIXED_60 = 0x03; //       rec+0x03 = 0x60 fixed opening value (initial coordinate/parameter, same for every actor born here)
const FIXED_1B = 0x04; //       rec+0x04 = 0x1b fixed opening value (initial coordinate/parameter, same for every actor born here)
const SPAWN_FIELD = 0x06; //    rec+0x06 = the caller-supplied spawn datum (a per-spawn count/parameter chosen by the scanner)
const KIND_FIELD = 0x17; //     rec+0x17 = the kind byte the scanner stamped in; selects both the animation and the speed row
const COUNTDOWN = 0x11; //      rec+0x11 = 0x40 dwell countdown that the per-frame handlers drain to time the actor's first transition
const SPEED_FIELD = 0x0a; //    rec+0x0a = the negated (two's-complement) signed speed derived below
const COUNTDOWN_SEED = 0x40; // initial dwell value seated into rec+0x11
const ROUND_MASK = 0x07; //     keep only the low 3 bits of the round counter (0..7) when picking the speed within a kind's row

export function loc_5489(m, rec = m.regs.ix, spawnField = m.regs.b) {
  const { mem8 } = m;

  // --- Stamp the fixed opening state -------------------------------------------------------------
  // Plant the identity/parameter bytes every actor born through this door starts with. The active
  // flag (+0x00 = 1) is what the per-frame actor sweep keys on to notice the record and start
  // servicing it; the state (+0x02) and phase (+0x05) bytes are zeroed to the starting state; +0x03
  // and +0x04 take fixed opening values (0x60/0x1b); and +0x06 receives the caller's spawn datum.
  mem8[rec + ACTIVE_FLAG] = 0x01;
  mem8[rec + STATE_FIELD] = 0x00;
  mem8[rec + PHASE_FIELD] = 0x00;
  mem8[rec + FIXED_60] = 0x60;
  mem8[rec + FIXED_1B] = 0x1b;
  mem8[rec + SPAWN_FIELD] = spawnField;

  // --- Install the animation for this kind -------------------------------------------------------
  // The kind byte (already sitting at rec+0x17) selects which animation sequence the actor plays.
  // The animation table at ROM 0x5657 is a table of 16-bit sequence pointers, one word per kind, so
  // the lookup reads entry `kind` (base + 2*kind) to get a pointer to that kind's frame sequence.
  // setActorAnimation then writes that pointer into the record's anim fields (+0x0c/+0x0d) and forces
  // the frame index (+0x0e) back to 0, so the actor starts playing the sequence from its first frame.
  const kind = mem8[rec + KIND_FIELD];
  const animPointer = fetchWordFromTableIndex(m, kind, ACTOR_ANIM_TABLE_5657);
  setActorAnimation(m, rec, animPointer);

  // --- Seat the dwell countdown ------------------------------------------------------------------
  // rec+0x11 gets 0x40. The per-frame state handlers drain this down; it times how long the newborn
  // actor holds its opening state before it first transitions.
  mem8[rec + COUNTDOWN] = COUNTDOWN_SEED;

  // --- Derive the initial signed speed -----------------------------------------------------------
  // The speed comes from a two-stage lookup into the speed table at ROM 0x55d7. First the kind byte
  // indexes the table to land on the START of this kind's speed row: the lookup returns the byte plus
  // the ADDRESS it read (base + kind), and only that address (`speedRow`) is kept — it is the base of
  // the row for this kind.
  const [, speedRow] = fetchByteFromTableIndex(m, ACTOR_SPEED_TABLE_55D7, kind);

  // Within the row, the entry is chosen by 3 x (round counter & 7). Masking the round counter to its
  // low 3 bits yields 0..7, and the x3 stride steps over the row in 3-byte groups, so the actor's
  // speed varies with the current round — later rounds pick faster entries.
  const step = 3 * (mem8[ROUND_COUNTER] & ROUND_MASK);
  const [speed] = fetchByteFromTableIndex(m, speedRow, step);

  // The table stores speed magnitudes; negating gives the signed (two's-complement) value the motion
  // code adds each frame, so the fetched magnitude becomes an upward/decreasing step. Store it at
  // rec+0x0a as the actor's live speed.
  mem8[rec + SPEED_FIELD] = u8(-speed);

  // Report false so the spawn scanner that called in returns at once — see the caller-skip note in
  // the header. A successful spawn always reaches here, so this always returns false.
  return false;
}
