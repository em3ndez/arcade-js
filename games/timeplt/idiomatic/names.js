// SPDX-License-Identifier: GPL-3.0-only

/**
 * Time Pilot work-RAM constants for the idiomatic layer.
 *
 * Maps this game's work RAM (0xA800-0xAFFF) to meaningful names. Addresses stay hex in
 * `../translated/` on purpose — that layer is the oracle; this file is a naming convenience for
 * the idiomatic rewrite and is NEVER the source of truth for behaviour.
 *
 * ★ PROVENANCE / CONFIDENCE (be honest — a wrong name is the sprite-record trap, worse than a
 * neutral hex address). Every name carries an evidence-source tag saying HOW we know the role:
 *   [seen]  — observed under MAME: a capture watched THIS address and confirmed what it does.
 *   [code]  — understood from the routines that touch it: consistent across them, but the cell
 *             itself was not observed.
 *   [guess] — one plausible reading, not confirmed; treat as a hint and verify.
 *   keep-hex — no confident name, so no const exists; the absence of an entry IS the signal.
 * The pixel gate, not the name, remains the correctness authority.
 */

/**
 * INNER index of the two-level sequence machine. [code]
 *
 * One reader masks this to its low nibble and dispatches through a word table on the result, so
 * it is an index rather than a count. One routine's only job is to increment it; another clears
 * it to restart the sequence. Touched across nineteen transcribed routines, consistently as an
 * index. Not yet observed under a capture, so the *identity* is code-derived: which sequence it
 * steps (attract, round intro, or both) is NOT established and this name does not claim it.
 */
export const SEQUENCE_SUBSTEP = 0xa9ac;

/**
 * OUTER phase of the same two-level machine: the machine's top-level MODE. [seen]
 *
 * The vblank service masks this to its low two bits and dispatches a jump table on the result;
 * inside those arms the inner index is consumed with several different masks,
 * which is what a per-phase table size looks like. Every phase-entry site writes the pair in one
 * idiom -- set this to a small constant, zero the inner one -- and the routine that steps this is
 * that same idiom with an increment in place of the store.
 *
 * Four values occur and no more. Watched under two independent MAME captures: 0 is the boot wipe,
 * 1 the attract sequence, 2 the credit / push-start state, and 3 the round engine.
 *
 * ★ Phase 3 is NECESSARY for play and NOT SUFFICIENT: the attract demo runs the same round engine
 * with the play flag clear, so the demo executes real game logic rather than replaying a recording.
 * Anything treating this cell alone as a play detector counts the demo as a game -- and the demo
 * is where most attract-mode dispatches come from, so that error silently corrupts any dispatch
 * attribution keyed on it.
 *
 * It is also routed through several ROM checksums whose trailing constants net to zero on a
 * genuine image, so a patched ROM corrupts the phase instead of failing cleanly. Same cell, same
 * meaning, booby-trapped.
 */
export const SEQUENCE_PHASE = 0xa9ab;

/**
 * Mirror of the IN0 input port, rewritten every frame from the port itself. [seen]
 *
 * The vblank service reads the port, complements it (the hardware is active-low) and stores the
 * result here, unconditionally — so this cell reflects what the panel is asserting, not what the
 * machine decided to do about it. Bit 0 is coin 1, bit 3 is 1-player start; watched under a
 * capture, it carries exactly the bits a driven tape held, for exactly the frames it held them.
 * Because the write is unconditional, a non-zero value proves a button was down and nothing more.
 */
export const IN0_MIRROR = 0xa9ae;

/**
 * Coin-counter pulses the machine still OWES the mechanical counter. [seen]
 *
 * Reads zero for the whole of an undriven run, and goes non-zero on the frame a driven coin is
 * taken, holding for a short spell before clearing. Unlike the port mirror this is downstream of
 * the machine's own decision: a debounce has to see idle-then-pressed before this is bumped.
 *
 * It is a COUNT, not a boolean — two coins in quick succession take it to two — and the pulse
 * driver decrements it as each solenoid pulse finishes.
 *
 * ★ What it does NOT mean: that a credit was banked. Credits live in a different, BCD cell and
 * are reached only after the coinage arithmetic, so on any setting that charges more than one coin
 * per credit these two diverge.
 */
export const COIN_ACCEPTED = 0xa981;

/**
 * The two coinage DIP settings, as the machine sees them: the complement of the DSW0 port. [seen]
 *
 * The boot path reads the port, complements it (the switches are active-low) and stores the result
 * here, then unpacks it. The low nibble is the setting MAME's own port definition for this driver
 * labels Coin A and the high nibble the one it labels Coin B, and forcing the port to a value under
 * MAME moves this cell to that value's complement.
 */
export const COINAGE_SETTINGS = 0xa9b1;

/**
 * Set while the cabinet is on free play, so a coin never has to buy a credit. [seen]
 *
 * Raised to all-ones by the coinage unpack when EITHER coin setting reads free play. Of the sites
 * that name this address those two are the only writes; the other six read it -- the sharpest being
 * the tail of the coin-accept path, which skips the whole credit arithmetic while this is non-zero.
 * Watched under MAME across eight forced DSW0 values it read
 * all-ones for exactly the three where a nibble was set to free play and zero for the other five.
 */
export const FREE_PLAY = 0xa9c0;

/**
 * What coin slot 1 charges: coins-required-minus-one in the high nibble, credits in the low. [seen]
 *
 * Written once at boot from the low nibble of COINAGE_SETTINGS through a sixteen-entry table, and
 * read by the accept arm that debounces the coin-1 bit of IN0_MIRROR: that arm steps an accumulator
 * by 0x10 per coin and returns until it reaches this byte's high nibble, then adds this byte's low
 * nibble to the BCD credit count. So the two nibbles are coins and credits, not one packed number.
 *
 * Forced under MAME, it carried exactly the pair MAME's own label gives the setting -- one coin for
 * one credit as 0x01, two coins for one as 0x11, two for three as 0x13, three for two as 0x22, four
 * for three as 0x33 -- and it followed its own nibble while the other nibble moved independently.
 */
export const COIN_SLOT_1_RATIO = 0xa9c9;

/**
 * The same for coin slot 2, from the OTHER nibble. [seen]
 *
 * Same encoding, same table, same grounding run; the arm that reads it is the one debouncing the
 * coin-2 bit, and it keeps its own accumulator. The two slots are independent: a run with one
 * nibble at free play and the other at one-coin-one-credit moved only its own destination.
 */
export const COIN_SLOT_2_RATIO = 0xa9cc;

/**
 * Flag set while play is active. [seen]
 *
 * A true boolean rather than a value: one routine stores all-ones into it, three others clear it
 * with an exclusive-or of the accumulator, and a reader tests it for zero and returns early when
 * it is set. Watched under captures it reads zero for the whole of two undriven runs totalling
 * over five thousand frames, goes all-ones on the frame a driven start press lands, and holds
 * for every remaining frame.
 *
 * SCOPE, since the obvious readings differ: it spans a whole CREDIT, not a life and not a round.
 * Watched through a driven game to game over, it stayed set across every life lost and cleared
 * only at teardown. Four start sites set it and two teardown sites clear it.
 *
 * ★ It is also the ONLY thing separating real play from the attract DEMO, because the demo runs
 * the same round engine with this flag clear. Anything that infers "a game is being played" from
 * the sequence phase alone counts the demo as a game.
 */
export const PLAY_ACTIVE = 0xad30;

/**
 * Pulses coin slot 1's mechanical counter still owes, counted down one frame at a time. [seen]
 *
 * Loaded to 48 when a pulse begins, and the counter line is driven high in the same breath; the
 * line is released at the half-way count of 24; at zero the routine takes one off COIN_ACCEPTED and
 * the next owed pulse starts on the following frame. So this cell is the pulse's phase, and its
 * period is what fixes the solenoid's on-time.
 *
 * Watched under MAME with a write tap over a driven game, the only two program counters that wrote
 * it were the pulse driver's own load and its own decrement -- 240 decrements over five coins,
 * which is 48 apiece. Undriven, it took no write at all.
 *
 * Slot 2 keeps its own cell one address on, driven by a byte-identical twin routine.
 */
export const COIN_PULSE_TIMER = 0xa984;

/**
 * How much longer a hit still counts as part of the current chain. [seen]
 *
 * Reloaded to 30 by every scoring post and counted down once per dispatch of the round engine's
 * service block -- which is NOT once a frame, so the window is 30 of those ticks and not half a
 * second. While it is non-zero the next hit climbs the award ladder; once it empties the ladder is
 * reset through CHAIN_STEP.
 *
 * Watched under MAME the cell took writes from three program counters, all inside the poster and
 * the routine that expires the chain. Its observed values run 0x00 to 0x1E and no higher.
 */
export const CHAIN_WINDOW = 0xa99d;

/**
 * Which rung of the chained-hit award ladder the next hit will be paid at. [seen]
 *
 * Stepped by the poster while CHAIN_WINDOW is alive and used, masked to three bits and incremented,
 * as the argument of the scoring command -- so the ladder wraps rather than caps. Cleared by the
 * routine that expires the chain, on every frame after the window has emptied rather than on the
 * frame it empties.
 *
 * Two writers, both watched under MAME. Its observed values reached 0x0C, past the eight rungs,
 * which is consistent with the mask rather than with a bounded count.
 */
export const CHAIN_STEP = 0xa99e;

/**
 * The escalation rung inside the current era: the LOW half of the composite ERA_INDEX describes. [seen]
 *
 * ERA_INDEX's own entry records that one reader shifts the era up four bits and adds "a per-era rung
 * in the low, into a table of five eras by sixteen rungs". This is that rung. It is seeded per life
 * from a per-player cell, bumped each time the rung timer expires, and clamped at fifteen -- so it
 * climbs while a life lasts and then stops.
 *
 * Watched under MAME it took writes from two program counters, the seed and the bump. It climbed
 * 0 to 5 over an attract run without ever reaching the clamp,
 * and each bump was followed by the routine that applies the row, whose twelve destinations then
 * took a monotone ladder of values -- which is what makes this a difficulty rung rather than a
 * cosmetic index.
 */
export const ERA_RUNG = 0xacc0;

/**
 * Per-round enemy-craft quota: how many craft a round should field. [code]
 *
 * Written by the era/rung config scatter from record byte 4 (resetPlayfieldAndArmNewRound stores
 * mem[src+4]; applyEraRungSettings and cold init reach the same cell), and read as the wave spawn
 * count / loop bound wherever craft are launched -- driveEnemyWaveForLifePhase, spawnEnemyWaveIntoFreeSlots,
 * gateTheFreeSlotSearchAndPickItsRun, loc_379f. The quota-picks-the-count idiom recurs: a spawner loads its
 * loop bound from here unless the kill quota is already spent, then falls back to five.
 */
export const ROUND_CRAFT_COUNT = 0xacc1;

/**
 * Descriptor-table selector for the current inline wave: (2 * era) + a random parity bit. [code]
 *
 * driveEnemyWaveForLifePhase computes it as 2*ERA_INDEX + one drawn bit, then multiplies by sixteen to
 * stride into the wave descriptor table at 0x397b (two-byte entries, one consumed per filled slot), so it
 * picks one of two shape/formation rows per era. Routine-local scratch that happens to live in RAM.
 */
export const WAVE_DESCRIPTOR_INDEX = 0xacc3;

/**
 * Per-round threshold that decides how each spawning craft's movement script is chosen. [code]
 *
 * Written by the era/rung config scatter from record byte 5, and read only by pickScriptAtRandomOrInTurn:
 * a random draw at or above this value yields a random script from a small band, a draw below it yields the
 * next entry of a round-robin cycle. A higher threshold biases toward the ordered cycle.
 */
export const SCRIPT_PICK_THRESHOLD = 0xacc4;

/**
 * Nonzero while a round / wave / Mother-Ship transition sequence is underway. [code]
 *
 * Cleared to zero when a fresh round arms (resetPlayfieldAndArmNewRound, cold init) and when the field-cleared
 * advancer completes a round (advanceRoundWhenFieldCleared writes ROM[0x07d1]=0x00, disarming the hold); raised
 * at the end of a wave/Mother-Ship sequence -- to 0xFE on a full formation rebuild (stepMotherShip 0x4587) or
 * 0xFF at warp/flash finish (loc_459b / stepMotherShip 0x464b). While it is set the per-frame enemy drivers
 * stand down (driveEnemyWaveForLifePhase returns; fireAndSweepPlayerShots skips spawning; armMotherShipOrStep
 * holds only on 0xFF, proceeding on 0xFE), and it is the gate the round-advancer requires (advance only when
 * this is set, the kill quota is spent, and the object band is empty). Different routines named it for the one
 * effect each saw -- spawn-hold, wave-hold, round-over -- but every reader treats a set value as a transition
 * in progress.
 */
export const ROUND_TRANSITION_HOLD = 0xacc6;

/**
 * How many more qualifying kills until the current wave's shared claim fires. [code]
 *
 * The inline wave builder tallies filled slots into this cell, then -- unless five or more slots filled, in
 * which case the tally itself stands -- overwrites it with ROUND_CRAFT_COUNT; from then on
 * countTheKillAndGrantTheSharedToken decrements it once per kill whose object cleared the claim guards, and the
 * kill that brings it to zero writes the winning slot ordinal into CLAIM_TOKEN. So the stored value is a
 * per-wave kill countdown, not a frame timer -- its builder-side fill tally and its claim-side countdown are
 * the same physical cell, filled while spawning then counted down.
 */
export const WAVE_KILL_COUNTDOWN = 0xa811;

/**
 * Frame-countdown window during which a spawned wave's shared claim is armed. [code]
 *
 * Preloaded to 0xE4 whenever a wave spawns (both the inline builder and the era-four/boss spawner), and wound
 * down one per vblank alongside the other frame timers. Its numeric value is never compared against a
 * threshold -- the only reader beyond the tick treats nonzero as "wave live, claim armed" -- so the 0xE4 seed
 * is a time budget: roughly how long after a wave spawns the last-of-wave kill can still be claimed.
 */
export const WAVE_CLAIM_TIMER = 0xa812;

/**
 * The shared "last of the wave" token, holding one claimant at a time. [code]
 *
 * The kill that empties WAVE_KILL_COUNTDOWN writes its own slot ordinal here with the top bit set; loc_2c31
 * keeps alive whichever object's record number matches the low seven bits -- a "named request" -- holding a
 * fixed shape and tint, and on its first phase posts a command and clears this cell, so the token is consumed
 * exactly once. Its writer-side (holder) and reader-side (request) views are the same cell.
 */
export const CLAIM_TOKEN = 0xa821;

/*
 * Kept hex (no confident name, so no const -- the absence is the signal):
 *   0xACC2  set 0xFF across the inline wave-build loop and cleared to 0 after (driveEnemyWaveForLifePhase);
 *           no reader in either layer, so its purpose (a build-in-progress interlock) is not earned.
 *   0xACC5  written 0 once when a free slot is stocked (spawnEnemyIntoFreeSlotElseStepSearch); no reader in
 *           either layer, so no role can be justified.
 */

/**
 * How many wraps of the base-sixty counter one rung of ERA_RUNG lasts. [seen]
 *
 * Written once, from a program byte, and read only to reload ERA_RUNG_TIMER. Watched under MAME it
 * took a single write in a whole run.
 */
export const ERA_RUNG_PERIOD = 0xa9d6;

/**
 * Wraps of the base-sixty counter still to go before ERA_RUNG climbs again. [seen]
 *
 * Seeded from ERA_RUNG_PERIOD at life start and again on every expiry, and stepped down once per
 * wrap of LIFE_TICKS_LOW rather than once per frame. Watched under MAME its step count matched that
 * cell's wrap count and the rung bumps came at the expected spacing.
 */
export const ERA_RUNG_TIMER = 0xa9d7;

/**
 * Low place of a three-place base-sixty counter, stepped once per dispatch of the round engine's
 * per-frame service block. [seen]
 *
 * ★ IT IS NOT A CLOCK, and reading it as one is the trap this comment exists to stop. The service
 * block runs only in the round phase and not on every frame of it, so sixty steps of this cell took
 * 84, 95, 120 and 140 frames on four different tapes -- a factor of 1.7. It measures work done by
 * the round engine, not time.
 *
 * Zeroed by the routine that starts a life. Its packed-decimal shape is observed: under a MAME write
 * tap it took values 00-09, 10-19, 20-29, 30-39, 40-49, 50-59 and the pre-wrap 60, and no other.
 * A reader elsewhere splits it into its two digits and uses the low one as a round-robin slot index,
 * so the digits are load-bearing and not merely display.
 */
export const LIFE_TICKS_LOW = 0xad05;

/**
 * Middle place of that counter, stepped once per wrap of LIFE_TICKS_LOW. [seen]
 *
 * The carry is one-to-one: watched under MAME, this cell's step count equalled the low place's wrap
 * count exactly, in every run. Zeroed together with the high place, as a word, by the life-start
 * routine.
 */
export const LIFE_TICKS_MID = 0xad06;

/**
 * High place of that counter, stepped once per wrap of LIFE_TICKS_MID. [code]
 *
 * The chain's third place. It is reached only through a pointer walk, so the address appears in no
 * instruction operand anywhere in the image. NOT OBSERVED TO MOVE: across 72000 frames of four tapes
 * the middle place never got past 0x55, so this cell took no step at all and only the life-start
 * routine's zeroing was ever seen. The mechanism is the same as its two siblings'; that it ever
 * carries is not established.
 */
export const LIFE_TICKS_HIGH = 0xad07;

/**
 * How many rescue awards this life has already been paid, which is the rung the next one takes. [seen]
 *
 * Read before it is stepped, so the first award of a life is paid at the bottom rung. The first four
 * rungs each select their own value; every rung after them takes the same top value.
 *
 * Watched under MAME with a write tap it took the values 1, 2 and 3 from the award poster's step and
 * was reset by the life-start routine -- five times on one tape and ten on another -- which is what
 * fixes the scope as a life rather than a round or a credit.
 *
 * ★ There is a THIRD writer and it is easy to miss: a bulk clear over the block this address sits
 * in appeared in the same write tap. A claim that the poster and the life-start reset are its only
 * writers is false.
 */
export const PARACHUTIST_RUNG = 0xa8f7;

/**
 * A copy of one character cell's glyph, taken so the anti-tamper machinery can check later that the
 * display still says what it should. [code]
 *
 * Written by the routine that takes the copy and by one other site, both with the same glyph code;
 * three separate guards then compare the live cell against this copy, or this copy against that
 * glyph as a literal, and divert into data when they disagree. It is the same shape as
 * TAMPER_WITNESS on a different pair of cells.
 *
 * The cell it is copied FROM is in the character plane rather than work RAM, so it is outside this
 * registry's window and stays a bare address; it is rewritten constantly by the caption painter,
 * and under MAME the two disagree for most of a run, so the guards' failing arms are NOT dead.
 */
export const TAMPER_GLYPH_COPY = 0xab43;

/**
 * Whether the picture is the right way up for whoever is playing: 1 upright, 0 turned round. [seen]
 *
 * The vblank service rewrites it every frame -- 1 unconditionally, then 0 only when the cabinet cell
 * says cocktail AND the player-select cell is clear -- and hands it straight to the LS259 bit the
 * board reports as flip-screen. Three routines read it and all three read it as orientation: the
 * sprite publish chooses between its upright and turned-round transform sets, the control reader
 * chooses which cabinet panel to hand back, and loc_13cc chooses which corner to flood from.
 *
 * Watched under MAME it takes exactly two values and no others across 29400 frames. With the Cabinet
 * dip at its default it held 1 on every frame after the first interrupt and the clearing store never
 * ran at all; with the dip at cocktail and a second player started it took 0 for 3007 frames, and the
 * sprite publish's turned-round arm went from 1 dispatch to 3008 in step.
 *
 * Three writers, and the third matters: boot clears the whole of work RAM, so the cell reads 0 --
 * "turned round" -- until the service's first store. That is why the turned-round publish arm runs
 * exactly once on a cold machine. The clear agrees with the name rather than excepting it.
 */
export const SCREEN_UNFLIPPED = 0xa987;

/**
 * Which era (the manual's ROUND) is being played, 0-4. [seen]
 *
 * The single most widely read cell in the game and, until this pass, the most conspicuous one with
 * no name. Dozens of transcribed routines key on it.
 *
 * ★ It is NOT one switch. Subsystems read it against their own thresholds and therefore step at
 * different rounds: the routine that arms the player's speed splits it {0}, {1,2}, {3,4}, while the
 * scenery dispatcher splits it {0}, {1,2,3}, {4}. Anything treating "the era" as one bundle of
 * settings will predict changes that do not happen.
 *
 * Watched under MAME it advances during the attract DEMO as well as in play, which is one reason
 * the demo cannot be told from a game by watching game state alone.
 *
 * It wraps to 0 when the game loops back to the first era, so the second loop's first era runs at
 * the first loop's speed; the escalation the manual describes for later rounds lives elsewhere.
 *
 * One reader shifts this cell up by four bits and masks the low nibble away. That is not a hint of
 * hidden state -- it is building a composite index, era in the high nibble and a per-era rung in
 * the low, into a table of five eras by sixteen rungs.
 */
export const ERA_INDEX = 0xad04;

/**
 * Enemies still to destroy before the Mother-Ship appears -- the manual's 56. [code]
 *
 * Counts DOWN. Loaded from a cell that is itself loaded once at boot from a single ROM byte whose
 * value is 56, and it is not era-keyed, loop-keyed or difficulty-keyed: the quota is the same in
 * every round of every loop on every setting. The escalation the manual describes for later rounds
 * is a different cell entirely.
 *
 * Only the ordinary enemy-craft slots decrement it -- not projectiles, not the middle-size bomber,
 * not the Mother-Ship, not the pickup -- so shooting a bullet scores without advancing the round.
 *
 * The bar along the bottom of the screen is a direct rendering of this cell, which is why nothing
 * in this game times the player: the one public source calling it a "time bar" was watching the
 * kill meter fill.
 */
export const KILLS_REMAINING = 0xad02;

/**
 * Per-frame world scroll, the component that lands in a sprite entry's NATIVE-Y byte. [seen]
 *
 * 8.8 fixed point, and it is the camera rather than any object's: one routine writes the pair once
 * a frame as the negation of the player's own velocity, and another zeroes both at life start.
 * Every site that reads this one pairs it with the same coordinate — whole part at the sprite
 * entry's `+0x31`, fraction at the object record's `+3` — and never with the other. Its magnitude
 * is era-keyed, taken from one of several ROM velocity tables, so there is no fixed scroll speed.
 *
 * ★ X AND Y HERE ARE THE NATIVE RASTER AXES, NOT THE PLAYER'S — and for this board those are not
 * the same axes. The name says which sprite-record FIELD the value lands in, which is what makes
 * it checkable on the spot beside `sprite + 49`; it makes no claim about the glass. The board is
 * ROT90 (clockwise), so native Y is the display's HORIZONTAL axis, mirrored:
 * `display_x = 239 - native_y`. A positive value here therefore slides the whole world LEFT on the
 * glass. Read as "horizontal" this name gives the right direction under the wrong axis; read as
 * screen-vertical it is simply wrong.
 *
 * Grounded under MAME by forcing this cell alone while the other stayed zero: every scenery
 * object's native Y moved at its own parallax fraction and its native X moved by exactly zero,
 * and the displayed picture shifted horizontally with no vertical component.
 *
 * ★ Prose written in DISPLAY axes calls this the horizontal — or "X" — scroll. Such a reading is
 * CROSSED against this name rather than disagreeing with it; the frozen oracle's transcription of
 * ROM 0x4017 labels the pair that way.
 */
export const WORLD_SCROLL_Y = 0xa808;

/**
 * Per-frame world scroll, the component that lands in a sprite entry's NATIVE-X byte. [seen]
 *
 * The other half of the same vector, on the same terms as WORLD_SCROLL_Y: written and zeroed by
 * the same two routines in the same breath, read by a set of sites disjoint from that cell's, and
 * always paired with the coordinate whose whole part is the sprite entry's `+0x00` byte and whose
 * fraction is the object record's `+5`.
 *
 * ★ Under the board's ROT90 native X is the display's VERTICAL axis (`display_y = native_x`), so a
 * positive value here slides the world DOWN the glass. Same grounding run, same result with the
 * axes exchanged: forcing this cell alone moved every scenery object's native X and left its
 * native Y at exactly zero, and the displayed picture shifted vertically with no horizontal
 * component.
 *
 * The structure ends here: the two words occupy 0xA808-0xA80B. The bytes flanking them —
 * 0xA803-0xA807 below, up to the live player-record fields, and 0xA80C-0xA80F above, before a
 * different structure begins — are touched by nothing but the two bulk RAM clears, in every run we
 * have watched. That is "dead in everything observed", not "provably never used".
 */
export const WORLD_SCROLL_X = 0xa80a;

/**
 * State byte of the player's own record, which begins at this address. [seen]
 *
 * 0xFF is alive; 0xF0 starts the death; 0x00 is torn down. Six routines had six different local
 * names for it (an attacker's state, a guard, a target flag, a mover flag, the first state, the
 * player's state) and this reconciles them.
 *
 * Watched under MAME with a write tap that recorded the program counter of every write across a
 * driven game: the writers are the life-start routine (0xFF, twelve times), the pair that reloads
 * and counts down a death timer, three collision sweeps that store 0xF0, and one teardown storing
 * zero. Every 0xF0 was followed within a frame by the countdown reload and, at its end, by a fresh
 * 0xFF from the life-start routine — nine complete death-to-respawn cycles.
 *
 * ★ It is NOT a shot. Watched against the fire button over twelve thousand frames the cell is
 * alive on much the same share of frames whether the button is down or up, and the sprite entry
 * its record drives stays pinned at one screen position while the world scrolls past.
 *
 * ★ 0xA800 is also the base of work RAM, and several fixtures use the bare address for that —
 * a record base, a scratch cell, the start of a clear loop. Those are the address, not this cell.
 */
export const PLAYER_STATE = 0xa800;

/**
 * Free-running frame counter, advanced once per vblank service. [seen]
 *
 * Thirteen routines read it and had eight different local names for it; readers take a bit of it
 * as a coin toss, or halve it to slow an animation down.
 *
 * Watched under MAME across two thousand consecutive frames after boot it advanced by exactly one
 * on every frame — never zero, never two. (Before that, during the boot stretch where the service
 * is not yet running, it stands still; a reader that assumes a value here is elapsed time from
 * power-on will be short by that stretch.)
 */
export const FRAME_TICK = 0xa980;

/**
 * Lines of the character plane still to blank in the wipe now running. [code]
 *
 * Counted down one per call by the routine that blanks a single line, which leaves the zero test
 * in the flags; the callers return early while it is non-zero, so the wipe is spread over frames
 * rather than run to completion in one. Written with the run length by the routine that starts a
 * wipe, alongside the cursor below.
 */
export const BLANK_LINES_LEFT = 0xa988;

/**
 * Where the next line of that wipe starts — a 16-bit cell address in the character plane. [code]
 *
 * Advanced by ONE per line, not by a line's worth of cells: the routine walks a line by stepping
 * 32 cells at a time and the next line is the neighbouring cell of the first.
 */
export const BLANK_LINE_CURSOR = 0xa989;

/**
 * The command ring's CONSUMER cursor: which cell the foreground loop reads next. [code]
 *
 * A byte offset into COMMAND_RING, stepped two on per command taken and wrapped to the ring's
 * length. Its producer-side twin is the neighbouring cell 0xA9B2, which the queueing routine steps
 * and which nothing here touches — that split is what makes this one the read cursor rather than
 * simply "the ring cursor".
 */
export const COMMAND_READ_CURSOR = 0xa9b3;

/**
 * The 64-cell command ring: command byte and argument byte in adjacent cells. [code]
 *
 * A cell whose high bit is set holds no command. One routine fills the whole ring with 0xFF at
 * init, the queueing routine writes a pair only into a free cell, and the foreground loop restores
 * 0xFF to both cells of a pair as it takes it.
 */
export const COMMAND_RING = 0xac00;

/**
 * A character cell copied out of the display when the image checksum fails, glyph then colour. [code]
 *
 * Written only by the failing arm of the routine that folds a block of the program image, and read
 * by a routine that compares this cell against one glyph code and the next against two colours,
 * taking a different path on a match. So it is not scratch: it is a mark one part of the anti-tamper
 * machinery leaves for another to find.
 *
 * The arm that writes it cannot run on a genuine image — the fold comes to exactly the compared
 * value — so what this cell does downstream is derived from the code and cannot be watched.
 */
export const TAMPER_WITNESS = 0xad39;

/**
 * Write pointer of the deferred character-write list, which runs from 0xAE04. [code]
 *
 * The routine that queues a tile block appends four bytes per cell here — address low, address
 * high, glyph, attribute — stepping the pointer WITHIN its own page, so a full list wraps onto its
 * own head. The routine that drains the list reads this to learn how many entries are waiting, and
 * treats a pointer still at 0xAE04 as empty.
 */
export const DEFERRED_WRITE_CURSOR = 0xae00;

/**
 * Base of the seventeen-byte shift register the pseudo-random generator advances. [seen]
 *
 * Every draw moves the block one place along and fills the vacated head with the exclusive-or of
 * two taps, so this cell is both the newest byte and the whole register's handle. It is seeded from
 * seventeen bytes of the program image -- on a cold machine and again at each attract demo start,
 * the same seventeen bytes every time -- and nothing else writes it.
 *
 * Watched under MAME across a run covering boot, attract, the demo and a driven game, the head took
 * writes from exactly two program counters: the generator's own feedback store, and the seeder's
 * block copy. The values it took spread across the byte range with no value dominating.
 *
 * ★ Anything that pins this game's entropy pins THIS register.
 */
export const RANDOM_REGISTER = 0xab30;

/**
 * The kill quota a round is armed with: how many enemies the next round will ask for. [seen]
 *
 * Loaded once at boot from a single ROM byte and read only by the routine that starts a round,
 * which copies it into KILLS_REMAINING. It is not era-keyed, loop-keyed or difficulty-keyed, so the
 * quota is the same in every round of every loop on every setting.
 *
 * Watched under MAME for a run covering boot, attract, the demo and a driven game it took exactly
 * one write -- at boot, value 0x38, which is 56.
 */
export const KILL_QUOTA = 0xa9cd;

/**
 * How many more hits the big two-slot object can absorb before it dies. [seen]
 *
 * Counts DOWN, and the routine that receives a hit is what fixes the role: if this cell is non-zero
 * it decrements it, puts the object's state back to alive, requests a sound and returns the object
 * to its live handler -- the hit is ABSORBED. Only when the cell is already zero does that routine
 * fall through to the explosion and the retire. So an object armed with 3 takes four hits, which is
 * the count `mechanisms.md` derives independently for the second era's bomber and the manual
 * states.
 *
 * ★ It is also what the object LOOKS like. The second era's dresser reads it as `3 - cell` to pick
 * one of four shape blocks, so the sprite shows its damage; and the ram path zeroes it, which is
 * why ramming kills outright instead of costing one hit.
 *
 * Watched under MAME it was armed to 3 by one routine and walked down 2, 1, 0 by the absorb path.
 * It is not the only writer. Power-on clears the WHOLE of work RAM (0xA800-0xAFFF, the `ldir` at
 * 0x0091), so boot writes every cell in the page and no cell is exempt from that. Two narrower
 * blocks are cleared again later, but by the ATTRACT SETUP rather than by a round: both sit behind
 * a test of the play flag and are skipped exactly when a credited game begins. Any "nothing else
 * writes it" claim elsewhere in this file is about the game's own stores and not about either
 * wipe. That capture
 * reached only the first two eras, so the values seen are 0-3; whether a later object arms it
 * higher is not established here.
 */
export const HITS_REMAINING = 0xa8dc;

/**
 * Which round is being played, counting on without wrapping. [code]
 *
 * ★ NOT the same thing as ERA_INDEX, and the difference is the whole reason this cell exists. The
 * era is this count wrapped to five; this one keeps going, which is what lets the game get harder
 * on the second lap through the same five eras. Stepped once per completed round by the routine
 * that starts one, and read three ways that only make sense of an unwrapped ordinal: bracketed
 * against 6 and 11 to pick the round's difficulty byte, compared against 100, and passed as the
 * argument of a ring command whose handler decomposes a value into counts of thirty, ten, five and
 * one.
 *
 * It is per player. Watched under MAME the only writes in a whole run came from the sixteen-byte
 * context copy that swaps a player's block into 0xAD00, which seeded it to 2 for the attract demo
 * and 1 for a real game; the routine that steps it needs a completed round, and no watched run
 * completed one.
 */
export const ROUND_NUMBER = 0xad01;

/**
 * Address -> idiomatic routine. Artifact three of the four: a module that is not in here is
 * never dispatched, so it is written-and-never-executed no matter how green its own gate is.
 *
 * `name` IS the filename (`./<name>.js`), one-to-one. `entry` overrides the export name only
 * where a routine is deliberately a pure function of its inputs rather than a `fn(m)`.
 * `cert` uses the same evidence vocabulary as the cell names above.
 */
/**
 * SETTLED IN PASS 1, kept because the shape of the answer matters. Two routines here retire an
 * object and a third site inlines the same stores; no file calls more than one, so these are
 * per-family helpers rather than versions of one. The mechanical difference is that one also
 * clears the sub-pixel remainders. Whether that is observable depends on the spawn path: some
 * reinitialise those cells immediately after marking a slot live, others have not been shown to.
 *
 * STILL OPEN: whether the two families were meant to differ here, or whether this is two habits.
 * Code cannot settle it.
 */
/**
 * Which of the two players is up: 0 for player one, 1 for player two. [seen]
 *
 * A one-bit index and the whole of the two-player machinery. Everything that is per player is
 * reached through it: the sixteen-byte context block copied in and out at 0xAD00, the score triple
 * (0xAD33 or 0xAD36), the score drawer, and the caption the game announces a turn with.
 *
 * Three writers, and the ROM and the machine agree on which three. A decode from every byte offset
 * of the whole image finds exactly three instructions that store here; a MAME write tap with
 * program-counter attribution, over 600 s of two-player play, recorded eleven writes from exactly
 * those three -- handPlayOverToOtherPlayer's flip, the game-over teardown that clears it alongside
 * the play flag, and the new-game init that clears it alongside both save blocks. It never held a
 * value other than 0 or 1. (Boot's clear of all work RAM is a fourth writer no tap can see; it
 * writes zero, which is consistent.)
 *
 * ★ Its POLARITY is grounded, not assumed. A one-player start arms PLAYER_ONE_LIVES and leaves
 * PLAYER_TWO_LIVES at zero, and this cell stays 0 for the whole game; the save and the restore both
 * map 0 to the first block; and the caption posted on 0 spells the digit one where the caption
 * posted on 1 spells two.
 *
 * ★ Six routines had five different local names for it -- a second-player flag, a tally selector,
 * a cell cleared alongside another. Those are one routine's view of an index.
 */
export const ACTIVE_PLAYER = 0xad32;

/**
 * Lives the ACTIVE player has left, in the live context block. [seen]
 *
 * Counts DOWN, and reaching zero is what ends that player's turn rather than the game: the routine
 * that decrements it branches away to the teardown path only when the decrement made it zero.
 *
 * Watched under MAME with a program-counter write tap through a 600 s two-player game it took 22
 * writes from exactly three instructions, and the three between them ARE the life cycle: the
 * decrement taken on a death, the sixteen-byte context copy that swaps a player in, and an
 * increment inside the routine that awards an extra life at a score mark. Nothing else wrote it.
 * (Boot's clear of all work RAM is the fourth writer, and no tap can see it.)
 *
 * ★ What the player SEES is this value minus one -- the reserve display is posted as a ring command
 * whose argument is read here and decremented first, both where the count changes and where a
 * context is swapped in. A reader who matches the cell against the ships on the glass will be off
 * by the one in the air.
 */
export const LIVES_REMAINING = 0xad00;

/**
 * Player one's lives, in their saved sixteen-byte context block at 0xAD10. [seen]
 *
 * The block is a mirror of the live one at 0xAD00, and this is its first byte. It is written by the
 * save copy taken when a life is lost, by whichever start path armed the game, and by nothing else
 * in a watched run; it is read directly by the routine that refuses to start a new game while
 * either player still has lives, and by the hand-over test that asks whether the other player has
 * any left.
 *
 * Grounded by the pair of runs that differ only in which start button is pressed: a ONE-player
 * start put the starting count here and zero in PLAYER_TWO_LIVES, a two-player start put the count
 * in both. That, with ACTIVE_PLAYER's polarity, is what makes this one PLAYER ONE's and not merely
 * the first of two.
 */
export const PLAYER_ONE_LIVES = 0xad10;

/**
 * Player two's lives, in their saved context block at 0xAD20 -- the same byte, the other block. [seen]
 *
 * Same writers, same readers, same grounding run. It is ZERO for the whole of a one-player game,
 * which is exactly what makes a hand-over impossible there: the branch into
 * handPlayOverToOtherPlayer is taken only when the block the index does NOT select still has a
 * non-zero first byte.
 */
export const PLAYER_TWO_LIVES = 0xad20;

/**
 * The sequence machine's shared one-shot delay: frames still to wait before its next step. [code]
 *
 * One cell, not one per step. Every writer found so far either ARMS it with a span or COUNTS THAT
 * SPAN DOWN by one. Most countdowns sit at the head of a step and return while the cell is still
 * running, so the step's body runs only on the frame it reaches zero, and most arm sites hand on to
 * the routine that advances the inner sequence index.
 *
 * ★ One writer is neither of those, and it is why this description carries no tally. The delay loop
 * at 0x32EB arms the cell and then counts it down inside its OWN body, with a bare `dec (hl)` whose
 * HL was loaded before a nested inner loop. A scan keyed on 0xA9EB is NOT blind to this routine --
 * it finds the arm sixteen bytes above and stops there, because nothing in it can attribute a
 * SECOND write at a site it has already counted. A MAME write tap can, and did: it caught a writer
 * at every site predicted from the image except one no tape reached, and then this one, which no
 * prediction contained. No run can rule out a further writer in a state none of them drove.
 *
 * `[code]` and not `[seen]`: the writers were watched, but that its users are all the SEQUENCE
 * machine is read off the code rather than observed -- and the delay loop above is a counterexample
 * to the tidier version of that claim.
 */
export const SEQUENCE_DELAY = 0xa9eb;

/**
 * Which of the eight Difficulty DIP positions the cabinet is set to, 0-7. [seen]
 *
 * Three bits, unpacked at boot out of the DSW1 port by the same shift chain that fills the cabinet
 * and demo-sound cells, and read at exactly one place: the credited-game init, which hands it to
 * loadDifficultyRecord as the index into an eight-record table.
 *
 * Grounded by driving the DIP through all eight of its positions on the real ROM under MAME, one
 * process per position with its own cfg directory, and reading THIS cell back rather than the
 * setting -- a CPU-read tap would bypass the port object. It took the eight values 0 through 7, in
 * the order of the eight settings MAME's own port definition labels 1 (Easiest) through
 * 8 (Difficult), and the four record cells below followed it row for row.
 *
 * ★ Zero is EASIEST. The cell counts up as the cabinet gets harder, which is MAME's label minus one.
 */
export const DIFFICULTY_SETTING = 0xa9c4;

/**
 * The escalation rung a round STARTS on, for the first five rounds. [seen]
 *
 * First byte of the four-byte record loadDifficultyRecord copies out of the difficulty table. It is
 * read by startNextRound, which brackets on rounds completed -- this cell below 6, the next at 6 to
 * 10, the one after at 11 and up -- and banks the answer in the per-player context block, from
 * which the life-start routine seeds ERA_RUNG.
 *
 * Watched under MAME at all eight DIP positions it took 0, 0, 0, 2, 4, 7, 11, 15 as the setting
 * hardened, and at every position ERA_RUNG itself was observed holding that same value once play
 * began. So the hardest cabinet starts a round at the rung the easiest one has to climb to.
 *
 * ★ It is NOT a difficulty tier. All three bracket cells come from the SAME record and therefore
 * from the same DIP position; what separates them is how many rounds the player has completed, not
 * how hard the cabinet is.
 */
export const START_RUNG_ROUNDS_1_5 = 0xa9d3;

/**
 * The same, for rounds six to ten. [code]
 *
 * Second byte of the same record; startNextRound reads it when the round number is at least 6 and
 * below 11. `[code]` and not `[seen]` for a specific reason: no run we have driven completed a
 * round, so the round number never reached 6 and this bracket was never taken. Its VALUES were
 * watched arriving here at all eight DIP positions -- 2, 3, 4, 6, 8, 10, 13, 15 -- and they are
 * uniformly at or above the first bracket's; that it is read on the rounds claimed is from the code.
 */
export const START_RUNG_ROUNDS_6_10 = 0xa9d4;

/**
 * The same, for round eleven and up. [code]
 *
 * Third byte of the same record, on the same terms as the cell above and unread for the same
 * reason. Its observed values are 6, 7, 8, 10, 12, 13, 14, 15 -- at or above the second bracket's
 * at every position, so the three together are a ladder in rounds as well as in the DIP.
 */
export const START_RUNG_ROUNDS_11_UP = 0xa9d5;

/**
 * The heading the player's ship is flying, a full byte = 256 steps of the circle. [seen]
 *
 * Third byte of the player's own record, whose head is PLAYER_STATE -- so it is offset +0x02, the
 * "current heading" of the record layout every actor family shares. The life-start routine seats it
 * at 0x80; the control reader's steering converges it toward a target; the routine that builds the
 * camera negates the velocity it looks up from it; and dressPlayerSpriteForHeading turns it into the
 * shape the ship is drawn with.
 *
 * Grounded by sampling it once a frame through a credited game under MAME against the sprite entry
 * it drives: with the ship alive, the entry's shape and attribute equalled the two ROM tables'
 * entries for this cell's sector on 4419 samples out of 4419, while the entry's two coordinate bytes
 * never moved off the pinned 0x84 / 0x78. Samples taken while the ship was not alive were excluded
 * and counted, not dropped.
 *
 * ★ This exact name was already carried for this address elsewhere in the layer before this pass,
 * from a different reading.
 */
export const PLAYER_HEADING = 0xa802;

/**
 * State byte of the Mother-Ship's record, which begins at this address and runs two slots. [seen]
 *
 * Same alphabet as every other slot -- 0x00 free, 0xFF live, 0xF0 just hit, a countdown below that.
 * What is different is that ONE object occupies this record and the one a stride on: the arming path
 * refuses unless both occupancy bytes are clear and the kill quota has reached zero, the retire
 * helper it hands off to clears both of the two neighbouring sprite entries, and the two ordinary
 * per-slot handlers for these two records return early for as long as MOTHER_SHIP_ARMED is up.
 *
 * Watched under MAME across a run with the kill quota forced empty: armed and torn down four times,
 * taking 0x00, 0xFF and a dying countdown, with the arming writing seven into the record's fifth
 * byte every time.
 *
 * ★ It was carried under several different local names before this pass, none of them agreeing
 * with another.
 *
 * ★ The noun is the part to overrule if you want to. What is MEASURED is: a two-slot object armed
 * exactly when the kill quota empties, with a counter armed to seven, whose ram test widens on one
 * axis in the first and last eras. What makes it the Mother-Ship is that the quota is 56 and the
 * counter is 7, which are the two numbers the manual gives for it, and that mechanisms.md derives
 * the same object under that name from a separate reading. Substitute BIG_TARGET_STATE and
 * BIG_TARGET_ARMED throughout if you would rather the registry stayed clear of the noun; nothing
 * else in this patch changes.
 */
export const MOTHER_SHIP_STATE = 0xa8a0;

/**
 * Raised while this round's Mother-Ship has been armed. [seen]
 *
 * All-ones or zero. One writer raises it -- the arming path, in the same breath as putting seven
 * into the hit counter -- and the only two that clear it are the round start and the life start, so
 * it stays UP after the object is destroyed, until the round turns over. A reader who takes it for
 * "is on screen right now" will be wrong for the rest of the round.
 *
 * Every reader of it reads it as "the two slots at MOTHER_SHIP_STATE are taken": the
 * shot sweep swaps a seven-craft run for a five-craft one and adds the Mother-Ship, a spawn walk
 * shortens its own run to five, the two per-slot handlers for those two records return early, and
 * the parachutist spawn refuses outright.
 *
 * Grounded by two MAME runs differing in one line of the driver -- whether the kill quota is forced
 * to zero. In the control it never left zero and the sweep arm that reads it took ZERO dispatches
 * while its caller took 2090; in the poked run it went up four times and that arm took 1361, every
 * one of them with this cell set.
 */
export const MOTHER_SHIP_ARMED = 0xad0d;

/**
 * Write pointer of the SECOND deferred cell list, the one holding what to blank. [seen]
 *
 * The twin of DEFERRED_WRITE_CURSOR, four bytes ahead of its own entries at 0xAE84 and stepped
 * within its own page in the same way. Nothing appends to this list entry by entry: once a pass, the
 * routine that drains both copies the paint list onto it wholesale and stores this cursor as the
 * paint cursor's low byte plus 0x80. That top bit is why its reader masks the byte before scaling it
 * to a count, and it is the only difference between the two drains' arithmetic.
 *
 * Grounded by a character-plane write tap under MAME attributed by program counter: over 3767 passes
 * the cells blanked from this list were exactly the cells painted from the other one on the pass
 * before, in both directions, with no exceptions.
 */
export const DEFERRED_BLANK_CURSOR = 0xae80;

/*
 * Enemy-craft slots: the 7-slot actor sub-band. Records at 0xA850 (stride 0x10) paired to sprite entries
 * at 0xAA1A (stride 0x02), lockstep 8:1 (entry = 0xAA10 + (record-0xA800)/8). Slots 0-6; slot 5 is the
 * Mother-Ship (MOTHER_SHIP_STATE 0xA8A0 / entry 0xAA24). Each cell below is the BASE of a whole record or
 * entry, not a scalar: record +0x00 = state head (0x00 free / 0xFF live / 0xFE held / dying-count), entry
 * +0x00 = X, +0x01 = tile, +0x30 = attribute, +0x31 = Y. See mechanisms.md §4.
 */

/**
 * Slot 0's record, and the iteration base of the whole 7-slot craft band. [code]
 *
 * Every whole-band walker seats ix/hl here and strides +0x10 -- the wave builder, the reaim/animate pass,
 * the wave spawner, the kill sweep, the animation-stop -- and the slot-0 per-slot handler also seats it.
 */
export const CRAFT_RECORD_SLOT0 = 0xa850;

/** Slot 1's record head; its per-slot handler seats it and tails into the era body. [code] */
export const CRAFT_RECORD_SLOT1 = 0xa860;

/** Slot 2's record head. [code] */
export const CRAFT_RECORD_SLOT2 = 0xa870;

/** Slot 3's record head. [code] */
export const CRAFT_RECORD_SLOT3 = 0xa880;

/**
 * Slot 4's record head, and the seat of the "cleared" free-slot spawn search. [code]
 *
 * When the kill quota is spent the search runs a fixed five slots starting here (spilling past the band's
 * end through the Mother-Ship slot into the era-special bank).
 */
export const CRAFT_RECORD_SLOT4 = 0xa890;

/**
 * Slot 6's record head (the last ordinary craft slot), with two extra duties. [code]
 *
 * It seats the "owed" free-slot spawn search (run length = ROUND_CRAFT_COUNT), and it is the Mother-Ship's
 * SECOND record when the boss is armed -- so slot 6's per-slot handler stands down while MOTHER_SHIP_ARMED
 * is set. (Slot 5, between slot 4 and this, is MOTHER_SHIP_STATE.)
 */
export const CRAFT_RECORD_SLOT6 = 0xa8b0;

/**
 * Slot 0's sprite entry, and the iteration base of the whole entry band; paired with CRAFT_RECORD_SLOT0
 * in every whole-band walk (entry stride +0x02). [code]
 */
export const CRAFT_ENTRY_SLOT0 = 0xaa1a;

/** Slot 1's sprite entry (paired with CRAFT_RECORD_SLOT1). [code] */
export const CRAFT_ENTRY_SLOT1 = 0xaa1c;

/** Slot 2's sprite entry. [code] */
export const CRAFT_ENTRY_SLOT2 = 0xaa1e;

/** Slot 3's sprite entry. [code] */
export const CRAFT_ENTRY_SLOT3 = 0xaa20;

/** Slot 4's sprite entry, and the "cleared" spawn-search entry-cursor seat (parallel to CRAFT_RECORD_SLOT4). [code] */
export const CRAFT_ENTRY_SLOT4 = 0xaa22;

/**
 * Slot 6's sprite entry: the "owed" spawn-search entry-cursor seat, and the Mother-Ship's second sprite
 * entry when armed (parallel to CRAFT_RECORD_SLOT6). [code]
 */
export const CRAFT_ENTRY_SLOT6 = 0xaa26;

export const ROUTINES = {
  0x43b7: { name: "armMotherShipOrStep", role: "once-in-eight-frames gate for the Mother-Ship: while the wave-hold flag 0xacc6 is clear, defer to the deep-state stepper (stepMotherShip) if it is already live (MOTHER_SHIP_ARMED 0xad0d != 0), else -- only when the kill quota (KILLS_REMAINING 0xad02) is spent and both records of its two-slot bank (0xa8a0/0xa8b0) read empty -- arm it (0xad0d=0xff), seed the lead record's seven-hit counter (ix+0x04=0x07), and retire the matching entry pair into cooldown to spawn it", cert: "code" },
  0x1199: { name: "serviceRoundThenResolvePlayerState", role: "the round engine's service list (substep 7 of the phase-3 dispatch at 0x0f29; runs per dispatch, short of the frame count): run each subsystem service in fixed order, then read the player-state byte at 0xa800 and advance the round when it is 0xff (alive), hand a life over when it is 0 (dead), else return", cert: "code" },
  0x31b4: { name: "reaimAndAnimateEnemyCraftOnPhaseTick", role: "on the 00s and 30s tenths of the packed-decimal life counter 0xad05, service enemy-craft slot (units digit, only slots 0-6 whose record head at 0xa850 reads 0xff): advance that record's shape animation, then unless the state byte at ix+8 is 0x10 re-aim its heading toward a point the state byte indexes out of the aim table at 0xac65 -- state 0x11 aims at the table base, stores heading+0x80 into ix+1 and resets the record to state 0x10, every other state stores the heading straight into ix+1; on every other tenth hand off to loc_326c", cert: "code" },
  0x36af: { name: "driveEnemyWaveForLifePhase", role: "enemy-wave substep: while the wave-hold cell 0xacc6 is clear, dispatch by era and life-phase -- era 4 to spawnEnemyWaveIntoFreeSlots, phase 7 to stopFiveSlotAnimations, phase below 7 to gateTheFreeSlotSearchAndPickItsRun, phase 8 to loc_379f; at phase 9+ with the low life-tick 0xad05 spent, spawn a fresh wave inline across the 0xa850/0xaa1a craft band from a heading-biased shape run, then request a sound once enough of the five slots filled", cert: "code" },
  0x40d6: { name: "sweepEra2PlusObjectBank", role: "entry to the per-slot sweep over an object bank: return early below era 2 (ERA_INDEX 0xad04) or when the bank's slot count (0xa8c6) is zero, else seat the record cursor (0xa8c0), the sprite-entry cursor (0xaa28) and the turn count, and run the sweep body at 0x40ea", cert: "code" },
  0x3b5f: { name: "serviceEra1BomberObject", role: "era-1 only: dispatch the single object at record 0xa8c0 by its head byte -- 0 arms its fire timer (armBomberSlotWhenTimerFires), 0xff runs the two-tile move (advanceTwoTileObjectThenTryAimedSpawn), any other value advances a hit-soaking object toward death (advanceHitSoakingObjectThenAnimateDeath); returns untouched outside era 1", cert: "code" },
  0x3fea: { name: "serviceEra0BallisticObjectBank", role: "era-zero-gated top-of-frame entry to the three-slot ballistic-object bank (dispatched as serviceRoundThenResolvePlayerState's substep 7): returns at once unless ERA_INDEX 0xad04 is 0, else seats the cursors (record ix=0xa8c0, sprite iy=0xaa28, count b=3) and routes the first slot by its marker byte -- step an empty slot via loc_400b, fly a ballistic (0xFF) slot then step it, else hand any other marker to sweepObjectSlotBankServicingFirstSlot", cert: "code" },
  0x4e4f: { name: "dispatchCollisionPassByEra", role: "dispatch one round's per-frame collision pass by ERA_INDEX (0xad04): era 4 to loc_4f2a, era 1 to splitCollisionWorkByFrameParity, every other era split on FRAME_TICK's (0xa980) low bit to loc_4f35 (odd) else runAllCollisionSweepsThisFrame (even); reached from the substep-7 dispatcher 0x1199", cert: "code" },
  0x2927: { name: "serviceEra0EnemyCraftSlot", role: "era-0 per-object update dispatched by index 0 of the rst-0x30 era table at 0x2914: on the object status byte at (ix+0) it leaves an empty slot (0), releases a held object (0xFE), steps a dying one (any other value), or steers/flies/refreshes an active craft (0xFF) and lets it spawn, retiring it the frame it reaches the line", cert: "code" },
  0x2984: { name: "serviceEra2EnemyCraftSlot", role: "era-2 per-slot object handler (index 2 of the 0x2914 rst-0x30 era table, ERA_INDEX 0xad04 low three bits == 2), dispatched on the slot's state byte (ix+0): 0x00 idle returns; 0xFF active steers toward its aim 3 frames in 4, flies at the slowest speed, retires the slot once it reaches a retire line, else dresses its sprite and runs two gated enemy-launch attempts; 0xFE releases the held object; any other value steps the dying-object state", cert: "code" },
  0x29b0: { name: "serviceEra3EnemyCraftSlot", role: "era-3 per-object-slot step, dispatched on the slot's lifecycle byte at ix+0: idle does nothing; a live slot (0xff) is steered, dressed, then retired at the line or flown on and given a spawn attempt; 0xfe releases a held slot; a lower value is a death-countdown step", cert: "code" },
  0x29d5: { name: "serviceEra4EnemyCraftSlot", role: "era-4 (ERA_INDEX 0xad04=4) per-object slot service, index 4 of the 0x2914 rst-0x30 table: on the slot's lifecycle byte at (ix+0) it returns when free (0), releases when held (0xfe), steps the dying animation for any other value, and when live (0xff) steers the slot toward the ship then either retires it once it reaches a retire line or animates its shape, runs the gated launch attempt, and launches an attacker into a free slot", cert: "code" },
  0x0069: { name: "clearWorkRamAndSpriteBanksThenColdInit", role: "cold-start clear reached once at boot via 0x07B1: kicks the watchdog four times, zeroes the 0xB410 sprite-bank run and the whole 2 KB work RAM, sums the fixed 256-byte program run at 0x00D8 and runs the frame service out of band on a non-genuine total, then hands off to the screen-RAM clear and image verify", cert: "code" },
  0x210e: { name: "seedDemoAutopilotScript", role: "seeds the attract-demo autopilot: picks a heading-command script by the demo selector (0xad14), writes its dwell counter to 0xadf2 and little-endian pointer to 0xadf3/4, then on a failed tile-image tamper readback (0xadfb/0xadfc) tail-jumps into the trap", cert: "code" },
  0x5866: { name: "clearScreenRamAndVerifyImageThenColdInit", role: "cold-start clear then ROM tamper check: fill colour RAM 0xA000-0xA3FF with 0x10 and video RAM 0xA400-0xA7FF with 0xf1 (bases from ROM pointers at 0x2581/0x4A37), sum the whole program ROM 0x0000-0x5FFF and test the total against 0xAF, kicking the watchdog after the first fill and once per summed byte; a genuine image tail-calls cold-start init, a tampered one derails into data at 0x59D7", cert: "code" },
  0x4bdc: { name: "paintFiveLabelledNumericReadouts", role: "paint five labelled numeric readouts up the tile plane: seat each of five source records (0xab08, stride 8), its tile-plane cursor cell (0xa711, stride 2) and its pen colour, then hand to the column painter loc_4c1f; writes tile/colour cells 0xa0f1-0xa719", cert: "code" },
  0x19f0: { name: "resetPlayfieldAndArmNewRound", role: "reset the whole playfield for a new round: clear scroll/control cells, seat the ship sprite + shot slots, retire every object slot (hold/shared-cooldown/cooldown/sub-pixel variants), clear four sprite entries, seat the era scenery band via loc_30a5, then scatter one era-selected 10-byte record from the 0x1B04 word table into the cells that arm the round", cert: "code" },
  0x3b94: { name: "advanceHitSoakingObjectThenAnimateDeath", role: "advance one hit-soaking object: while HITS_REMAINING (0xa8dc) is left, spend one, force the record head live (0xff) and re-request its sound pair before the ordinary two-tile move; once no hits remain, run the record head down (capped at 0x61) toward a retire-and-hold at 0, drift it with the world scroll, and at head 0x40 post a command / on 8-step boundaries above 0x40 reseat the sprite shape from the 0x3c09 table", cert: "code" },
  0x3b77: { name: "advanceTwoTileObjectThenTryAimedSpawn", role: "advance a two-tile object one frame: fly it along its stored velocity, then seat its second tile directly under the first (same X, Y+0x10); if loc_3cc4 answers it has reached a boundary retire it, otherwise dress the pair by heading and run the aimed-spawn attempt", cert: "code" },
  0x167b: { name: "advanceSequenceElseStartFreePlayGame", role: "a shared tail of the two-level sequence machine: when the packed-decimal credit count (0xA986) is nonzero, step the outer sequence phase and return; otherwise, only when the free-play flag (0xA9C0) is set and a start-button bit (0xA9AE & 0x18) is held, hide every sprite and start a game charging no credit", cert: "code" },
  0x23e3: { name: "fireAndSweepPlayerShots", role: "fire and sweep the player's shots: on a fire-button rising edge arm and seed one shot into a free slot of the six-slot shot bank at 0xaa80 aimed along PLAYER_HEADING; then advance every live shot by the world scroll, queue its character-cell tiles, and cull any that leaves the field or holds a stale head", cert: "code" },
  0x1edf: { name: "dispatchPlayerFrameByState", role: "seat the player record (ix=0xa800) and its paired sprite entry (iy=0xaa10), then branch on the player-state byte 0xa800: return while it is 0, run the tile-animation step (0x2010) while it is any other non-0xff value, and once it is 0xff either fly the attract demo pilot (0x214b when PLAY_ACTIVE 0xad30 is 0), turn the ship toward the read control stick (0x1f01 when the low control nibble is nonzero), or just scroll the world (0x1f42) when the stick is centred", cert: "code" },
  0x48be: { name: "serviceCoinInputs", role: "one frame of coin-input service: run the two coin-slot debounce/accept handlers and the phase-gated credit drip in turn, then pulse each mechanical coin counter once per coin still owed; dead unless an input edge or a pending debt is present", cert: "code" },
  0x4243: { name: "launchAttackerIntoFreeSlot", role: "on this object's turn of the eight-frame round, once the shared spawn cooldown (0xA8F4) has expired, walk the object-record bank for a free slot, stash its record/entry pointers at 0xA991/0xA993, and if the new object clears the two fixed lines hand the caller's facing (C=IX+0x02) to the era-0 aim launcher (0x429C) or the heading-follows launcher (0x42B7); otherwise tick the cooldown down or leave everything untouched", cert: "code" },
  0x400b: { name: "loc_400b", role: "advance-step entry of the object-bank sweep: stride one slot forward (record +0x10, sprite entry +2) and return when the count runs out; step over an empty slot, fly a ballistic (0xFF) slot a frame and step over it, and hand the first slot bearing any other marker to the servicing sweep for the rest of the bank", cert: "code" },
  0x30a5: { name: "loc_30a5", role: "sum a fixed 16-byte run against a constant as a discarded tamper tripwire, copy eight bytes of the ERA_INDEX-keyed row from the 0x3176 table into the stride-two run at 0xAA31, then tail into the scenery clear+run carrying the era in C and the fill byte 0x28 at era four else 0xCC", cert: "code" },
  0x48e7: { name: "loc_48e7", role: "per-frame debounce of IN0 bit 2 (port mirror 0xA9AE): rotate that bit into the bottom of the rolling history at 0xA983 (rl (hl)), fire only on a clean leading edge — the low three history bits reading 001 (idle, idle, pressed) — else return; on the edge request a sound (0x57F1) and award exactly one credit outright (C=1 into awardCoinCreditThenPulseCoinCounter, which folds it into the BCD credit count at 0xA986 and pulses the coin counter), a flat-credit path distinct from the coinage-metered coin-1 handler at 0x4941", cert: "code" },
  0x188a: { name: "loc_188a", role: "the two-credit copyright screen's await-start step: stamp the fixed copyright caption strip and flash its line, then dispatch on the two start-button bits of IN0_MIRROR (0xA9AE) -- bit 4 tail-calls the two-player start, bit 3 the one-player start (bit 4 wins when both are held), and with neither held it returns so the screen shows again", cert: "code" },
  0x4c1f: { name: "loc_4c1f", role: "paint a labelled numeric readout as one upward tile-plane column: a table-indexed three-tile pictogram (source lead byte x3 into 0x4cb4), a six-digit field, then a three-tile suffix, each cell paired into the colour plane with the caller's pen colour", cert: "code" },
  0x4911: { name: "loc_4911", role: "phase-gated credit drip: rotate a selector bit (from 0xA9AE) into the phase cell 0xA9CA and act only when its low 3 bits read 1 -- request a sound, bump the counter at 0xA982, step the low byte at 0xA9CB up by 0x10; once the high byte at 0xA9CC still trails the raised low byte, pull the low byte back by (high&0xF0)+0x10 and tail into awardCoinCreditThenPulseCoinCounter with C = the high byte", cert: "code" },
  0x379f: { name: "loc_379f", role: "gate a spawn tick on the packed-decimal phase byte the caller points at (return unless it is 0x00 or 0x30), count the busy heads across the seven-record enemy-craft band at 0xa850, and while fewer than two are busy run the free-slot search -- the cleared run via loc_3793 when the owed-kills cell 0xad02 is zero, else the owed run (b from the round's craft count 0xacc1, seated at 0xa8b0/0xaa26) via spawnEnemyIntoFreeSlotElseStepSearch; stages nothing when the gate is shut or two heads are busy", cert: "code" },
  0x4f2a: { name: "loc_4f2a", role: "era-4 (ERA_INDEX 0xad04=4) per-frame collision dispatch split by frame parity (FRAME_TICK 0xa980), reached only as dispatchCollisionPassByEra's era-4 tail: even frames run the whole player-vs-object collision-and-destruction pass; odd frames stage one shot-vs-target sweep over the object-slot run at 0xa810/0xaa12 (six shots, box l=7/h=0x0f), restaging the shared body's two reload cursors 0xa991/0xa993 first -- while MOTHER_SHIP_ARMED (0xad0d) is set the run is nine long and a mother-ship mutual-kill pass (0x4fe0) follows, while clear the run is eleven long and none does", cert: "code" },
  0x4447: { name: "loc_4447", role: "dress an object's sprite entry to face its heading (heading-quadrant picks a shape pair, era picks a colour, one heading half swaps the pair and the other biases the colour by half a page), unless the object has reached the field edge, in which case retire the entry pair; on the flutter era instead give a two-frame flutter and step/cap/close-out the wind-down counter", cert: "code" },
  0x4941: { name: "loc_4941", role: "one frame of coin slot 1 accounting: clock the raw coin line into a debounce shift register and, on a clean rising edge, count the coin -- blip the coin sound, bump the tally, add a unit to the coins-inserted accumulator; once it passes the coinage threshold (coins-per-credit high nibble, credits awarded low) carry the overshoot forward and, unless the no-credit flag is set, add the low nibble to the packed-decimal credit count (saturated at 99) and repaint its panel; either overshoot path then pulses the mechanical coin counter", cert: "code" },
  0x4a0f: { name: "loc_4a0f", role: "lay out one phase of the sequenced intro/self-test screen: stock an 8-byte control block at 0xA9F0 (ROM shape byte 0x3213, fixed fields, parked ROM pointer 0x56F1), write a fixed attribute run at 0xA400, colour three colour-plane rows and a small block by adding the base colour at 0xAD0C to fixed offsets, seed the active player's saved pen from its era, then tail-step the sequence sub-step; unreached by either tape", cert: "code" },
  0x27b1: { name: "loc_27b1", role: "round-start sequence arm: seat two player-object records (0xAD0C-0xAD2E) and position seeds (0xAC64=0x78,0xAC65=0x84), request a sound and load the difficulty record, then split on PLAY_ACTIVE(0xAD30) -- mid-game it queues command de=0x0400 and folds a +1 XOR checksum of 256 program bytes at 0x1550 into control latch 0xC308 (0xA9EB=0x96); on a fresh round it cycles the 1..3 stage counter at 0xA9D0, reseeds the random register, clears 0xAA80-0xAADF and 0xA800-0xA97F, SUB-checksums 256 bytes at 0x3310 into 0xA9AB (xor 0x90) and paints star field 0xAC74-0xAC83 with 0x80 (0xA9EB=0x5A); both arms tail-advance the sequence sub-step", cert: "code" },
  0x4cc3: { name: "loc_4cc3", role: "file the active player's finished score into the five-record high-score board: walk the standing scores top-down comparing each (isScoreBelow) to find the first the new score is not below, slide the records beneath down one slot (lddr), write the new score with blank 0xf1 name-cell sentinels, look up its initial-glyph row pointer, and renumber the rank column 0..4; carry returns clear when filed, set when the score beat none", cert: "code" },
  0x326c: { name: "loc_326c", role: "when the mode byte in C selects sub-mode 7 (low nibble == 7), fill sprite object 0xac64's twelve coordinate fields (0x10-0x1b) with six XY pairs around centre (0x78 across, 0x84 down): the scroll angle +0x40 and the scroll angle itself, each drawn through the velocity table (via 0x59d1) at x8 and x16 radii, the +0x40 direction also mirrored to its negatives; other sub-modes return without writing", cert: "code" },
  0x2251: { name: "loc_2251", role: "tamper-trap data table jumped into as code when the tile-ROM check fails; register churn then a store through BC that faults writing to ROM (else the hard-coded 0x228B store faults), else halt", cert: "code" },
  0x2010: { name: "loc_2010", role: "advance a phase-byte-driven tile animation: on the first frame (phase>=0xb4) clamp the phase, flag the paired entry, and cue sounds (56d2 always, 5679 past level 2) unless two game-state cells divert to loc_1f2e; else step the phase down and, on one of seven keyframe values, blit a 5x6 shape strip into video+colour RAM", cert: "code" },
  0x3ed6: { name: "loc_3ed6", role: "one gated attempt to launch an enemy into the object bank: past a phase-key match, an arm flag, a non-empty flight count, and a strided scan for a free record, three margin windows must place the aim point near the player entry and the scroll; only then does it request the launch sound, copy the entry's two coordinates into the found record's paired entry, look up a doubled velocity pair from the heading via one of two tables chosen by a select cell, stock the record with that velocity, stamp two entry constants, re-arm the flag from its source, and count the record head down one", cert: "code" },
  0x42b7: { name: "loc_42b7", role: "commission the object the free-slot finder staged, whose record/entry pointers wait at 0xA991/0xA993: copy the spawner's two coordinate pairs and the caller's facing (C) into the new slot, then fit it out one of four ways chosen by the era cell 0xAD04 -- era 0 an unaimed drift with a mirror flag (IY+0x01=0x4F) and slow-fall marker; eras 1-2 a heading toward the fixed point 0xAC7F skewed by a stored half-turn from (IX+0x0F); era 3 a doubled velocity vector for a heading offset +/-0x1A from the facing; era 4 a straight aim at 0xAC7F plus a seeded (IX+0x04); each way winds the new slot's active count (IX+0x00) down, re-arms the spawn cooldown (0xA8F4 from 0xA8F6), restores the spawner's own IX/IY, and hands off to one era-specific sound request", cert: "code" },
  0x3d25: { name: "loc_3d25", role: "spawn one aimed enemy when the spawn slot is free, the cooldown at 0xa8f4 is clear, the era count at 0xa8c6 is live, and an object in the caller's two-slot bank sits inside a doubled window: seat the found slot's coords, the doubled velocity pair aimed toward the player at 0xac7f (aim side alternated each spawn via 0xa8d4), a script and a shape into the era's fixed record+sprite bank (0xa840/0xaa18 or 0xa8e0/0xaa2c), decrement the new record head, and reload the cooldown from 0xa8f6", cert: "code" },
  0x459b: { name: "loc_459b", role: "step one object's timed warp/flash sequence: drift it with the world, seed the sprite's heading and shape from angle/Y-gated tables, then count a state byte down — the 0xB4 frame flags the sprite, bumps the 0xA800 sentinel and posts sound de=0x040D, above-trigger frames step an eight-shape ROM cycle, and a spent counter resets to idle then loops or returns on two program-image gates; reached through a misaligned prologue (two POP AF, DEC SP) whose stray carry can fold in a life-loss", cert: "code" },
  0x083e: {
    name: "buildCopyrightScreenThenVerifyImage",
    role: "title/attract copyright-screen layout arm (table-dispatched, no static call site): request the flashing copyright line, stamp the copyright caption strip, post caption commands (command 1, arguments 0,1,3..7,20,21) to the command ring, then XOR-fold the 24-byte program block at 0x176A and step the sequence sub-step when the fold matches 0xC9, else transfer to the checksum-failure landing",
    cert: "code",
  },
  0x1323: {
    name: "stepRoundStartIntroAnimation",
    role: "phase-14 arm of the sequence loc_0f1f dispatches off the 0x0F29 table (keyed on SEQUENCE_SUBSTEP & 0x0F): only on alternate frames (bit 1 of FRAME_TICK clear), dispatch on the animation sub-step at 0xA9F0 -- steps 0/1 flash the player ship and advance a scripted char-plane animation, steps 2/3 tick a two-colour animation and run a title-plane pass, step 4 floods the colour plane; the final step sets SEQUENCE_DELAY, hides every sprite, sets up the active player's turn (loadActivePlayerContextAndPostRoundHud) and reloads SEQUENCE_SUBSTEP from ROM byte 0x2750 (=3) to wind the outer sequence on",
    cert: "code",
  },
  0x189e: {
    name: "startTwoPlayerGame",
    role: "start a two-player game: park the caption sprites, raise PLAY_ACTIVE and the flag beside it, load both players' lives from the starting-count settings cell, run the two-player-start arm, deduct two credits in packed BCD from 0xA986 and repaint the panel field, then send the sequence machine to its last phase",
    cert: "code",
  },
  0x2511: {
    name: "initColdStartRamThenSeedConfig",
    role: "cold-boot init: paints a 64-byte work-RAM block all-ones, seeds RNG / loads default high scores / empties the deferred lists (watchdog-kicking after each), then tail-jumps into the settings + cold-start chain",
    cert: "code",
  },
  0x30d1: {
    name: "clearSceneryEntriesThenRunEraScenery",
    role: "clear a stride-two run of eight object cells to the fill byte carried in A, then branch on the era in C: below four, seat and run the frame's scenery through the four-object seat path; at four and up, when two work-RAM guards read their expected values seat eight entries from a packed table before running the scenery, and on a wrong guard transfer into a data table and fault",
    cert: "code",
  },
  0x335e: {
    name: "seatCaptionPenFromEraFoldingTamperIntoPhase",
    role: "sequence-machine arm: fold a fixed image run into the sequence-phase cell as a tamper tripwire (net-zero on a genuine image), then seat the caption pen (glyph 0xAD0B / colour 0xAD0C, and the active player's save block) from a two-byte glyph/colour record indexed by that player's era; steps the sub-step an extra time if the pen colour was unchanged, re-arms the pen route, then steps the sub-step again as a tail",
    cert: "code",
  },
  0x37d6: {
    name: "spawnEnemyIntoFreeSlotElseStepSearch",
    role: "work one slot in a downward free-slot search: a busy slot passes the turn to the search tail, a free slot is claimed and stocked with a random heading-derived velocity, facing, script and fresh animation (at most one slot filled per turn); grounded in MAME: this fills the green enemy-craft band (0xA850) one slot at a time",
    cert: "seen",
  },
  0x386e: {
    name: "spawnEnemyWaveIntoFreeSlots",
    role: "spawn a wave across a fixed bank of object slots: fill each free slot from a randomly-drawn shape record (shape index + two fields), prime its step counter, step its animation once, mark it live; store a fixed status byte when the pass ends",
    cert: "code",
  },
  0x3c25: {
    name: "armBomberSlotWhenTimerFires",
    role: "on even frames tick a slot's arming countdown at ix+0x0e; when it fires and MOTHER_SHIP_ARMED (0xad0d) is clear, arm the slot -- pick a shape record from PLAYER_HEADING (0xa802) via the table at 0x3c84, snap the heading to a facing bit, look up the velocity pair, write shape/facing/velocity into the record, set HITS_REMAINING (0xa8dc)=3, and mark the slot live (ix+0=0xff); grounded in MAME as the era-1 large multi-hit craft (removed by a negative control). mechanisms.md §6 identifies this counter-3 era-1 craft as the 1940 bomber (absorbs three, dies on the fourth hit) -- NOT the counter-7 Mother-Ship; the MOTHER_SHIP_ARMED gate names the 0xAD0D boss class, and 3c25's sole caller serviceEra1BomberObject dispatches it only in era 1",
    cert: "seen",
  },
  0x3ff9: {
    name: "sweepObjectSlotBankByHead",
    role: "sweep a fixed bank of object slots for a frame, servicing each by its head byte -- fly a ballistic slot (0xFF) a frame along its arc, run the shape-cycle countdown service on any other nonzero, skip an empty (0) -- striding one 0x10 record and two sprite-entry bytes per slot for the caller's count",
    cert: "code",
  },
  0x4008: {
    name: "sweepObjectSlotBankServicingFirstSlot",
    role: "sweep the fixed three-slot object bank for one frame from the seated cursors (record cursor +0x10, sprite cursor +2 per slot, count bounding the pass): service the first slot's shape-cycle unconditionally, then route each following slot by its marker byte -- skip an empty (0x00) slot, fly a ballistic (0xFF) slot a step, and service any other marker's shape-cycle",
    cert: "code",
  },
  0x413c: {
    name: "stepDriftingCountdownObjectByEraFrames",
    role: "advance one countdown-driven object per frame: re-stamp+sound at the reset cap, drift with world scroll, decrement, retire the slot at zero, else animate the sprite from an era-selected frame table above the window floor",
    cert: "code",
  },
  0x4194: {
    name: "stepSlotApproachThenBreakawayRetire",
    role: "one slot's per-frame handler in an object sweep: while the record's approach countdown at +4 runs, decrement it and drive the object through its chased-object frame; the tick it hits zero, fly the object at double velocity, animate its shape cycle, and retire the slot only if it has reached a retire line, then step the sweep onto the next slot",
    cert: "code",
  },
  0x47b3: {
    name: "runParachutistSlot",
    role: "per-frame manager of the single parachutist slot (record 0xa8f0, sprite 0xaa2e): idle in era 4, else branch on the slot's state byte — free spawns it at the edge ahead, in-flight (0xff) flies it and retires it once it reaches a retire line else steps its shape from the frame tick, 0x10 posts its bonus, >=0x3c shows its award, and any lower value drifts it with the world then counts down and retires it at zero; grounded in MAME as the parachutist rescue object (canopy + 1000 bonus), removed by a negative control",
    cert: "seen",
  },
  0x496e: {
    name: "awardCoinCreditThenPulseCoinCounter",
    role: "outside free play, fold C's low decimal digit into the packed-decimal credit count at 0xa986 (decimal add, clamp to 99) and repaint that field, then run the coin-counter pulse",
    cert: "code",
  },
  0x4a42: {
    name: "paintCaptionColourBandAndStepSequence",
    role: "continue a caption's colour band from the caller's HL cursor: lay the caller's A over one cell, a 13-cell run of the caller's C and a 4-cell tail (0x0e), then fill two colour-RAM rows and six scattered colour cells from the base colour at 0xAD0C (each value base+offset), then seed the saved pen from the era and step the sequence sub-step; A/C/HL/DE left scratch",
    cert: "code",
  },
  0x4d72: {
    name: "drawEmblemStripThenGuardImage",
    role: "ring command 5's handler (word-table slot 5 at 0x0BBC; reached on coin-start, never in attract): while 0xAD30 is nonzero, stamp up to six 2x2 award emblems leftward from 0xA783 via loc_4daf, blank the rest of that row down to 0xA623 via loc_4dcf, then XOR-verify program bytes 0x0711-0x0810 -- memory only",
    cert: "code",
  },
  0x4e63: {
    name: "runAllCollisionSweepsThisFrame",
    role: "run one round's collision-and-destruction pass: sweep the player's shots against targets, then the player against a run of objects, then -- picked by whether the mother-ship is armed -- either the player-vs-slots contact sweep plus the mother-ship mutual-kill box, or a wider player-vs-slots sweep; then a three-target attacker sweep and a final mark of objects touching the player. The object/slot cursor pair threads through DE/IY across the chain, each stage continuing where the last left off",
    cert: "code",
  },
  0x4ebc: {
    name: "splitCollisionWorkByFrameParity",
    role: "split the per-frame collision work by frame parity: on odd frames run the shot-vs-target sweeps (loc_4f35); on even frames run the player-vs-object collision chain, adding the mother-ship mutual-kill check (ramTestPlayerVsMotherShip) only while the mother ship is armed",
    cert: "code",
  },
  0x5303: {
    name: "advanceSequenceUnlessImageTampered",
    role: "run the image-checksum tamper test and relay by its verdict: present the carried checksum, step the attract sequence on the one genuine value, else spring the tamper trap",
    cert: "code",
  },
  0x0167: {
    name: "loc_0167",
    role: "caption-record data run as code on the checksum-mismatch derail arm: bumps one work-RAM cell the accumulator points at, then falls into the frame-interrupt epilogue that unwinds the frame and resumes",
    cert: "code",
  },
  0x074b: {
    name: "erasePenRouteThenAdvanceStep",
    role: "attract-sequence arm (phase 1, sub-step 0, reached by rst-30 computed dispatch from loc_1651): fold the fixed 256-byte run at 0x4AA0 into an eight-bit total and derail into the checksum-failure landing 0x08FA on any total but 0xB8; otherwise set the pen colour 0xAD0C to 5 and the stamp glyph 0xAD0B to the blanking glyph 0xF1 (so the pen erases), re-arm the pen route via 0x01E1, then step the sequence sub-step 0x0F1A -- twice when the pen colour already held 5",
    cert: "code",
  },
  0x0f8d: {
    name: "loc_0f8d",
    role: "image-checksum tamper trap: drops four return words to unwind the caller chain, then falls into the sprite position-fixup pass (rets on the fifth word)",
    cert: "code",
  },
  0x1734: {
    name: "advancePenRunAnimationStep",
    role: "one interpolated-run sequence step: call drawInterpolatedPenRun to draw/advance one pen run and ret nz unless it reseated to a zero row integer, then store the two's-complement checksum of the 34-byte code block at 0x1748 into 0xA817 (0x00 on a clean image) and tail-jump to 0x0F1A (advanceSequenceSubStep) to step the sequence sub-index",
    cert: "code",
  },
  0x1f2e: {
    name: "loc_1f2e",
    role: "the direction table's bytes decoded as code: fold B into A, take two early returns on the result, and on the single surviving live-in pair AND B in (to zero) and fall out of the table into the heading snap -- write PLAYER_HEADING and scroll the world; the churn arm at 0x1f99 it also decodes is never reached from the fold",
    cert: "code",
  },
  0x29f7: {
    name: "steerEnemyTowardShip",
    role: "steer one live slot toward its aim heading then fly it a step; when the slot's probe cell (iy+0x31) lies within a fixed window of either reference point the turn runs with the shared turn-rate index forced to zero then reseated to four, else at the standing index, and the step alternates a double- and a single-velocity mover on bit 1 of the frame tick",
    cert: "code",
  },
  0x2b93: {
    name: "stepDyingObjectState",
    role: "per-object state-machine step: dispatch on the object's state byte — 0xf0 re-arms it to 0x3b and begins its death, 0x3c begins the death then flies it on, above 0x3c flies it on, below 0x3c counts the byte down, retiring the slot at zero else moving the object for the frame",
    cert: "code",
  },
  0x2d21: {
    name: "driftNearestSceneryTriTile",
    role: "drift one scenery object with the world scroll over-travelled by a quarter, then lay the tile abutting it and the one cornering it diagonally (three corners of a square) and step both cursors one slot past",
    cert: "code",
  },
  0x307f: {
    name: "loc_307f",
    role: "tail of a per-slot sprite-entry fill: store a coordinate through the pointer and fold it into A, then hand each slot to the straight placer while the counter (B) holds; on the last slot index a word table by A, bump the byte past the entry, drop two stack bytes into AF, and finish through the diagonal placer",
    cert: "code",
  },
  0x3117: {
    name: "seedSceneryEntriesThenRunScenery",
    role: "when a sentinel pair reads 0x68 then 0x10-or-0x05, seat four objects from a packed table into the sprite cell and shadow of the first four entry-bank slots and hand on to the frame's scenery run; otherwise transfer to the caption path",
    cert: "code",
  },
  0x406c: {
    name: "runOneShotAnimatedObjectSlot",
    role: "service one animated slot for a frame: rearm it (stamp the countdown to 59 and request the paired sound) when the countdown at (ix+0) is >=0x3c, count the countdown down, retire the sprite (zero iy+0 and iy+0x31) when it reaches zero, otherwise drift the object with the world scroll and, once the countdown is >=0x1c, drive the sprite shape (iy+1) from the 9-byte table at 0x4094 indexed by (countdown-0x1c)>>2 and set its attribute (iy+0x30) to 0x0e",
    cert: "code",
  },
  0x418b: {
    name: "flyLiveSlotAndTickCountdown",
    role: "service one live slot of the per-slot object sweep: fly the slot's object a step along its stored velocity (retiring it once it crosses a retire line), tick down the slot's own countdown at record offset 0x0e, then close the turn of the sweep; reached only for a slot whose marker byte reads 0xFF with a nonzero countdown, outside the fourth era",
    cert: "code",
  },
  0x41b8: {
    name: "flyTowardShipStandoffThenEndApproach",
    role: "run one chased object through a frame: every sixteenth frame re-aim it at one of two fixed points a record bit selects, cut its approach countdown to zero once both axis gaps to that point fall under sixteen, then turn, move and dress it every frame; the carry answers whether it reached a retire line",
    cert: "code",
  },
  0x460e: {
    name: "setUpTwoPlayerStartObjectOnce",
    role: "two-player-start setup arm (called from 0x189E): when the video cell 0xA67C and work cell 0xAB43 disagree, decrement the counter at (IX+0), seat 0xFE/0xFD and 0x6C/0x6C into the object slot at (IY+1/+3/+0x30/+0x32), request sound 0x580B when 0xA800 is 0xFF, and queue ring command 0x04/0x0D; a no-op when the two cells agree",
    cert: "code",
  },
  0x49a8: {
    name: "finishBootSelfTestAndColdStart",
    role: "tail of power-on config decode + self-test: slices two bits of the rolled config byte into work-RAM 0xa9c4/0xa9c6, kicks the watchdog, drives LS259 line 1 from ROM byte 0x0c3e, tiles the character plane, sums the 256-byte ROM block at 0x27de and derails a tampered image into the frame handler, else cold-starts",
    cert: "code",
  },
  0x4c75: {
    name: "loadActivePlayerContextAndPostRoundHud",
    role: "sequence arm (computed-dispatch entry 3 of the table at 0x0F29): blank a fixed character-cell run, copy the active player's saved 16-byte context block into the live block at 0xAD00, step the sequence sub-index; when play is active it also posts the round number (cmd 6) and lives-less-one (cmd 5) to the command ring and folds a fixed program span (0x5B50, 256 bytes) into an XOR whose low bit less one drives the picture-enable latch 0xC308 -- a tamper guard",
    cert: "code",
  },
  0x4d3a: {
    name: "escalateDifficultyRungOnCounterWrap",
    role: "step a three-place base-sixty tick counter at 0xAD05, carrying into the next place only while a place rolls over; only on a full roll-over count down the reload timer at 0xA9D7, and each time it fires rearm it from 0xA9D6, climb the escalation rung at 0xACC0 one step (held at 15), and apply that rung's tuning row",
    cert: "code",
  },
  0x50b1: {
    name: "ramTestPlayerVsMotherShip",
    role: "select the collision box for the mutual kill of the player and one fixed two-slot target by ERA_INDEX: eras 0 and 4 transfer to the wider first-axis check (loc_50ee), the rest run the same destruction inline with a narrower first-axis window; when both are live and their coordinates fall in the box, mark both destroyed, clear the cell beside them, and tail-post the chained hit score",
    cert: "code",
  },
  0x52aa: {
    name: "seedGameConfigFromDipSwitches",
    role: "boot-time DIP seed: copy two ROM defaults into their cells (0x08c9->0xa98d, 0x0874->KILL_QUOTA), store DSW0 complemented as COINAGE_SETTINGS and unpack the coin ratios, then turn DSW1's low two bits into a lives count (3/4/5, or 0xff when they fold to none) and tail-jump with it plus the whole complemented bank into the switch-settings peeler; never returns",
    cert: "code",
  },
  0x5bd7: {
    name: "blankCaptionThenAdvancePenRunStep",
    role: "inner sequence-dispatch arm (table 0x0f29 index 2): blank a fixed character run, advance the interpolated pen run, and bail unless it reseated to a zero row integer; on the full path fold two guarded code blocks (an anti-tamper XOR check that raises the sequence phase on mismatch, and a self-cancelling add-checksum over a work cell) then step the sequence sub-index",
    cert: "code",
  },
  0x0008: {
    name: "fetchTableByte",
    role: "step a table pointer on by an index and return the byte it lands on, leaving the pointer at that entry",
    cert: "code",
    why: 'most call sites consume the returned byte immediately (ld (iy+n),a, ld (de),a) while only a few read on through the surviving pointer, so the fetch is the product. Siblings 0x0010 and 0x018c already read as "fetch what an index selects", and this is the byte-table member of that family',
  },
  0x0018: {
    name: "offsetAddress",
    role: "move a 16-bit address forward by an unsigned byte offset, echoing the low half of the result back",
    cert: "code",
    why: "loc_20af hands it a table base and an index and then does its OWN ld a,(hl), so the caller owns the fetch and this must stop at the arithmetic; fetchTableWord uses it as the first half of a word-table fetch",
  },
  0x0020: {
    name: "advanceCharCursor",
    role: "step the character-cell cursor on to the next cell of the line being drawn",
    cert: "code",
    why: "loc_0d81 draws a two-digit pair as high nibble, step, low nibble, so the step is reading order; MAME's ROT90 (clockwise) maps a decreasing native row to an increasing display column, and every base feeding these drawers lies inside video RAM",
  },
  0x0038: {
    name: "postCommand",
    role: "queue a command byte and its argument in the command ring, dropping the pair when the cursor's cell is still occupied",
    cert: "code",
    why: 'initColdStartRamThenSeedConfig fills the ring with 0xFF at init and loc_0b93 restores 0xFF on consumption, so "free = high bit set" is fixed by a writer and a reader outside this routine; loc_0b93 then dispatches the low nibble through a sixteen-way table, which is what makes it a command rather than a sound byte',
  },
  0x0201: {
    name: "drawInterpolatedPenRun",
    role: "draw one interpolated run of pen-glyph cells from the current row/column toward a target pair (signed per-step increment (target-current)>>4), stamping each cell until the stamped video cell hits the run's end cell, then advance the run index, load the next run's endpoint from the word table at 0x0290, reseat the pen, and leave Z set when the new row integer is 0 (callers ret nz on it)",
    cert: "code",
  },
  0x07e6: {
    name: "stepCopyrightScreenAwaitingStart",
    role: "copyright / insert-coin attract sequence arm (table-dispatched): re-stamp the copyright strip, re-request the flashing copyright line, sample one character cell (0xA61C) into a two-byte record (0xABFE), then read the IN0 mirror -- hand off to the one-player game start when 1-player start (bit 3) is held, return when the credit count at 0xA986 is one, otherwise queue ring command 1/argument 25 and step the sequence sub-step",
    cert: "code",
  },
  0x08fa: {
    name: "loc_08fa",
    role: "checksum-failure landing whose bytes are really a read-as-data table; run as code it always faults — carry-clear stores into program space, carry-set spills 1-2 stack words and jumps to unmapped space",
    cert: "code",
  },
  0x0c90: {
    name: "awardScoreToPlayer",
    role: "score-award command (ring handler 4): add the argument-selected award to the current player's packed-decimal score, promote it into the high score when it now beats it, and repaint the affected scores; argument 0 repaints the score labels and blanks the absent second score",
    cert: "code",
  },
  0x0b90: {
    name: "enterCommandRingDrain",
    role: "tail transfer into the foreground command-ring loop: a jp that hands control to the drain and never comes back; touches no memory or register, so its whole product is the drain's continuation handed straight back",
    cert: "code",
  },
  0x0066: {
    name: "enterVblankInterrupt",
    role: "the per-frame (vblank) interrupt vector: hardware dispatches it once per interrupt and it transfers straight to the frame-service handler at 0x00d8, writing nothing of its own",
    cert: "code",
  },
  0x0d73: {
    name: "loc_0d73",
    role: "paint a six-digit field: two packed bytes through the suppressing painter, sharing one suppression flag this entry clears, then a third through the plain painter so the last two digits always show, walking the source pointer backwards as it goes",
    cert: "code",
  },
  0x0d81: {
    name: "loc_0d81",
    role: "paint the two decimal digits packed into one byte, the high one first, stepping the cursor one cell on after each; the byte is read twice from the pointer the caller is walking, shifted down for the high digit and taken whole for the low, and the colour and cursor arrive as the caller left them",
    cert: "code",
  },
  0x0d90: {
    name: "paintUnsuppressedDigit",
    role: "paint one decimal digit and the caller's colour into the cell a cursor names, taking the glyph from the table at 0x0DCC by the value's low four bits -- a zero always paints the digit `0`, where the suppressing twin paints the blank instead while no significant digit has been seen yet -- and leaving the cursor on the glyph side and the caller's run pointer where it was",
    cert: "seen",
    why: "the name's whole content is the contrast with paintSuppressedDigit at 0x0DAF, and the contrast is refutable per dispatch. A PC-gated read tap under MAME logged the value handed in and the glyph byte written out, on every entry to BOTH routines in ONE ninety-second run: this one painted the digit `0` on all twenty-two of its zero-valued dispatches and the blanking glyph on none, while the twin -- same run, same instrument -- painted the blanking glyph on nineteen zero-valued dispatches and the digit `0` on six, so the instrument that reported the absence was shown able to see the thing absent. MAME's own screenshot agrees on the glass, on the HI-SCORE field rather than a player's: it reads `10000`, and the tap attributes its leading blank and first three digits to the twin and only its two trailing zeros to this routine. Feeding it what the name says it never gets refutes `hex` as well: holding the displayed field at 0xAB, 0xCD and 0xEF drove it to the table's last entry and five bytes beyond, where it painted 0xF1, 0x11, 0x63, 0xA4, 0xFE, 0x64 -- the blanking glyph the table really holds, then the first five bytes of the routine at 0x0DD7 -- and never a glyph A-F",
  },
  0x0da0: {
    name: "loc_0da0",
    role: "paint the two decimal digits packed into one byte with a leading zero suppressed, the high one first, stepping the cursor one cell on after each; the caller's suppression flag arrives, carries across both digits and goes back out, so a longer run of digits suppresses as one field",
    cert: "code",
  },
  0x0dd7: {
    name: "drawCountAsPictogramStrip",
    role: "draw a clamped 0..99 value as a right-to-left row of denomination tiles (thirties, tens, fives, ones) from display cell 0xa463, pad the rest of the row to 0xa623 with the blank glyph, then verify a fixed three-word checksum (0x009d/0x00a0/0x00a3) and hard-reset via 0x0000 on mismatch",
    cert: "code",
  },
  0x0eac: {
    name: "drawRoundNumberCaption",
    role: "paint the round number as two decimal digits into a caption frame via the leading-zero-dropping digit painter (nothing once it reaches 100), then fold a fixed program block onto a seed and throw/halt-into-data if it does not sum to zero -- an anti-tamper guard",
    cert: "code",
  },
  0x0f1a: {
    name: "advanceSequenceSubStep",
    role: "step the jump-table sequence index on by one; reached as a tail jump so the caller's own return carries it",
    cert: "code",
    why: 'advanceSequencePhase increments the outer phase and zeroes this index in one breath, which is only coherent if this is the inner half of a two-level machine -- so a name saying merely "sequence step" would claim the half that gets discarded whenever the sequence really advances',
  },
  0x0f1f: {
    name: "loc_0f1f",
    role: "the inner level of the two-level sequence machine for one outer mode: run the arm the LOW NIBBLE of the inner index selects out of a sixteen-word table laid inline just after this entry, then one fixed block; the arm returns through a slot this entry parks for it",
    cert: "code",
  },
  0x10fd: {
    name: "spinRemainingSpriteMultiplexSlots",
    role: "reused subroutine entry into the five-slot display-list split pass, joined inside the first slot: trades the first slot from the caller's held byte (or, below the raster line, restarts the whole pass and re-reads every slot from memory), then trades slots 2-5 wherever their top bit is set; live-out memory only",
    cert: "code",
  },
  0x11ed: {
    name: "loseLifeAndHandOver",
    role: "process a player's death: hide the sprite band, apply a pending round-advance when its flag is set, and queue the frame's fixed sound requests; then decrement LIVES_REMAINING at the head of the live 16-byte context block and checkpoint that block into the active player's save slot — on lives reaching zero it tail-calls the game-over banner, otherwise, when the other player's saved block still shows lives, it flips the active-player index, arms a delay and re-steps the sequence for the next life",
    cert: "code",
  },
  0x0f97: {
    name: "multiplexSpriteSlotsSkipping",
    role: "scanline-gated sprite position fixup over 8 slots: for each slot whose Y byte (sprite bank 1) has bit 7 set and whose Y + scanline counter carries, clears bit 7 of that Y byte and toggles bit 7 of the paired X byte (sprite bank 0)",
    cert: "code",
  },
  0x0f54: {
    name: "advanceAttractTowardGameStart",
    role: "guarded tail of the phase-3 image-service step, reached as loc_0f1f's pushed continuation: returns while the play-active flag (0xAD30) is set; on a nonzero credit count (0xA986) it zeroes the sequence sub-step (0xA9AC) and reloads the phase (0xA9AB) from the ROM constant at 0x1736; otherwise, only when the free-play flag (0xA9C0) is set and one of two input bits (0xA9AE & 0x18) is held, it zero-fills the work table 0x15b6 clears and tail-calls loc_1690",
    cert: "code",
  },
  0x1253: {
    name: "postGameOverBanner",
    role: "the last life is gone: queue the PLAYER-n caption and the GAME OVER caption, hold them for three seconds and step the sequence on; when no game is running it branches instead into the shared teardown restartAttractSequence, which hands the machine back to attract",
    cert: "seen",
    why: "watched under MAME on the real ROM from both directions. Naturally: five dispatches over 600 s of driven play, every one with LIVES_REMAINING zero and PLAY_ACTIVE set, and SEQUENCE_DELAY written 0xB4 from this routine's own store exactly five times in the same run -- so the queueing side is the side the machine takes, and its caller's other arm accounts for the remaining eleven of its sixteen entries. Forced: a one-shot opcode substitution that dispatches it once mid-game put 02 09 and 0A 0B into the command ring on the same frame and left `7d a5 38 34 f1 68 0e 34 d7` in the cells at 0xA672, which is GAME OVER glyph for glyph out of caption record 11, against blanks in both control arms, and 361 pixels of the real screen changed where a control that suppresses the same host changes none. Command 2 is drawCaptionInPenColour and command 10 is the same drawer taking its colour from a counter, so the arguments 9/10 and 11 are caption indices and the ROM's own record table decodes them as PLAYER 1 / PLAYER 2 and GAME OVER",
  },
  0x1271: {
    name: "advanceRoundWhenFieldCleared",
    role: "gated two-arm state transition: fires only when 0xad02=0, 0xacc6!=0 and all 15 slots at 0xa810 are empty, then queues the fixed sound set and runs one of two arms on 0xad30 — disarm+reset a cell cluster, or clear a strided run and copy a 16-byte record into 0xad10/0xad20",
    cert: "code",
  },
  0x12e7: {
    name: "loc_12e7",
    role: "hand the turn over to the other player when that player's saved lives count is non-zero, and otherwise step the inner sequence index; both exits are tails, so this entry chooses between two continuations rather than returning to anything",
    cert: "code",
  },
  0x12fb: {
    name: "restartAttractSequence",
    role: "put the machine back at the top of the attract sequence: clear the play flag, the active-player index and the inner sequence step, then set the outer phase from a byte of the program image, and write the inner step a SECOND time through a fold over three more image bytes -- on an unaltered image that fold comes to zero and agrees with the first write, on an altered one it does not and the sequence restarts at some other step",
    cert: "seen",
    why: "the name's claim is the DESTINATION, and the phase cell decides it: the byte it copies from 0x16D3 reads 0x01, and SEQUENCE_PHASE's own entry has 1 = the attract sequence, watched. Confirmed running, on the real ROM under MAME: an entry tap plus a write tap gated to this routine's own program counter caught it firing three times in 200 s of a driven one-player game and twice in the undriven 200 s control, and every single firing wrote the same five stores -- 0xAD30<-00, 0xA9AC<-00, 0xAD32<-00, 0xA9AB<-01, 0xA9AC<-00 -- with the outer phase reading 3, the round engine, on entry each time. So it is the way OUT of the round engine, and it lands on 1 and not on 0 or 2. The fold really does close: the second write to the inner step was measured as 0x00 on the genuine image, not derived. It is NOT the game-over routine, which is the reading the driven run alone would have supported and the control refutes: the two firings with no coin ever inserted are the attract DEMO ending, and only the first driven firing had the play flag still set (0xFF on entry, 0x00 immediately after this routine's own store at 0x12FC) -- one routine, two occasions, and the flag it clears is sometimes already clear. Its arrivals are worth recording because a call-site grep gets them wrong in both directions: of the three driven firings, two came from advanceRoundWhenFieldCleared's `jp` at 0x12C4, ZERO came from postGameOverBanner's `jp z` at 0x1257 (marked and never taken), and the game-over one arrived by COMPUTED DISPATCH -- the word 0x12FB occurs three times in the whole image, twice as those two jump operands and once at 0x0F41, which is entry 12 of the inline sequence table loc_0f1f dispatches on (SEQUENCE_SUBSTEP & 0x0F), and the entry tap read SEQUENCE_SUBSTEP as 0x0C on exactly that firing against 0x07 on the two that came through 0x12C4. The bytes the fold reads are not arbitrary either: 0x4901-0x4903 are the middle of the copyright caption's record -- the high byte of its destination, its colour byte and its first glyph -- so tampering with the credit corrupts the attract restart rather than failing cleanly, which is this ROM's standing idiom.",
  },
  0x1367: {
    name: "flashPlayerWhiteEveryOtherFrame",
    role: "one frame of the flash that runs the player's ship white and back: the two flip bits of the player's sprite control byte are kept and the colour under them is driven from the low bit of the animation's own tick, alternating between the all-white palette entry and the colour the ship normally wears; the tick is stepped last and wraps at eight bits, and on the single tick where it reads the threshold the routine also hands the animation on to its next step and asks for one sound",
    cert: "seen",
    why: "the flash is the part that could have been wrong and it was watched on the real machine. 0xAA40 is the PLAYER's sprite control byte -- publishSpriteShadow gathers bank 1 from 0xAA40 into hardware slot 6, whose bank-0 pair 0xAA10/0xAA11 mechanisms.md fixes as the player's entry, and dressPlayerSpriteForHeading writes 0xAA11 and 0xAA40 as a pair -- so the six bits under the mask are a colour, and the byte the routine puts there is 62, whose four sprite pens are transparent and three whites. Nothing in the image calls this routine's dispatcher, so the state was built rather than driven to: with the heading dresser replaced by this routine at its own entry, a MAME capture showed the same twenty-six pixels of that sprite alternating white and blue on every single frame, against a control run with the dresser suppressed and this routine absent where they never moved, and the substitution was proved to take because that control also lost the dresser's 1542 writes. The threshold arm is measured too: seven ticks at the threshold, seven writes of the next step from 0x1373, and sound code 0x19 at the port three times in the arm that runs this routine and never once in either arm that does not. The name says nothing about the OCCASION because nothing reaches it -- driving a game to deaths, which is what the proposal asked for, leaves this whole machine untouched",
  },
  0x1393: {
    name: "loc_1393",
    role: "one tick of a two-colour animation inside the round engine's step-14 sub-sequence: step a count down by one and, from a single bit of that count, drive the colour field of the shadow byte that the sprite publisher copies into the player ship's sprite attribute, so a colour holds for four consecutive ticks; the top two bits of that byte, which carry the sprite's mirroring, are left alone. The tick that finds the count already at zero also moves the sub-sequence's step cell on to 3, and the count still steps on that tick, wrapping below zero. Its one call site is that sub-sequence's step 2, which follows it with one other routine",
    cert: "code",
  },
  0x13cc: {
    name: "loc_13cc",
    role: "the step-4 arm of the round engine's step-14 sub-sequence: flood a fixed block of the colour plane with one byte, and hand the sub-sequence the step whose arm winds it up. The byte comes from one of two parallel cells — the same offset in each of the two per-player save blocks — chosen by the active-player index, so it is a saved value rather than the live one. The block is twenty-eight rows of twenty-seven cells: every row the driver leaves visible, and all but five of the plane's thirty-two columns. When the picture is turned round the painting runs from the far corner backwards, which changes the ORDER the cells are touched in and not WHICH, so the two directions leave the plane identical. A separate count is stepped down by one on the way out",
    cert: "code",
  },
  0x14c5: {
    name: "advanceScriptedCharPlaneBandTo4",
    role: "one pass of a cursor-scripted character-plane animation that runs during the inter-round / player-change transition — NOT the title (the title logo is a caption strip, and this arm is dispatched only from the life-loss / round-advance path and is reach-0 across attract): erases two columns + six loose cells on even passes, refills/steps them from the script on odd passes, ends the script by clearing the counter, advancing the stage to 4 and requesting sounds; decrements the pass counter otherwise",
    cert: "code",
  },
  0x142a: {
    name: "advanceScriptedCharPlaneBandTo2",
    role: "advance one frame of a script-driven character-plane animation: bit 0 of a countdown cell alternates a blanking pass (fill two thirteen-cell columns and six lead cells with one tile code) with a drawing pass (restore the working column from its saved run, nudge four counters by the low bit of the next two script bytes, step the band up then back down, and gather the column back); a terminator byte instead clears the countdown, arms the next sequence step and rewinds the script pointer one, ending early, and every non-terminating call then decrements the countdown",
    cert: "code",
  },
  0x15b5: {
    name: "loc_15b5",
    role: "a single ROM byte, `ret`, wired in as slot 15 of the sixteen-word table at 0x0F29 that loc_0f1f dispatches on the low nibble of SEQUENCE_SUBSTEP; taking this arm reads nothing, writes nothing and drops straight into 0x0F54, the continuation every arm of that table returns into. The address occurs exactly once in the whole 24KB image as a little-endian word -- that table slot -- and its gate measures both shipped tapes never presenting nibble 15, so whether the slot is a deliberate idle rung or filler for an index the machine never produces is not settled by anything read here",
    cert: "code",
  },
  0x15c2: {
    name: "loc_15c2",
    role: "run the arm the LOW THREE BITS of the inner sequence step select out of a word table laid down inline just behind this entry; the arm is entered as a transfer with no place parked for it to come back to, so it returns past this entry and nothing here runs after it, and all eight indices are carried out through the machine's own arithmetic rather than assumed away",
    cert: "code",
  },
  0x15fe: {
    name: "armAttractScreenShowingHighScore",
    role: "once a per-frame countdown lapses, arm a fresh screen: enqueue four fixed ring commands, seed a marker byte into two cells, patch six cells from a following table (value + 0x05 marker), print the six-digit readout, set two sub-states, and enqueue a fifth command when the gate cell is set",
    cert: "code",
  },
  0x1651: {
    name: "loc_1651",
    role: "the inner level of the two-level sequence machine for one outer mode: run the arm the RAW inner index selects out of a word table laid inline just after this entry, then this mode's shared tail at 0x167B; the doubling that turns the index into an offset wraps at eight bits, so a large index folds back onto the head of the table",
    cert: "code",
  },
  0x1690: {
    name: "startGameOnFreePlay",
    role: "start a game for whichever start button the input mirror shows held -- two players if the two-player bit is set, one if only the one-player bit is -- stocking each started player's block with the lives setting, and charging no credit",
    cert: "seen",
    why: "the name predicts the routine is unreachable on a coin cabinet and reachable with no coin on a free-play one, and both halves were measured. On the default coinage a read tap counted zero across four driven MAME runs including a real two-player game, while the sibling coin start site ran; with the DSW0 port read forced to the value MAME's own driver calls Free Play -- proved by COINAGE_SETTINGS and FREE_PLAY both reading all-ones while the credit cell stayed zero -- it ran and started a game with nothing inserted. Which arm is which was then fixed by changing only the button: at mirror 0x08 only the one-player arm's program counters wrote, at 0x10 only the two-player arm's, and those are the masks the driver gives the one- and two-player start buttons. All three callers test the free-play cell before tail-jumping here, which is why this one takes no credit where startTwoPlayerGame subtracts two in packed BCD",
  },
  0x172a: {
    name: "loc_172a",
    role: "jump the sequence machine to its last outer phase and restart the inner index at zero; both stores are constants and neither cell is read first, so this is an unconditional jump to a fixed place rather than a step",
    cert: "code",
  },
  0x17e2: {
    name: "loc_17e2",
    role: "raise one flag cell to all bits, fold a fixed block of the program image into a running total seeded from an image byte and bank the result, then step the inner sequence index -- one step of the tamper-check sequence",
    cert: "code",
  },
  0x17fb: {
    name: "loc_17fb",
    role: "a sequence step that does no work of its own -- it only moves the inner index on, so reaching it costs one turn and changes nothing else",
    cert: "code",
  },
  0x17fe: {
    name: "loc_17fe",
    role: "the inner level of the two-level sequence machine for one outer mode: run the arm the RAW inner index selects out of a word table laid inline just after this entry; this mode's tail does nothing at all, which is why every arm here simply ends",
    cert: "code",
  },
  0x181e: {
    name: "loc_181e",
    role: "one step of a screen-clearing sequence: park every sprite out of sight, copy the glyph and colour showing at one fixed character cell into one fixed two-byte record, arm the line wipe to run from the plane's fifth line, and step the sequence's inner index on last; both the cell and the record are fixed here, so nothing a caller was holding chooses either",
    cert: "code",
  },
  0x1830: {
    name: "postAttractInfoCaptions",
    role: "one arm of the two-level sequence machine (inner index 2 of loc_17fe): after two setup calls it posts a fixed run of display codes to the writer at 0x0038 as (D=1,code) pairs -- 0x01,0x14,0x15, a code that flips 0x0F/0x11 on cell 0xA9C3 and its successor, 0x16, 0x00, and a tail 0x19/0x17 chosen by 0xA986 -- advancing the sequence counter 0xA9AC through 0x0F1A twice on the 0xA986>=2 branch and once below",
    cert: "code",
  },
  0x1980: {
    name: "rearmHeldControlRepeat",
    role: "clear the one-bit press history a caller points at, and hand back a zero. A history is a byte a control's bit is rolled into every other frame, and its owner acts on the frame the low three bits read 001; while a control stays held the byte fills and that pattern cannot recur, so clearing it is what lets the same press act again",
    cert: "seen",
    why: "the name claims an EFFECT that lives entirely outside this routine -- that a control held down repeats -- and the machine could have said otherwise three ways. Driven under MAME into high-score initials entry, which is a state no instrument had visited: holding the panel bit whose history saturates at 0xFF cleared 0xA996 127 times, at a gap of 16 frames on every one of the 126 gaps, and stepped the letter index 128 times; holding the bit whose history saturates at 0x7F cleared 0xA995 145 times, at 14 frames on every one of the 144 gaps, and stepped the letter the other way, wrapping at 0x1A. Sixteen and fourteen frames are eight and seven samples, which is what the two saturation constants predict with nothing fitted, and the two arms never once cleared each other's cell. The negative control is a call site that DOES NOT EXIST: 0xA997 is the same history mechanism in the same routine with no call to this one, and holding ITS control committed a letter exactly once in the whole screen. In the same staging with nothing held the scanner ran 2041 times and this routine ran zero times. The routine is dark in undriven attract on the real machine, so none of this is visible without driving the state. What the name does NOT claim is the handed-back zero: at both call sites the byte is dead -- 0xFF and 0x7F both give 7 under `and 0x07`, so the branch is the same whether the zero is handed back or not -- and a rewrite must still hand it back because the oracle does",
  },
  0x1afc: {
    name: "sampleCellGlyphAndColour",
    role: "take what is currently showing at one character cell -- its glyph byte and the colour byte of the same cell -- and lay the two down side by side as a two-byte record. One pointer reaches both planes because they hold the same grid at the same offset and are told apart by a single address bit. The cell itself is not touched, so what the caller gets is a reading and not a reservation",
    cert: "seen",
    why: 'the reading a name has to choose between is SAMPLE and SAVE-FOR-RESTORE: both copy a cell into RAM, and only what happens to the record afterwards tells them apart. A write tap on the record cells across a driven MAME game on the real ROM settles it. The glyph half came back CONSTANT -- 0xA5 on all 15733 writes -- while the colour half alternated, 0x05 on 7865 and 0x10 on 7868, so the cell being read is blinking under the routine and the copy tracks it frame by frame; a fixed pair would have made "sample" pointless and a constant colour would have made it a plain save. A read tap on the same cells then enumerated the consumers rather than grepping for them: exactly two program counters ever read the record, 0x202D and 0x2036, and both are COMPARISONS inside loc_2010 (against 0xA5, then against 0x05 or 0x10). Nothing writes the pair back to any cell in that run, which is what a restore would have to do. The two call sites fix the cells from outside: stepCopyrightScreenAwaitingStart samples 0xA61C into 0xABFE every frame, loc_181e samples 0xA5FC into 0xACBE once. The second record took ZERO reads in the run, so what consumes it is unmeasured and this entry does not claim one. Dispatches are a clean A/B: 15735 across a driven game, ZERO across two undriven attract runs of 180 and 300 emulated seconds',
  },
  0x1f01: {
    name: "turnShipTowardTargetHeading",
    role: "steer the ship one notch toward the wanted heading a table selects (leave it when already there, snap on when within one notch, else step the short way round the compass by three notches — four once the era's low digit reaches three), then fall into the shared world-scroll tail",
    cert: "code",
  },
  0x1f55: {
    name: "loc_1f55",
    role: "negate both velocity components into the world scroll cells, so the world moves opposite the player, then dress the player's sprite for its heading",
    cert: "code",
  },
  0x1f99: {
    name: "loc_1f99",
    role: "direction-table bytes decoded as code: pops a long run of stack words while shuffling registers, pushes the pointer once and decrements one cell, then exits via ret / an off-map call / a computed jp(hl); no input tape dispatches it",
    cert: "code",
  },
  0x200c: {
    name: "presentChecksumForTamperTest",
    role: "put the byte the caller has been carrying where a result is read from, so the verdict of an image check can be taken; on the way it walks an address forward twice, by a wide step and then by that same byte, and the address it lands on is never dereferenced by anything downstream. It reads and writes no memory, so the walk is arithmetic and not a fetch",
    cert: "seen",
    why: "the tempting name is a table-index helper -- add a stride, add an offset, return a byte -- and the caller chain refutes it. Its only reachable entry is the tail chain showCreditLine -> sumImageBlockForTheTamperCheck -> parkTheImageTotalForTheTamperVerdict -> advanceSequenceUnlessImageTampered: sumImageBlockForTheTamperCheck folds a run of image bytes into A with `add a,(hl)`, parkTheImageTotalForTheTamperVerdict hands it on to B, and advanceSequenceUnlessImageTampered calls here and then `cp 0x67`, branching to loc_0f8d on a mismatch and tail-jumping to advanceSequenceSubStep on a match. loc_0f8d pops four words off the stack and unwinds -- it is the tamper arm, not an error return -- so the byte this entry moves into A is a verdict and the compared constant is baked in. That the walked address is a decoy is not read off the code, it is a claim about the callers, and neither branch of advanceSequenceUnlessImageTampered touches HL. Under MAME on the real ROM, with a PC-filtered read tap: 5 dispatches over 300 emulated seconds of attract, 3 over 180, 1 over a driven game, and in EVERY run the count equals sumImageBlockForTheTamperCheck's and advanceSequenceUnlessImageTampered's exactly, so the fold and the test are one chain with no second entrance. Every dispatch was captured with A = 0x67 and B = 0x67 -- the sum already correct -- and the tamper arm loc_0f8d, tapped in the same runs as the control, took ZERO dispatches in all three. A genuine image never fails, which is the only outcome that lets the game boot; a wrong constant or a second caller would have shown here. cert stays honest about one thing: with A and B equal at every observed entry, no capture can distinguish `ld a,b` from leaving A alone, and that half is read from the image",
  },
  0x214b: {
    name: "flyDemoShipByScript",
    role: "attract demo auto-pilot step: ticks the packed dwell/turn countdown at 0xadf2, steps the heading-command script at 0xadf3/4 when the dwell expires, turns PLAYER_HEADING (0xa802) by the 2-bit command, then tail-jumps to the mover at 0x1f42",
    cert: "code",
  },
  0x28b7: {
    name: "loc_28b7",
    role: "seat the record cursor and the sprite-entry cursor on one fixed object slot, then run the era-keyed dispatch over it; the pair of immediates is the whole of what distinguishes this entry from the four siblings that share its shape -- the two gated ones later in the chain differ by more",
    cert: "code",
  },
  0x28c2: {
    name: "loc_28c2",
    role: "seat the record cursor and the sprite-entry cursor on one fixed object slot, then run the era-keyed dispatch over it; the pair of immediates is the whole of what distinguishes this entry from the four siblings that share its shape -- the two gated ones later in the chain differ by more",
    cert: "code",
  },
  0x28cd: {
    name: "loc_28cd",
    role: "seat the record cursor and the sprite-entry cursor on one fixed object slot, then run the era-keyed dispatch over it; the pair of immediates is the whole of what distinguishes this entry from the four siblings that share its shape -- the two gated ones later in the chain differ by more",
    cert: "code",
  },
  0x28d8: {
    name: "loc_28d8",
    role: "seat the record cursor and the sprite-entry cursor on one fixed object slot, then run the era-keyed dispatch over it; the pair of immediates is the whole of what distinguishes this entry from the four siblings that share its shape -- the two gated ones later in the chain differ by more",
    cert: "code",
  },
  0x28e3: {
    name: "loc_28e3",
    role: "seat the record cursor and the sprite-entry cursor on one fixed object slot, then run the era-keyed dispatch over it, with no gate in front of it",
    cert: "code",
  },
  0x28ee: {
    name: "loc_28ee",
    role: "run the era-keyed dispatch over the mother ship's slot, but only while the armed cell is clear -- a set cell returns at once, leaving the slot unserviced for the frame",
    cert: "code",
  },
  0x28fe: {
    name: "loc_28fe",
    role: "run the era-keyed dispatch over one fixed object slot, but only while the mother ship's armed cell is clear -- a set cell returns at once, leaving the slot unserviced for the frame",
    cert: "code",
  },
  0x290e: {
    name: "loc_290e",
    role: "run the arm the LOW THREE BITS of the ERA INDEX select out of a word table laid down inline just behind this entry; the arm is entered as a transfer with no place parked for it to come back to, so it returns past this entry and nothing here runs after it",
    cert: "code",
  },
  0x291e: {
    name: "foldBlockIntoTotal",
    role: "fold a run of image bytes into a total the caller has already seeded, walking a SECOND pointer alongside it in lockstep. The second walk adds nothing: each step overwrites the same byte-wide holder, so only the last byte it passes survives, and on a genuine image its leftover went unread by every RAM signature the pass sampled. A count of zero means a full 256 bytes, the total wraps at eight bits, and no memory is written",
    cert: "seen",
    why: "the name calls the total the product and the second walk a passenger, and MAME could have refuted either half. The one call site seeds the total from (0x27C0), banks what comes back at 0xAA6F, and three frames later sequence arm 0x2730 does cp 0x76 / jp nz,0x2530 -- the 0x76 summed independently from the thirty ROM bytes at 0x335E matches the constant the check carries, and 0x2530 took zero hits on a genuine image. Flipping the returned total at the routine's own ret drove the machine into 0x2530 three times and moved 77 of 108 RAM signatures; flipping the byte the second walk left behind moved none of the 108. A control that failed to move anything would have made the second reading worthless, and it moved a great deal",
  },
  0x2b60: {
    name: "driftWithWorldScroll",
    role: "add the frame's world-scroll displacement to one object's two split 16-bit coordinates",
    cert: "code",
    why: "loc_1f55 writes the displacement pair as the NEGATION of a velocity pair on its way into the routine that refreshes the player sprite from its heading, and gameplay.md records that the background moves opposite the plane -- so adding that pair to a world-static object is what streams it past a fixed ship",
  },
  0x2bb4: {
    name: "loc_2bb4",
    role: "count an object's state byte down by one and let it fly on at the slowest of the velocity-table speeds; the countdown wraps at a byte and nothing here tests it, so reaching zero is the caller's business. Both entries into it are on the path a slot takes once its state byte is neither free, live nor held",
    cert: "code",
  },
  0x2bde: {
    name: "retireSlotAndSubPixel",
    role: "take an object out of play, zeroing each coordinate WHOLE — occupancy byte, both sub-pixel remainders, and both sprite-entry coordinates",
    cert: "code",
    why: "it clears the two sub-pixel remainders as well as the coordinates, which the sibling retire helper leaves standing; spawn paths differ on whether they reinitialise those cells, so which helper retired a slot can still be visible to its next occupant",
  },
  0x2c22: {
    name: "loc_2c22",
    role: "move one object for the frame according to its state byte, then run the shared appearance step over that same object: from thirty-two up it counts the state byte down and flies on at the slowest table speed, below thirty-two it only drifts with the world and the state byte is left alone; the appearance step runs on both paths",
    cert: "code",
  },
  0x3cc4: {
    name: "loc_3cc4",
    role: "answer, in the carry flag, whether an object has reached a boundary, the heading choosing which of two adjacent and disjoint three-wide bands is the one tested",
    cert: "code",
  },
  0x3dda: {
    name: "loc_3dda",
    role: "guard on the era index and, when it passes, hand two fixed bases to the shared slot servicer; the guard is the whole of the decision, and the bases are constants rather than anything a caller chose",
    cert: "code",
  },
  0x3deb: {
    name: "loc_3deb",
    role: "service one slot, splitting three ways on the head byte of its record: zero does nothing at all, all-ones flies the object one step along the velocity it carries and retires it into the shared cooldown only once that step has put it on a retire line, and any OTHER value retires it on the spot without moving it first",
    cert: "code",
  },
  0x3e6c: {
    name: "loc_3e6c",
    role: "fly one object a step along the velocity it carries and retire its slot once that step has put it on a retire line; in one era of the game, and only that one, the object is also given the next frame of a fixed shape cycle before it moves, and the retire is last so a shape written this tick may go out in the same breath",
    cert: "code",
  },
  0x3e8e: {
    name: "loc_3e8e",
    role: "run one slot's counter down for a frame and take the slot out of play as soon as it has nothing left to run; the era cell not standing at the last era, or the counter already sitting one above the floor, ends it outright, and otherwise the counter drops by one and the slot drifts with the world",
    cert: "code",
  },
  0x3f93: {
    name: "requestEraKeyedLaunchSound",
    role: "request the sound of a craft launching, taking the code from one of two program bytes according to whether the era has reached the fourth; both go through the play-gated door, so the attract demo stays silent",
    cert: "seen",
    why: "the split point is the claim and it is refutable per era. Read taps on both tail targets under MAME: the high arm fired 7 times on the one tape that reaches the fourth era and ZERO on every tape that stops below it, including a poked run held at the first era, while a poked run held at the fifth took it on most dispatches. Had both arms queued the same byte the distinction would not exist; the two program bytes differ. 'Launch' rather than the object's name is deliberate and rests on the caller: its one caller is the tail of a spawner that finds a free slot and writes a fresh record -- velocity, shape and the live state code -- with nothing after this call able to abort it, so the request is one-to-one with something appearing. What that something IS stays unnamed, and a sibling launcher reaches the low arm directly even in the fifth era, so this selector belongs to its own caller and not to launches in general",
  },
  0x409d: {
    name: "loc_409d",
    role: "stamp one object's state byte to fifty-nine and ask for the sound that goes with it; the stamp is unconditional -- nothing here reads the byte first, and the ROM's test at this entry sends both of its answers to the same address",
    cert: "code",
  },
  0x4afb: {
    name: "loc_4afb",
    role: "set the pen colour, the destination cell and the source byte, then paint them through the packed-digit painter; every one of the three is fixed here, so a caller chooses none of them",
    cert: "code",
  },
  0x566e: {
    name: "requestTwoSoundsWhilePlaying",
    role: "ask for two sounds in a row, each code fetched from its own byte of the program image, both admitted only while a game is being played",
    cert: "code",
    why: "requestTwoSounds is this routine's structural twin -- same two-fetch shape, same fall-through into the entry that supplies the second code -- and the ONLY difference between them in the image is the permission: this one enters loc_560c twice, which drops the request with the play flag clear, while the twin enters loc_5617, which also admits the demo. That is what the name has to carry and either entry could refute it. Under MAME every dispatch of this routine was in the demo with the play flag clear, the state its own permission drops, while the twin dispatched 101 times in the same run",
  },
  0x56d2: {
    name: "loc_56d2",
    role: "ask for three sounds whose codes come from bytes of the program image, all three refused unless a game is being played, then leave through the two-request tail whose permission is looser -- so a state that drops the three can still admit the pair",
    cert: "code",
  },
  0x58aa: {
    name: "loc_58aa",
    role: "fly one object a double step at the pace one fixed table of velocity samples sets; choosing the table and the mover is the whole of this entry, and a pointer the caller held is discarded",
    cert: "code",
  },
  0x58b6: {
    name: "loc_58b6",
    role: "fly one object a step at twice the velocity one fixed table of samples sets, the shared drift added once; choosing that table is all this entry does",
    cert: "code",
  },
  0x599d: {
    name: "loc_599d",
    role: "take the heading out of an object's own record and continue into the doubled velocity lookup, forwarding rather than replacing the table pointer the caller seated -- which is what separates it from the sibling shims that choose a table themselves",
    cert: "code",
  },
  0x59c5: {
    name: "loc_59c5",
    role: "hand back the doubled component pair a heading handed straight in calls for, at the pace one fixed table of samples sets; choosing that table is all this entry does",
    cert: "code",
  },
  0x59cb: {
    name: "loc_59cb",
    role: "hand back the doubled component pair a heading handed straight in calls for, at the pace a second fixed table of samples sets; choosing that table is all this entry does",
    cert: "code",
  },
  0x59d1: {
    name: "loc_59d1",
    role: "hand back the doubled component pair a heading handed straight in calls for, at the pace a third fixed table of samples sets; choosing that table is all this entry does",
    cert: "code",
  },
  0x2b83: {
    name: "hasReachedRetireLine",
    role: "answer whether an actor has drifted onto either of two fixed retire lines, within a narrow wrapped window, which is what makes its caller free the slot",
    cert: "code",
    why: "resetPlayfieldAndArmNewRound pins the player's own sprite entry at (0x84, 0x78) and loc_20af never rewrites those two bytes, so the two lines at 0x04 and 0xF8 are each exactly +0x80 -- the antipode in a coordinate that wraps at 256; the callers that act on the carry use it to free the slot, though at least one path discards it",
  },
  0x2d62: {
    name: "driftOneTileSceneryAtThreeQuarters",
    role: "drift one scenery object at three quarters of the frame's world scroll, lay no further tile, and step both cursors onto the next slot",
    cert: "code",
    why: "same family, same falsifiable arithmetic as driftThreeTileSceneryAtFiveQuarters: this is the one-tile member, so the era-4 arm that calls it twice can reach the band's eight slots only if it lays exactly one -- 2+2+1+1+1+1 -- and any second tile would overrun the band. Its callee driftAtThreeQuartersWorldScroll is already grounded to the scenery slots, and driftTwoTileSceneryAtThreeQuarters' entry lists this shape as its 'three quarters with one tile' sibling. NOT GROUNDED, and the reason is specific: it sits in the dispatcher's fifth-era arm, and no tape we can drive reaches the fifth era by playing -- four played tapes gave it zero dispatches while an era-held sweep arm gave it 31634, so cert stays code",
  },
  0x2d68: {
    name: "driftOneTileSceneryAtHalf",
    role: "drift one scenery object at half the frame's world-scroll displacement, lay no further tile, and step both cursors onto the next slot -- the one-tile member of the parallax family, and the slowest rung, so what it moves reads as the farthest layer",
    cert: "seen",
    why: "the family's names rest on a fraction each, and the one thing that could break this member is a second wrapper sharing its rung -- then 'the half rung' would not be this entry's to own and the tile count would not be readable off its body. A PC-filtered read tap under MAME on the real ROM put that to the test three times and the counts came back IDENTICAL to driftAtHalfWorldScroll's in every run: 8427/8427 and 14153/14153 on two undriven attract runs of 180 and 300 emulated seconds, 5351/5351 on a driven one-player game held in the first era. Sole caller, measured, not derived from a grep -- and the grep could not have shown it, since the dispatch comes off a table the ROM reads at runtime. The rung itself is already watched: driftAtHalfWorldScroll's entry records a capture matching each wrapper to its own fraction on every dispatch and to the other two on none, every dispatch seated inside the eight scenery slots. What stays code-derived is the TILE COUNT: this entry places none of its own before stepping the slot, which is one tile per dispatch by construction, and mechanisms.md's era table reads the same count off the same body. Watched at eras 0 through 3 -- the attract runs visit the second through fourth, the driven run holds the first -- while the fifth era's list, which names it twice, was reached by no run here",
  },
  0x2d6e: {
    name: "driftAtFiveQuartersWorldScroll",
    role: "move one object by the frame's world-scroll displacement and a further quarter of it, so it over-travels the world; applied to both of its split coordinates, whole part in the sprite entry and fraction in the object record",
    cert: "seen",
    why: "the displacement pair they read is written elsewhere as the negation of the player's own velocity, which gameplay.md describes independently as the background moving opposite the plane -- so it is the camera and nothing of the object's. Their only caller chain is the era-keyed dispatcher, which seats every dispatch inside the scenery slots. The fraction assignment makes a prediction its callers could refute: parallax depth should track sprite size, and each dispatched wrapper places a different number of tiles before stepping the slot -- smallest scenery on the slowest rung, largest on the fastest. Crossing any two of these names inverts that. A MAME run then watched all three addresses and matched each to its own fraction on every dispatch and the other two on none, every dispatch seated inside the scenery block. What that capture covers is the fraction and the slots; the rung ORDERING and the sprite-size correspondence stay code-derived, since it watched neither relative speed nor sprite size",
  },
  0x2d93: {
    name: "driftAtThreeQuartersWorldScroll",
    role: "move one object by three quarters of the frame's world-scroll displacement, applied to both of its split coordinates, whole part in the sprite entry and fraction in the object record",
    cert: "seen",
    why: "the displacement pair they read is written elsewhere as the negation of the player's own velocity, which gameplay.md describes independently as the background moving opposite the plane -- so it is the camera and nothing of the object's. Their only caller chain is the era-keyed dispatcher, which seats every dispatch inside the scenery slots. The fraction assignment makes a prediction its callers could refute: parallax depth should track sprite size, and each dispatched wrapper places a different number of tiles before stepping the slot -- smallest scenery on the slowest rung, largest on the fastest. Crossing any two of these names inverts that. A MAME run then watched all three addresses and matched each to its own fraction on every dispatch and the other two on none, every dispatch seated inside the scenery block. What that capture covers is the fraction and the slots; the rung ORDERING and the sprite-size correspondence stay code-derived, since it watched neither relative speed nor sprite size",
  },
  0x2df4: {
    name: "driftAtHalfWorldScroll",
    role: "move one object by half the frame's world-scroll displacement, applied to both of its split coordinates, whole part in the sprite entry and fraction in the object record",
    cert: "seen",
    why: "the displacement pair they read is written elsewhere as the negation of the player's own velocity, which gameplay.md describes independently as the background moving opposite the plane -- so it is the camera and nothing of the object's. Their only caller chain is the era-keyed dispatcher, which seats every dispatch inside the scenery slots. The fraction assignment makes a prediction its callers could refute: parallax depth should track sprite size, and each dispatched wrapper places a different number of tiles before stepping the slot -- smallest scenery on the slowest rung, largest on the fastest. Crossing any two of these names inverts that. A MAME run then watched all three addresses and matched each to its own fraction on every dispatch and the other two on none, every dispatch seated inside the scenery block. What that capture covers is the fraction and the slots; the rung ORDERING and the sprite-size correspondence stay code-derived, since it watched neither relative speed nor sprite size",
  },
  0x309b: {
    name: "advanceToNextSlot",
    role: "step the record cursor and the parallel sprite-entry cursor on to the next object slot",
    cert: "code",
    why: "placeAbuttingTile uses it to step onto a further tile of the sprite it has just placed, while driftOneTileSceneryAtThreeQuarters and loc_2d68 use it to reach a different entity -- the callers disagree about what the next slot holds, so the unit it advances is the slot index, not the object",
  },
  0x3114: {
    name: "loc_3114",
    role: "a bare transfer to 0x307F and no return; no cell is read or written and no register moves",
    cert: "code",
  },
  0x3156: {
    name: "loc_3156",
    role: "fix the fill byte and transfer to 0x30D1 without returning; choosing that one constant is the entire content of the entry, so whatever the caller carried in its place is discarded",
    cert: "code",
  },
  0x315b: {
    name: "loc_315b",
    role: "a bare transfer to 0x3176 and no return; no cell is read or written and no register moves",
    cert: "code",
  },
  0x339c: {
    name: "setSavedPenFromEra",
    role: "seed the pen the active player's SAVED context block will hand back — the glyph and the colour a caption is stamped in — from the era recorded in that same block, both halves coming as one two-byte record out of an inline table the era indexes; the live pen is left alone, where the nearer arm at 0x335E sets it too, sums a run of image bytes into a tamper cell before doing any of it, and can repaint",
    cert: "seen",
    why: "'saved' and 'era' are the two discriminating claims and each could have failed at the ROM. Forced 5920 times under MAME by a PC-gated opcode substitution at a per-frame host, its entire effect against a control that displaces the same host is TWO program counters writing TWO cells -- 0xAD1B taking 0xF1 every time and 0xAD1C taking era+1 -- with the sequencer cells, the command ring and every other byte of 0xAD00-0xAD3F identical, and ZERO of 57344 pixels changed on four frames where removing the host alone changes 91. That zero is what says SAVED: a one-player game never swaps a context in, so a write to a save block cannot reach the glass. A read tap over both save blocks through a 420 s two-player game then closes the chain the other way -- the sixteen-byte `ldir` at 0x4C8A reads all thirty-two save cells and lands 0xAD1B/0xAD1C in 0xAD0B/0xAD0C thirteen times, and plotPenCell stamps those two onto a character cell. The ROM's own nearer arm at 0x335E writes the same two cells with the same values three times unforced in the same log, and adds the live pair and a repaint, which is the difference the name carries. 'Era' rather than 'round': 0xAD14 is offset 4 of the save block and the save `ldir` at 0x1211 copies 0xAD04 there, and 0xAD04 is ERA_INDEX -- ROUND_NUMBER is 0xAD01 and is not read here",
  },
  0x3421: {
    name: "drawCaptionFivePastSharedColour",
    role: "paint the caption an index selects from the shared record table, taking the destination and the glyph run from the record but the colour from a cell outside it, five past that cell's value and kept to four bits",
    cert: "seen",
    why: "the discriminating claim is the OFFSET, and the image holds the set that makes it one: three handlers read the SAME cell and add 0, 5 and 10 before the same four-bit mask, all three ending in drawTextRun, while a fourth (drawTextRunByIndex) takes the colour the record itself carries. This is the +5 member; drawCaptionInPenColour is the +0 and drawCaptionTenPastSharedColour the +10. Measured on the real ROM with a read tap on the source cell attributed by program counter, over 9000 frames of undriven attract and 13200 frames of a coin-driven run: this entry took 22 and 33 dispatches, every one at destination 0xA673, and the colour it used was the source value plus five every time -- source 2,3,4 against used 7,8,9. In the SAME runs the +0 sibling painted that same destination at 2,3,4 and the +10 sibling at 12,13,14, so the three really do take turns at one caption rather than one of them cycling. The record's own colour byte, read at HL-1 on each dispatch, was 4 throughout and equalled the colour actually used on 0 of 22 and 0 of 33 dispatches -- so 'a colour the caption does not own' is measured and not inferred from the skipped `inc hl`. What the capture does NOT cover: which caption 0xA673 is, and whether any handler other than these four reaches the same record",
  },
  0x3855: {
    name: "stopFiveSlotAnimations",
    role: "leave five consecutive object records standing on the shape a finished animation ends on, with their step bytes cleared so nothing walks them again — but only while the byte the caller points at still reads zero, so it is a guarded settling and not a step",
    cert: "seen",
    why: "'stop' rather than 'start' is the claim, and the animation machine settles it: a record's step byte is counted down once per dispatch and the count it lands on indexes the run, so a step of zero is the run's FIRST byte and the countdown reads a zero step and returns before writing, which means nothing raises it again. The shape written is 0x11, and re-derived from the image this run every one of the eighteen run pointers in the table at 0x3438 (0x346F..0x368F, 0x20 apart) has 0x11 as its first byte — so this writes precisely the resting state, and had any run started on something else the name would be wrong. The three sites that ARM an animation load 0x20 into the same byte, which is the opposite store. Watched on the real ROM through a write tap over 0xA850-0xA89F attributed by program counter: 100 writes from this routine across 9000 frames of undriven attract and 150 across 13200 frames of a coin-driven run, ten bytes per dispatch, every one either +8 taking 0x11 or +9 taking 0x00, on records sixteen apart from 0xA850. The tap's positive control is in the same column: the spawner at 0x36AF-0x3792 wrote into that same band 344 and 512 times in the same runs. The guard is the caller's: its only inbound transfer is a `jp z` from 0x36AF taken when LIFE_TICKS_MID & 0x0F is 7, with HL pointing at LIFE_TICKS_LOW, and every logged dispatch read 0xAD05 = 0x00 and 0xAD06 = 0x07. What is NOT claimed: what the five slots hold, or what 0x11 looks like",
  },
  0x3cd9: {
    name: "hasDriftedOffTheField",
    role: "answer whether an object has drifted onto the boundary its caller frees the slot at: the vertical window this arm owns is tested here, and when it is not met the same question is handed on to the horizontal one, so the answer is an OR of two windows on two axes and only the first is decided here",
    cert: "seen",
    why: "the effect claim is the caller's, and both callers agree: 0x3B77 and 0x4447 each take the carry and, on a yes, tail into a routine whose whole body is stores of zero — 0x3C0D zeroes two occupancy bytes and the entry's two coordinates, 0x46DB zeroes the occupancy byte and all four of the entry's coordinate bytes. Nothing else consumes the answer. Its own window is the falsifiable part and one bound could have been dead: read-tapped on the real ROM, gated by PC, this arm read the entry's vertical byte 743 times across 9000 frames of undriven attract and 905 across 13200 frames of a coin-driven run, sweeping 0x38 to 0xF0, and landed INSIDE its three-wide window exactly once — at 0xF0, the window's own first value. Rare and reachable, which is what an off-field test should look like; the horizontal half it hands to, 0x3CE1, took 1519 and 1681 reads over 0x31 to 0xCF and entered its four-wide window zero times, so the two axes are not the same test twice. ★ It is an ARM, not an entry: its only inbound transfer is `jp nz,0x3cd9` from 0x3CC4, taken on the heading — 743 of 1521 and 905 of 1683 heading reads chose it — and 0x3CC4's other arm tests the SAME axis three lower, so the two windows are adjacent and disjoint and the heading picks which side of the line the object is approaching from. That is also why a three-wide window is not obviously steppable-over here, unlike hasReachedRetireLine's. NOT COVERED by the capture: the retirement actually following a yes (the single in-window hit was counted, not traced through to the occupancy byte), and which heading half means which direction",
  },
  0x3e36: {
    name: "stepFourActorSlots",
    role: "put four named actor slots through the shared per-slot step, in a fixed order, one after another, without asking first whether any of them holds anything — so the four are serviced as a group and the group's membership is fixed here rather than by the caller",
    cert: "seen",
    why: "'four, unconditionally, every time' is the whole of the claim and a tap can refute it outright. Read tap on the record band gated to the step's own state read, on the real ROM: across 9000 frames of undriven attract each of the four records 0xA810, 0xA820, 0xA830, 0xA840 was read exactly 6584 times, and across 13200 frames of a coin-driven run exactly 9866 times each — four equal counts, which a routine that skipped free slots could not produce, and 22208 of the 26336 attract reads returned 0x00 (free). The four IX bases pair with the four IY bases the routine loads beside them, 0xAA12, 0xAA14, 0xAA16, 0xAA18, under the record/entry mapping mechanisms.md states independently — (0xA810-0xA800)/8 = 2 and (0xA840-0xA800)/8 = 8 against 0xAA10 — so 'slot' is the right unit and 'actor' is the band those four sit in. The state values seen are the lifecycle's and nothing else: 0x00 and 0xFF throughout, plus one sighting each of a dying countdown (0x14 at 0xA810, 0x28 at 0xA830, 0x32 at 0xA840) and none at all at 0xA820. It is entry fifteen of the round engine's per-frame service list at 0x1199, and 6584 dispatches in 9000 frames is the sub-every-frame cadence that list is documented to run at. NOT claimed: what the four slots hold, or why these four and not the rest of the actor band",
  },
  0x3e63: {
    name: "loc_3e63",
    role: "split three ways on the head byte of the record an index register points at: zero returns with nothing done, all-ones hands over to one continuation and every other value to another. One byte read, nothing written, and neither continuation is given anything this entry computed",
    cert: "code",
  },
  0x3ecb: {
    name: "loc_3ecb",
    role: "force the head byte of the record the index register points at to one fixed value and hand over; what that byte held is discarded unread, so this is a clamp and not a step",
    cert: "code",
  },
  0x3faf: {
    name: "loc_3faf",
    role: "point an object's sprite the way it is heading, from a different pair of sector tables to the sibling that does the same rounding",
    cert: "code",
  },
  0x4017: {
    name: "flyAlongBallisticArc",
    role: "fly one object a frame along a ballistic arc -- a constant sideways step whose sign the record's own flag fixes, and a stored velocity on the other axis that gains a fixed amount every frame -- carrying it with the world scroll in both axes, and retiring the slot outright once it leaves the field on either",
    cert: "seen",
    why: "'ballistic' says one axis is integrated and the other is not, which the spawner could have refuted: it seeds that velocity word to minus one whole pixel per frame -- pointing AWAY from the direction it then accelerates -- and sets the sideways flag from the sign of the thrower's offset against the player's pinned sprite entry, so the arc always leans toward the player. A constant-speed mover, or a flag drawn from a heading table or the generator, would have killed the name, and the neighbouring era arms do exactly those instead. Under MAME it took ZERO dispatches on the attract demo, which runs the second through fourth eras, and thousands on all three tapes held in the first -- its caller's era gate, measured -- and BOTH retire arms fired, so neither bound is dead. ★ The name carries no object noun on purpose: gameplay.md records the manual describing the first era's thrown grenades in exactly these terms, which is what first suggested the reading, but that is an outside document and no capture here identifies what this object is",
  },
  0x40ab: {
    name: "retireSlot",
    role: "retire an object, zeroing only the INTEGER halves — occupancy byte and both sprite-entry coordinates — leaving the sub-pixel remainders standing",
    cert: "code",
    why: "no file calls both this and the sibling retire helper -- the two caller sets are statically disjoint, which is what makes them two families' helpers rather than two versions of one; and retireSlotIntoSharedCooldown re-arms a cooldown byte after calling it, a slot going back on cooldown rather than an object deleted",
  },
  0x0010: {
    name: "fetchTableWord",
    role: "fetch the two-byte entry an index selects from a word table and hand back both the word and the address past it",
    cert: "code",
    why: "batch 1 named 0x0008 fetchTableByte and 0x0018 offsetAddress, and this routine calls 0x0018 and then reads a word -- it is the word member of that family by construction; it is reached by a one-byte restart where the wide-index sibling needs a three-byte call, which is what makes it the default form",
  },
  0x0028: {
    name: "retreatCharCursor",
    role: "step the character-cell cursor one cell back along the line being drawn, the inverse of the advance vector",
    cert: "code",
    why: "loc_0eeb calls it on a blanked digit and returns so the caller's following advanceCharCursor nets to zero -- a suppressed digit consuming no cell is only coherent if the two are exact inverses on the same axis; MAME's ROT90 maps an increasing native row to a decreasing display column, which is the direction retreat names",
  },
  0x00a8: {
    name: "enableInterruptAndEnterForegroundLoop",
    role: "bring the machine up and never come back: set the interrupt-enable bit of the output latch from the low bit of the byte the caller carries, pet the watchdog, and fall into the foreground loop -- neither store reaches work RAM, and there is no return path",
    cert: "seen",
    why: "the refutable half is the ENABLE, and it was measured both ways in one run. Under MAME on the real ROM a write tap gated to this routine's own program counter caught exactly ONE store, 0xC300 <- 0x01 with the counter at 0x00A8; MAME's timeplt.cpp routes 0xC300-0xC30F to the LS259 whose Q0 is nmi_enable_w, so the low bit is the enable and the byte the caller hands over is the ROM byte at 0x4C87, which reads 0x01. The negative control is in the same trace and comes from the ROM itself: boot writes 0x00 into all eight latch offsets before this, and a fetch tap on the interrupt vector 0x0066 counted ZERO acceptances up to this routine's single entry at t=3.9217 s and the first one 11.6 ms later -- so the interrupt starts here and not earlier. The one-way half is corroborated from outside: the entry tap fired exactly ONCE in a 30 s attract run and this routine's latch store fired exactly once in each of three further 12 s runs, and mechanisms.md records the drain it falls into holding a single stack-pointer value over 4.5 million fetches of its loop head, which is what no return address looks like. The WATCHDOG store is named by the hardware map, not by the value: the driver maps 0xC200 writes to watchdog reset_w, which ignores its data -- so a name reading the byte as a watchdog argument would be wrong.",
  },
  0x00b1: {
    name: "loc_00b1",
    role: "tile the character plane with a lattice of boxes -- fourteen bands of sixteen, each box two cells wide and two lines deep, every one of them laid down by stampGridBox -- walking a cursor that starts a full line above the first band it writes and skips a line before each band, so the lattice keeps clear of the top of the plane and its bands come out contiguous; every position is counted out here and nothing is read to decide where a box goes",
    cert: "seen",
    why: "this address was watched directly, not inferred: under MAME it dispatched ONCE, at frame 33, in phase 0. The extent is the refutable half of the role, and it cross-derives from two directions that were not fitted to each other. From this side: fourteen bands of sixteen is 224 boxes of four cells, 896 writes, and a cursor from 0xA420 advancing a line per band plus two cells per box lands its last write at 0xA7BF. From the other: a MAME write tap gated to stampGridBox at 0x00C7 -- taken before this routine had a module -- counted 224 dispatches of four writes each, 896 cells with not one written twice, spanning 0xA440-0xA7BF, a tiling of 28 of the plane's 32 lines across all 32 columns. Those writes are all this routine's and that is checkable rather than assumed: CALL 0x00C7 occurs at exactly ONE address in the 24576-byte image, 0x00BC, interior to this routine's own range, with no JP to it anywhere -- and that is a scan of the WORD and not merely of the opcode forms, because a computed dispatch would name no opcode: the bare word occurs at four further addresses, none preceded by a call or jump opcode, each inside a table of little-endian words stepping by about three -- data, not a dispatch table. The count could have come out otherwise -- a second execution would have shown 1792 writes to the same 896 cells, and it showed 224 dispatches in each of two independent runs. The role says 'lattice' and not 'background' deliberately: mechanisms.md records the same census finding the plane blank before the fill, the pattern standing from frame 35 to frame 236, 812 cells left at frame 240 and none at frame 300, so this is a power-on pattern that the boot wipe removes before the attract loop, and nothing draws on it",
  },
  0x00c7: {
    name: "stampGridBox",
    role: "lay the four corner tiles of one hollow sixteen-by-sixteen box into the character plane at the cursor -- two cells across and two rows down -- and give the cursor back unmoved",
    cert: "seen",
    why: "'box' is the refutable half and the tile ROM settles it: codes 86, 131, 199 and 239 decode through this board's character layout as a top edge with a left edge, a top edge with a right edge, and the two matching bottom halves, which assemble into a closed rectangle and nothing else. 'Grid' is the caller: loc_00b1 runs this over 224 distinct cursors stepping two cells across and two rows down, and a MAME write tap attributed to this routine's own stores counted 896 writes to 896 DISTINCT cells spanning 0xA440-0xA7BF -- a regular tiling of 28 of the plane's 32 lines, where a caption would have been a handful. It does NOT claim a gameplay background: the same runs show the plane already blank before the fill, the fill standing for about 200 frames from power-on with the video-enable bit set, and the boot wipe erasing all 896 cells before the attract sequence starts",
  },
  0x018c: {
    name: "fetchWideTableWord",
    role: "fetch the word an index selects from a word table, with the index doubling carrying into the high byte so the table may run past the reach of its narrow sibling",
    cert: "code",
    why: "the only thing separating it from fetchTableWord is that the index doubling carries into the high byte, so this is the form a table wider than 128 entries needs -- a distinction no call site currently exercises, which is exactly why the name must carry it rather than the call sites",
  },
  0x0b06: {
    name: "stampCopyrightStrip",
    role: "stamp the four fixed pieces of the copyright caption into the display-list shadow; it reads nothing, so re-stamping changes nothing",
    cert: "code",
    why: "sibling hideCaptionSprites zeroes the vertical byte of exactly these four slots and nothing else, so an outside routine treats them as one addressable unit; the shapes it places decode out of the sprite ROM as the glyphs of the copyright caption, in the order it places them",
  },
  0x0e8d: {
    name: "drawSlotWithOneGlyph",
    role: "paint a two-cell character slot with a single glyph, blanking the other cell of the slot, give both the caller's colour, and step the cursor on to the next slot",
    cert: "seen",
    why: "the name predicts a write pair one cell apart with the blanking glyph on the lower address on every dispatch, and a MAME write tap gated to this routine saw 126 dispatches and 126 such pairs with no other shape. Two siblings fix the slot as two cells wide and not one: loc_0e9c writes glyphs into BOTH cells of the same pair and loc_0e70 writes four, all three stepping the same cursor by the same amount -- so the blank is the unused half of a fixed-width slot. It is not leading-zero suppression, which mechanisms.md attributes to a different drawer that chooses its glyph three ways from a carry flag",
  },
  0x0e9c: {
    name: "paintDoubleTile",
    role: "lay one two-tile block into the character plane from a base code the caller fixes -- the base below the cursor and the base plus one at it -- colour both cells a plane below, and step the cursor clear of the block",
    cert: "seen",
    why: "the family is named by BLOCK SIZE, as paintQuadTile's entry records, and this is the member the count of FIVES drives -- checkable, and checked on the real machine. Neither MAME sweep reached it, because the only argument either sweep presented to the routine that splits a value into thirties, tens, fives and ones was 1; posting that routine's ring command by the ROM's own protocol with the argument 37 -- one thirty, no tens, one five, two units -- dispatched this routine exactly once, paintQuadTile exactly once and the single-tile painter twice more, and a write tap caught this one laying codes 0x32 and 0x33 into two character cells with colour 0x11 in the two cells a plane below. Any other reading of the denominations gives different counts",
  },
  0x0eeb: {
    name: "paintDigitDroppingLeadingZero",
    role: "paint one decimal digit, with its colour, into the cell a cursor names -- or drop it and give the cursor back where it started, so the digit occupies no cell at all. Only the low four bits of the value choose the shape. A digit is dropped only while a caller-set allowance is left; a non-zero digit spends the whole allowance at once, so nothing after the first significant digit can be dropped and a zero in the last place still prints",
    cert: "seen",
    why: "the discriminating claim is DROP versus BLANK, and the two differ in one observable: whether the suppressed place consumes a cell. 30 s of undriven attract under MAME reaches it ZERO times, so it was made to run on the real machine -- MAME, posting command 7 by the ROM's own protocol (the command byte written into the ring cell the read cursor at 0xA9B3 names) while holding ROUND_NUMBER at a chosen value. With 37 the routine was entered 904 times and made 1808 character-plane writes: glyph 0x64 into 0xA5B7 and glyph 0xB0 into 0xA597, one cell apart, each with its colour a plane below at 0xA1B7/0xA197. With 7 it was entered the SAME 904 times and made 904 writes -- the zero place wrote NOTHING, and the surviving glyph 0xB0 landed at 0xA5B7, the very cell the tens digit had occupied in the other run. A blanking implementation would have written the blank glyph 0xF1 at 0xA5B7 and pushed the 7 to 0xA597; it did neither. The register log carries the mechanism with it: the first entry of every pair arrives with the allowance at 1 and the second with it at 0, whether the first place painted or was dropped, and the cursor DE reads 0xA5B7 on both entries of the dropped run against 0xA5B7 then 0xA597 on the painted one -- the retreat and the caller's advance cancelling exactly. The control is not blind: the identical script with the poke disabled dispatched it ZERO times and produced zero writes, and the same tap fired 904 times under the poke. That the shapes are DECIMAL digits is the ROM's: the table at 0x0F06 decodes through this board's character layout as 0-9 in its first ten entries and the blanking tile in the eleventh -- a different code set from the 0x0DCC table but the same drawn glyphs, and the table runs into the code at 0x0F11 after that, so only the digits are addressable.",
  },
  0x0f11: {
    name: "advanceSequencePhase",
    role: "advance the outer sequence phase and restart its inner step index at zero",
    cert: "code",
    why: "it executes zero times across a driven run -- every read of its entry byte is a checksum fold, none with the program counter at the address -- which corroborates from outside that all but one of its callers sit behind an anti-tamper test and are dead on a genuine image",
  },
  0x1226: {
    name: "handPlayOverToOtherPlayer",
    role: "give the turn to the other player: flip the one-bit active-player index, re-arm the shared sequence delay with a fixed span, and reseat the inner sequence index from a byte of the program image; nothing is copied here, and the flip is the only effect the skipped arm does not also have",
    cert: "seen",
    why: "the name predicts that a ONE-player game can never reach this entry, because the one-player start paths arm one save block and write zero into the other while the branch that arrives here is taken only when the OTHER block's first byte is non-zero -- so a two-player start must make it fire and a one-player start must not. Two MAME runs on the real ROM differing in one line of the driver, which start field it pulses, settled it: nine dispatches under a two-player start against ZERO under the one-player control, the selector alternating 0/1 on each of the nine, and the counts closing against the ten deaths the same runs recorded. It could have come out either way and the control is what makes the nine mean anything. Which player each value names is fixed outside this routine too: loc_078d posts caption index 9 or 10 on this cell, and those two records of the table at 0x0C50 are identical but for the one glyph that the score field independently fixes as 1 versus 2. A read of video RAM at the two score fields through the same run shows the inactive player's six cells frozen and the active player's moving, swapping at every flip",
  },
  0x1319: {
    name: "fillCellRun",
    role: "fill a fixed-length run of character cells with one byte, stepping a cell at a time along the line",
    cert: "code",
    why: "its callers pass video-RAM starts with the blanking character and colour-RAM starts with a computed colour, so the unit it steps is the tilemap cell in both planes rather than a byte address; the stride is the one batch 1's advanceCharCursor established as one cell along a line",
  },
  0x1563: {
    name: "restoreColumnFromSavedRun",
    role: "put a saved thirty-two cell picture back onto the character plane: twenty-eight bytes down one column of cells a row apart, then four into two two-cell columns beside it. Every address is fixed here -- the run it reads, the column it lays and the two stubs are all this entry's choice, not a caller's -- and it overwrites the cells whole rather than merging into them",
    cert: "code",
    why: "the direction is what a name has to get right, and it is fixed by two things outside the routine. First, the run it reads from, 0xA400-0xA41F, is the first row of the character plane, and MAME's driver puts the visible window at rows 2 through 29 (`set_visarea(0, 32*8-1, 2*8, 30*8-1)` over a 32x32 TILEMAP_SCAN_ROWS map) -- so the run is thirty-two cells of video RAM that are never displayed, which is a backing store and not a picture. Second, both call sites bracket their tick with the pair: advanceScriptedCharPlaneBandTo2 and advanceScriptedCharPlaneBandTo4 each call THIS entry near the top and its inverse 0x158C near the bottom, mutating cells of the same column in between (advanceScriptedCharPlaneBandTo2 does `inc (0xa5f0)` on one of the four stubs). Read run-first-save-last, the column is the working copy and the hidden row is where it survives whatever else draws over the screen; read the other way round, the two calls would cancel and the mutation would never persist. On the glass the geometry is a line, not a column: under the rotation mechanisms.md measured -- display_x = 239 - native_y, display_y = native_x -- a fixed video-RAM column is a constant display_y, so the twenty-eight cells at column 17 spanning rows 2-29 are a full-width horizontal line at display_y 136-143, and the four stub cells at columns 16 and 18, rows 15 and 16, are sixteen-pixel segments at display_x 104-119, centred, one line above the run and one below. NOT GROUNDED, and the reason is specific: its callers sit at inner steps 1, 2 and 3 of the sequence whose outer phase cell is 0xA9AC, dispatched as entry 14 of the `rst 0x30` table at ROM 0x0F29, and no run reached it -- 0x1323, the phase handler itself, took ZERO dispatches across 480 emulated seconds of attract and 400 of driven play, as did 0x142a, 0x14c5 and 0x158c. A blind poke of 0xA9AC/0xA9F0 to that phase does NOT settle it: the poked machine ran off into video RAM within seconds (program counter observed at 0xA41F), because the phase's script pointer at 0xA9F7 is part of the state being faked",
  },
  0x158c: {
    name: "loc_158c",
    role: "gather one column of the character plane into a thirty-two byte run -- the column's twenty-eight cells a row apart, then the two two-cell columns beside it -- overwriting the run whole rather than merging into it; it is the exact inverse of 0x1563 over the same cells in the same order",
    cert: "code",
  },
  0x15b6: {
    name: "hideAllSprites",
    role: "zero every slot of the vertical sprite shadow band, which parks all of them above the first visible line, hiding them without retiring any",
    cert: "code",
    why: "the slots it zeroes are exactly the ones the renderer scans, and its four-slot sibling hideCaptionSprites uses the identical idiom on the caption's slots alone -- one routine hiding a caption, this one hiding everything",
  },
  0x2b52: {
    name: "releaseHeldObject",
    role: "count a held object's release delay down and, when it expires, step its state code to the live one and re-arm the delay",
    cert: "code",
    why: "all five callers reach it through the same state-byte ladder and tail-jump here only when that byte is exactly the held value, so the increment is invariably held-to-live and never an open-ended bump; batch 1's retireSlot why already records other routines re-arming this same cell as a cooldown",
  },
  0x2bef: {
    name: "steerTowardAimHeading",
    role: "turn an object's heading one step toward the heading it aims at, the short way round, at a rate a small table supplies for the current mode cell",
    cert: "code",
    why: "the byte it writes is the one an object's own movement routine reads to pick a velocity -- the 0x58bc family, which carries an inlined copy of that lookup -- so this steps the heading motion follows, and the cell it steps toward is the target rather than the other way round",
  },
  0x3058: {
    name: "placeAbuttingTile",
    role: "place an object's next sprite tile flush against the current one and step both cursors onto it",
    cert: "code",
    why: "driftThreeTileSceneryAtFiveQuarters chains two of these and driftNearestSceneryTriTile chains one plus the diagonal sibling placeDiagonallyAbuttingTile, both tail-jumping into advanceToNextSlot -- so a slot boundary here is a tile boundary, which is exactly why that routine's own entry declines to call the unit an object",
  },
  0x40b8: {
    name: "askForSoundWhileTheGroupIsClear",
    role: "ask for one sound on every thirty-second frame from the third era on, and only while none of the three records at 0xA8C0, 0xA8D0 and 0xA8E0 is live; any one of those four tests failing ends the entry having done nothing at all",
    cert: "seen",
    why: "an entry of the round engine's service list, sitting immediately before the routine that WALKS that same group of records from 0xA8C0 and carrying the identical era test, so the pair is one subsystem's motion and one subsystem's sound. A MAME read tap PC-gated at the entry took 11471 dispatches over 300 driven seconds and evaluated all four conditions at each one: 3 dispatches had all four true and the fetch of the jp that asks was counted exactly 3 times, with zero passes carrying a false condition and zero refusals carrying four true ones -- so the gate is the conjunction and not a subset of it. The counter's low five bits were spread across all 32 values at the entry (356-360 each), so the thirty-second-frame test is a real filter on a free-running cell rather than a test the dispatch time already decides. Holding the era at 4 in a second run took the passes from 3 to 16. What is NOT established is which sound: the byte it asks for is ROM[0x07FE] = 0x86, and 0x86 does appear in the small set of codes the sound latch actually receives (9 writes in the run where this entry made 3 requests), but the latch is written by the interrupt epilogue's queue drain rather than by the requester, so the counts cannot be matched one to one and something else queues 0x86 too",
  },
  0x41ec: {
    name: "endApproachNow",
    role: "make the countdown at +0x04 of the record a caller points at read zero, so that record's handler takes its expired arm on the next frame instead of counting the rest of the delay down; one store and nothing else",
    cert: "seen",
    why: "one instruction, so everything that makes it a coherent act is outside it, and the outside is measured rather than assumed. Its one call site re-aims the record at a point every sixteenth frame and calls here only when BOTH axis distances to that point are under 16 -- so the condition is arrival, not a timer. Under MAME the era had to be held at 4 to see it at all, because the only path in runs `cp 0x04 / jp z,0x4194` on the era cell: in a 300-second control run with no poke this address, its caller 0x41B8 and that caller's own entry 0x4194 all took ZERO dispatches, and with the era held they took 4, 3278 and 6270. All 4 dispatches had IX = 0xA8C0 and the record's ordinal at +0x0F = 0x0C, and A and D at entry -- the two distances the caller tested -- were 0x06/0x0B, 0x07/0x07, 0x07/0x0B and 0x07/0x0C, every one under 16. The byte being cut was NON-ZERO on all 4, at 0x01, 0x07, 0x21 and 0x21, so the store really shortens a live countdown rather than restating a zero; 0x21 is 33 frames of delay skipped. What the countdown gates is decided by 0x4194, which reads it, not here",
  },
  0x43e8: {
    name: "sumImageBlockForTheTamperCheck",
    role: "add a run of program-image bytes into one eight-bit total and hand it down the tail chain that compares it against the value a genuine image gives, so the machine leaves either on the ordinary path or into the trap; a length of zero means a full 256 bytes and the total wraps",
    cert: "seen",
    why: "the whole of the chain is three tail jumps -- this entry, then parkTheImageTotalForTheTamperVerdict, then 0x5303 which calls 0x200C (whose last act is ld a,b, handing the total back) and does cp 0x67, jp nz,0x0F8D. mechanisms.md already names 0x0F8D as a two-byte data table that this arm jumps to as if it were code, which is the tamper trap. Adding the twenty bytes at ROM 0x086B out of the image gives exactly 0x67, so a genuine image passes by construction, and MAME agrees: over 300 driven seconds a PC-gated tap took 2 dispatches, both with HL = 0x086B and B = 0x14, the total recomputed at each was 0x67 both times, the clean arm at 0x530B was fetched twice and the trap at 0x0F8D was fetched ZERO times. A different block, a total that was not 0x67, or a single fetch of 0x0F8D would each have refuted this. The routine itself is generic in HL and B -- only one caller in the image fixes them, and it does so as its last act (jp 0x43E8 with HL = 0x086B, B = 0x14)",
  },
  0x46ba: {
    name: "setMotherShipVelocityFromHeading",
    role: "give the Mother-Ship the two velocity words its current heading picks out of the velocity table the era selects -- the word at the heading and the word a quarter turn behind it -- and park them at +0x0C and +0x1C of the record pair, which is where its motion reads them",
    cert: "seen",
    why: "the era chooses a table and nothing else: each of the five arms in the word table at 0x46C4 is a bare ld hl,<table> falling into or jumping to the shared 0x596E, and 0x596E does the whole lookup -- DE = table[(IX+0x02)], BC = table[(IX+0x02) - 0x40] -- so the arm's only degree of freedom is which of the ROM velocity tables is used, i.e. a speed. The tables the arms name are 0x59D7, 0x5E00, 0x5E00, 0x2E3E, 0x08FA for eras 0 to 4, all four of which sit on the closed six-rung ladder of scaled copies of one waveform that mechanisms.md derives, at peaks 206, 256, 306 and 331 computed from the image -- so what an era buys here is a SPEED and nothing else. Set against the player's own ladder as mechanisms.md records it (256 at era 0, 306 at eras 1-2, 331 from era 3), this object runs exactly one used rung below the player at eras 0 through 3 and draws level at era 4. A MAME run holding the kill quota at zero so the object arms often, and walking the era, took 32 PC-gated dispatches with IX = 0xA8A0 on every one, across all five eras (3/5/7/7/10), and the arm selected followed the era exactly. On each dispatch all four bytes the block at 0x46CE stores were recomputed from the ROM -- arm table indexed by era, then that arm's velocity table indexed by the record's own heading byte -- and 128 of 128 stores matched with zero mismatches; a wrong axis, a wrong quarter-turn or a wrong table would each have produced a mismatch on the first dispatch. The mask admits eight indices where the table defines five, and indices 5-7 read the first bytes of the block at 0x46CE as though they were an arm address -- unreachable while the era cell stays 0-4, and the rewrite reproduces the arithmetic rather than assuming it away",
  },
  0x4809: {
    name: "showParachutistAward",
    role: "start the parachutist slot's exit: put its state byte at the top of the dying countdown, ask for the sound that goes with collecting it, and swap its sprite tile to the glyph for the award the slot's own rung byte selects -- with one fixed glyph once the rung passes the four the table holds, so the lookup never reads on past the table",
    cert: "seen",
    why: "the rung byte it indexes by is (IX+0x07), and IX is 0xA8F0 from its only caller, so that byte is 0xA8F7 -- the cell names.js already calls PARACHUTIST_RUNG, 'how many rescue awards this life has already been paid'. That registry entry's claim that the first four rungs each select their own value and every rung after them takes the same top value IS this table: ROM 0x482D holds f9 fc 8d 8e and the out-of-range arm writes a single 0x8F. Under MAME, 300 driven seconds gave 2 PC-gated dispatches, both with IX = 0xA8F0 and IY = 0xAA2E; the rung read at entry was 0x00 then 0x01 -- so it steps between collections, and it is read before that step, which is why the first award of a life pays the bottom rung -- and the glyph actually written to (IY+0x01) was 0xF9 then 0xFC, matching ROM[0x482D + rung] on both, 2 of 2, with no writes matching neither arm. A glyph off by one, or a rung that did not move between the two, would have refuted the reading. The other two stores are constants: 0x3B into the state byte, which is the TOP of mechanisms.md's 0x01-0x3B dying-countdown band, and 0x6C into (IY+0x30). The sound is ROM[0x079B] = 0x16, asked for through the permission-gated request shim at 0x57FF; which sound that is has not been established here",
  },
  0x4bd9: {
    name: "loc_4bd9",
    role: "a bare transfer to 0x08AE and no return; no cell is read or written and no register moves",
    cert: "code",
  },
  0x4dcf: {
    name: "loc_4dcf",
    role: "write the caller's glyph into the character cell the cursor names and the blanking glyph into the cell one address below it, lay the caller's colour beside both in the colour plane, and step the cursor one cell along the line -- the same two-address pair loc_4daf writes as one column of its two-by-two emblem. Its one call site in the image is the loop at 0x4D9A inside drawEmblemStripThenGuardImage, the handler for ring command 5, which runs it from 0xA783 down to 0xA623 to clear the tail of that row after the emblems it has drawn, and passes 0xF1 as the glyph as well, so in that use both cells come out blank. Returning from the colour plane is a SET and not a restore, so a cursor that arrived on the colour side would write its glyph there and come back on the glyph side; nothing checked here supplies such a cursor",
    cert: "code",
  },
  0x4dde: {
    name: "loc_4dde",
    role: "award an extra life when the active player's score reaches one of the bonus marks, once per mark. It returns immediately unless PLAY_ACTIVE is set; picks one of the two mark tables at ROM 0x4E1B and 0x4E30 on bit 0 of the settings byte at 0xA9C3; and searches the chosen table with cpir for an EXACT match on the top byte of the active player's six-digit packed-decimal score -- 0xAD35 or 0xAD38, selected on ACTIVE_PLAYER -- so only a score standing on a mark matches, never one compared against it. Bit 0 of 0xAD03 makes the award one-shot: a match while that bit is already set does nothing, and the first call that does not match clears it again. On a fresh match it sets the bit, increments LIVES_REMAINING, posts ring command 5 with the count from BEFORE the increment, and tail-jumps into loc_5805 for the sound, so loc_5805's ret returns to this routine's caller. Its one call site in the image is serviceRoundThenResolvePlayerState, the round engine's straight-line block of calls, which reaches it once per dispatch of that block",
    cert: "code",
  },
  0x51de: {
    name: "postChainedHitScore",
    role: "post a scoring command to the ring, stepping the award up while consecutive hits keep landing inside the chain window and wrapping back round after the eighth",
    cert: "code",
    why: "expireHitChain, an entry in the round engine's service block, ticks the chain window down and clears the step cell when it expires -- without that outside reset the argument would not restart, so the chaining is fixed by a routine other than this one; and it posts through postCommand, which drops the pair on a full ring, so it posts rather than awards",
  },
  0x565f: {
    name: "loc_565f",
    role: "read the byte at 0x07A2 and request it as a sound code, only while a game is being played",
    cert: "code",
  },
  0x5664: {
    name: "loc_5664",
    role: "read the byte at 0x16DE and request it as a sound code, only while a game is being played",
    cert: "code",
  },
  0x5669: {
    name: "loc_5669",
    role: "read the byte at 0x4C9F and request it as a sound code, only while a game is being played",
    cert: "code",
  },
  0x5674: {
    name: "loc_5674",
    role: "read the byte at 0x276B and request it as a sound code, only while a game is being played",
    cert: "code",
  },
  0x5679: {
    name: "loc_5679",
    role: "read the byte at 0x07FE and request it as a sound code, only while a game is being played",
    cert: "code",
  },
  0x567e: {
    name: "loc_567e",
    role: "read the byte at 0x3270 and request it as a sound code, admitted while a game is being played or the cell at 0xA9C6 is set",
    cert: "code",
  },
  0x568e: {
    name: "loc_568e",
    role: "read the byte at 0x2D87 and request it as a sound code, only while a game is being played; it is the fifth member of the family of shims that each bake in one program address and share one permission door",
    cert: "code",
  },
  0x56e4: {
    name: "loc_56e4",
    role: "read the byte at 0x27CB and request it as a sound code, then do the same with the byte at 0x33A0; each request goes through the door at 0x5617, which admits it while a game is being played or while the cell at 0xA9C6 is set. It is reached two ways -- as a call from advanceScriptedCharPlaneBandTo4, in the arm that steps that routine's script pointer on, and by falling out of the bottom of loc_56d2, which has just asked for three other codes through the play-only door at 0x560C -- and it is the same two-load, two-request shape as requestTwoSounds at 0x5683 with a different pair of program bytes",
    cert: "code",
  },
  0x57f1: {
    name: "loc_57f1",
    role: "read the byte at 0x322E and request it as a sound code, with no permission test",
    cert: "code",
  },
  0x57f7: {
    name: "loc_57f7",
    role: "request the sound code that the era index selects out of a run beginning twelve codes up, only while a game is being played; the sum is not clamped",
    cert: "code",
  },
  0x57ff: {
    name: "loc_57ff",
    role: "read the byte at 0x079B and request it as a sound code, only while a game is being played",
    cert: "code",
  },
  0x5805: {
    name: "loc_5805",
    role: "read the byte at 0x2D4E and request it as a sound code, only while a game is being played",
    cert: "code",
  },
  0x580b: {
    name: "loc_580b",
    role: "read the byte at 0x49EE and request it as a sound code, only while a game is being played",
    cert: "code",
  },
  0x5811: {
    name: "loc_5811",
    role: "read the byte at 0x07A9 and request it as a sound code, only while a game is being played",
    cert: "code",
  },
  0x5817: {
    name: "loc_5817",
    role: "read the byte at 0x273A and request it as a sound code, only while a game is being played",
    cert: "code",
  },
  0x5834: {
    name: "loc_5834",
    role: "read the byte at 0x1767 and request it as a sound code, only while a game is being played",
    cert: "code",
  },
  0x583a: {
    name: "loc_583a",
    role: "read the byte at 0x18FA and request it as a sound code, only while a game is being played",
    cert: "code",
  },
  0x5840: {
    name: "flyAtSlowestSpeed",
    role: "fly one object a single step at the slowest of the velocity-table speeds, choosing that table for the flier and deciding nothing else; reached as a call from two per-slot actor handlers and as a tail jump from a third",
    cert: "code",
    why: "every entry into flyAlongHeading is a two-instruction shim fixing one of several velocity tables whose peak magnitudes step evenly in 8.8 fixed point, so what an entry contributes is a rung on that ladder and not the act of fixing a table. Those tables are one waveform scaled -- each is the 256-peak table times its own peak to within two units of the last place, with identical off-symmetry headings -- so magnitude is the only degree of freedom a shim has, which is what makes a speed the right kind of thing to name it for. The ladder's ORDER is fixed from outside the flier: the routine that arms the player reads the era index and climbs the same tables as it rises, and an enemy shim selects the table that routine reaches at the top -- an enemy flying the player's own rung, which is what gameplay.md describes when it records the fourth era's jets as as fast and manoeuvrable as you. This entry's table sits below the slowest the player is ever given. A MAME run saw every dispatch here predicted exclusively by that table, while a sibling shim ran on the SAME slot array with a faster one, so an entry selects a speed and not an object class. cert stays code because 'slowest' is a rank over ROM tables and must stay one: two rungs of this ladder are selected only by shims whose addresses appear nowhere in the image, so no capture can ever watch the whole rank. A run reaching the later eras would put every REACHABLE rung under observation, and the name survives that ordering too",
  },
  0x5860: {
    name: "loc_5860",
    role: "fly one object a single step at the pace the velocity samples based at 0x2E3E set, choosing that table and deciding nothing else; a pointer the caller was holding is discarded. Its one reader in the image is steerEnemyTowardShip, which the era-4 arm of the handler table at 0x2914 calls for a live slot, and that reader alternates on bit 1 of the frame tick between this entry and 0x58AA -- the shim that hands the double-velocity mover the ladder's bottom table -- so the object it steps does not stay on one rung",
    cert: "code",
  },
  0x5942: {
    name: "loc_5942",
    role: "hand back the perpendicular component pair an object's heading calls for, at the pace the velocity samples based at 0x59D7 set -- the bottom rung of the six-table ladder; choosing that table is all this entry does, an incoming pointer is discarded, and the pair is the whole product, no memory is written. Two readers: armBomberSlotWhenTimerFires calls it while arming a slot and stores the pair straight into that record, and it is the first word of the era-indexed arm table at 0x46C4, the arm setMotherShipVelocityFromHeading takes at era 0",
    cert: "code",
  },
  0x596b: {
    name: "loc_596b",
    role: "hand back the perpendicular component pair an object's heading calls for, at the pace the velocity samples based at 0x08FA set; choosing that table is all this entry does, an incoming pointer is discarded, and the pair is the whole product -- no memory is written",
    cert: "code",
  },
  0x596e: {
    name: "velocityForHeading",
    role: "look up the velocity vector for a heading: two perpendicular components a quarter turn apart, read from the table the caller supplies",
    cert: "code",
    why: "loc_1f55 negates the pair this returns into the very cells driftWithWorldScroll adds to every world-static object -- negated player velocity applied to everything else is the camera, which gameplay.md records independently; the selectable tables hold a near-constant magnitude around the heading circle, not an exact one, with anomalous words widening the spread",
  },
  0x0bff: {
    name: "drawTextRun",
    role: "paint one caption into the character plane and give every cell of it one colour, taking glyphs in order from a run that ends at a fixed terminating code",
    cert: "code",
    why: "the runs its callers select decode, through the board's own tile layout, into the English captions the public record independently names -- and two of them spell the exact bonus settings MAME reads off DSW1 -- so the bytes it copies are glyph codes and not a display list. NOT text in every case: two records instead select second-bank tiles with three pen levels, a shaded banner strip where a byte is a piece of a letter, which this name does not cover",
  },
  0x0f7b: {
    name: "loadDifficultyRecord",
    role: "copy the four-byte record an index selects out of a fixed table and into the four cells that hold the difficulty settings in force; scaling the index by the record width is done as a BYTE, so an index of sixty-four or more selects a record a wider multiply would not",
    cert: "seen",
    why: "'difficulty' is the whole of the claim and one experiment could have killed it. The index this entry is normally handed is a cell three bits wide that the boot-time DIP unpack fills, and the table has exactly eight records; MAME's own port definition for this driver names that DIP field Difficulty and gives it eight positions labelled 1 (Easiest) through 8 (Difficult). Driving the field through all eight positions on the real ROM, one process per position with an isolated cfg directory, and reading the DERIVED cells back rather than the setting: the index took the eight distinct values 0 to 7 in the labels' own order, and the four destination cells took the eight DISTINCT ROM rows in the same order. The DIRECTION could have come out backwards and did not. Three of the four bytes are the escalation rung a round starts on, bracketed by rounds completed at 6 and 11 by startNextRound -- and the first of them was watched reaching the per-player cell and then ERA_RUNG itself at every one of the eight positions, rising 0,0,0,2,4,7,11,15. The fourth lands in ERA_RUNG_PERIOD, which is separately grounded as how long one rung lasts, and it FALLS 13,12,11,10,9,7,5,5. Harder setting, higher start and faster climb, on cells whose roles were fixed by an earlier pass. ★ The negative control is in the same runs: with no credit taken all eight positions produced the SAME record, because the attract path reaches this entry through the call site that passes a literal instead of the DIP cell",
  },
  0x1098: {
    name: "multiplexSpriteSlots",
    role: "wait until the raster has passed each of eight scenery slots, then move that slot half a screen in both axes so the same sprite shows twice in one frame; a slot whose request bit is clear is left alone",
    cert: "code",
    why: "the slots it edits are exactly those the sprite DMA fills from the shadow block the era-keyed parallax dispatcher writes, and the partner it moves is that slot's X byte while the request it clears is its Y byte -- so the two writes are one object repositioned, not two objects. A near-twin performs the same edit on the same slots but SKIPS a slot whose beam has not arrived instead of spinning for it, and that contrast is what identifies the wait as this routine's purpose",
  },
  0x1a9a: {
    name: "applyEraRungSettings",
    role: "apply the tuning row that the era and its escalation rung together select, scattering the row's ten bytes over twelve cells -- two spawner caps, two aim windows, two cooldown periods and their live countdowns, and two thresholds",
    cert: "seen",
    why: "'settings' is the claim, and a wave-composition table would have refuted it. Watched under MAME while the rung climbed, every destination took a monotone ladder of values -- one cooldown period stepping 0x32, 0x28, 0x1E, one threshold 0x50 through 0xA0, one cap 0, 1, 2 -- and two of the destinations are read as live countdowns by a routine that is not this one: the vblank service decrements 0xA817 and 0xA8F4 thousands of times and six sites reload them from 0xA814 and 0xA8F6, which this routine writes in the same breath. A row of unrelated constants could not have produced a period-and-countdown pair. ERA_INDEX's own entry already describes the composite index this routine builds without naming the routine that builds it. ★ It is also reached by FALL-THROUGH from the life-start routine at 0x19F0, not only by the tail jump from the escalation timer, so a rewrite that gives 0x19F0 no path here silently loses the round-start application. The name does NOT say the settings are all about attack: two of the twelve are read by paths I did not tie to attacking",
  },
  0x1ae4: {
    name: "freeAndNumberEveryObjectSlot",
    role: "lay out the object array's twenty-three records, sixteen bytes apart from a fixed start: clear each record's occupancy byte and stamp its sixteenth byte with that record's position in the run, counting from one. Nothing is read, so the run comes out the same however it went in",
    cert: "seen",
    why: "the name says the stamped byte is an IDENTITY handed to every slot, which predicts both that some other code selects a slot by it and that the run covers the whole array rather than one family's band. Both hold from outside this routine. countTheKillAndGrantTheSharedToken writes a record's own stamp, plus a top bit, into a single shared cell when a timer expires, and 0x2C31 retires an object outright unless that cell's low seven bits match its own stamp -- a writer and a reader that agree on the byte's meaning and would both be incoherent if it were a countdown or a type code. The run is the whole array: 0xA810 through 0xA970 at a stride of sixteen is exactly the actor band plus the scenery band in mechanisms.md's own table, every slot but the player's. Watched under MAME with a read tap at this entry, the twenty-three sixteenth bytes read 1 through 23 and the twenty-three occupancy bytes read zero in the frame it ran, on all three dispatches of a driven run; its one caller is the life-start routine, so the cadence is once per life and not once a frame",
  },
  0x1ed1: {
    name: "readPlayerControls",
    role: "hand back the control word of whichever cabinet panel currently faces the picture",
    cert: "code",
    why: "the flag it selects on is the byte the vblank service latches into the LS259 bit MAME reports as flip-screen, and the two cells it chooses between are the frame mirrors of the driver's mono panel and its cocktail twin -- so which panel faces the picture is fixed by hardware outside this routine. Its callers then split the returned word three different ways (the stick nibble, the fire bit edge-detected into a burst, and, in initials entry, individual bits each shifted into their own one-bit edge history), which is what makes the whole word the product rather than any one field",
  },
  0x2a3c: {
    name: "refreshSpriteFromHeading",
    role: "store the shape byte and the attribute byte that show an object pointing the way it is heading into that object's own sprite entry",
    cert: "code",
    why: "spriteForHeading returns the pair and this is one of the two sites that consume it; the two bytes land at +0x01 and +0x30 of the same sprite entry whose +0x00 and +0x31 the parallax and flight helpers write as coordinates, so the four bytes are one entry and what is stored is a sprite rather than a state code. A read tap measured 51532 dispatches through driven play and none at all in an undriven run, so whatever it dresses is not on screen in attract",
  },
  0x2a47: {
    name: "refreshSecondEraSpriteFromHeading",
    role: "show one of the second era's enemy craft pointing the way it is heading: the shared heading lookup picks a shape and the byte beside it, and each is stored into the object's own sprite entry shifted by a fixed bias -- sixteen on the shape, fifty-three on the attribute -- so this era's craft is drawn from its own block of the sprite ROM in its own colour. The attribute's two flip bits survive the addition because every entry of the lookup's attribute table carries the same low colour field, so the bias moves the colour and leaves the facing alone",
    cert: "seen",
    why: "the name claims the bias is ERA-keyed, and that is exactly what the machine could have refuted three ways: the pair could have been shared by every era's craft, or keyed to an object class, or the sibling dresser could have run alongside it. The arm that reaches it is chosen by `ld a,(0xad04); and 0x07; rst 0x30` on the table at ROM 0x2914 -- entries 0x2927, 0x294c, 0x2984, 0x29b0, 0x29d5 -- so the dispatch is by era index and nothing else, and each arm can be watched separately. Under MAME on the real ROM, with dispatches attributed by a PC-filtered read tap and keyed on the era cell: an undriven attract run that visits the second, third and fourth eras dispatched this entry 17274 times and EVERY ONE of them at era 1, while the third- and fourth-era arms ran 21598 and 21996 times over the same run and contributed ZERO of them; a driven one-player game held in the first era dispatched it zero times and dispatched the sibling refreshSpriteFromHeading 21922 times instead. The control runs both ways, so the complementary zeros are evidence and not coverage. The slots it dresses are the seven ordinary enemy-craft records 0xA850-0xA8B0, and the sprite entries it writes, 0xAA1A-0xAA26, are what mechanisms.md's record-to-entry formula predicts from those records -- a pairing this capture reproduces independently rather than assumes. Its one caller returns immediately after it, so the shifted bytes are the whole of what it leaves behind",
  },
  0x2a57: {
    name: "spriteForHeading",
    role: "pick the sprite shape, and the byte beside it, that show an object pointing the way it is heading, alternating between two shape banks as a frame counter's bit turns over",
    cert: "code",
    why: "its callers store the two returned bytes into a sprite entry's tile-code and control slots and nothing else, so the pair is a sprite and not a state code; the attribute table's colour field is identical in every entry while only its two flip bits vary, so that byte is a flip attribute rather than a per-sector palette pick, and it is the MIRRORING those bits give that lets a handful of shapes cover the whole circle. Two object classes use it, so it is not the player's",
  },
  0x2e31: {
    name: "displaceByFiveQuarters",
    role: "move a coordinate by a displacement and a further quarter of it, so what it carries leads what moves by the whole of it; the quarter rounds down rather than toward zero",
    cert: "code",
    why: "the sole caller of each is a byte-identical wrapper differing from the other two only in which of these it calls, and from driftWithWorldScroll only in applying a fraction -- so the fraction is the whole of what distinguishes them, while the scroll cells, the object and every memory write belong to the caller. These three read no scroll cell, touch no object and write no memory. A prediction that could have failed and did not: if each fraction has exactly one wrapper, the dispatch ratio across the era-0 handler list must be one to two to one, and it is measured at one to two to one on both attract and driven runs",
  },
  0x303e: {
    name: "displaceByThreeQuarters",
    role: "move a coordinate by three quarters of a displacement, so what it carries trails what moves by the whole of it",
    cert: "code",
    why: "the sole caller of each is a byte-identical wrapper differing from the other two only in which of these it calls, and from driftWithWorldScroll only in applying a fraction -- so the fraction is the whole of what distinguishes them, while the scroll cells, the object and every memory write belong to the caller. These three read no scroll cell, touch no object and write no memory. A prediction that could have failed and did not: if each fraction has exactly one wrapper, the dispatch ratio across the era-0 handler list must be one to two to one, and it is measured at one to two to one on both attract and driven runs",
  },
  0x304d: {
    name: "displaceByHalf",
    role: "move a coordinate by half a displacement, so what it carries keeps half the pace of what moves by the whole of it",
    cert: "code",
    why: "the sole caller of each is a byte-identical wrapper differing from the other two only in which of these it calls, and from driftWithWorldScroll only in applying a fraction -- so the fraction is the whole of what distinguishes them, while the scroll cells, the object and every memory write belong to the caller. These three read no scroll cell, touch no object and write no memory. A prediction that could have failed and did not: if each fraction has exactly one wrapper, the dispatch ratio across the era-0 handler list must be one to two to one, and it is measured at one to two to one on both attract and driven runs",
  },
  0x5205: {
    name: "expireHitChain",
    role: "run the chained-hit window down by one and, on every frame after it has reached zero, clear the chain step so the next hit starts the award ladder from the bottom again",
    cert: "seen",
    why: "that this routine and no other ends a chain is the claim, and a write tap could have found a dozen writers: across a driven run the window cell took writes from three program counters and the step cell from two, all of them inside this routine and the poster it serves. postChainedHitScore's registry entry already describes this routine's effect from the other side, written before it was lifted, and the poster has no path that resets the step itself, so without this the ladder would never restart. Its two arms are exclusive and exhaustive, measured: the tick count plus the clear count equalled the dispatch count exactly on all four tapes. The name says 'expire' rather than 'tick' because the clear is not edge-triggered -- it fires on every idle frame, not only the frame the window empties",
  },
  0x5211: {
    name: "destroyTargetsHitByShots",
    role: "destroy every target a live shot has reached, spending the shot with them, and post the score for each; the sweep does not stop at the first, so one shot can take several in a pass",
    cert: "code",
    why: "every caller fixes the outer array at the six-slot table fireAndSweepPlayerShots owns and arms only on a fire-button rising edge, and varies only the inner list -- so the sweep runs shots against targets and not the reverse. The state code it writes is the one stepDyingObjectState converts into a death countdown before retiring the slot, so destroy is the object's fate rather than this routine's bookkeeping. Kills also arrive through another routine's inline collision, which is why nothing here is [seen]",
  },
  0x58a4: {
    name: "loc_58a4",
    role: "fly one object a single step at the pace one fixed table of velocity samples sets, discarding any pointer the caller held",
    cert: "code",
  },
  0x58bc: {
    name: "flyAlongHeading",
    role: "fly one object a single step along the heading it holds, and in the same add carry it with the world: each coordinate gains its own velocity component PLUS the shared per-frame scroll pair, so nothing else may drift this object",
    cert: "code",
    why: "the pair it adds to every coordinate is the same pair driftWithWorldScroll applies to world-static objects, so this is that camera application and the object's own velocity folded into one add -- which is why none of its callers drifts the object separately, and why a reader who takes the name to mean velocity only will add a drift beside it and apply the camera twice. Its first half is byte-identical to velocityForHeading, so the module's reuse of that routine is an identity rather than an approximation",
  },
  0x0b39: {
    name: "flashCopyrightLine",
    role: "make the copyright line change colour every frame: ask for the same glyph run at the same place in one of two colours, choosing between them on the low bit of the frame counter, which it only reads. The request goes on the command ring and is dropped when the slot the write cursor names has not been consumed, so a frame can silently miss its turn",
    cert: "seen",
    why: "the two arguments are 0x00 and 0x1F and the ROM says what they select: both records of the caption table at 0x0C50 give destination 0xA6BC and the SAME thirteen glyph codes, which decode through this board's character layout as a copyright mark, KONAMI and 1982 -- they differ in one byte, the colour, 0x10 against 0x05. So the pair cannot be two captions, and the only thing that can alternate is the colour. Watched under MAME on the real ROM: a write tap on the line's first colour cell 0xA2BC logged 58 writes from the shared caption painter's store at 0x0C07 across the first second of the title screen, 29 of 0x05 and 29 of 0x10, strictly alternating at 16.7 ms intervals apart from one repeat in the first three frames; over the same window the glyph cell 0xA6BC took the copyright mark 0x30 from that same store 17 times and no other value -- colour moves, shape does not. The two arms are attributed, not assumed: entry taps put this address and 0x0B46 on alternate frames, and the frame this routine's own arm ran produced the 0x10 write while the frame it tailed into 0x0B46 produced the 0x05 one. Command 1 is the caption drawer that takes the record's OWN colour byte (table 0x0BBC slot 1 -> 0x0BF2), which is why a colour difference in the record is the whole mechanism. 0x0B46 is reached from nowhere else in the image, so the pair is one act and not two entries.",
  },
  0x0b46: {
    name: "loc_0b46",
    role: "queue one fixed command, with its one fixed argument, in the command ring -- both bytes are chosen here and whatever the caller held is discarded; the pair is dropped when the slot the write cursor names has not been consumed, and this entry never learns that",
    cert: "code",
  },
  0x0b93: {
    name: "loc_0b93",
    role: "the foreground loop: take commands off the ring one at a time and run each, for ever. A read cursor names a cell; while its high bit is set the cell holds nothing and the loop looks again, which is the only wait for the vblank among the foreground loops a coin-and-play tape reaches -- the ring is refilled from outside the loop. An occupied cell gives up a command byte and an argument byte, both cells are freed BEFORE the command runs so a command may reuse the pair it arrived in, and the low nibble of the command indexes a sixteen-way table. Where the handler lands is the exit test: it is handed one fixed place to come back to, and anything else means it has taken the machine somewhere this loop no longer owns",
    cert: "code",
  },
  0x0c0f: {
    name: "drawCaptionInPenColour",
    role: "paint the caption a caller's index selects, taking the glyph run from a record in the table at 0x0C50 and colouring every cell from the low nibble of the shared colour cell instead of from the record's own colour byte",
    cert: "code",
    why: "which byte the colour comes from is the only thing separating this entry from its siblings, and a sibling settles it the other way: loc_0bf2 walks the same table and the same record layout and loads the colour FROM the record's third byte -- the byte this routine steps over -- so that byte is the record's own colour and skipping it is the whole of what this entry contributes; loc_0c23 is the same skip with a fixed offset added. mechanisms.md reaches the same split from a colour-cell write tap, recording that four handlers draw from one record table, one taking the record's colour and the others deriving it from a single cell",
  },
  0x0c23: {
    name: "drawCaptionTenPastSharedColour",
    role: "paint the caption an index selects from the shared record table, taking the destination and the glyph run from the record but the colour from a cell outside it, ten past that cell's value and kept to four bits",
    cert: "seen",
    why: "the discriminating claim is the OFFSET, and the image holds the set that makes it one: the handler table at 0x0BBC sends three entries to routines that read the SAME cell and add 0, 5 and 10 before the same four-bit mask, all three ending in drawTextRun, while a fourth takes the colour the record itself carries. The name deliberately does not say the colour cycles, because that was refuted: a read tap logging the accumulator and the source cell together on every dispatch found this handler painting caption 27 at source value 2 and caption 28 at source value 3, every time and at no other value, across 90 s of attract and a 200 s driven game -- its own colour never moved. The flashing comes from the three handlers taking turns at one caption",
  },
  0x0c39: {
    name: "eraseTextRunByIndex",
    role: "erase the caption an index selects: the index picks the same record drawTextRunByIndex uses, and every cell the record's glyph run covers is overwritten with the blank code, leaving the colour plane exactly as it was",
    cert: "seen",
    why: "the discriminating claim is erase-not-repaint, and one cell settles it from outside: on a driven tape the video-RAM cell 0xA4E0 took three writes of the blank code from THIS routine's store, while on the attract tape the same cell took six writes of a glyph from drawTextRun's store -- one cell, one painter, one eraser. No colour-plane write was ever attributed to it, which a repaint would have produced. The ring's sixteen-way handler table at 0x0BBC seats drawTextRunByIndex at slot 1 and this at slot 3, and its one direct caller uses it in the arm where the second player's label must be absent while the two-player arm draws that same caption -- so a name saying merely 'blank a run' would drop the half that makes it the draw handler's inverse. Its store fired about a dozen times per dispatch on every tape: a caption's length, not a screen's and not one cell",
  },
  0x0ce8: {
    name: "loc_0ce8",
    role: "an exit with nothing left to do: no cell is read or written and no register moves",
    cert: "code",
    why: "it is not a routine, and an English name would have to say it is. The word 0x0CE8 occurs exactly ONCE in the whole 24 KB program image, at 0x0C98 -- which is the operand of awardScoreToPlayer's own `jp z,0x0ce8`. So no table dispatches it, nothing outside awardScoreToPlayer transfers to it, and the sixteen-way command table at 0x0BBC does not hold it: the bare-`ret` slot that table uses six times is 0x0BDC, a different address. What 0x0CE8 actually is is the last byte of awardScoreToPlayer (0x0C90-0x0D1A minus its second half), the label its early-out and its normal end both land on -- a range boundary that the transcription turned into a filename, which is the trap routine-is-a-range-not-a-filename names. It runs: an entry tap gated on the program counter caught it three times in 30 s of undriven attract under MAME on the real ROM, so it is live code and not data; that measurement says it is reached, and reaching a `ret` is not a role. Any name by EFFECT would have to be the effect of awardScoreToPlayer's exit, which is awardScoreToPlayer's to carry.",
  },
  0x181d: {
    name: "loc_181d",
    role: "an arrival point with nothing to do: no cell is read or written and no register moves",
    cert: "code",
  },
  0x3ce1: {
    name: "loc_3ce1",
    role: "answer whether the byte at the head of a sprite entry has reached its wrap point, testing a four-wide window that straddles zero -- so it measures a wrapped distance rather than bounding a range, which is what lets a byte stepping several units at a time land inside the window instead of over it",
    cert: "code",
  },
  0x5854: {
    name: "loc_5854",
    role: "fly one object a single step at the pace the velocity samples based at 0x5E00 set, choosing that table and deciding nothing else",
    cert: "code",
  },
  0x594e: {
    name: "loc_594e",
    role: "hand back the perpendicular component pair an object's heading calls for, at the pace the velocity samples based at 0x5E00 set; choosing that table is all this entry does",
    cert: "code",
  },
  0x5965: {
    name: "loc_5965",
    role: "hand back the perpendicular component pair an object's heading calls for, at the pace the velocity samples based at 0x2E3E set; choosing that table is all this entry does",
    cert: "code",
  },
  0x01b5: {
    name: "armLineWipeFromFifthLine",
    role: "arm the character-plane wipe to start at the plane's fifth cell and to run for a count taken from a fixed cell of the program image rather than carried as an immediate; neither armed cell is read here, and nothing a caller held survives into either",
    cert: "seen",
    why: "the name claims a PARTIAL wipe -- a definite start and a definite length -- and both halves are countable from outside this routine, because a routine that is already grounded does the work. blankNextLine blanks one line and takes one off the count, and its callers return early while the count survives, so the number of its dispatches after an arm IS the count armed. Measured on the real ROM under MAME with a read tap at each entry: the boot arm, armWholePlaneWipeThenDerailOnATamperedImage, seats the cursor at the plane's first cell with an immediate 32 and is followed by exactly 32 dispatches of blankNextLine; each dispatch of THIS entry is followed by exactly 27. Three independent driven runs recorded the same 32 + 27 + 27, and reading the two cells back in the frame this ran gave the cursor at the fifth cell and the count at 27 both times. 32, or 28, or a count that did not come back to zero would each have killed it. It fires on the credit and game-over transitions and not at all in 200 s of undriven attract, which is what a sequence step that clears the screen looks like from outside",
  },
  0x01c2: {
    name: "blankNextLine",
    role: "blank one line of the character plane in both planes, step the wipe's cursor on to the next line, and count the lines still owed down by one; the zero test is left in the flags for the caller",
    cert: "seen",
    why: "the name claims a line at a time, not a screen and not a cell, and that is countable from outside: a read tap at this entry on the real ROM under MAME counted exactly 32 dispatches through the boot wipe, in two independent runs. A whole-screen wipe would have been one, a cell at a time 1024, and 32 is the tilemap's line count. Both callers then `ret nz` on the flag it leaves, which is what makes the wipe span frames rather than run to completion inside one call -- so a name saying merely 'blank' would drop the half the callers use",
  },
  0x026f: {
    name: "plotPenCell",
    role: "stamp the current pen glyph and pen colour into the one character cell a row cell and a column cell name, and hand back the video-plane address of that cell",
    cert: "seen",
    why: "the name predicts an exact address, so a MAME write tap recomputed 0xA400 + row*32 + column the way the ROM does -- eight-bit row multiply, and the column added to the low byte with the carry discarded -- and compared it against every write the routine made: 14200 writes, 14200 landing on that cell or its colour twin, zero misses, where an arithmetic reading that kept the carry would miss at every row wrap. drawInterpolatedPenRun fixes the returned address as a product rather than a leftover: it subtracts a target cell from it to decide whether to keep stepping",
  },
  0x0365: {
    name: "publishSpriteShadow",
    role: "gather the sprite shadow into the two hardware banks, three runs per bank in an order that is not their order in memory, transforming each byte by which half of its sprite it is and which way round the cabinet has the picture; then, inside one window of the sequence, ask for the eight scenery slots to be shown a second time half a screen away",
    cert: "seen",
    why: "which half is which coordinate was the open question, and the transform table answers it in a way that could have come out otherwise. The second byte of each bank-1 sprite is complemented past fourteen when the picture is upright and merely stepped on when it is turned round; 241-(b+1) is exactly 240-b, so that byte is the vertical coordinate under the board's own reading of the driver (sy = 241 - value), and on the same argument the first byte of a bank-0 sprite is the horizontal one, the second is the tile code, and the first byte of a bank-1 sprite is the attribute, since the turned-round arm toggles exactly its two flip bits. Grounded: under MAME both banks matched that reconstruction on all 48 bytes on every quiet frame of an upright run, and with the Cabinet dip at cocktail on player two's turn every bank-0 byte matched the TURNED-ROUND reconstruction instead -- an arm that took 1 dispatch upright and 3008 flipped, while this entry's own dispatch count stayed equal to the NMI count in every run, which is what a sole caller in the vblank service looks like from outside. The eight sprites it raises are the scenery band entire, split by its own reorder into the three it promotes to the front and the five it sends to the back, and what it adds is half a screen on both axes to the same slots multiplexSpriteSlots walks",
  },
  0x07d2: {
    name: "blankFourteenCharCells",
    role: "blank a fixed run of fourteen character cells, walking back one native row at a time from a fixed cell, and give every one of them the same colour",
    cert: "seen",
    why: "the extent of the run is the whole claim, so a MAME write tap gated to this routine's program counters listed the distinct video addresses it touched: exactly 0xA79F - 0x20k for k = 0..13, each 433 times, each the blanking glyph, and no other video address. The name deliberately declines to say where that is on the glass -- the run holds a native COLUMN and varies the native row, which under this board's ROT90 is a display ROW, and no pixels were captured",
  },
  0x0809: {
    name: "drawKillMeter",
    role: "repaint the meter that shows how many kills are still owed: a bar of era-selected glyphs one cell long per four kills, an end glyph carrying the remainder, and one blanking cell past it",
    cert: "seen",
    why: "the name says these cells ARE the bar the player sees, which a pixel A/B can refute. Three MAME runs identical in every input but the count forced into KILLS_REMAINING for the three frames before a snapshot: two runs forcing the same value produced byte-identical images, and two counts four apart differed in 33 pixels confined to one 8x8 character cell at the bottom of the glass. Reading the video-RAM strip back for seven forced counts also matched, at every one of the seven, the bar length and end glyph the era's own ROM row predicts",
  },
  0x17b9: {
    name: "guardBlockOrBlankDisplay",
    role: "fold a block of the program image and let the sequence step on only if it still adds up; otherwise switch the display off and copy one character cell into TAMPER_WITNESS",
    cert: "code",
    why: "two things outside the routine could have refuted it and did not. The block it folds is 51 bytes from 0x0B06, which is the entry of stampCopyrightStrip -- the guard covers a routine, not an arbitrary span -- and the fold over the real image comes to exactly the value compared, while shifting the seed by one takes the other arm. Its address also sits in the word table at 0x1659 that loc_1651 dispatches, at the eighth entry, so the sequence really is what it gates",
  },
  0x308a: {
    name: "placeDiagonallyAbuttingTile",
    role: "carry an object diagonally onto one more sprite entry, cornering off the one it already occupies: a pitch back along the high axis and a pitch on along the low one, in one 16-bit add so the low axis's wrap borrows",
    cert: "code",
    why: "placeAbuttingTile's registry entry already called this address the diagonal sibling before it was decompiled, and the write-set could have contradicted that: it does not -- the step is -16 on the entry's +49 byte and +16 on its +0 byte. driftNearestSceneryTriTile chains placeAbuttingTile then this one, which lays three tiles on three corners of a square -- the fourth corner is never written; driftThreeTileSceneryAtFiveQuarters chains two straight ones and lays a strip",
  },
  0x3dfb: {
    name: "retireSlotIntoSharedCooldown",
    role: "retire a slot the way retireSlot does and then arm its delay byte from one shared address instead of leaving it clear, so every slot retired here goes out holding the same value",
    cert: "code",
    why: "'cooldown' is retireSlotIntoCooldown's claim about the same record byte, and that entry's own why already names this routine as the sibling that re-arms the byte after calling retireSlot, citing the six sites outside it that form the loop. What this name adds is 'shared', and the source could have been an immediate: it is one address read by six sites, and MAME shows the value is not fixed -- 0x1E through the attract demo and 0x42, 0x48 then 0x4E across a driven game, restamped by the routine that loads a per-era table block. A cooldown length chosen elsewhere and travelling is not something an immediate can do",
  },
  0x3e05: {
    name: "flyAlongStoredVelocity",
    role: "fly one object a single step along the velocity held in its own record, and in the same add carry it with the world; each coordinate gains its stored word plus the shared per-frame scroll",
    cert: "code",
    why: "the four bytes it reads at +0x0A..+0x0D are written by other routines and never by this one: loc_3d25 and loc_3ed6 each call a doubled-velocity shim and store the returned pair straight into exactly those four. So 'stored velocity' names a value some other routine banked, which is a claim their write-sets could have refuted. Its sibling flyAlongHeading looks the velocity up from the heading instead, and both add the same world-scroll pair -- so nothing else may drift an object this moves",
  },
  0x3e7e: {
    name: "animateFixedShapeCycle",
    role: "give a sprite entry the next frame of an eight-frame cycle from a fixed shape base, and one fixed control byte beside it; nothing of the object is read, so two entries written in one tick get the same shape",
    cert: "seen",
    why: "the name claims a cycle that is fixed and not the object's, and its one caller reaches it as `call z` after comparing ERA_INDEX with 4. That gating is measurable and it was measured: read taps at this entry counted zero dispatches across two MAME runs that stayed in eras 0-3, and 7242 in a third that held the era at 4. A name tied to an object class would have to survive that the two entries written in one tick cannot be told apart, which they cannot",
  },
  0x50ee: {
    name: "loc_50ee",
    role: "★ destroy the player and one fixed two-slot target together when they touch, zero that target's hit counter so the contact kills it outright instead of costing it one hit, and tail-transfer to the chained hit score; this is the wider of two first-axis windows, and the arm its caller selects for two of the era values",
    cert: "seen",
  },
  0x5121: {
    name: "destroyTargetsReachedByFixedAttacker",
    role: "destroy every target of a caller's run that one fixed attacker -- the player's own ship -- has reached, marking both destroyed and posting the chained score for each; the attacker's state is tested once, so one pass can take several",
    cert: "seen",
    why: "the attacker is not a parameter, and which object it is decides whether this duplicates destroyTargetsHitByShots or is the other half of the collision system. A MAME write tap recording the program counter at every write of the attacker's state byte settled it: this routine is one of only three writers of the destroyed code, each such write is followed within a frame by a death-countdown reload and, at the end of the countdown, by the life-start routine writing the live code again. The entry it tests stayed at one pinned screen position through the whole run while the world scrolled, and showed no correlation with the fire button. LIVE-OUT is not only memory: both cursors are left where the sweep ended and the caller's tail target reads them",
  },
  0x526a: {
    name: "emptyBothDeferredCellLists",
    role: "put both deferred character-cell lists back to empty, parking each cursor four bytes past its own head",
    cert: "seen",
    why: "doing BOTH in one breath is what separates it from the publish step it is the empty branch of, and a MAME write tap by program counter measured exactly that: this routine wrote the two heads 7916 times each, equal counts, while drainBothDeferredCellLists's own reset wrote only the staging head, 9849 times. The values are the sentinels both drains test for -- one masking the low byte before subtracting four, the other subtracting four directly -- so 'empty' is fixed by two readers outside this routine. mechanisms.md USED to reach the pair as a double-buffered display list, one walker blanking last frame's cells and another writing this frame's; that reading is retracted there and refused at drainBothDeferredCellLists, because the copy runs one way on every pass and the two walkers are asymmetric",
  },
  0x52d2: {
    name: "paintDeferredCells",
    role: "paint the deferred cell list into the character plane and its colour plane: each four-byte entry gives a colour-plane address, the shape to put a plane above it and the colour to put at it, with one shared bias added to every colour. How many are pending comes off the low half of the list's own write cursor, so the whole list lives inside one page; an entry whose colour cell already has the high-priority bit set is passed over untouched, and a cursor that scales to a count of zero is not empty -- the loop runs 256 times",
    cert: "seen",
    why: "the name says these writes ARE the cells the queueing routine banked, and a write tap could have attributed them elsewhere. queueTileStampForObject's registry entry already describes this routine from the other side, before it was lifted -- it takes each stored address, sets bit 10 to reach the character plane and writes the glyph there, clears it again and writes the attribute -- and DEFERRED_WRITE_CURSOR's entry already records the four-byte entry shape and the empty test. Watched on the real ROM under MAME with a write tap over the whole character plane attributed by program counter, this routine's glyph store took 20853 writes in 120 s and every cell it wrote was blanked on the following pass by the routine that drains the second list, 3767 passes running with not one exception in either direction. The tap is not blind: twenty-six OTHER program counters wrote the same plane in the same run and were counted separately, the kill meter's two stores alone taking 25392. ★ The bias cell is deliberately left as a bare address here: it goes under several different local names across the layer and this pass measured only two values for it",
  },
  0x530e: {
    name: "blankCellsPaintedLastPass",
    role: "blank the character-plane cells the previous pass painted: walk the second deferred cell list, which the shared caller filled by copying the paint list wholesale after draining it, and write the blank shape a plane above each entry's address, leaving the colour byte exactly as it was. The pending count comes off the masked low half of that list's own cursor -- the mask drops the top bit the caller sets when it copies -- and an entry whose colour cell already has the high-priority bit set is passed over",
    cert: "seen",
    why: "'painted last pass' is the claim, it comes from the CALLER and not from this body, and one experiment could have killed it: the caller drains this list, then drains the paint list, then copies the paint list wholesale onto this one with 0x80 added to the cursor, then parks the paint cursor back on its own first entry. So this list at pass N should be the paint list of pass N-1, exactly. Watched on the real ROM under MAME with a write tap over the character plane attributed by program counter, and compared per pass keyed on the shared caller's own dispatch: over 3767 passes with a non-empty set on either side, the set of cells this routine blanked equalled the set the paint routine wrote on the previous pass, in BOTH directions, with zero exceptions. Twenty-six other program counters wrote the same plane in the same run and are excluded by attribution rather than by assumption. mechanisms.md once derived a double buffer from the code alone and called the pair a display list for the player's shots; the double-buffer half is retracted, but the pass-N-equals-pass-N-minus-1 relation measured here is what that reading got RIGHT, and it is watched rather than argued",
  },
  0x5337: {
    name: "queueTileStampForObject",
    role: "queue a two-by-two block of character cells for an object's position onto the deferred write list, one four-byte entry per cell, skipping a pair whose glyph is zero",
    cert: "code",
    why: "the noun 'tile' is the claim, and the routine alone cannot settle it -- it only builds an address from a base of 0xA000. The routine that drains the list does: it takes each stored address, sets bit 10 to reach 0xA4xx and writes the glyph there, clears it again and writes the attribute at 0xA0xx. Those are this board's video and colour RAM, so the entries are character cells in both planes and not sprite records",
  },
  0x59a0: {
    name: "doubledVelocityForHeading",
    role: "turn a heading handed straight in into the velocity pair the caller's table gives for it, doubled; the doubling wraps at sixteen bits and nothing is written",
    cert: "code",
    why: "'doubled' distinguishes this body from velocityForHeading, and its consumers show the doubling is the product rather than an artefact: the three shims that fix a table tail-jump here, and their callers bank the pair straight into an object record's +0x0A..+0x0D, which flyAlongStoredVelocity then integrates every frame. 'ForHeading' rather than 'ForObject' is the other half -- loc_599d enters this same body after reading the heading off an object, so taking it as a value is exactly what this entry contributes",
  },
  0x08ae: {
    name: "selectFoldBlock",
    role: "hand back where a fixed block of the program image starts and how many bytes of it to take; nothing is read and nothing is written",
    cert: "code",
    why: "the name says the pair it returns is a fold's source and count, and the caller could have refuted that: the only transfer into this address is a tail jump from 0x4bd9, whose single caller loads a seed byte and then immediately calls 0x291e -- which IS add a,(hl) / inc hl / djnz, over exactly the count returned here -- and banks the total in a cell a later sequence arm reads. A copy would have used ldir and a painter would have used the character cursor; neither appears anywhere on that path",
  },
  0x0b2b: {
    name: "hideCaptionSprites",
    role: "park the four sprites of the copyright caption above the first visible line by zeroing the vertical byte of each, leaving the rest of their slots standing",
    cert: "seen",
    why: "two things the name claims could have been refuted by watching one of those four bytes under MAME, and neither was. Attributed by program counter over 160 s of driven play the byte took 1255 writes from stampCopyrightStrip's own store and exactly two zeroes from this routine's, and the four bytes went from the stamped ladder to all-zero on the frame a driven start press raised PLAY_ACTIVE -- so it fires when a game begins, on the slots the stamper filled. That those slots are the copyright caption's is re-derivable: the shapes the stamper puts in them decode out of the sprite ROM as a copyright mark and then KO, NA, MI",
  },
  0x0d57: {
    name: "loc_0d57",
    role: "enter the shared packed-decimal digit routine at 0x0D73 with one fixed triple -- first cell 0xA781, the three-byte field whose high end is 0xAD35, and a fixed colour; choosing that triple is the whole entry and whatever the caller held is discarded",
    cert: "code",
  },
  0x0d61: {
    name: "loc_0d61",
    role: "enter the shared packed-decimal digit routine at 0x0D73 with a second fixed triple -- first cell 0xA501, the three-byte field whose high end is 0xAD38, and a fixed colour; choosing that triple is the whole entry and whatever the caller held is discarded",
    cert: "code",
  },
  0x0d6b: {
    name: "loc_0d6b",
    role: "enter the shared packed-decimal digit routine at 0x0D73 with a third fixed triple -- first cell 0xA641, the field whose high end is 0xA98D, and a fixed colour; the routine walks the field downward, so the high end is where it starts",
    cert: "code",
  },
  0x0daf: {
    name: "paintSuppressedDigit",
    role: "paint one four-bit digit into the cell the cursor names with the caller's colour a plane below, using the blank glyph instead when the digit is zero and no significant digit has been seen yet, and stepping the caller's flag on at the first that is",
    cert: "seen",
    why: "the suppression is the claim and it is refutable per dispatch: a PC-gated tap under MAME logged the digit, the caller's flag and the destination cell on every entry, and the SAME digit zero painted the blanking glyph while the flag was clear and the glyph '0' once it was set, with the flag turning over exactly at the first non-zero digit -- the six-cell field then read blank, 1, 0, 0, 0, 0 for a value of ten thousand. The glyph it picks for a suppressed zero is independently the game's blank: one caption handler writes that same code to erase a caption, and the pictogram strip pads with it",
  },
  0x0e70: {
    name: "paintQuadTile",
    role: "lay one four-tile block into the character plane from a base code the caller fixes, give all four the caller's colour a plane below, and leave the cursor clear of the block for the next one",
    cert: "code",
    why: "'quad' is the discriminating claim, and the caller could have contradicted it: the routine that decomposes a value into counts of thirty, ten, five and one calls a DIFFERENT painter per denomination and chains the cursor between them -- one tile for the units, two for the fives, and this one for both the tens and the thirties with only the base code and the colour differing. So what this entry contributes is the block SIZE and not a denomination, and the four codes are the caller's base plus 0..3 rather than anything a table selects. Not reached by either MAME sweep, which is a fact about the states those sweeps drove: TWO sites post its caller's ring command, and the second passes ROUND_NUMBER rather than a constant -- a cell stepped on the same path that steps ERA_INDEX, and tested against 6 and 11 elsewhere, so arguments of ten and more are anticipated and ten is the smallest that gives the tens a non-zero count",
  },
  0x323a: {
    name: "stepShapeAnimation",
    role: "count one record's step timer down and refresh that record's shape byte from the entry the NEW count selects, in the run its own selector byte points at; a timer already at zero is left alone",
    cert: "seen",
    why: "the sharp claim is that the count is also the INDEX rather than only a delay, and that is checkable from outside the routine. Watching one record's three fields under MAME produced six distinct (selector, count) pairs, and in every one the shape byte equalled the byte the ROM's own run-pointer table at 0x3438 puts at that count -- a plain delay would have left the shape unrelated to it. That table has eighteen usable entries and each run is 32 bytes, which is exactly the count the three sites that START an animation load into the step; and since the countdown ends at index 0, every run's FIRST byte is the shape a finished animation is left standing on -- the same shape loc_3855 writes, alongside a zeroed step, into its five records",
  },
  0x32eb: {
    name: "loc_32eb",
    role: "hold the machine still at power-on and then hand it over: count twelve passes down in a work-RAM cell, petting the watchdog 256 times inside each so the board is never reset while nothing happens, leave the cell and the two counting registers at zero and the pointer on the cell, tell the audio processor to go quiet, pick up the byte that decides the interrupt-enable bit, and fall into the routine that starts the machine",
    cert: "code",
  },
  0x33b8: {
    name: "headingToward",
    role: "return the heading from an object to a point as a byte of a 256-step circle: the signs and relative sizes of the two axis differences pick one of eight octants, and the shorter leg over the longer places the answer at one of thirty-two rungs inside it",
    cert: "code",
    why: "an index would not survive arithmetic only an angle admits, and three places do it. The octant table at ROM 0x3415 holds the eight multiples of 32, each exactly once, with bit 5 of each base doubling as a run-backwards flag -- under which the eight octants tile 0x00 to 0xFF with no overlap and no gap; the equal-legs table at ROM 0x341D holds exactly the four diagonals and is four bytes long, its fifth byte being an instruction. And loc_3ed6 subtracts the object's own heading cell from the returned value, biases by 0x10 and tests against 0x20, which is a wrapped alignment window, while reaimAndAnimateEnemyCraftOnPhaseTick adds half a turn before storing it into the cell steerTowardAimHeading turns toward. cert stays code because no capture can watch an angle",
  },
  0x3c0d: {
    name: "retireObjectAndHold",
    role: "take an object and the slot one stride on out of play -- both record heads, both coordinates of the caller's sprite entry and of one fixed entry -- then set a further byte of the caller's record to a non-zero constant instead of clearing it",
    cert: "seen",
    why: "'hold' says the byte left standing is a delay rather than a survivor of the wipe, and watching it could have refuted that: under MAME the record head went to zero and that byte jumped to 128 in the same frame, then counted down by one every OTHER frame, which is the cadence of the routine at 0x3c25 -- it gates the decrement on FRAME_TICK's low bit and branches only when the byte reaches zero. Its two siblings retireSlot and retireSlotAndSubPixel clear their record and stop; this one retires a second record and a fixed entry as well, and arms the delay",
  },
  0x4984: {
    name: "pulseSlot1CoinCounter",
    role: "drive coin slot 1's mechanical counter through one pulse for each coin the machine still owes it -- energise the line, release it at the half-way count, and take one off the debt as the pulse ends -- so a debt of two comes out as two separate pulses; with nothing owed it does nothing",
    cert: "seen",
    why: "the slot number is the load-bearing half, and the twin is what forces it: 0x49D6 is byte-identical for all thirty-six bytes but for three operands -- a different debt cell, a different timer, and a different LS259 line -- so an unqualified 'pulse the coin counter' would name two routines. Watched under MAME with a write tap, the twin was dispatched 17764 times on every tape and drove NOTHING, because no tape coined the second slot. The pulse itself is measured, against an undriven tape as the negative control: with no coin the line, the debt and the timer took no writes at all; with five coins the line took five writes of one and five of zero from two program counters both inside this routine, the timer took 240 decrements -- exactly 48 per pulse -- and the debt took five increments from the accept arm and five decrements from here. ★ A prediction that could have come out otherwise: this routine is entered three ways, one of them a fall-through from the credit path, so it must run TWICE on the frame a coin is banked -- its dispatch count came out at exactly the undriven count plus one per coin, on all three driven tapes",
  },
  0x49d6: {
    name: "loc_49d6",
    role: "drive one hardware output line as a train of square pulses, one pulse per unit of a pending count",
    cert: "seen",
  },
  0x4a9d: {
    name: "loc_4a9d",
    role: "step thirteen cells of the character plane on by one shape each, but only where a script says so, walking that script through one shared cursor cell that is left wherever the walk ended; two bits of one incoming byte set the directions independently -- the low bit reads the script backwards and steps the shape DOWN, the next bit takes the cells a row up instead of a row down",
    cert: "code",
  },
  0x4acc: {
    name: "unpackCoinage",
    role: "turn the two four-bit coinage settings into the byte each coin slot's accept arm works from, and raise the free-play flag when either of them reads free play",
    cert: "seen",
    why: "the subject matter is the whole of the name, and it is a MAME experiment that could have gone the other way. Forcing the DSW0 port to eight values and reading the destinations back, each carried exactly the coins-and-credits pair MAME's own label gives that nibble's setting, each destination followed its OWN nibble while the other moved independently, FREE_PLAY came up only for the settings labelled free play, and a control cell in the same block did not move. Which destination belongs to which slot is fixed outside this routine: the accept arm that debounces the coin-1 bit reads COIN_SLOT_1_RATIO and the one debouncing coin 2 reads COIN_SLOT_2_RATIO",
  },
  0x4b19: {
    name: "stepSequenceUnderChecksum",
    role: "step the sequence's inner sub-step on, folding a block of the program image on the way; a total that does not match advances the outer phase instead, which derails the sequence rather than halting it",
    cert: "code",
    why: "the name says the mismatch arm cannot run on a genuine image, and a measurement could have contradicted it: read taps under MAME counted zero dispatches at advanceSequencePhase's entry across both runs while this routine's own entry was reached in both, and the fold over the real image comes to exactly the byte it is compared with. This entry has no static call site anywhere in the image -- it is reached only as the eleventh entry of the word table at 0x1659 that loc_1651 dispatches -- so what it is FOR is fixed by that table and by nothing that could be mistaken for a caller",
  },
  0x51b3: {
    name: "markObjectsTouchingPlayer",
    role: "replace the state byte of every object in a caller's run that lies inside a wrapped box around the player's sprite entry, while the player is alive; the box is the caller's, the player's own state is untouched and nothing is scored",
    cert: "seen",
    why: "that the reference is the PLAYER is what the name adds over the mechanism, and it rests on evidence outside the routine: three sibling sweeps read the same guard cell and the same reference pair, and the write tap behind destroyTargetsReachedByFixedAttacker already attributed that pair to the ship held at one screen position through a driven game. What separates this entry is what it does NOT do -- the other three also write the destroyed code into the player's own state. Only two of those three go on to post a score: destroyPlayerAndObjectsTouchingIt does not. Under MAME it marked ten times in 300 s of attract, every mark on the same record, which is the single object every one of its four call sites leaves the cursor on",
  },
  0x5634: {
    name: "loc_5634",
    role: "queue seven sound codes back to back with no play test: six fetched one each from its own cell of the program image, so an edit to the image changes what is asked for, and a seventh formed by adding the era index to a fixed base",
    cert: "code",
  },
  0x5683: {
    name: "requestTwoSounds",
    role: "request two sounds in a row, each code fetched from its own byte of the program image, both admitted by the shared play-or-demo permission",
    cert: "code",
    why: "'sounds' is a claim about where the codes end up, and it is settled outside this routine by the rest of the path: the drain at 0x55d4 takes the queue's head, hands it to 0x55f8, which writes it to 0xC000 -- the sound-data latch in the driver's memory map -- and pulses the LS259 bit MAME wires to the second Z80's IRQ trigger. So the bytes reach another processor as commands rather than sitting in RAM. Neither code is baked in: each is read from a program byte, and the two bytes are far apart, so this is a chosen pair and not a run walked through",
  },
  0x5628: {
    name: "loc_5628",
    role: "queue a sound code with no permission test, so it is queued whether or not a game is being played",
    cert: "code",
  },
  0x5617: {
    name: "loc_5617",
    role: "queue a sound code when either the play flag or the cell at 0xA9C6 is set; only with both clear is the request dropped",
    cert: "code",
  },
  0x560c: {
    name: "loc_560c",
    role: "queue a sound code, but only while a game is being played; with the play flag clear the request is dropped and nothing is left behind for a later frame",
    cert: "code",
  },
  0x0b4c: {
    name: "loc_0b4c",
    role: "add a run of bytes together and answer whether the total is the byte the caller named; the length means a full 256 when it is zero, the total wraps at eight bits, nothing is written, and the answer is left for the caller rather than acted on here",
    cert: "code",
  },
  0x0bf2: {
    name: "drawTextRunByIndex",
    role: "paint the caption an index selects: the index picks a record from one word table, and the record supplies the destination cell, the colour and the glyph run that drawTextRun then paints",
    cert: "seen",
    why: "the name claims selection by index into a table of a definite size, and both halves are refutable from outside. A PC-gated read tap under MAME logged the accumulator on 1578 dispatches across 200 s of undriven attract and the largest index ever presented was 31 -- and the byte one past the table's 32nd entry is 0x0C90, which is the entry of the very routine that calls this one, so the table cannot be longer. Every one of those 32 records names a destination inside video RAM and ends its run on drawTextRun's terminator, while the two records past the end name 0x7E1C and 0x0D0D, neither of which is video RAM. It does NOT claim every record is text: drawTextRun's own entry records that two of them are a shaded banner strip instead",
  },
  0x20af: {
    name: "dressPlayerSpriteForHeading",
    role: "dress the player's own sprite entry to face the way the ship is heading: round the heading byte to the nearest of thirty-two equal sectors and write the shape and the byte beside it straight into the entry, from two parallel thirty-two-entry tables in the program image. The entry and both tables are fixed here, so nothing about which object this is comes from the caller",
    cert: "seen",
    why: "'the player's' is the claim, and the sprite entry is the thing that could have refuted it. The life-start routine seats this ship's record head alive, writes the heading cell this entry reads, pins the entry's two coordinate bytes at 0x84 and 0x78, and only then calls this -- and PLAYER_STATE's own entry, grounded by a write tap, records 0xA800 as the head of that record, of which the heading cell is the third byte. Watched under MAME through a credited game, sampled once a frame: with the state byte alive, the entry's shape byte equalled the ROM table's entry for the heading's sector and the byte beside it equalled the parallel table's, on 4419 samples out of 4419, while the two coordinate bytes never left 0x84 and 0x78. The 2937 samples taken while the state byte was NOT alive are excluded and counted rather than dropped -- the ship is mid-explosion there and the shape is not this routine's. A crossed table, a sixteen-sector rounding, or an entry belonging to some other object would each have produced mismatches and produced none",
  },
  0x2755: {
    name: "freeAllShotSlots",
    role: "free all six of the player's shot slots, zeroing each record's occupancy byte and its second-axis coordinate but not its first; the fill byte and the record stride are both fetched from program space rather than written as immediates",
    cert: "seen",
    why: "that the array is the player's shots is fixed outside this routine: fireAndSweepPlayerShots reads the panel through readPlayerControls, rotates the fire bit into carry, shifts it into a two-bit edge history and tests for exactly a rising edge before arming this same six-record table, and destroyTargetsHitByShots fixes its outer array here too. The name then predicts a cadence a tap could refute -- freeing the shots belongs to the start of a life, not to a frame or a round -- and under MAME its store fired 9 times on a tape whose life-start store wrote PLAYER_STATE alive exactly 9 times. Its only caller is that life-start routine. Patch-sensitive by construction: change either fetched byte and it clears a different array with a different stride",
  },
  0x2a97: {
    name: "dressSpriteForFineHeading",
    role: "dress one sprite entry to face the way its object is heading, resolving the heading to thirty-two sectors and writing the shape code and the attribute beside it directly into the entry, alternating between two shape banks as a frame counter's bit turns over",
    cert: "seen",
    why: "'Fine' is a rank against exactly one sibling and it has to be checkable: spriteForHeading rounds to sixteen sectors and RETURNS the pair, this rounds to thirty-two and STORES it -- the mask is 0x3F with a pre-add of half a sector, where sixteen sectors would need 0x1E. The sharper claim is that the second table byte is a flip attribute and not a per-sector palette, and one tap could have killed it: the sprite entry's attribute byte took 914 writes from this routine's store and the value histogram of those writes contains ONLY 0x5C and 0xDC, summing to exactly 914 -- two values differing in one bit across every dispatch, where a palette pick would have spread. Reachability was measured rather than assumed: 7126 dispatches on the one tape that reaches the third era and zero on three tapes that do not, which is its handler's seat in the era-keyed table. It does not say what the object is",
  },
  0x2afc: {
    name: "loc_2afc",
    role: "point an object's sprite the way it is heading, by rounding its heading byte to the nearest of sixteen sectors and taking a shape pair from two parallel tables",
    cert: "code",
  },
  0x2b38: {
    name: "animateSelectedShapeCycle",
    role: "give one sprite entry the current frame of a four-frame shape cycle, from the block a record byte selects, and one fixed attribute beside it",
    cert: "code",
    why: "'Selected' is the whole discriminator against animateFixedShapeCycle, and the two bodies settle it: that sibling's base is a literal while this one's is four times a record byte, and its cycle is eight frames from the counter's low bits where this one is four from bits 2-3. Reachability was measured rather than assumed -- read taps under MAME counted zero dispatches on two tapes that stayed in eras 0-1 and 48894 on a third that held the era at 4. It does not claim what the record byte IS; only that it selects",
  },
  0x2c31: {
    name: "loc_2c31",
    role: "drive one object's appearance from its own state byte, in three bands, on the path a slot takes once that byte is neither free, live nor held: at forty-two and above only the tint moves, cycling with the frame counter; from ten to forty-one a halved value picks a shape out of a fixed sixteen-entry table; and below ten the slot is retired outright unless a single shared request cell names it by the record number stamped at the record's sixteenth byte -- while named it holds one fixed shape and tint, advances the byte on seven frames in eight, and on the first value alone posts a command and clears the request",
    cert: "code",
  },
  0x2cbc: {
    name: "runSceneryForEra",
    role: "seat the record cursor and the sprite-entry cursor on the first scenery slot, then run one of three fixed lists of parallax wrappers, chosen by the era index",
    cert: "seen",
    why: "the arms test the era against 0 and then 4, so the name predicts the last era gets its own list while the middle eras share one -- which mechanisms.md derives independently as this dispatcher splitting the era {0}, {1,2,3}, {4}. A MAME run holding the era at 4, whose undriven stretch ran at era 1, measured both arms with one instrument and every wrapper's count is this routine's own dispatch count times its place in the arm's list, exactly: 963 dispatches at era 1 gave 963 / 1926 / 963 across that arm's three calls, 15817 at era 4 gave 31634 to each of its three doubled calls, and each arm's members sat at zero in the other's context",
  },
  0x2d15: {
    name: "driftThreeTileSceneryAtFiveQuarters",
    role: "drift one scenery object at five quarters of the frame's world scroll, lay two further tiles flush against it in a straight strip, and step both cursors past the object so the caller lands on the next slot",
    cert: "seen",
    why: "the fraction and the tile count are the whole claim, and the family could have contradicted either: its four siblings are the same calls with one term changed each, and driftTwoTileSceneryAtThreeQuarters' own entry already lists a 'five quarters with three' sibling from a separate derivation. A prediction that could have failed: the scenery band is eight slots wide, and each member consumes one slot per tile, so every arm of the era-keyed dispatcher must total exactly eight -- the era-0 arm comes to 3+2+2+1, the middle arm to 3+2+2+1 and the era-4 arm to 2+2+1+1+1+1, all landing on the band boundary. Under MAME it was dispatched 11999 times on a tape held in the first era and ZERO on the attract demo, which never runs that era in the round phase -- the {0} {1,2,3} {4} split ERA_INDEX's entry records independently. Its callee driftAtFiveQuartersWorldScroll is already grounded with every dispatch seated inside the scenery block. It does not say which object",
  },
  0x2d2d: {
    name: "stepTwoTileSceneryAtFiveQuarters",
    role: "advance one two-tile scenery object: drift it at five quarters of the world scroll, lay its second tile flush against the first, and step both cursors past the pair",
    cert: "seen",
    why: "the fraction and the tile count are both counts a run can refute. The fraction: its drift call is driftAtFiveQuartersWorldScroll and no other, and that helper's count in an era-4 MAME run equals this routine's exactly. The tile count: two slots go per dispatch, one inside placeAbuttingTile and one at the tail, so advanceToNextSlot must run eight times per dispatch of the last era's arm in the era-keyed scenery dispatcher at ROM 0x2CBC -- 126536 against that dispatcher's own 15817 dispatches, which is eight, and a tile count wrong by one breaks it. It is also the only member of its family absent from every other arm of that dispatcher, measured at zero across four runs that never reached era 4",
  },
  0x2d36: {
    name: "driftTwoTileSceneryAtThreeQuarters",
    role: "drift one scenery object at three quarters of the frame's world scroll, place a second tile flush against it, and step both cursors past the object so the caller lands on the next slot",
    cert: "code",
    why: "the fraction and the tile count are the claim, and the family could have contradicted either: its four siblings are the same three calls with one term changed each -- three quarters with one tile, five quarters with two, five quarters with three, a half with one -- and every one of them tails into advanceToNextSlot. Its callee driftAtThreeQuartersWorldScroll is already grounded with every dispatch seated inside the scenery block, and the era-keyed scenery dispatcher calls this entry twice in a row from two of its arms, which is the shape of two consecutive two-tile items in a parallax list. It does not say which object",
  },
  0x2db8: {
    name: "startNextRound",
    role: "start the next round: step the round number, roll the era on and wrap it after the fifth, set the round's difficulty byte from one of three sources by round bracket, refill the kill quota, and clear two flags while arming a third",
    cert: "code",
    why: "a routine that starts a round must re-arm the quota that ends one, and must advance the era on the schedule the era cell independently follows -- both are checkable against other code and both hold. It reloads KILLS_REMAINING from KILL_QUOTA, which is written once at boot with 56 and is not era-keyed; its era roll wraps at five, which is what ERA_INDEX's own entry records from a separate derivation; and its round brackets at 6 and 11 are the escalation mechanisms.md derives independently as banded by rounds completed rather than by era. Both callers gate it on a round being over. NOT REACHED by three MAME sweeps -- none completed a round -- and a write tap corroborates from the other side: across a run covering boot, attract, the demo and a driven game, not one of this routine's stores fired, every write to those cells coming from the per-player context copy instead",
  },
  0x3252: {
    name: "guardBlockOrDerailSequence",
    role: "fold a fixed span of the program image and let the sequence's inner step go on if it still adds up; a span that does not fold to the expected value throws the sequence a whole phase forward instead, which derails it rather than halting it",
    cert: "code",
    why: "named after guardBlockOrBlankDisplay, whose name states its failure arm, because the failure arm is what separates the four members of this family and this one's could have gone either way. Two of them jump at data or outside the image and simply kill the machine; stepSequenceUnderChecksum takes BOTH arms, advancing the phase and then always stepping the sub-step. This one is a tail jump to one or the other and never both. Its pass arm is advanceSequenceSubStep and its failure arm advanceSequencePhase, and read taps under MAME reached this entry on all three sweeps while advanceSequencePhase's own entry took zero dispatches on every one -- which is what an arm that cannot run on a genuine image looks like from outside",
  },
  0x3ce9: {
    name: "mirrorTwoTileObjectByHeading",
    role: "dress two adjacent sprite entries with a consecutive pair of shape codes from the block HITS_REMAINING selects, so the object wears its damage, and mirror the pair -- swapping which entry takes the lower code, and flipping both -- on whichever half of the heading circle it is in",
    cert: "seen",
    why: "if the two arms are a mirror rather than two different poses then the two attributes must be one colour differing in a flip bit, and the swap must fall at two antipodal headings. Both held: the attributes are 0x6D and 0xED, and the board decodes a sprite's second bank byte as six colour bits, an inverted flip-X and a flip-Y, so those two are the same colour differing only in flip-Y; and the boundary is the heading biased by a quarter turn against a half, which is exactly 0x40 and 0xC0. Watched under MAME the entry's code byte took 172 writes from each arm and its attribute byte 172 of each value, summing to the 344 dispatches a read tap counted on the same tape. It does not say what the object is, and unlike spriteForHeading it resolves the heading to one bit. The block selector is HITS_REMAINING, read as the most hits minus what is left -- so a fresh object and a damaged one are drawn from different blocks",
  },
  0x41f1: {
    name: "animateFixedShapeCycleAtHalfRate",
    role: "give one sprite entry the current frame of an eight-frame shape cycle from a fixed base, and one fixed byte beside it; the frame is picked from bits one to three of the free-running counter, so the cycle turns over once every sixteen counts. Nothing about the object is read, so two entries written in one tick get the same shape",
    cert: "code",
    why: "'AtHalfRate' is a rank against exactly one sibling and the two bodies settle it: animateFixedShapeCycle takes its frame from the counter's LOW three bits and this one from bits one to three, so this cycle advances on every second count and its sibling's on every count -- same eight frames, half the speed. 'Fixed' is the other half and it is refutable: neither body reads anything of the object, which is why two entries dressed in one tick cannot be told apart. Reachability was measured rather than assumed: read taps on the real ROM under MAME counted ZERO dispatches across an undriven attract run reaching eras 0-3, a driven run in era 0 and a driven run with the kill quota forced empty, and 2618 in a run holding ERA_INDEX at 4 -- which is the gate its two callers sit behind. cert stays code because the rate is read off the two bodies; no capture watched the shapes on the glass",
  },
  0x4201: {
    name: "steerTowardAimOneUnitAFrame",
    role: "turn an object's heading one unit toward the heading it aims at, on every dispatch, standing still once the heading sits on the aim or one unit past it; the direction test is taken on the gap PLUS ONE, so a gap of exactly 127 turns the LONG way round and the standing band is off centre",
    cert: "code",
    why: "the two halves of the name are what separate this from its sibling steerTowardAimAtFixedRate, whose registry entry already describes this address from the other side as 'the same biased tests with a step of one'. The step is one where the sibling's is two, and this body reads no counter where the sibling gates on the frame counter's low two bits -- so this turns on every dispatch at one unit and the sibling on three frames in four at two units, which is the slower of the two on average. That the two are different mechanisms rather than two versions of one is measured, not argued: read taps under MAME counted 4939 dispatches here across eras 2 and 3 and ZERO in era 0 and ZERO in a run holding the era at 4, while the sibling's own entry records zero in eras 0-1 and 8225 at era 4. Their callers agree -- 0x4117 calls this one and then a flier and a dresser, 0x41B8 calls the sibling in the same slot of the same shape. ★ The name does NOT say 'the short way round': the +1 bias makes a gap of 127 turn long, and because the step is ONE the resting point is decided by the side it approached from",
  },
  0x421f: {
    name: "steerTowardAimAtFixedRate",
    role: "turn an object's heading two units toward the heading it aims at, on the three frames in four when the frame counter's low two bits are not both clear; a fixed step, where its sibling steerTowardAimHeading takes its rate from a table",
    cert: "code",
    why: "the name says the byte it writes is the heading MOTION follows, and its caller could have refuted that: flyTowardShipStandoffThenEndApproach re-aims by writing the aim byte every sixteenth frame, calls this routine, and then calls the flier whose first instruction reads the very byte this one wrote. A caller that used the result as a table index, or a flier that read the aim instead, would have killed the name. Read taps under MAME counted zero dispatches on two tapes in eras 0-1 and 8225 on one holding the era at 4. ★ The name deliberately does NOT say 'the short way round': the direction test is taken on the gap PLUS ONE, so a gap of exactly 127 turns long; the standing band is two wide and off centre, at gaps of 0 and 255; and because the step is TWO the gap's parity is invariant, so which of those two it comes to rest on follows that parity and not the side it approached from. Sibling 0x4201 has the same biased tests with a step of one, which makes it side-determined instead -- same shape, different mechanism",
  },
  0x44dc: {
    name: "loc_44dc",
    role: "give an object the two shapes of a two-frame flutter, the pair picked by one bit of a counter cell and nothing the object holds",
    cert: "code",
  },
  0x46ce: {
    name: "loc_46ce",
    role: "file two register pairs into an object's record as four bytes, each pair high byte first and so stored the opposite way round from a word",
    cert: "code",
  },
  0x46db: {
    name: "retireEntryPairIntoCooldown",
    role: "clear a record's occupancy byte and both coordinates of TWO neighbouring sprite entries, then arm the record's delay byte with a fixed value rather than leaving it clear",
    cert: "code",
    why: "'pair' is the whole of the claim and the caller settles it from outside: armMotherShipOrStep refuses to spawn unless the occupancy bytes of BOTH the record at 0xA8A0 and the record one stride on are clear, and then hands this routine that record with the matching entry base 0xAA24 -- so the thing retired occupies two entries by the caller's own test, not by this routine's shape. Its second caller reaches it conditionally from a different file, so the shape is not one caller's habit. The byte it arms is the offset retireSlotIntoCooldown and retireObjectAndHold arm with 0xF0 and 0x80; this site's value is 95, and nothing here fixes the tick rate",
  },
  0x4831: {
    name: "postNextParachutistBonus",
    role: "post the next rung of the rescue award to the command ring and step the per-life rung count on; the first four rungs each take their own value from a four-entry table and every rung after them takes the same top value, so the ladder rises and then caps",
    cert: "seen",
    why: "the ladder is the claim and it is decodable outside this routine, through a table this routine never touches: the four bytes it posts are arguments to ring command 4, whose handler indexes a packed-decimal table and adds the result to the player's score, and decoding all five gives 1,000 / 2,000 / 3,000 / 4,000 then 5,000 for ever -- monotone, round, and capping, where any non-monotone or non-round decode would have killed the name. mechanisms.md derives the same ladder and the same cap independently. ★ 'per-life' was measured rather than assumed: under MAME the rung cell took writes from this routine's increment with the values 1, 2, 3 and from the life-start routine resetting it, five times on one tape and ten on another. The observed rungs are the first four only -- the capped arm was never taken on any tape, so the top value stays code-derived. Its caller returns early in the final era, which is the one era mechanisms.md records as having no parachutists",
  },
  0x4853: {
    name: "spawnAtEdgeAhead",
    role: "on a cooldown, and only on alternate frames, place a free slot at the field-edge position the player's current heading selects, clear its sub-pixel remainders and mark it live",
    cert: "seen",
    why: "a heading-indexed table gives one answer per dispatch, so a MAME write tap on the slot's two coordinate bytes recomputed the index the ROM's way and compared: 19 placements, 19 matches on both bytes, over eight heading sectors. Both halves of the name are properties of that table and both hold -- all sixteen pairs lie within sixteen of a field border, and against the player position the same run measured, each pair lies within 41 degrees of the heading that selects it. That second check is the one that could have failed, and on a first derivation with the player's two axis bytes crossed it did; the measurement corrected the axes. What it places is fixed from outside: its caller seats one dedicated record and sprite entry and opens by reading the era index, comparing and returning, which is the singleton manager mechanisms.md derives independently for the parachutist and the reason there are none in the final era",
  },
  0x48ad: {
    name: "retireSlotIntoCooldown",
    role: "take an object out of play -- occupancy byte and both of its sprite entry's coordinates -- and then arm the record's delay byte instead of leaving it clear, so the slot is held rather than freed",
    cert: "code",
    why: "'cooldown' is the claim and it is refutable: if that byte were scratch nothing would read it. Six sites outside this routine form the loop instead -- the per-slot handler tests it and, when it is non-zero, diverts the whole slot to the routine that counts it down; two routines decrement it; and the sibling that calls retireSlot re-arms this same byte immediately afterwards, which retireSlot's own entry already records. Its first three stores are retireSlot byte for byte, so the arming is the entire difference. It does not claim how long the delay is: this entry writes 0xF0 where retireObjectAndHold writes 0x80, and nothing here fixes the tick rate",
  },
  0x4b30: {
    name: "loc_4b30",
    role: "copy three tilemap cells into three two-byte keeps, reading each cell twice because its two planes sit a fixed distance apart",
    cert: "code",
  },
  0x4b4b: {
    name: "drawRandomByte",
    role: "draw the next pseudo-random byte: advance the seventeen-byte shift register one place, fill the vacated head with the exclusive-or of two taps, and hand back that feedback plus the frame counter, so two draws at different moments differ even where the register has not moved",
    cert: "seen",
    why: "if this is the game's generator the register must be seeded from somewhere and must have no other writer, and a write tap could have found a dozen. It found two program counters: this routine's feedback store, and the block copy that seeds seventeen bytes from the program image. Its four callers each consume the accumulator immediately as a draw and each shapes it differently: a bit, a signed jitter around a heading, a compare against a threshold cell, and a masked table index. ★ Anything that pins this game's entropy pins THIS",
  },
  0x4ba5: {
    name: "loadDefaultHighScores",
    role: "copy forty bytes of program space into the five-entry high-score table, which is the only way that table is ever initialised",
    cert: "code",
    why: "the block's first column runs 0,1,2,3,4, which fits five eras and five ranks equally, so the column cannot settle the noun and other code has to. It does: one routine compares each record's score field against the CURRENT PLAYER'S score cell, slides the tail down by exactly one eight-byte record when it is beaten, and then renumbers that first column 0,1,2,3,4 -- an insertion sort with a rank key, which an era table would never receive. Another draws all five records into video RAM. The ROM defaults are monotone decreasing in the compared field. Watched under MAME the destination took exactly one write, at boot, and none through a full driven game, which is what a table of DEFAULTS looks like. It does not claim what the four bytes past each score are",
  },
  0x4d2b: {
    name: "isScoreBelow",
    role: "answer whether one three-byte score is below another, both read most significant byte first from the two addresses given and DOWNWARD, all three equal counting as not below; nothing is written -- the answer, mirrored into carry for the caller to branch on, is the whole product",
    cert: "seen",
    why: "'score' is the claim and the routine's own body cannot support it -- it is a three-byte compare and nothing more -- so it rests on the operands, which are chosen entirely outside. Its only caller walks five eight-byte records, calls this against each, takes the first for which the answer is 'not below', slides the tail down by exactly one record with lddr, copies three bytes in and then renumbers the records' first column 0,1,2,3,4: an insertion sort with a rank key. loadDefaultHighScores' registry entry derives the same table independently and from the other end. Watched under MAME through a credited game to game over, it was dispatched five times, all in ONE frame, with the candidate pointer at the active player's score triple -- selected on ACTIVE_PLAYER, which read 0 -- and the standing pointer walking 0xAB0B at a stride of eight. The five standing values decoded most-significant-byte-first as 10000, 8800, 8460, 6520 and 4300, monotone decreasing and byte-identical to the ROM defaults; the candidate was 5700 and the sweep inserted at the last record. Had the caller used the answer as a table index, or had the five values decoded as anything but a descending list, the name would be dead",
  },
  0x4d67: {
    name: "advanceSexagesimalDigit",
    role: "advance one two-digit packed-decimal place of a base-sixty counter, storing the stepped value before testing it and replacing it with zero once it reaches sixty; the answer comes back in the carry, inverted, so a set carry means it did NOT wrap",
    cert: "seen",
    why: "base sixty rather than base a hundred is the claim, and the value histogram of a MAME write tap could have refuted it: the cell it steps took writes at 00-09, 10-19, 20-29, 30-39, 40-49, 50-59 and 60 and at no other value -- no invalid packed-decimal nibble ever appeared -- and the wrap store fired exactly as often as the value 60 was written. The inverted carry is what its caller consumes: the caller chains it over three neighbouring cells and stops at the first that does not wrap, so the flag and not the byte is the product, and the carry into the second place was one-to-one with the first place's wrap in every run. ★ The counter it serves is NOT a clock, and the name says 'sexagesimal' rather than 'seconds' because of it: one wrap took 84, 95, 120 and 140 frames on four different tapes, because the caller runs once per dispatch of the round engine's service block and that block does not run every frame",
  },
  0x4daf: {
    name: "loc_4daf",
    role: "stamp one two-cell-square emblem at the cursor, colour all four cells walking back across the square, and leave the cursor past it",
    cert: "code",
  },
  0x4f5d: {
    name: "loc_4f5d",
    role: "stage the two cursor cells and the eight fixed arguments -- the six-slot player shot run, a three-slot target run at a sixteen-byte stride, and a box seven by fifteen -- then tail-jump into destroyTargetsHitByShots, which does the destroying; choosing the runs is the whole of what this entry contributes",
    cert: "code",
  },
  0x4f7e: {
    name: "destroyFixedTargetHitByShots",
    role: "destroy the one fixed target the player's shots have reached, spending each shot that reached it and posting the score for each; the target's liveness is tested ONCE, ahead of the sweep, so several shots can be spent on it in a single pass",
    cert: "seen",
    why: "the swept array is the claim, and its record layout could have contradicted it: this routine reads each record's coordinates at the same two offsets destroyTargetsHitByShots uses on its own outer array, which is this same six-record table, which fireAndSweepPlayerShots arms only on a fire-button rising edge. Watched under MAME both of its stores fired -- the target's state byte nine times and a shot's occupancy byte once -- so the hit path is observed and not inferred. ★ The guard sits BEFORE the loop and is never re-tested, which is why the role says so: a reader who assumes it re-arms will predict one hit per call and be wrong",
  },
  0x4fbf: {
    name: "destroyCraftAndMotherShipHitByShots",
    role: "run the shot sweeps for the stretch of a round in which the Mother-Ship is on the field: stage the two cursor cells, sweep the six player shots against FIVE ordinary craft rather than the usual seven, then fall through into the sweep that runs the same six shots against the Mother-Ship's own state byte and screen position. Choosing the shorter craft run is the whole of what this entry adds",
    cert: "seen",
    why: "the claim is that this is the arm taken while the two-slot object is out, and that FIVE is five because that object holds the last two of the seven ordinary craft slots -- both refutable, and several independent sites in the ROM agree. Its caller reads one flag and sends the sweep here when it is set and to a SEVEN-craft sweep of the same run when it is clear; the spawner raises that flag only when the kill quota has reached zero and both the record at 0xA850+5 strides and the record one further on are free, and arms the second of those with seven; the two ordinary per-slot handlers for exactly those two records return early while the flag is set; and a further site shortens its own walk of the same run to five under the same test. The arithmetic closes: 0xA850 plus five strides IS that object's record. Measured on the real ROM under MAME, two runs differing in one line of the driver -- whether KILLS_REMAINING is forced to zero: ZERO dispatches here across the control, whose caller was dispatched 2090 times in the same run, against 1361 in the poked run, every one of them attributed to the flag-set state and none to the flag-clear state that the same run entered nine times. The arming was watched four times and wrote seven into the counter each time, which is the manual's seven hits on an object the manual says appears after the quota's 56. ★ It does not CALL the second sweep, it falls into it: this entry and 0x4FE0 have equal dispatch counts in both runs",
  },
  0x4fe0: {
    name: "loc_4fe0",
    role: "sweep the six player-shot slots for one that has reached the single fixed two-slot target, mark both destroyed and post the score for each; the first-axis window is widened for two of the era values, by a data swap rather than a second body",
    cert: "seen",
  },
  0x507e: {
    name: "destroyFixedTargetReachedByPlayer",
    role: "destroy one fixed target and the player with it when the two touch, zero the target's HITS_REMAINING so the contact kills it outright rather than costing it a hit, and tail-transfer to the scoring routine; four tests must all pass, so nothing at all is written unless every one of them does",
    cert: "code",
    why: "the reference it measures the target against is what the name adds, and it is fixed outside this routine: it reads the same sprite-entry pair three sibling sweeps use, and the write tap behind destroyTargetsReachedByFixedAttacker already attributed that pair to the ship that held one screen position while the world scrolled past. NOT GROUNDED, and the reason is specific: across two MAME write-tap runs none of its three stores ever fired, so the four-test conjunction was never satisfied on any tape we have driven",
  },
  0x5152: {
    name: "destroySlotsAndPlayerOnContact",
    role: "sweep a run of slots against the player's own sprite entry and, for every overlap, write the destroyed marker into both the slot and the player and post the score; the sweep does not stop at the first",
    cert: "seen",
    why: "were this the shots-against-targets sweep it would neither refuse to run on the player's state byte nor write it, and it does both: a MAME write tap attributing every write of PLAYER_STATE by program counter through a driven game caught this routine's own store six times, each the destroyed marker. mechanisms.md derives independently that the collision chain's members differ in what else they write, and that two of them write the player and post a score; this is one of those two",
  },
  0x5185: {
    name: "destroyPlayerAndObjectsTouchingIt",
    role: "destroy the player and every object of a caller's run that lies inside a wrapped box around the player's sprite entry, while the player is alive; one window width serves both axes, nothing is scored, and the sweep runs on past the first",
    cert: "seen",
    why: "the name makes two claims the family splits on -- that the player's OWN state takes the destroyed code, and that nothing is scored -- and a write tap settled the first: across a driven run the destroyed code reached PLAYER_STATE from exactly three program counters, one of them this routine's store, which fired together with its target store in a single event; markObjectsTouchingPlayer's store never appears, as that entry claims. The second is structural: its two nearer siblings both call the scoring routine and this one has no path to it. ★ LIVE-OUT IS NOT MEMORY, and a memory-equivalence gate is structurally blind to the rest: it hands back the occupancy cursor in E -- stepped by 0x10 with no carry into D, so it wraps inside its own page -- and the sprite-entry cursor in IY, stepped by two. Its callers at 0x4EF9 and 0x4F21 reload only B, L and H before tail-jumping into markObjectsTouchingPlayer, so DE and IY carry straight over; that is how the module's first version was wrong while passing every twin",
  },
  0x55f8: {
    name: "sendSoundCommand",
    role: "hand one byte to the audio processor: write it into the one-byte latch that processor reads, then drive its attention line high and back low, the edge that makes it look",
    cert: "seen",
    why: "'the' latch is a uniqueness claim and one tap could have killed it. A write tap on the real ROM under MAME recorded 1686 writes to the sound-data latch across boot, attract, the demo and driven play, and every single one came from this routine's store -- no second program counter. The attention line took exactly twice that, 1686 highs from one instruction paired with 1686 lows from the other, and a read tap at this entry counted the same 1686 dispatches. The board layer, read against the driver, has that address as sound data to the second Z80 on WRITE and the LS259 bit MAME wires to that processor's interrupt at the other. ★ The latch address is split BY DIRECTION -- read, it is the scanline counter -- so the sites elsewhere that load from it are not reading what this routine wrote. It does not claim what any particular byte MEANS; there is no audio oracle here",
  },
  0x58fe: {
    name: "flyAlongHeadingAtDoubleVelocity",
    role: "fly one object a single step along the heading it holds, with TWICE its own velocity component and the shared world scroll added once, so nothing else may drift this object",
    cert: "code",
    why: "if only the velocity term doubles then the difference from flyAlongHeading must be exactly two instructions, each sitting immediately after a velocity load and neither after a scroll load -- and the two bodies are byte-identical but for two inserted adds, in exactly those places. Both entries are reached only through two-instruction table-fixing shims. Read taps counted zero dispatches on two tapes in eras 0-1 and 38749 on one holding the era at 4. ★ It says 'Velocity' and not 'Step' on purpose: flyAlongHeading's entry already warns that a reader who takes it for velocity alone will apply the camera twice, and a name saying the whole step doubles would make that same error in the other direction",
  },
  0x10f8: {
    name: "loc_10f8",
    role: "give five display-list slots a second appearance half a screen away: a slot is a byte pair whose first byte carries a request in its top bit, and where that bit is set the pair trades half a byte range -- the requester gives that half up and the partner takes it on, which is what carries the slot into the far half of the display. A slot with no request is stepped over rather than stopped at, so a gap in the middle costs the slots after it nothing",
    cert: "code",
    why: "kept hex because the IMAGE has no entry point here for an English name to be about. A scan of the whole 24 KB for the little-endian word 0x10F8, at every alignment, finds two occurrences and neither is behind a call or a jump opcode; the only transfers that land on this address are relative branches at 0x10DD and 0x1104, both interior to 0x1098-0x1198, which is the range the frozen transcription gives loc_1098 and is this address's own range with a head in front of it. The same scan is shown able to find an entry point in the same breath -- it finds 0x1098's word three times behind a `cd` and 0x10FD's once behind a `c4`, the CALL and CALL NZ those two are reached by. The entry is still needed, because the frozen layer DOES dispatch this address: spinRemainingSpriteMultiplexSlots's tail is a transfer to 0x10F8, so with no name here that tail runs the oracle. What the body does is a stretch of loc_1098's job rather than a job of its own, which is the trap routine-is-a-range-not-a-filename names",
  },
  0x12e2: {
    name: "loc_12e2",
    role: "run the sequence delay down by one and, on the frame it reaches zero and only then, let the sequence take its next decision; the countdown wraps rather than sticking, so a delay that starts at zero buys a full 256 frames before that decision comes round again, and on every other frame the one decremented cell is the whole effect",
    cert: "code",
    why: "an English name was proposed and REFUSED; the refusal is recorded so it is not proposed again. It described the SHARED PROLOGUE and not this routine: a byte-pattern scan of the image finds `ld hl,0xA9EB / dec (hl)` at seven sites -- 0x12E2, 0x16D6, 0x174E, 0x1792, 0x196A, 0x330B and 0x56B8 -- so the countdown is an idiom the image reuses and any name built out of it names all seven. Two of the seven are arms of the SAME inline jump table at 0x0F29, 0x330B at arm 8 and this address at arm 11, so the table alone holds two routines a delay name could not tell apart. What is left once the prologue is subtracted is the single tail this entry chooses, loc_12e7, and loc_12e7's own entry already carries that decision",
  },
  0x1748: {
    name: "holdCopyrightThenEraseTheCoinInvitation",
    role: "hold one sequence step for as long as its delay cell counts, restamping the copyright strip and flashing its line on every frame of the wait, and on the frame the delay expires queue two erase requests -- caption records 3 and 4, whose glyph runs read PLEASE DEPOSIT COIN and AND TRY THIS GAME -- then step the sequence on. A cell holding zero on arrival wraps to 255 and waits the long way round rather than leaving at once. ★ The expiry frame also does the load-bearing thing the name drops: it copies the glyph showing at 0xA63C and the colour of the same cell into the pair at 0xACC7, and that pair is a COPYRIGHT TAMPER WITNESS rather than a screen save. 0xA63C is the fifth cell of the `(c) KONAMI 1982` caption -- the N, glyph 0x3B -- and the arm at 0x30E3 reads the pair back, tests the glyph against 0x3B and the colour against 0x05 or 0x10, and derails to 0x315B on anything else",
    cert: "code",
    why: "both halves of the name are refutable off the image and both hold. The erase half: the two requests carry command 3, which the ring's sixteen-way handler table at 0x0BBC seats at eraseTextRunByIndex, with arguments 3 and 4, and records 3 and 4 of the caption table at 0x0C50 hold the glyph runs the tile ROM draws as PLEASE DEPOSIT COIN and AND TRY THIS GAME -- so what is erased is the invitation, not the copyright this same routine has spent the wait restamping. The witness half: the caption record at 0x086B puts the copyright line's first cell at 0xA6BC and the cursor rst steps 0x20 BACK per cell, so the record's fifth glyph lands at 0xA63C, and that glyph is 0x3B, which the tile ROM draws as an N. The same arithmetic puts the A at 0xA61C, the cell sampleCellGlyphAndColour's entry already records as sampled every frame with a colour alternating 0x05 and 0x10 -- which are exactly the two values 0x30E3's arm accepts. So a tampered credit moves the glyph, the witness carries the move, and the check derails the sequence instead of failing cleanly, which is this ROM's standing idiom",
  },
  0x1f42: {
    name: "scrollWorldAtTheEraPace",
    role: "move the world past the ship at the pace the era sets, READING the heading rather than deciding it -- some paths in write it first, others arrive with whatever is already there: one of three fixed sample tables is picked from ERA_INDEX alone -- the opening era its own, the next two sharing a second, everything from the third era up sharing a third -- and the pair that table gives for the ship's heading is handed on to be negated into the world scroll cells. Choosing the table is the whole of what this entry decides",
    cert: "code",
    why: "'pace' is the claim, and the three tables could have differed in shape rather than size and killed it. Read out of the image they are the same 256-sample turn at three amplitudes -- 256, 306 and 331 -- so the era buys speed and nothing else; a table that turned at a different rate, or a fourth read, would have shown here. That the pair becomes the WORLD's motion and not the ship's is fixed by the continuation rather than by this body: loc_1f55 negates both components into the scroll cells before dressing the ship, which is what makes 'scrollWorld' true and 'flyShip' false. ERA_INDEX is the only cell this entry reads",
  },
  0x28a1: {
    name: "stepSevenCraftSlots",
    role: "work seven fixed object slots in one fixed order, each through the entry that seats its own pair of cursors; the order is the whole of what this entry decides, and nothing here reads or writes a slot itself. ★ Seven is the SET's size and not the per-frame count: the last two slots stand down while MOTHER_SHIP_ARMED is set, so on that arm only FIVE slots step. A resume value is laid down for each slot that will reach an arm, and not for the two that stand down, which reach none",
    cert: "code",
    why: "the five-slot arm is the half of the name that has to be qualified rather than observed, because nothing we drive reaches it: across the two sessions the gates use -- coin-then-start, and the undriven demo, 2500 frames each through our own harness -- this entry ran 863 and 1379 times and MOTHER_SHIP_ARMED read zero at every one, so the taped evidence covers the seven-slot arm only. Which two stand down is checkable from the far side: loc_28ee and loc_28fe are the two gated entries and their own registry entries record that a set cell returns at once and leaves the slot unserviced, while destroyCraftAndMotherShipHitByShots's entry derives independently that the Mother-Ship holds the last two of the seven ordinary craft slots. A name saying 'step five' would be false on every frame the tapes actually run",
  },
  0x2cdb: {
    name: "blankOneLineThenGuardBlockOrDerailSequence",
    role: "one turn of the line wipe, and on the turn that finishes it, one tamper test: a single line is blanked per turn and the turn ends there while lines are still owed; the turn that clears the last one folds a fixed 1024-byte span of the program image together with exclusive-or into an eight-bit total and compares it against the total an untampered image gives. Matching steps the sequence's INNER index, so the sequence carries on; not matching steps the OUTER phase instead, restarting the inner index somewhere else entirely -- derailing the sequence rather than halting it",
    cert: "code",
    why: "the compound name is the finding. The second half is the family guardBlockOrDerailSequence at 0x3252 belongs to, and the two bodies are the same test: an exclusive-or fold of a fixed span against a baked-in constant, advanceSequenceSubStep on a match and advanceSequencePhase on a mismatch, each reached as a tail and never both. Only the span differs -- 768 bytes from 0x0008 there against 1024 bytes from 0x4980 here -- so a name for this one that did not carry the family's would leave two identical mechanisms with unrelated names. The first half is what the family name would drop: the wipe gate sits in FRONT and the test runs on one turn in many, so a reader taking this for a plain guard will expect it every dispatch",
  },
  0x2d3f: {
    name: "showCreditLine",
    role: "one sequence step that puts the credit line up: while FREE_PLAY is set it does nothing but move the sequence's inner index on; otherwise it repaints the panel field from the packed-decimal credit count at 0xA986, queues caption record 8 -- whose glyph run reads CREDIT -- and then reads a guard byte that decides everything after. Anything but zero transfers to 0x2E3E, which carries no routine, so that transfer RAISES rather than running; zero stamps the copyright strip into the display list, asks for its line in this frame's colour, and folds the twenty-byte run at 0x086B into a total for the chain that judges it. What writes the guard byte is not established here",
    cert: "code",
    why: "'credit' is fixed twice over from outside this body. The caption: record 8 of the table at 0x0C50 holds the glyph run 0x77 0xD7 0x34 0x87 0xFD 0xDC, which the tile ROM draws as C R E D I T. The count: the cell it repaints through loc_4afb is 0xA986, the same packed-decimal byte startOnePlayerGame takes one off at the one-player start and startTwoPlayerGame takes two off at the two-player one -- and startGameOnFreePlay's entry already records that free play charges nothing, which is exactly the arm this entry paints nothing on. The derail target is checkable rather than merely absent: 0x2E3E is the amplitude-306 sample table scrollWorldAtTheEraPace hands to velocityForHeading for the middle eras, so the tamper arm enters a sine table as code",
  },
  0x3215: {
    name: "startOnePlayerGame",
    role: "stock the machine for a game with only the FIRST player's context filled in: park the caption sprites, raise PLAY_ACTIVE, clear PLAYER_TWO_LIVES and the flag beside PLAY_ACTIVE, load PLAYER_ONE_LIVES from the settings cell carrying the starting count, TAKE ONE CREDIT off the packed-decimal count at 0xA986 and repaint the panel field from it, copy a fixed set of tilemap cells into their keeps, and send the sequence machine to its last phase. The subtract is decimal-corrected the way the hardware does it, so a byte that was never valid packed decimal still lands where the hardware would put it",
    cert: "code",
    why: "the CHARGE is the only axis separating this from startGameOnFreePlay's one-player arm at 0x1719, so a name saying merely 'start a one-player game' would name both. The two are the same seven stores in the same order -- xor a, ld (0xAD31),a, ld (0xAD20),a, dec a, ld (0xAD30),a, ld a,(0xA9C1), ld (0xAD10),a -- at 0x3219 and at 0x1719, and both then transfer to 0x172A; this entry alone puts `ld hl,0xA986 / ld a,(hl) / sub 1 / daa / ld (hl),a` and a repaint between them. startTwoPlayerGame is that same insert with 2 for the two-player start, and startGameOnFreePlay's entry records that all three of its callers test the free-play cell before reaching it -- which is why the free arm has no debit to be told apart by",
  },
  0x382d: {
    name: "pickScriptAtRandomOrInTurn",
    role: "draw a byte and let one comparison against a threshold cell decide which of two entirely different answers the caller gets: a draw at or above the threshold is folded down to one of four values and handed straight back, writing nothing; a draw below it ignores the drawn byte completely and instead steps a five-long cycle counter on, wrapping it to zero once it would leave the cycle, stores it and hands THAT back. ★ The two arms draw from DISJOINT halves rather than sampling one pool two ways: the random arm can only answer 5 through 8, the rotation only 0 through 4, so which arm ran is recoverable from the answer alone",
    cert: "code",
    why: "the disjointness is structural, not incidental, and it is what the name would otherwise hide: the random arm returns the drawn byte modulo four plus five and the rotation arm returns a counter reset the moment it would reach five, so the two ranges cannot meet whatever the threshold cell holds. 'Script' is the callers' word and it is checkable at one remove: both of them store the answer at a freshly-seated object's +0x0A, and loc_323a reads that byte as an index into the word table at 0x3438, fetches the run it points at and takes that run's C'th byte -- C being a counter it steps down each pass -- into the object's +0x08. So the answer selects a sequence that is then walked, which is what makes it a script rather than a speed or a coordinate; one of the two callers biases it by nine first, so the two spawn sites draw from different stretches of the same table. Across the two sessions the gates drive -- coin-then-start and the undriven demo, 2500 frames each through our own harness -- the entry answered 24 and 39 times and every value 0 through 8 came up, so neither arm is dead code",
  },
  0x4117: {
    name: "chaseOneAimPointAndRetireAtTheLine",
    role: "run one object through a whole frame of chasing: re-aim it, turn it, move it, dress its sprite, and retire it once it has drifted onto a retire line. Re-aiming is RATIONED rather than done every frame -- the object carries a phase byte and the aim is recomputed only on the frames whose low four bits match it, which spreads a crowd across sixteen frames and leaves each object a stale aim in between; a phase byte above 15 can never match FRAME_TICK's low four bits at all, so such an object is never re-aimed. ★ The point is neither the only one nor a constant: it is one of SIX two-byte points packed at 0xAC74-0xAC7F, and those twelve bytes are rewritten as a block. The turn, the move and the dressing run every frame regardless, and the counter pair the caller holds is put back before the retire test",
    cert: "code",
    why: "'one aim point' says the choice belongs to this entry and not to the mechanism, and the sibling shows the choice is real: 0x41B8 has the same shape and aims at 0xAC75 and 0xAC79 out of the same twelve-byte block, while this entry takes 0xAC7F, whose partner byte headingToward reads one below it. 'Fixed' would have been wrong too: loc_326c writes all twelve of those bytes through IX-indexed stores off 0xAC64, offsets 0x10 through 0x1B with no branch between them, from a value it recomputes each pass -- and through our own harness the block's contents changed on 84 of loc_326c's 919 entries in the 2500-frame demo session, each individual byte on between 78 and 83 of them, the spread being passes that stored a value already there. The retire half is fixed outside as well: hasReachedRetireLine's entry already describes its test as what makes its caller free the slot, and retireSlot is that freeing",
  },
  0x44c9: {
    name: "loc_44c9",
    role: "close out one object's animation and dress its sprite entry: the counter the caller carries is read without the top bit that selected this path, and once what is left has reached three the counter cell in the object's record is put back to zero -- below three it is left alone. Either way both attribute slots of the sprite entry take the one code fixed here, and the two shape codes are then chosen by the flutter this entry hands on to",
    cert: "code",
    why: "kept hex: an English name would have to say what the animation IS, and nothing this body reaches decides that. It writes one attribute code into two fixed slots and hands the shapes to loc_44dc, so what the object ends up looking like is settled a routine further on; the counter it may clear is an offset in a record whose owner it never reads, and the top bit it masks away was set by the caller that chose this path, so even the arm it is on is somebody else's fact",
  },
  0x4b67: {
    name: "seedRandomRegister",
    role: "copy a fixed seventeen-byte run of program space at 0x4B84 into the random register block, then check the image that run came out of: three bytes taken from two fixed words of program space are added to one constant, and any total but zero means the program space being read is not the one the constant was picked for -- on that outcome control transfers to 0x6000, outside the image, so it raises rather than running. ★ The copy is unconditional and COMPLETE before the check runs, so nothing this entry wrote is gated by it",
    cert: "code",
    why: "two readings the name has to refuse, and the image refuses both. It is NOT seeding under a checksum of the seed: the guard's operands are `ld ix,(0x086D)` and `ld hl,(0x0870)`, and 0x086D-0x0871 is the middle of the copyright caption's record -- the record's colour byte 0x10, the (c) glyph 0x30 and the K glyph 0x7C -- which with the routine's own 0x44 come to zero exactly; the block at 0x4B84 is not read by the guard at all, and the copy has already finished when the guard runs, so a tampered credit line raises AFTER the register has been seeded. It is also NOT seeded once: two CALLs reach this address, at 0x251B inside initColdStartRamThenSeedConfig and at 0x2852 inside loc_27B1, and through our own harness the entry ran three times in 6000 frames of undriven attract. A reader who takes the register as fixed from boot will be wrong three times in that run",
  },
  0x4f35: {
    name: "loc_4f35",
    role: "choose between the round's two shot sweeps and, on one of the two arms only, stage the full seven-target run: while MOTHER_SHIP_ARMED is set the sweep that also covers the standing object runs instead, and that sweep stages its own runs, so this entry gives it nothing but the branch; while the cell is clear the two cursor cells the shared sweep reloads between passes are staged here first, so every pass restarts on the run chosen here, and the shared sweep then runs six shots against seven targets inside one box. Both counts handed over are seven, so the first pass is no shorter than the rest",
    cert: "code",
    why: "kept hex because no verb is true of BOTH arms: one arm is pure staging with a tail, the other is a bare branch into a sweep that stages everything itself, so a name naming the staging is false on the armed arm and a name naming the sweep is false on the other. The cell it branches on is the same MOTHER_SHIP_ARMED that destroyCraftAndMotherShipHitByShots's entry describes from the far side, so the split is a known one rather than a local guess. Neither taped session reaches the armed arm: across coin-then-start and the undriven demo, 2500 frames each through our own harness, this entry ran 430 and 689 times and the cell read zero at every one",
  },
  0x5286: {
    name: "drainBothDeferredCellLists",
    role: "one pass of the deferred cell machinery: blank the cells the erase list names, paint the cells the pending list names, then copy the pending list wholesale onto the erase list and park the pending cursor back on its own first entry. The copy length is the pending cursor's own byte, cursor included, so it lands the pending count on top of the erase cursor and the line after replaces that with the same count plus a mark in the top bit; where nothing is pending both cursors are parked instead and no copy happens; and a cursor of ZERO is not nothing pending -- the count is a block-copy length, and a length of zero means the whole address space. ★ NOT a double buffer: the copy runs one way, 0xAE00 onto 0xAE80, on every pass, and the two lists hold different jobs rather than alternating ones",
    cert: "code",
    why: "the double-buffer reading is the one this name has to refuse, and it was live in this layer until this batch -- mechanisms.md derived the pair as a double-buffered display list and two entries here repeated it; all three are corrected in the same commit, so what follows is why. What refuses it is the asymmetry of the two drains, readable at both. blankCellsPaintedLastPass walks the 0xAE80 list and writes only the character plane, putting the blank shape in and leaving every colour cell as it was; paintDeferredCells walks the 0xAE00 list and writes both planes, shape and colour, with a shared tint bias; their entries even start at different offsets, 0xAE84 against 0xAE04. The copy this entry makes always runs from the second list onto the first and never back, and it is a wholesale block copy rather than an append. So the halves cannot exchange roles the way a double buffer's do: one is a list of edits to make, the other a record of last pass's edits to take back",
  },
  0x55d4: {
    name: "sendOldestQueuedSoundCommand",
    role: "send the byte at the head of the pending-sound queue, then close the gap it left: a count cell at 0xAC43 says how many bytes are waiting and the bytes follow it from 0xAC44, and a count of zero is left untouched with nothing going out. Otherwise the count comes down by one, the head byte goes out, and every byte still waiting slides one place down so the head slot always holds the next one. The send happens whether or not anything is left to slide, so emptying the queue costs no slide; and nothing bounds the count, so a large one slides bytes in from past the queue's own cells",
    cert: "code",
    why: "'oldest' is the FIFO claim and the producer is what could have refuted it: loc_562a bumps the count at 0xAC43 and stores the new byte at 0xAC43 plus the bumped count -- the TAIL -- while this entry takes 0xAC44, the head. Opposite ends, so the byte that goes out is the one that has waited longest, and a stack would have put both at the same end and needed no slide at all. That the byte reaches the audio processor rather than sitting in RAM is sendSoundCommand's claim and its own entry already carries it, which is why this name says 'send' and not 'latch'",
  },
  0x598e: {
    name: "loc_598e",
    role: "hand back the doubled component pair an object's OWN heading calls for, at the pace the first of the three fixed tables of samples sets; the heading comes off the record and any pointer the caller was holding is discarded, so choosing that table is all this entry adds",
    cert: "code",
    why: "kept hex, and the family is the reason: five siblings of exactly this shape have already landed under hex names -- 0x58B6, 0x599D, 0x59C5, 0x59CB and 0x59D1 -- each a two-instruction shim differing from the next only in the table immediate or in where the heading comes from. An English name here would have to say what the pace MEANS, which class of object moves at it, and nothing reachable from a shim decides that; naming one member and leaving five hex would also claim a distinction the bodies do not carry",
  },
  0x5994: {
    name: "loc_5994",
    role: "hand back the doubled component pair an object's OWN heading calls for, at the pace the second of the three fixed tables of samples sets; the heading comes off the record and any pointer the caller was holding is discarded, so choosing that table is all this entry adds -- it is loc_598e with the other table immediate",
    cert: "code",
    why: "kept hex for the same reason as loc_598e, which it is byte-for-byte apart from the table address: the same five landed siblings of this shape are hex, and the only fact an English name could add here is what the pace means, which no shim settles",
  },
  0x0000: {
    name: "loc_0000",
    role: "a bare transfer to 0x07B1 and no return; no cell is read or written and no register moves",
    cert: "code",
    why: "kept hex, and the precedent is byte-shaped: loc_4bd9 is `c3 ae 08` where this is `c3 b1 07`, the same three-byte transfer with a different operand -- this one's operand is seatTheStackAndSettleTheControlLatch's entry -- and the house already registered that one hex with the role this entry reuses word for word. An English name here would have to be about RESET, and reset is a property of the Z80 and of the board's wiring rather than of these three bytes -- what the bytes establish is the transfer and nothing else. Naming this one and leaving its twin hex would also claim a distinction the two bodies do not carry. A scan of the whole 24 KB for the little-endian word 0x07B1, at every alignment, finds one occurrence, this jump's own operand at 0x0001; that is an operand scan and not a dispatch tap, so it is a fact about the image and no exclusivity claim",
  },
  0x00d8: {
    name: "loc_00d8",
    role: "one byte, `push af`, falling into the register-save prologue at 0x00D9 that owns the rest of the frame service and the frame's work; the two bytes it stacks land in work RAM, so they are part of what the machine leaves behind",
    cert: "code",
    why: "kept hex on ONE reason, the one-byte idiom, and the reason is structural: the frozen layer heads this address ROM 0x00D8-0x00D8 and gives 0x00D9-0x015E to a separate routine, so the only thing this entry does that 0x00D9 does not is the `push af` that opens the prologue 0x00D9 owns. An English name would name the idiom, and any name of the form 'enter the frame interrupt' would put the frame service's identity on the one byte that is not the frame service. ★ A SECOND objection was proposed and is WITHDRAWN, recorded here so it is not proposed again: it ran that an interrupt name is false at the sites that crash into this address, and that the epilogue then unwinds bytes that were never pushed. Neither half survives. There are THREE code-shaped arrivals, not four -- `c3 d8 00` at 0x0066, the NMI vector, and `c4 d8 00` at 0x00A2 and at 0x49D0; the fourth code-shaped hit, `21 d8 00` at 0x0098, is a `ld hl` that seeds a checksum and is not an arrival, and the remaining four occurrences of the word -- 0x0940, 0x0AB2, 0x5C16 and 0x5DE8 -- each carry a 0x00 byte in front of them rather than a transfer opcode, so none of them is code-shaped either. And the stack BALANCES: 0x00D9 pushes nine words on top of this one's, ten in all, 0x0174 pops exactly those ten in mirror order, and a `call nz` deposits its return address in the slot the NMI's pushed program counter would occupy -- equivalence-0174.test.js's SEAT arm measures SP landing exactly 22 above where it started, which is those ten words plus that return and cannot be reconciled with anything unwound that was never given. Both guarding sums pass on the shipped image, sum(0x00D8,256) = 0x87 against the `sub 0x87` at 0x00A0 and sum(0x27DE,256) = 0xC5 against the `sub 0xc5` at 0x49CE, so what a patched image buys at those two sites is one whole frame service run out of band and returned from normally: corruption, not a crash",
  },
  0x019a: {
    name: "armWholePlaneWipeThenDerailOnATamperedImage",
    role: "seat the character-plane wipe on the plane's very first cell and put a whole plane's worth of lines against the counter beside it, so the next pass starts at the top with everything still to do; then fold a fixed 240-byte run of the program image into one eight-bit total and, on anything but the total a genuine image gives, transfer into bytes that carry no routine. ★ The wipe is armed EITHER WAY -- the fold gates nothing above it, and the run it folds lies elsewhere in the image and has nothing to do with the wipe -- so a reader who takes this for a guarded arm will be wrong on every dispatch",
    cert: "code",
    why: "'whole plane' and 'derail' are the two claims. Whole plane is exact rather than approximate: BLANK_LINE_CURSOR is seated at 0xA400 and BLANK_LINES_LEFT at 32, and blankNextLine walks a line in steps of 32 while advancing that cursor by ONE, so 32 lines of 32 cells is the whole 0xA400-0xA7FF plane and the count is an exact fit rather than an estimate. Derail: the mismatch arm is `call nz,0x0167`, and 0x0167 is not a routine -- it is CAPTION RECORD 9, whose pointer sits at 0x0C62 in the record table at 0x0C50, and which reads destination 0xA66F, colour 0x14 and nine glyphs before the 0xB9 terminator at 0x0173, the byte immediately before the interrupt epilogue, which is WHY executing it falls into 0x0174. Its two `pop af` consume the two return addresses the `call 0x019a` and the `call nz` pushed but NOT the arm-return word the frame service pushed at 0x0158, so the epilogue then unwinds one word out of step and returns to a saved register value: control destroyed rather than reported. The separation the name relies on is checked rather than assumed -- the folded run is 0x4BA5-0x4C94, which opens `ld hl,0x4bb1 / ld de,0xab08 / ld bc,0x0028 / ldir / ret` and contains neither the wipe machinery nor either armed cell -- and sum(0x4BA5,0xF0) recomputes to 0x11 exactly, matching the `sub 0x11`, so a genuine image passes by construction",
  },
  0x01e1: {
    name: "armThePenRouteThenColdStartOnATamperedImage",
    role: "put the cell-stamping pen back at the start of its route -- leg index to zero and both coordinates to the route's first point, each written a word at a time so the whole-cell part and the fraction below it land together, and each lifted out of a fixed pair of program bytes rather than carried as a literal -- then fold a fixed 256-byte run of the image into one eight-bit total and, on anything but the total a genuine image gives, transfer into the cold start, which clears the work RAM the stack sits on and never comes back here. The arming is unconditional: the fold gates nothing above it",
    cert: "code",
    why: "'the route's first point' is exact and it is the claim that could have failed: the word at ROM 0x0D45 is 0x1000 and the word at 0x280C is 0x0400, giving row 0x10 and column 0x04, and entry zero of the leg table at 0x0290 is `10 04` -- the identical point. The pen is a real stamping cursor rather than an inferred one: drawInterpolatedPenRun treats 0xA9E3 and 0xA9E5 as fixed-point pairs, interpolates toward a target and calls plotPenCell each step off the whole-cell halves of those two pairs, then does `inc (0xa9e2)` and indexes the leg table with the result -- so 0xA9E2 is a leg index and the two pairs below it are the cursor plotPenCell is aimed with. 'Pen' is house vocabulary and not a coinage: plotPenCell's own entry already names the two cells it stamps from, and 0xAD0C is the one drawCaptionInPenColour calls the pen colour. sum(0x0E33,0x100) recomputes to 0xFD exactly, matching the `sub 0xfd`, and the checked run holds neither seed word nor the leg table; 0x0069 clears 0xB411, 0xB410 and 0xA800-0xAFFF by `ldir` and ends `jp 0x5866`, so 'cold start' is not too strong. ★ The name refuses to say WHAT the pen draws, and the image is why: three operand-visible `call 0x01e1` sites exist, at 0x076A, 0x3333 and 0x3396, and TWO of them set the stamp glyph to 0xF1, the blanking glyph, immediately beforehand (`ld a,0xf1 / ld (0xad0b),a` at 0x0765 and at 0x332E), so on those paths the trace ERASES rather than draws, and the third sets neither cell. 'Route' rather than 'line' is deliberate for a second reason: the leg table reads `10 04 11 04 … 1c 04 1d 04` and then TURNS, `1d 05 1d 06 1d 07 …`, so it is an L -- rows down one column, then columns across one row",
  },
  0x07ad: {
    name: "parkTheImageTotalForTheTamperVerdict",
    role: "park the eight-bit total the image fold arrives with into B, where the helper the verdict arm calls hands it back to A after its own address arithmetic has clobbered A; then hand on by jump, so the verdict's own exits carry this entry too. Nothing is read or written and no flag moves",
    cert: "code",
    why: "the two-instruction shape argues for hex and the CHAIN overrules it, because three of its four links are already named: sumImageBlockForTheTamperCheck (0x43E8) -> this entry -> 0x5303 -> presentChecksumForTamperTest (0x200C). 0x43E8 is `xor a / add a,(hl) / inc hl / djnz / jp 0x07ad`, equally generic in HL and B, and the house named it off that same chain; 0x200C is `add hl,de / rst 0x18 / ld a,b / ret`, MORE register-generic than `ld b,a / jp`, and the house named it at cert seen. So leaving this link hex is itself a claim -- that its role is undecidable -- and its two named neighbours' own entries contradict it. The register move has a derivable purpose rather than a generic one: 0x5303's `call 0x200c` runs `add hl,de` and `rst 0x18`, both of which clobber A, and 0x200C's last act `ld a,b` hands the total back for the `cp 0x67` at 0x5306. The loc_598e / loc_5994 precedent does NOT govern: those are kept hex because they are one of six interchangeable siblings and nothing reachable from a shim decides what their pace means, where this entry has no siblings and the chain either side of it decides its meaning. A scan of the whole 24 KB for the little-endian word 0x07AD, at every alignment, finds two occurrences -- the operand of the `jp 0x07ad` at 0x43ED, and an accidental pair at 0x1A9C straddling the operand of `ld a,(0xad04)` and the `rlca` after it. Operand scan only, with no write or dispatch tap, so no exclusivity is claimed",
  },
  0x07b1: {
    name: "seatTheStackAndSettleTheControlLatch",
    role: "power-on: probe the expansion socket and give the machine away to it if a board answers there, otherwise seat the stack at the top of work RAM, kick the watchdog, drive the four control lines the latch's first eight addresses carry low, raise the video-enable line from a byte of the program image, and hand on to the cold start. No work memory is touched -- the whole effect is the seated stack and the latched lines. ★ Latch bits 5, 6 and 7 are NEVER WRITTEN here: the walk stops at 0xC307 and the only other store is to 0xC308, so 'settle the control latch' is five of its eight lines and not all eight",
    cert: "code",
    why: "how many lines the walk settles is where this name could have been wrong, and the board layer decides it rather than the ROM. boards/timeplt/memory.js routes a write in 0xC300-0xC30F as writeControlLatch((addr - 0xc300) >> 1, value & 1) and hardware.json records the same -- TWO ADDRESSES PER BIT -- so the eight-address walk over 0xC300-0xC307 settles bits 0, 1, 2 and 3, each written twice: four lines, not eight. 0xC308 is bit 4, which io.js exports as LATCH_VIDEO_ENABLE and reads back as videoEnabled, so it is a fifth line and not a ninth; memory.js carries a standing comment against the `& 7` misreading that would make the walk eight lines. ROM[0x2D4B] = 0x01, so the picture is enabled out of an image byte rather than a literal and patching that byte leaves the machine dark. The definite article is earned: there is exactly one LS259 on this board. ★ What the name deliberately does not claim is the expansion branch -- on a stock board 0x6000 is unmapped and the `cp 0x55` should never match, but the float was not measured here, so the role calls it a probe and stops there",
  },
  0x15e2: {
    name: "startTheWholePlaneWipeAndFoldAnImageBlockIntoThePhase",
    role: "the first arm of the sequence machine's outer phase zero: arm the whole-plane wipe, then hand the inner index the step that actually runs that wipe, then subtract a 256-byte block of the program image from the outer phase and exclusive-or a fixed key into the difference. Neither number lands as an immediate -- the inner index is read out of a program byte that is the low half of an address inside an instruction, and the phase is never assigned, only folded -- so it is a tamper test that CORRUPTS the sequence rather than refusing to run. ★ The dispatch that reaches it masks with `and 0x03`, so arrival proves only that the phase is congruent to zero modulo four, which is less than it looks like: 0x04, 0x08 and 0x0C are not fixed points of the fold. That the phase is left standing rests on SEQUENCE_PHASE's own registered range of four values and not on anything this arrival establishes",
    cert: "code",
    why: "'start' is the weakest word in the name and it survives, because the scheduling store is this entry's own: armWholePlaneWipeThenDerailOnATamperedImage only ARMS -- its own name says so -- and this entry arms and then picks the step that consumes what was armed. Read end to end off the image: the frame service's phase table at 0x015F is `15c2 1651 17fe 0f1f`, so phase 0 goes to 0x15C2; 0x15C2 is `ld a,(0xa9ac) / and 0x07 / rst 0x30` with an inline word table at 0x15C8 whose entry 0 is this address; ROM[0x1749] = 0x06 and 0x1748 is `cd 06 0b`, so the index really is the low half of a call operand; and entry 6 of that same table is 0x15FE, which opens `call 0x01c2 / ret nz` -- blankNextLine, the step that runs the wipe. The fold recomputed here: sum(0x5648,256) = 0xB2 and the key is 0x4E, so the phase becomes ((phase - 0xB2) & 0xFF) ^ 0x4E, whose fixed points are the sixteen values of 256 that share no bit with 0x4E -- 0 and 1 among them, 2 and 3 not. ★ A reader who assumes eight live arms in the 0x15C8 table will be wrong six times: only entries 0 and 6 are arms, and the bytes from 0x15D6 are CAPTION RECORD 5 -- destination 0xA660, colour 0x14, eight glyphs and a 0xB9 terminator at 0x15E1, the byte immediately before this entry. Parking caption text where a table or a trap points is this ROM's standing idiom",
  },
  0x19da: {
    name: "checkTheCopyrightLineColoursOrDerail",
    role: "walk the thirteen colour cells under the copyright line and derail on the first one that has been changed: starting at 0xA2BC and stepping back 32 a cell, every cell must hold one of exactly two colours, and the first that holds anything else transfers into bytes that carry no routine and never come back. ★ The two accepted colours are the COLOUR BYTES OF THE LINE'S TWO RECORDS, which differ in nothing else -- 0x10 in the record at 0x086B and 0x05 in the record at 0x4900, both carrying destination 0xA6BC and the same thirteen glyphs -- so the pair is what the line's own flashing writes, and not a wipe colour beside a pen colour. Thirteen good cells return having done nothing",
    cert: "code",
    why: "the identification is arithmetic and it is a strict coincidence test with no slack in it. The copyright line's record is reached through the table at 0x0C50, whose first word is 0x086B; that record's destination is 0xA6BC and it holds thirteen glyphs before drawTextRun's 0xB9 terminator, and advanceCharCursor steps the cursor by -32 a cell, so the line's character cells are 0xA6BC, 0xA69C … 0xA53C and their colour twins (& ~0x0400) are 0xA2BC, 0xA29C … 0xA13C. I generated both lists and compared them: same start, same stride, same direction, same count of thirteen. The line is TWO records and not one, which is what makes 'record zero' under-determined and the colour pair explicable: record 31, pointer 0x4900, carries the same destination and the same thirteen glyphs `30 f1 7c 68 3b a5 38 fd f1 96 5d 17 9b`, and differs from record 0 in exactly one byte, the colour. drawCaptionInPenColour masks its colour with `& 0x0F` and so could never write 0x10 at all, which rules the pen out as the source of the second value. 'Derail': 0x49FA is CAPTION RECORD 4 -- pointer at 0x0C58, destination 0xA6EE, colour 0x14, seventeen glyphs and a 0xB9 terminator at 0x4A0E -- so what the transfer enters is text, and the offending colour, the cell it came from and the count still owed are DEBRIS those bytes happen to consume rather than an argument to anything. Two static call sites reach this entry, `call 0x19da` at 0x176A and at 0x1797, so no role here may say 'the caller'",
  },
  0x1f3e: {
    name: "snapHeadingOntoTheTurnTarget",
    role: "end a turn by writing the heading the turn was steering toward straight into the player's heading cell, then fall into the world scroll every arm of the turn reaches; the target arrives in a register and nothing is read, so the whole of the entry is that one store",
    cert: "code",
    why: "'snap' is the claim, and the two sibling arms settle it without leaving the enclosing routine's own control-flow web: 0x1F68 is `sub d / add a,b / ld (0xa802),a` and 0x1F6F is `add a,d / add a,b / ld (0xa802),a`, the live heading stepped by D, which is 3 or 4 off ERA_INDEX's low nibble -- those arms STEP, and this one writes the target itself. A store of the target in place of a step is a snap. That B holds the target is fixed between 0x1F05, where it is loaded from the direction table at 0x1F2E, and this entry: I checked each opcode in between and not one writes B. The arrival condition is arithmetic rather than a guess -- C is live minus target, the entry is taken on C + 1 < 3 so C is 0xFF, 0x00 or 0x01, and C == 0 has already left at the `jp z,0x1f42` -- so the two live values are one step either side. ★ Naming an ARM by a meaning its caller fixes is settled practice here: endApproachNow is a one-instruction entry whose why opens by saying so, and hasDriftedOffTheField's why says outright that it is an arm and not an entry. ★ Nothing dispatches this address: the frozen turnShipTowardTargetHeading runs these two instructions inline, and the gate's REACHABILITY arm asserts the zero over three tapes with turnShipTowardTargetHeading's and scrollWorldAtTheEraPace's own counts as the positive controls. The name deliberately omits the world scroll, because scrollWorldAtTheEraPace is a tail several arms of the pipeline reach and naming the fall-through would name the shared tail rather than this arm",
  },
  0x2bba: {
    name: "countTheKillAndGrantTheSharedToken",
    role: "the tick a hit object's death begins: ask for the pair of death sounds and take one off the round's kill quota -- both UNCONDITIONAL -- and then, only past three guards, grant this record the single-holder token at 0xA821, its own slot ordinal marked with a top bit. The guards are the record's cooldown byte carrying its top bit, the shared arming cell being set, and the shared countdown beside it reaching zero on this step; the countdown is spent whenever the first two pass, so every claimant spends a tick and not only the one that wins. The quota is floored rather than wrapped -- a count already at zero is left alone",
    cert: "code",
    why: "the trade the name makes is clean rather than lopsided: 'countTheKill' carries the quota decrement, 0xAD02 being KILLS_REMAINING, and the only act dropped is the sound request, which the role carries. 0x5683 is requestTwoSounds and loc_5617 drops a request unless 0xAD30 or 0xA9C6 is set, so 'ask for' is right where 'play' would be wrong. The two shared cells are sized together by the spawner rather than guessed at: 0x36AF's wave spawn zeroes 0xA811, counts filled slots into it, then writes 0xE4 to 0xA812 and re-stamps 0xA811 from 0xACC1, the round's craft count. What the token BUYS is not claimed here: loc_2c31 is the consumer, and freeAndNumberEveryObjectSlot's entry already records the writer and the reader agreeing that the record's sixteenth byte is a slot identity. ★ 'The tick a death begins' holds for the REACHABLE callers only. Three static call sites exist -- `call z,0x2bba` at 0x2B9D and `call 0x2bba` at 0x2BB0, both inside stepDyingObjectState and both leaving the state byte at 0x3B (the 0x3C path decrements it at 0x2BB4, the other path stores it at 0x2BAC), and `call 0x2bba` at 0x2A38, which sits after `ld (ix+0x00),0xff` and so calls with the object left ALIVE. That third site is DEAD: no absolute reference and no relative branch lands on the block 0x2A2A-0x2A3B, its single little-endian hit at 0x196F straddles a `jr nz` displacement and the `ld hl,(0xa993)` after it, the instruction before it at 0x2A28 is an unconditional `jr`, and the frozen layer's coverage ends at 0x2A2A and resumes at 0x2A3C. Shown live, it would widen the role from 'death begins' to 'an object has been hit'",
  },
  0x2e19: {
    name: "unpackTheFirstThreeSwitchSettings",
    role: "open the settings block: store, whole, the byte the caller has already worked out from the switch port's low two bits, then peel the next two switch bits into a cell each, one bit per cell and nothing else in it, and hand the byte on rotated so the last bit spent sits lowest -- twice over, in both registers that carry it -- to the continuation that peels the rest. Nothing is read from memory and control never comes back. ★ 'Switch settings' is established at the CALLER and at the three cells' readers, not inside a routine that reads no memory at all: the caller at 0x52C0-0x52CF is `ld a,(0xc200) / cpl / ld c,a / and 0x03 / add a,0x03 / cp 0x06 / jr nz,+2 / ld a,0xff / jp 0x2e19`, so C arrives as the complemented DSW port and A as 3, 4, 5 or the folded 0xFF",
    cert: "code",
    why: "'first three' is a boundary rather than a guess, because the byte is fully accounted for across this entry and its continuation: here the port's low two bits (already folded into a count by the caller) go whole into 0xA9C1, bit 2 into 0xA9C2 and bit 3 into 0xA9C3, and 0x49A8 then takes bits 4-6 into 0xA9C4 -- DIFFICULTY_SETTING, which the registry already calls a cell three bits wide that the boot-time DIP unpack fills -- and bit 7 into 0xA9C6, which loc_5617 reads as its second sound permission. All three destinations are READ AS SETTINGS elsewhere in the image, which is what makes 'settings' a claim: 0xA9C1 is the cell startOnePlayerGame's role already calls the settings cell carrying the starting count; 0xA9C3 is read at 0x4DE3, where `and 0x01` picks between the bonus-mark tables at 0x4E1B and 0x4E30, exactly as the extra-life entry records; and 0xA9C2 -- the weakest leg -- is read at 0x00FD, where a zero forces 0xA987 and that byte is then written to 0xC302, an LS259 line, which is the cabinet switch. A scan of the whole 24 KB for the little-endian word 0x2E19, at every alignment, finds one occurrence, the operand of the `jp 0x2e19` at 0x52CF; that is an operand scan, so an indexed or computed arrival would be invisible to it and no exclusivity is claimed. ★ 'Switch settings' was chosen over 'DIP' to match the registry's existing 'the settings byte at 0xA9C3', and over 'cabinet settings' because one of these bits IS the cabinet position and that phrase would read as a category and one of its members at once",
  },
  0x3793: {
    name: "loc_3793",
    role: "seat the record cursor and the sprite-entry cursor on the highest of five consecutive object slots, set the turn count to five, and transfer into the body that fills the first free one; all three are constants chosen here, nothing is read and nothing is written, and control does not come back",
    cert: "code",
    why: "kept hex because the IMAGE has no entry point here for an English name to be about -- the loc_10f8 precedent -- and this address fails that test harder than loc_10f8 did. A scan of the whole 24 KB for the little-endian word 0x3793, at every alignment, finds ZERO occurrences where loc_10f8 at least had two, so no table can name it and nothing absolute reaches it; the one transfer in the image that lands here is a RELATIVE `jr z` at 0x37C8, interior to another routine's body. The frozen layer says the same in its own words: translated/loc_37bd.js is headed ROM 0x37BD-0x37D5 'plus the 0x3793-0x379E block it branches back to' and restates the three constants inline, and the idiomatic gateTheFreeSlotSearchAndPickItsRun inlines the run rather than importing this module. And what the body does is a stretch of another routine's job rather than a job of its own: 0x37BD decides, and this block only stages one arm of that decision while the other arm stages inline at 0x37CA -- which is the trap routine-is-a-range-not-a-filename names. runSceneryForEra, offered as the counter-precedent, is the same seat-two-cursors-and-transfer shape with an English name, but it CHOOSES between three lists; this block chooses nothing. The entry is still needed, because the frozen layer DOES dispatch the address -- translated/loc_379f.js's tail is `m.call(0x3793)` -- so with no entry here that tail runs the oracle",
  },
  0x37bd: {
    name: "gateTheFreeSlotSearchAndPickItsRun",
    role: "decide whether this is a spawning tick and, if it is, choose which run of object slots the free-slot search walks: the caller points at a counter cell and only two of its values open the gate, every other value ending the entry with nothing staged; past the gate the count of kills still owed picks between two runs of the one slot file -- while any are owed the run starts two records higher and is as long as the round's craft count asks, and once none are owed a fixed run of five starts lower -- and control leaves for the search without coming back. The role names no address for the gate byte on purpose: it is read through a pointer, so the routine itself cannot know what it is",
    cert: "code",
    why: "the gate opens on exactly 0x00 and 0x30, and the counter is PACKED DECIMAL, which is what turns two arbitrary bytes into two moments of a cycle: HL is set to 0xAD05 at 0x36BC and the four instructions before the `jp c,0x37bd` at 0x36C9 -- `ld a,(0xad06)`, `and 0x0f`, `cp 0x07`, `jp z` -- leave it alone, and LIFE_TICKS_LOW's own entry records that cell taking only 00-09, 10-19 … 60 under a MAME write tap at cert seen. 0xACC1 is the round's craft count, the first destination of applyEraRungSettings's scatter (`ld a,(de)` at 0x1AC3, `ld (0xacc1),a` at 0x1AC4). The two runs address the same band from different ends: owed is 0xA8B0 / 0xAA26 for as many turns as 0xACC1 asks, cleared is 0xA890 / 0xAA22 for five, and the tail steps both cursors DOWNWARD. The quota-picks-the-count idiom is not local either -- 0x3702 loads B from 0xACC1 and replaces it with 5 when 0xAD02 is zero, the same rule and the same two numbers at a second site. ★ 'Search' rather than 'sweep' is the body's own shape: 0x37D6 opens `ld a,(ix+0x00) / and a / jp nz,0x3847`, so an OCCUPIED slot writes nothing and goes straight to the tail while a free one is filled and the routine returns -- at most one slot per entry, the walk stopping at the first free one",
  },
  0x3847: {
    name: "closeOneTurnOfTheFreeSlotSearch",
    role: "close one turn of the search for a free object slot and decide whether there is another: step the record cursor back one whole sixteen-byte record and the sprite-entry cursor back one two-byte entry, so the search walks its bank downward, strike one off the turn count, and while any remain transfer back to the body that tries one slot; when the last is struck off the search ends having filled nothing and this entry simply returns. The wide scratch pair the backward step is built from is left standing on the way out",
    cert: "code",
    why: "it is `dec b` followed by `jp nz` and not `djnz`, so the flags the jump reads are the decrement's -- which is the difference from closeOneTurnOfTheSlotSweep, whose otherwise twin body ends in a real `djnz`. A scan of the whole 24 KB for the little-endian word 0x3847, at every alignment, finds one occurrence, the operand of the `jp nz,0x3847` at 0x37DA, which is the body's SLOT-IS-OCCUPIED arm: every turn closed here is a turn that found the slot taken, and that is what makes 'search' the right noun and 'sweep' the wrong one. ★ Why this is not kept hex alongside loc_3793, on loc_10f8's own two criteria: the reference is ABSOLUTE -- the address appears as a word behind a jump opcode, the exact thing loc_10f8 recorded as absent for itself -- and it has a job of its own, a complete loop-closing act, where advanceToNextSlot is already registered for almost this body minus the loop. It is the shared tail of a different routine, not a stretch of one",
  },
  0x410b: {
    name: "closeOneTurnOfTheSlotSweep",
    role: "close one turn of the per-slot sweep over an object bank: step the record cursor on one whole sixteen-byte record and the sprite-entry cursor on one two-byte entry, strike one off the turn count and go round again while any remain, ending the sweep when the count runs out; several arms of the sweep's body converge here rather than one, and the record stride is left standing in the wide scratch pair on the way out",
    cert: "code",
    why: "'sweep' against closeOneTurnOfTheFreeSlotSearch's 'search' is the discriminating word, and the two bodies are opposite in both polarity and termination: 0x40EA opens `ld a,(ix+0x00) / and a / jp z,0x410b`, so a FREE slot is skipped to the tail and a live one is serviced, and no arm returns early -- every arm converges here and the count alone ends the sweep -- where 0x37D6 skips the occupied slot and returns the moment it fills a free one. The convergence is a scan result and here are the arms: `jp z,0x410b` at 0x40EE, `jr 0x410b` at 0x4106, `jp 0x410b` at 0x4191, 0x41A1 and 0x41B5, `jp nc,0x410b` at 0x41AF, plus the fall-through after the `call 0x413c` at 0x4108; a sixth occurrence of the word, at 0x2A86, sits inside a data run and is not a transfer. That is why the name says 'close one turn' and not 'return from the handler'. The count is not a constant either: the sweep's entry at 0x40D6 is `ld a,(0xad04) / cp 0x02 / ret c`, then `ld ix,0xa8c0 / ld iy,0xaa28`, then `ld a,(0xa8c6) / and a / ret z / ld b,a`, and 0xA8C6 is the third destination of applyEraRungSettings's scatter, at 0x1ACE. ★ advanceToNextSlot (0x309B) is `ld de,0x0010 / add ix,de / inc iy / inc iy / ret`, byte-identical up to the ending, so these two names must differ by the loop and by nothing else",
  },
  0x429c: {
    name: "setTheLaunchFacingInsideOneAimWindow",
    role: "the last gate in front of a launch, and the one thing the launcher is told: on one of the two coordinates the sprite entry carries, the firing object must lie inside a window centred on a fixed line whose half-width is READ FROM 0xA8E6 rather than baked in, and outside it this entry ends and nothing is launched; inside it the OTHER coordinate is compared against a second fixed line, and which side it falls on is handed to the launcher at 0x42B7 in the narrow scratch byte as a plain zero or one, which that routine turns into a mirroring of the NEW object's sprite rather than of the firing one's. ★ 0xA8E6 is one of the two aim windows applyEraRungSettings scatters, which is why the name says 'one' and not 'the'; the cell also has a NON-WINDOW reader at 0x43AE (`ld a,(0xa8e6) / ld (ix+0x04),a`, seeding a record countdown), and mechanisms.md marks what each of those twelve scattered cells governs as not fully settled",
    cert: "code",
    why: "the window is not a plain 'within the half-width', which is why the role claims a centre and no width: the cell is doubled and the coordinate re-centred in a BYTE, so half-widths of 0x00 and 0x80 both shut the window over every coordinate and anything above 0x80 reopens it narrower and off centre. That 0xA8E6 is a window at all is checked by the idiom rather than by a count of cells: the shape `ld a,(cell) / ld d|b,a / add a,a / ld c|e,a / ld a,LINE / sub (iy+off) / add a,d|b / cp c|e` occurs at four sites -- 0x3D47 and 0x4278 on 0xA8D6, 0x3F9E and this entry on 0xA8E6 -- so exactly two cells serve as half-widths, matching the 'two aim windows' applyEraRungSettings's registered role already names, and the indefinite article is right. The mirroring was followed rather than assumed: 0x42B7 copies the firing object's coordinates into the free slot the pointers at 0xA991 / 0xA993 name and stores the handed byte at the new record's +0x01, and the first-era arm at 0x42EC does `ld a,c / rrca / sra a / and 0xc0 / add a,0x0b`, giving attribute 0x0B for zero and 0xCB for one -- the two flip bits, and nothing else, differing. ★ The player is kept out of the name deliberately, following hasReachedRetireLine, whose role says 'two fixed retire lines' and leaves the derivation to its why: 0x84 and 0x78 are immediates here, and that they are the player's own pinned sprite-entry pair is a fact about the caller and not about these bytes. One static inbound, `jp z,0x429c` at 0x4296, taken when ERA_INDEX reads zero, with the other arm of that same test reaching 0x42B7 carrying the object's own heading -- so what this entry is, is the first era's substitution of an alignment-and-side facing for a heading-follows one",
  },
};
