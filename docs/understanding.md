# 7. Understanding the mechanisms

The [lift](translation.md) is byte-faithful but **meaning-blind**: it tells you a routine
writes `0x801b`, not that `0x801b` is *which directions the player is allowed to dig*. The
[idiomatic generation](idiomatic-generation.md) can't produce readable code or *earned* names
without that meaning — a name is a claim about what a routine does *in the game*. This step builds
that claim, on evidence, before and during the idiomatic rewrite.

The output is one **living** document per game: `games/<game>/mechanisms.md` — a code-grounded
model of how the game actually plays.

## It is grounded, not recalled

We deliberately port games with **no public reverse-engineering** (The Pit is the first), so that
"understanding" can't be smuggled in from a manual or a wiki — it has to come from the code and
from watching the real machine. Keep that discipline: **every claim in the mechanism map carries a
confidence tag**, and nothing recalled is ever written as fact.

- **[seen]** — observed on the real ROM under MAME: a captured frame, a pixel diff, a
  control-poke, or a read-tap log. Our engine may be in the chain; the reference must be MAME.
- **[code]** — derived from a translated routine's behaviour. The *mechanics* are exact (the lift
  is faithful); the *role* is your inference from them.
- **[guess]** — plausible, unverified. Explicitly not to be relied on.

**A number is `[seen]` only if its evidence chain TERMINATES in a MAME observation.** Our engine
may be in the chain — a pixel diff runs our renderer against a MAME golden and stays `[seen]`,
because the reference is the real machine. A chain that ends in our own output does not: a dispatch
count from `new Machine(ROM).runFrames(...)` is our engine replaying the ROM however long the
window, and an idiomatic-vs-oracle equality is our JS against our JS. Both are good evidence *about
the port*, and both are `[code]`. When the number is ours, write **"harness replay"** rather than
"attract run" — but note that phrasing is an authoring habit, not a review test: every tag this rule
was written to catch already said "attract run".

A wrong role asserted with confidence is worse than a neutral `loc_<addr>` — it is the
[sprite-record trap](idiomatic-generation.md) at the level of the whole game. Tag honestly.

## The formula — how to run an understanding pass

Run one after every decompile batch. Never two decompile batches in a row.

**1. Sweep reachability.**
Count dispatches per unnamed routine. Work highest-first.
Unreached means "not reached by this sweep" — not dead.

**2. Two proposers, blind.**
Same routines, separate files, forbidden to read each other's.
Each entry: NAME / MECHANISM / EFFECT / CORROBORATION / NOT CLAIMED. Append per routine.
Name by effect, not method. `loc_` only when the mechanism itself is unreadable.

**3. Diff them.**
Every fresh name is a `[code]` proposal and goes on the grounding list (see "A naming pass produces
`[code]` proposals" below). The diff sets the ORDER, not the membership:
**diverged → the code can't settle it → ground it FIRST**, together with anything load-bearing that
downstream work will trust. Converged names are candidates, not confirmed — two blind agents can
converge on the same wrong reading.
All named / none kept is a flag, not a win.

**4. Ground the top of that list — before promotion.**
The diverged and load-bearing picks get grounded BEFORE they are promoted; the rest are lifted by the
grounding pass that follows this one. Never promote a load-bearing, code-undecidable pick unground.
MAME on the real ROM. Never our own engine.
A/B with a negative control, or it's an anecdote.
Say played vs poked. Hold Lua tokens in globals.
Verify a control actually moved pixels — a positive control can silently be a no-op.
"Still open, and here's why" is a result.

**5. Third review: try to break it.**
Two blind agents can converge on the same wrong reading, so convergence is not a pass.
If both proposers report the same unexplained oddity, suspect their shared premise before the ROM.

**6. Lead edits names.js.**
Proposers never do. Rename every importer. Equivalence suite stays green.

**7. Rewrite mechanisms.md whole.**
From gameplay.md, blind to the old map. Never patch it. Recount by measuring.

**8. Sweep the prose the renames just falsified.**
Sweep by **claim family** — existence, counts, "only/sole", status words — **never by token.**
A token sweep finds only claims that name the renamed thing, and most stale claims never name it:
to-dos that have since fired, counts of other files, whole-ROM "only" assertions, and status words
the port's own progress falsifies. This is the step's recorded failure mode, twice.
Flatten files before matching — wrapped lines hide hits.
Enumerate the phrasings actually present; guessing them is the failure mode.
Re-derive every count a reworded predicate touches.

**How big this step is depends on whether the game's routine layer has been migrated to R21.**
Reviewer-rules R21 forbids an idiomatic routine header from referencing anything outside its own
file. Once a game's layer complies, the only prose that can go stale on a rename is `mechanisms.md`
(already covered — step 7 rewrites it WHOLE, which is why it is a rewrite and never a patch),
`names.js` roles, `names.js` `why` fields — which cite callers and siblings BY NAME and are therefore
the most rename-fragile prose in the registry — and test headers. That is a small, bounded surface.

Until then the routine layer is still in scope for that game, and this step is still tree-wide.
The test is per game and it is `scan`, not `check`:

    python3 tools/comment_gate.py scan games/<game>

`check` only inspects files that are STAGED, so it goes green on a pass that stages no routine file
and proves nothing about the layer. Migration is per game and not assumed: run `scan` for the game
you are in. Treat a green `scan` as the licence to run the short version of this step, and nothing
else as that licence.

**9. One commit. Independent review confirms these steps were followed.**
The whole pass lands as ONE unit — renames, `names.js`, `mechanisms.md`, the prose sweep — because a
reviewer cannot confirm steps that have not happened yet. Commit half and there is nothing to check.
The reviewer reads the scratch artefacts from steps 1-5 live. Those stay scratch and may be deleted:
they are REPRODUCIBLE — if they are gone, start again at step 1. That is why the evidence never needs
committing, and why the committed prose carries the finding rather than a path to it.

The sections below are the reasoning behind those steps — read them when a step needs justifying,
not before running one.

## How to build it

1. **Watch the game — attract mode is free ground truth.** Every arcade game of this era runs an
   attract loop (title / high-scores / a gameplay demo) when idle. It is **deterministic and
   input-free**, so you can capture it headlessly and *see* what the code is doing without solving
   any gameplay:

   ```sh
   # tools/mame-play.py resolves the MAME driver from the board and isolates config; --headless
   # gives the null-video capture path (drop --headless to just play it in a window).
   python3 tools/mame-play.py <game> --rompath <romset-parent> --headless --seconds 45 \
     -snapshot_directory <out> -aviwrite attract.avi
   ffmpeg -i <out>/attract.avi -vf fps=1 <out>/f_%02d.png
   ```

   Read the frames. Identify the actors, the playfield, the HUD, the loop. That is your **[seen]**
   layer, and those same frames become the first [pixel-gate](pixel-gate.md) goldens (the title
   screen — deterministic, though often with a blink to match by frame *phase* — is the cleanest
   first target; the demo needs the [entropy pin](idiomatic-generation.md) because enemy motion
   pulls from the RNG).

2. **Tie observed elements to routines and RAM.** For each thing you see (player, each enemy, the
   score, a spawn), find the routines that drive it and the addresses they read/write. Record a
   mechanism→routine table and a RAM-role table. This is the **[code]** layer.

3. **Leave the unknowns visible — and enumerate them, don't curate.** Keep an explicit *open
   questions* list (win/lose conditions, a timer, an actor whose behaviour you haven't pinned).
   Named unknowns are the to-do list for understanding, exactly as unreached spans are the to-do list
   for [disassembly](disassembly.md).

   **That prose list is a highlighted subset, NOT the whole to-do — never treat it as complete.** The
   exhaustive, ground-truth to-do for an understanding pass is *every undefined memory location*, and it
   has TWO nets, because either one alone leaks: **(a)** each work-RAM cell still referenced as a raw
   `mem8[0x..]` hex literal with no `names.js` name; **and (b)** each work-RAM cell aliased to a file-LOCAL
   `const NAME = 0x8..` inside a routine but never centralized in `names.js`. A local alias was understood
   well enough to earn a name — yet it is *invisible* to net (a) (every use goes through the const), it
   is absent from the one registry, and different files may give the SAME address DIFFERENT local names
   (the exact "one routine's local view" the registry exists to reconcile). Plus each routine still
   tagged `[guess]`. An undefined cell is an unnamed unknown even when no prose question mentions it. So
   an understanding pass **ENUMERATES both nets mechanically** and works that whole set — it does not
   read the map's open-questions section and stop. (Recorded failures: an agent read only the map's
   "still-open" list and reported the game "as understood as it gets" while **30** cells sat unnamed;
   and a first single-net recipe caught only (a), hiding **~19** more cells that lived as local
   consts — a one-net enumeration UNDER-reports.) Verified game-agnostic enumeration (`<game>` = e.g.
   `thepit`):

   ```sh
   node --input-type=module -e '
   const game="<game>";
   const ram=await import(`./games/${game}/idiomatic/names.js`);
   const fs=await import("node:fs");
   const named=new Set(Object.values(ram).filter(v=>typeof v==="number"));
   const dir=`games/${game}/idiomatic`, rawHex=new Set(), local=new Map();
   for(const f of fs.readdirSync(dir)){ if(!f.endsWith(".js")||f==="names.js") continue;
     const t=fs.readFileSync(`${dir}/${f}`,"utf8");
     for(const m of t.matchAll(/mem(?:8|16)\[(0x8[0-9a-f]{3})\]/gi)){          // net (a): raw hex (8- AND 16-bit)
       const a=parseInt(m[1],16);
       if(a>=0x8000&&a<=0x87ff&&!named.has(a)) rawHex.add(m[1].toLowerCase()); }
     for(const m of t.matchAll(/const ([A-Za-z_]\w*) *= *(0x8[0-9a-f]{3})\b/g)){ // net (b): local const
       const a=parseInt(m[2],16), k=m[2].toLowerCase();
       if(a>=0x8000&&a<=0x87ff&&!named.has(a)){ if(!local.has(k)) local.set(k,new Set()); local.get(k).add(m[1]); } }
   }
   console.log("RAW-HEX unnamed:", [...rawHex].sort().join(" "), "("+rawHex.size+")");
   console.log("LOCAL-CONST (named in a file, not in names.js):");
   for(const [a,ns] of [...local].sort()) console.log("  "+a+"  ["+[...ns].join(" | ")+"]");'
   ```

   Both nets still read cells through `mem8`/`mem16[...]` and `const` — a **bare** `0x8xxx` literal (in a
   clear-array, a `regs.sp = 0x83ff`, an offset base) hides a cell from either. So also
   `grep -nE "0x8[0-9a-f]{3}"` the **non-comment** code and reconcile every hit against `names.js`: a hit on
   a NAMED address is a missed rewire (the cell must be used by its imported name — that a const is *live*
   is the other half of single-source), a hit on an UNNAMED one is an enumeration to-do net (a) missed.

   Each address either net prints is a to-do item: pin its role from its readers/writers (and a
   control-poke if needed), then either promote it to a `names.js` name if the role is earned — reconciling
   any conflicting local names into one consensus, and replacing the local `const` with an `import` so
   the registry stays the single source of truth — or leave a comment saying *why* it stays hex (genuine
   scratch / a role you deliberately won't over-claim). "Understanding is as complete as it gets" is a
   claim about BOTH sets being empty-or-accounted-for — verify it against this command's output before
   ever saying it.

### A naming pass produces `[code]` proposals — it is FOLLOWED BY a grounding pass

Naming a cell from the code alone earns it `[code]`, not `[seen]`: you have a consistent reading of what
the byte *is*, not a confirmation of what it *does*. So a naming pass is **not** the terminus of the
spiral — it FEEDS a grounding pass. Two stages, and stage B is not optional:

**A. Land the names cleanly (the code side).** The pass's code-side is finished only when all of:

1. **The const is live everywhere.** Rewire EVERY reference to the new name — not just `mem8[0x..]`,
   but `mem16[0x..]`, `regs.sp = 0x..`, and **bare `0x..` literals** (clear-arrays, offset bases). A
   named cell still read as raw hex means the registry is not yet its single source. (A reviewer caught
   a "single source" claim that was false because only the `mem8[...]` sites had been rewired — the
   enumeration's bracket-only net (a) is not enough; also `grep` the non-comment code for every bare
   `0x8xxx` and reconcile.) The rewire is behaviour-preserving, so the equivalence suite must stay green.
2. **No prose contradicts the registry.** Sweep routine comments AND `mechanisms.md`: nothing may call a
   now-named cell "hex / no names.js name / unnamed". `tools/names_consistency.py` (pre-commit gate #2)
   enforces this — run it. Acknowledging a deliberate raw / different-role use is allowed ("0x8057 is
   `BOARD_MODE`, reused raw here"); a bare "0x8057 stays hex" is not. See [names-registry](names-registry.md)
   "One source per fact".
3. **The names cleared proposer≠confirmer + a third adversarial review.** Two independent *blind*
   derivations, promoted on convergence — but convergence is necessary, not sufficient (two blind
   derivations can converge on the same *wrong* reading, the recorded `0x8076` case), so a third
   adversarial review reads every promoted name before it lands, not only the ones the two split on. The
   lead — not a proposer — edits `names.js`. (See [idiomatic generation](idiomatic-generation.md).)
4. **Verify the code side mechanically, don't assert.** Both-net enumeration prints zero uncentralized
   cells; the names-consistency gate reports zero; the equivalence suite is green; a reviewer≠author
   reads the diff.

**B. Then GROUND the `[code]` names.** They are *proposals*. A grounding pass plays/pokes each in MAME —
never the JS engine, which is our own model (grounding it against itself is circular) — to lift
`[code]`→`[seen]` or to OVERTURN it. Ground the **load-bearing, code-undecidable** picks first and
*before you build on them*: a name derived from code alone can be confidently wrong (The Pit shipped
"no laser exists" and called enemy-3 a "ship", both from code, both overturned only by grounding). A
batch of fresh `[code]` names is a grounding **work-list**, not a finished map — the pass is complete
only when that list is grounded-or-accounted-for, exactly as the mechanism map is (below).

## Maintain it as understanding grows

**The mechanism map is never "done" — it is maintained continuously.** It starts as mostly
`[guess]` and a short mechanism table, and every later pass promotes it:

- A newly translated routine turns a `[guess]` into `[code]`, or adds a row.
- A RAM-naming corroboration or a control-poke turns `[code]` into `[seen]`/confirmed, and closes an
  open question — **but the promotion only counts under proposer≠confirmer (below): whoever grounded
  or proposed it cannot be the one who confirms it.**
- The idiomatic decompile is where the deepest understanding lands — fold what you learn back in as
  you go, don't leave it in your head.

**Promotion requires proposer ≠ confirmer — interpretation gets the same bar as code.** A name or a
role-tag is a claim about what something *means*, and the method holds interpretation to the same
proposer-≠-confirmer discipline as code ([README](README.md): "proposer≠confirmer (RAM *and* routines)
+ third adversarial review"; [how-the-agents-worked](how-the-agents-worked.md): "a separate confirmer re-derives
it by control-poke or citation before it is trusted"; also [names-registry](names-registry.md),
[idiomatic generation](idiomatic-generation.md)). So a `[guess]`/`[code]` item is promoted to
`[seen]`/confirmed — and a name is trusted in `names.js` — only after a **separate** agent (not the
proposer) **independently re-derives it from scratch**: reproduces the control-poke and reads the result
themselves, or cites the corroborating readers/writers themselves, and reaches the same conclusion (or
refutes it). Grounding a claim yourself makes it a *proposal*, not a confirmation.

**A write-up review is NOT a confirmer.** Having a reviewer check your *prose* for honesty/over-claiming
catches an over-claimed sentence; it does not catch a wrong observation — a misread cell, a render
artifact, a pattern-match — because the reviewer never re-ran the experiment. If the confirmer cannot,
or does not, re-derive the finding independently, the promotion does not happen and the item keeps its
prior tag. (Recorded failure, 2026-07-31: an understanding pass promoted an arrow-render
`[guess]`→`[seen]` with the *same* agent proposing and "confirming" — the review could not re-run MAME
— which is a proposer-only `[seen]` mislabeled as confirmed; see [that promotion](../games/thepit/mechanisms.md)
§3, still owed an independent re-derivation.)

Anyone who touches the game — translating, naming, or decompiling — updates the map in the same
change. Treat a stale mechanism map the way you treat a stale doc: a bug.

## Where it sits in the pipeline

It is **cross-cutting, not a step.** The observation half needs only the ROM and MAME, so it
**starts on day one — before the lift** — and orients everything that follows; the `[code]` layer
then grows with the lift, and the deepest understanding lands *during* the decompile. It spans the
whole [idiomatic generation](idiomatic-generation.md), whose RAM-naming and bottom-up-decompile
steps **consume** it: an earned English name *is* a mechanism-map role that reached confidence. So:

> **The mechanism map (`games/<game>/mechanisms.md`) is required reading for the idiomatic /
> decompile workers**, along with this doc — before proposing any name or writing any idiomatic
> routine. You cannot name what you don't understand.
