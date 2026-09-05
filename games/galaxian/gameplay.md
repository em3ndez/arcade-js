# Galaxian (Namco, 1979) — Gameplay Spec (BLIND / public sources only)

> Written from public documentation ONLY (Wikipedia, wikis, retrospectives, arcade manual
> references). No ROM, MAME source, or repo code was consulted. Uncertain claims are flagged;
> real play is expected to overturn some of these.

## 1. Objective
Namco's answer to *Space Invaders*. The player pilots a single starfighter (the **Galaxip**)
along the bottom of a black starfield and must destroy the whole formation of alien
"Galaxians" massed at the top of the screen. Clearing a formation advances to the next, harder
wave; the core loop is: dodge diving aliens + their dropped bombs, shoot everything, clear the
wave, repeat. Highest score is the goal (the game is a fixed shooter with no ending).

## 2. Cast — the Galaxip and the aliens
Player ship: the **Galaxip**, a single fighter confined to horizontal movement at screen bottom.

The alien formation is a color-coded hierarchy; higher-ranked / higher-on-screen aliens score
more. Naming varies by source — modern wikis use bug-style class names, older/manual material
uses colors + "Gorgs"/"Galboss":

| Color  | Class name(s)                    | Formation role                          |
|--------|----------------------------------|-----------------------------------------|
| Blue/green | Drones ("Gorgs")             | lowest rank, bulk of the swarm          |
| Purple | Emissaries                       | mid rank, "erratic" divers `[SINGLE-SOURCE: namco.fandom]` |
| Red    | Hornets / Escorts                | high rank; escort the flagship on convoy dives |
| —      | Flagship / Commander ("Galboss") | top rank; leads escorted convoy dives   |

**Formation layout** (the classic arrangement): 3 rows of 10 blue at the bottom of the block,
1 row of 8 purple above, 1 row of 6 red above that, and 2 flagships perched at the very top
(over the 2nd and 5th red from the left) — **46 aliens total = 30 blue + 8 purple + 6 red + 2
flagships**. `[CONTESTED: retroarcadememories/strategy sources say 46 (30/8/6/2); namco.fandom
says "44 aliens with 2 or more flagships," and claims up to four flagships under some
conditions]`. The whole block sweeps left/right in unison and edges downward as the wave
progresses.

**Visual/behavioral distinctions:** color = rank. Blue drones tend to dive-bomb fairly directly;
purple emissaries move more erratically when attacking (harder to hit); reds usually fly out
alongside a flagship. `[SINGLE-SOURCE: namco.fandom for the per-color dive behavior]`

## 3. Controls
- **Movement:** two-way joystick, left/right only. The Galaxip cannot move vertically.
- **Fire:** a single fire button.
- **One bullet on screen at a time** (verified): the player must wait for the current shot to
  hit an enemy or reach the top of the screen before firing again. This is the classic Galaxian
  constraint and forces careful aiming.
- **Coin/Start:** standard coin-op start buttons.
- **Two players:** supported as **alternating turns** (not simultaneous), competing for high
  score. `[the exact 1P/2P/coinage set is DIP-configurable per program version]`

## 4. The attack mechanic
Aliens don't just march (as in *Space Invaders*) — Galaxian's signature innovation is that they
**break formation and dive**. Individually, in pairs, or in groups of three led by a flagship,
aliens peel away from the grid and swoop toward the Galaxip on curved / zig-zagging trajectories,
**dropping bombs (projectiles) as they descend**, sometimes trying to ram the ship. An alien that
survives its pass returns to its slot in the formation.

**Flagship convoy dive:** a flagship attacks flanked by **one or two red escorts** flying in a
tight convoy — the most dangerous but most lucrative attack. Score depends on how you take the
convoy apart (see §5): killing the escorts *first* and the flagship *last* is the high-value,
high-risk play.

**Diving multiplier:** an alien shot *while diving* is worth **roughly double** its in-formation
value (blue 30→60, purple 40→80, red 50→100), rewarding the player for taking shots at moving,
dangerous targets rather than picking off the static grid.

## 5. Scoring
In-formation vs. attacking values (widely reproduced across strategy sources):

| Enemy            | In formation | While attacking / diving |
|------------------|-------------:|-------------------------:|
| Blue drone       | 30           | 60                       |
| Purple emissary  | 40           | 80                       |
| Red hornet/escort| 50           | 100                      |
| Flagship         | 60           | see below                |

**Flagship (Galboss) diving values:**
- Flagship diving **alone**: **150**
- Flagship **+ one escort**: **200**
- Flagship **+ two escorts**: **300**
- **Both escorts destroyed first, then the flagship**: **800** (the marquee high-value maneuver)

**Extra life (bonus Galaxip):** awarded at a point threshold set by DIP switches.
`[CONTESTED: the Midway manual's Program No. 1 is cited as a bonus Galaxip at 7,000 points
(SW.3 OFF / SW.4 ON); other sources cite 10,000 as default with 7,000 / 12,000 / 20,000 as
selectable options across program versions]`.

## 6. Win / lose & wave structure
- **Losing a life:** the Galaxip is destroyed on contact with a diving alien OR with a dropped
  bomb. When all lives are gone, it's **game over**.
- **Clearing a wave:** destroy every alien in the formation to advance to the next wave.
- **Round counter:** completed rounds are tracked by small **flags/markers at the bottom of the
  screen**.
- **Difficulty escalation:** later waves feature faster alien movement and **more frequent /
  denser dive attacks and more bombs fired**. The layout stays the same 46-alien block; the
  aggression and speed ramp up. The game **loops indefinitely**. `[SINGLE-SOURCE:
  retroarcadememories says the stage counter runs up to Stage 48 — treat the exact cap as
  unverified]`
- **Fleeing flagship:** if a flagship is one of the last aliens left, it reportedly **flees**
  (vanishes) rather than fight, reappearing as an extra flagship at the start of the next stage.
  `[SINGLE-SOURCE: retroarcadememories]`

## 7. Attract mode
The attract / demo screen shows the aliens and displays the iconic message:
**"WE ARE THE GALAXIANS / MISSION: DESTROY ALIENS."** (Confirmed via Wikipedia.) It presumably
also cycles a high-score / scoring table and demo action `[the demo-play portion is
UNVERIFIED from sources — assumed]`.

## 8. Distinctive details
- **Scrolling starfield:** a field of stars scrolls vertically behind the action, giving a sense
  of depth/motion in otherwise black space. Iconic to the game. `[SINGLE-SOURCE for
  "vertical scroll" direction: retroarcadememories]`
- **Full RGB color:** one of the first arcade games to use full RGB color graphics (vs. *Space
  Invaders*' overlays), with multicolored, individually animated sprites.
- **Sound:** Namco reportedly emphasized the audio heavily — described as possibly Namco's first
  game with sounds made on an actual synthesizer, with distinct cues for alien movement and the
  diving attacks. (No looping "background music" in the *Galaga* sense is claimed.)
- **Pioneered the dive-bombing formation-shooter**, the template later refined by *Galaga* (1981)
  and countless clones.

## Sources
- https://en.wikipedia.org/wiki/Galaxian
- https://retroarcadememories.wordpress.com/arcade-games-reviews/galaxian/
- https://namco.fandom.com/wiki/Galaxian_Flagship (via search excerpt; page fetch blocked)
- https://shmups.wiki/library/Galaxian
- https://strategywiki.org/wiki/Galaxian/Gameplay (via search excerpt; page fetch blocked)
- https://primetimeamusements.com/getting-good-galaxian/ (via search excerpt; page fetch blocked)
- https://bitvint.com/pages/galaxian (via search excerpt)
- https://archive.org/details/ArcadeGameManualGalaxian (Midway arcade manual — DIP/bonus, technical)
- https://gamefaqs.gamespot.com/arcade/583825-galaxian/faqs/32227 (Sashanan strategy guide; fetch blocked, used search excerpt)
