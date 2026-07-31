# Grounding — playing the game to recover what it *means*

Translation and decompilation recover *correct, readable structure*. They do not tell you what the game
**is**: its objective, its win/lose conditions, which sprite is an enemy and which is decoration, what a
tile or a RAM cell *means* in play. Reading code has a hard ceiling here — those answers live in
behaviour, not in opcodes. **Grounding** is the step that gets them: drive the real ROM in MAME and
watch what happens.

It is the second face of the oracle. The [pixel gate](pixel-gate.md) uses MAME to ask *"is our JS
correct?"*; grounding uses the same emulator as a **probe** — *"what does the game do?"* — turning
`[guess]` claims into `[seen]` facts, one experiment at a time. It runs on the **real ROM in MAME** and
needs no JS build at all, which is why the behavioural half can, and should, run on day one.

## Two halves, different dependencies

- **Behavioural grounding** — the game as a *player* sees it: objective, cast, win/lose, controls,
  mechanics. Needs only MAME + a verified romset; in its purest form it is just *playing and taking
  notes*, zero reverse-engineering. **Front-load it at day zero**, before naming — otherwise names get
  chosen at partial understanding and need a costly late re-derivation (the name-revisit in
  [the decompiler pipeline](decompiler-pipeline.md)).
- **Structural grounding** — attaching that behaviour to specific addresses/routines ("*this* cell is
  the completion gate," "*this* routine kills the player"). This needs the memory map, so it **threads
  through the decompile** as the map fills in.

**Grounding GATES a load-bearing, code-undecidable pick — in-loop, not deferred.** When the decompile
is about to commit an identity that (a) downstream work will *trust* and (b) the code alone cannot
settle — laser vs terrain-scroll, enemy vs ship, which axis is X — fire the experiment *then* and let
the result set the name. Do **not** name it from code and "let grounding upgrade it later": that
deferral is exactly how The Pit committed *"no laser exists"* and named enemy-3 a *"ship,"* each
caught only by a later round after the wrong pick had propagated through the map. Resolve a
load-bearing `[guess]` *as it is generated*, before building on it. (Low-stakes or code-decidable
calls defer freely — this gate is for the picks everything downstream will lean on.)

**Meaning rides on the map.** Poke-assisted grounding needs to know *where* to poke, which is the
decompile's output. With no map yet, bootstrap pokes with **memory-diffing**: play, snapshot RAM around
an event, and find the byte that changed ("which cell decrements when I die?" → the lives counter,
discovered with zero decompilation).

## The experiment discipline

Every semantic claim is an **experiment**, not an assertion:

1. **Hypothesis** — e.g. "the on-screen tank is the timer that kills you."
2. **Reach the state** — play to it, or poke the known cells to jump there fast.
3. **Watch** — log the RAM cells + read annotated frames.
4. **A/B with a negative control** — the control is what makes it proof. To test "is X an enemy?", force
   X *active* and overlap it onto the player (death) **and** run the identical setup with X far away (no
   death); the difference is the finding. A same-cell pin on a *dormant* actor fires nothing — a missing
   control produced an inconclusive death test once.
5. **Prefer a natural run** — the strongest evidence is a claim captured **end-to-end in normal play,
   zero pokes**; pokes are an accelerator, not the goal.

Cross-check a frame reading against the **validated renderer's own computation** of the same sprite RAM —
an independent second "yes" that the pixels mean what you think.

## Rounds: persistence + a completeness critic

Run grounding in **rounds**, and keep going while each round still lands a *correction* (one game's first
three rounds each overturned something — the objective wasn't collect-all, the "enemies" were decor, a
"saucer" was a real enemy). Then spend the effort **once more** — a **completeness-critic** round that
asks "what's still unlooked-at?" — and stop only when it comes back dry.

State the **honest floor**: what is structurally *un*-observable and stays `[guess]` — e.g. a
sound-command→audio mapping with no audio oracle, or a RAM cell dormant on every reachable path. Naming
"we couldn't observe this" is a result, not a gap.

## The MAME observation rig

**Stand this rig up at day zero, alongside `gameplay.md`** — a verified romset, the per-frame RAM
dump, and the poke/input harness. It is the precondition for grounding *in-loop*: if the rig is a
late-phase setup, grounding slides to the end and stops gating the picks it should (§ the gate rule
above), and a whole session can be lost to a false "I can't ground yet." Build it before naming, not
after.

Agent-driven, headless, reproducible:

- Capture with `-video none -aviwrite` in the **displayed** orientation (rotation applied — *not*
  `-norotate`) so frames match what a player sees; extract frames with ffmpeg.
- A **per-frame Lua notifier** (`emu.add_machine_frame_notifier`) logs the RAM cells of interest each
  frame and can poke state / drive inputs. **Retain EVERY subscription token in a global — the notifier
  AND every `mem:install_write_tap` / `install_read_tap`.** A discarded token is silently
  garbage-collected mid-run and the tap/notifier stops firing, so the log flatlines partway through —
  which reads as *the game stalled or reset* when it is actually still running fine. Measured on The Pit
  (MAME 0.288): an **unheld** write-tap died at frame 184; the identical tap **held** in a global
  (`_G.__t = mem:install_write_tap(...)`) ran to completion (frame 529). Note which one bit: the
  notifier held globally tracked frame-for-frame all run — so when a trace goes dark, suspect an unheld
  **tap** token first, not the notifier. Cross-check any "it stopped" reading against a GC-immune
  signal: `manager.machine.screens:at(1):frame_number()` is a register read, not a subscription, and
  never lies.
- Reach cells with `mem = manager.machine.devices[":maincpu"].spaces["program"]; mem:read_u8 / write_u8`.

Gotchas that cost real time:

- Build a **properly-named, verified romset first** — a loose chip dump lacks the `.icNN` filenames
  `-verifyroms` needs.
- **Verify hardware/driver citations against the actual MAME source**, never a web summary — a wrong
  "fix" once pointed the board layer at a nonexistent driver file (the real one was confirmed via a `gh`
  code search on `mamedev/mame`).

## What grounding feeds

Grounding's `[seen]` facts flow into two places: the **names** (an earned name is a mechanism/role that
reached confidence — schedule an adversarial name-revisit once grounding is in) and the game's own
`mechanisms.md`, its [inside-out model](mechanisms.md). It also **extends the pixel gate** into deep
gameplay: the same pokes drive the engine to states attract mode never reaches, which can then be
pixel-validated too.

The worked example is **The Pit** (`games/thepit/mechanisms.md`): four grounding rounds took the whole
game from `[guess]` to `[seen]` — recovering the dig → collect → surface objective, refuting a decorative
"tank," and correcting names the code alone had gotten wrong.
