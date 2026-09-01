0000	zero the value that will silence the interrupt latch
0001	clear the vblank-interrupt-enable latch -- hold the per-frame interrupt off until state exists
0004	enter the power-on boot
0010	store the fill byte into the current cell
0011	step to the next cell
0012	repeat for the whole run -- a count of zero means a full 256 bytes
0018	store the fill byte -- inner run of the two-level block fill
0019	step to the next cell
001a	repeat the inner run
001c	count down the outer run
001d	restart the inner run for each outer pass
0020	add the byte index onto the table base
0024	carry the index into the high byte -- a full 16-bit table offset
0026	read the table entry at base plus index
0039	point at the command-ring page
003b	read the ring's write cursor -- the low byte of the next slot
003f	test the slot's free bit -- bit 7 set means free to write
0041	slot still occupied -- drop this command silently
0043	store the command's high byte into the slot
0044	step to the next slot
0045	store the command's low byte
0046	advance the cursor past the pair
0048	did the cursor run off the top of the ring body?
004c	wrap it back to the ring start
004e	commit the advanced write cursor
0066	vblank interrupt vector -- jump into the per-frame service
0092	boot entry -- kick the watchdog
0095	seat the stack just below the top work cell
0098	clear the first config cell
009b	eight 4K program banks to checksum
009d	reserve the top word for the self-test tally
009e	start the running sum at the bottom of program ROM
00a1	point at the reference-checksum table
00a5	clear this bank's low and mid sum bytes
00a8	clear the high sum byte
00aa	fold the next ROM byte into the running low sum
00ae	carry into the mid sum byte
00b1	carry on into the high sum byte -- a 24-bit rolling sum
00b2	advance within the 256-byte page
00b3	sum the whole page
00b5	step to the next page
00b7	sixteen pages make one 4K bank
00b9	keep summing until the bank is done
00bb	kick the watchdog between banks
00bf	compare the low sum against this bank's reference
00c2	any byte off -- the bank fails
00c5	compare the mid sum
00cb	compare the high sum
00ce	all three match -- the bank is intact
00d0	skip the pass count on a failed bank
00d3	point at the self-test pass tally
00d6	count this bank as passed
00d8	advance to the next bank's three-byte reference
00de	repeat for all eight banks
00e0	read DIP bank 0
00e3	isolate its low nibble
00e5	point at a small selector table
00e8	look up the entry for that nibble
00eb	continue into the work-RAM wipe
0103	kick the watchdog
0106	point at the base of work RAM
010c	span work RAM but its two top cells
010f	seed the first cell to zero
0111	wipe work RAM to a known-blank state
0115	seed the sound-side work cell
0118	point at the display-command ring buffer
011f	mark every display-command slot empty
0120	point at the sound-command ring buffer
0125	mark every sound-command slot empty
0129	park the sound ring's read and write cursors at its origin
012c	kick the watchdog
0131	select the upright screen at the hardware flip latch
0134	mirror the upright flag into work RAM -- the master orientation copy
013a	park the display ring's read and write cursors at its origin
013d	point at the colour/attribute plane
0143	the default attribute byte
0148	flood the whole colour plane with the default attribute
014a	arm the row-by-row tile fill from the tile-plane base
014d	kick the watchdog
0150	read DIP bank 1
0153	the switch bank is wired active-low -- complement it
0155	rotate DIP1 bit 2 down to bit 0
0159	store the cabinet-type flag
015d	expose DIP1 bit 3
0161	store the bonus / extra-life award selector
0165	expose DIP1 bits 4-6
0169	store the difficulty level
016d	expose DIP1 bit 7
0173	store the demo / attract-sounds enable
0176	read DIP bank 1 again for the lives setting
0179	complement the active-low bank
017a	take the low two bits -- the lives selector
017c	a pair of set bits is the special setting
0180	otherwise lives is the selector plus three -- three, four or five
0184	the special lives setting
0186	store the starting lives
0189	read DIP bank 0 -- the coinage bank
018d	take the high nibble -- coin slot 2 coinage
018f	shift it down to a table index
0193	point at the coinage table
0196	look up the coin-slot-2 credit descriptor
0197	store the coin-slot-2 coinage config
019b	take the low nibble -- coin slot 1 coinage
019d	point at the coinage table
01a0	look up the coin-slot-1 credit descriptor
01a1	store the coin-slot-1 coinage config -- 0x0f means free play
01a4	kick the watchdog
01a7	clear the sprite banks and blank the lower tile map
01ab	silence the audio processor
01b0	enable the vblank interrupt -- the per-frame heartbeat begins
01b3	point at the high-score table
01b6	ten default entries
01be	seed each entry to the 10000-point default
01c1	lay down all ten default high scores
01c6	seed the live top-score leading byte to 10000
01c8	kick the watchdog
01cb	point at the status-panel digit source
01d1	clear the panel digit source so it starts blank
01d2	enter the main loop -- never returns
01db	kick the watchdog while waiting
01de	poll the input port
01e1	test the awaited input bit
01e3	return once it is set
01e6	keep waiting until the countdown drains
01e8	flag the timeout
01ea	point at sprite bank 1's active-record window
01ed	its 0x30-byte record window
01ef	flood bank 1's window with the fill byte
01f0	point at sprite bank 0's window
01f5	flood bank 0's window -- both banks cleared
01f6	point into the tile-code plane
01ff	the blank / erase tile
0201	paint the playfield tile plane blank
0203	top of the settle wait -- the no-ops burn a fixed slice each pass
0206	burn time -- inner settle delay
0208	kick the watchdog through the wait
020b	count down the outstanding settle passes
020c	repeat the settle delay
020f	point at the command-ring page
0211	read the ring's read cursor
0215	fetch the next queued command byte
0216	shift out its high bit -- the once-per-frame worker marker
0217	an ordinary command -- go dispatch it
0219	worker marker reached -- run the per-frame worker
021c	loop back and keep draining the ring
021e	mask the command's handler index
0223	free this ring slot
0226	read the command's argument byte
0227	free the argument slot
0229	advance the read cursor past the pair
022b	did it wrap below the ring body?
022f	wrap the read cursor to the ring start
0231	commit the advanced read cursor
0235	point at the command-handler table
0238	index it by the handler number
0239	fetch the handler address
023f	arrange to return into the drain loop
0241	run the command handler
0248	command dispatch table -- command 3 runs the score-accrual handler at 0x0496
024a	command 4 runs the score-clear-and-repaint handler at 0x0552
024c	command 5 runs the score-column painter at 0x056b
024e	command 6 runs the canned stacked-text painter at 0x05b2
0250	command 7 runs the credit-count painter at 0x05ee
0252	command 8 runs the high-score-table integrity check at 0x0644
0254	read the free-running control byte
0257	keep it for the bit tests below
0258	take its low nibble -- zero on just one frame in sixteen
025a	on that frame, repaint the scroll columns
025d	otherwise run the program-signature self-test
0261	scrolling exists only during a game -- test the in-play gate
0265	not in play -- nothing to scroll
0266	stride of one tilemap row up
0269	point at the mode-dependent side column
026c	one- or two-player game?
0270	one player -- erase the player-2 strip
0272	two players -- cap the column with its top tile
0274	paint the two body tiles below the cap
0277	point at the shared scroll column
027a	stamp a fresh capped column -- the edge that appears to scroll
027d	which player's banks are active?
0281	player 1 uses the shared column
0286	player 2 uses the capped column
0289	the control byte's 16-frame toggle gates the extra blank
028c	and the in-play gate's low bit must be set too
0291	erase the vacated column so no stale tile trails behind
0294	point at the top of the player-2 strip
0297	blank the capped column
029a	where player 2's score would sit
029d	blank the next three cells
02a0	and three more
02a3	and the last three -- the whole strip erased
02a6	then paint the shared scroll column
02a8	stamp the cap tile at the top of the column
02aa	step down one row
02ab	lay the middle body tile
02ad	step down another row
02ae	lay the base tile -- the three-cell column stands
02b1	the blank / erase tile
02b3	erase the top cell
02b4	step down one row
02b5	erase the middle cell
02b6	step down another row
02b7	erase the bottom cell
02b9	point at the sprite display list
02bc	its 0x60 bytes -- 24 four-byte entries
02be	the zero fill byte
02bf	clear the whole display list -- every sprite off screen
02c0	point at the actor arena
02c3	clear one full page of records
02c4	clear the second page
02c5	the arena's 0x37-byte tail
02c7	clear the tail -- every slot-active flag now reads empty
02c9	zero the sprite list and actor arena first
02cc	29 visible cells to blank this row
02d0	row remainder -- the full row width minus the cells just blanked
02d4	load the row-fill cursor
02d7	the blank tile
02d9	blank this row's cells
02da	skip the off-screen remainder to the next row's start
02db	store the cursor for the next frame
02e1	count this row off -- reports drained when the last row is done
02e3	seed the fill cursor at the fixed top of the tile plane
02e6	store the fill cursor
02e9	the full 32-row grid height
02eb	seed the remaining-row counter
02ef	point at the head of the sprite display list
02f2	source the two lead actors
02f6	records are 0x18 bytes apart
02f9	two entries
02fb	harvest the lead actors into the list
02fe	source the two hunter / target records
0304	harvest them as the next two entries
0307	source the eighteen general moving objects
030b	eighteen entries
030d	build their entries with sub-pixel coordinate math
0310	source the two arrow / launch records
0316	harvest them as the final two entries
0319	the first arrow entry's Y byte
031c	drift the first arrow up one pixel
031d	the second arrow entry's Y byte
0320	drift the second arrow up one pixel
0321	read the screen-orientation flag
0325	upright -- the sprites are already correct
0326	screen flipped -- mirror the whole sprite list
032a	pick the record's Y field into the list
032f	then its attribute byte
0334	then its X field
0339	then its tile-code byte -- one four-byte sprite entry
033e	step to the next record
0340	repeat for each record in the group
0343	take the object's sub-pixel low byte
0346	and its whole-position byte
0349	scale the 16-bit position down to a screen coordinate
0352	bias to the sprite's fixed origin
0354	write the first coordinate
0356	copy the attribute byte raw
035b	take the other axis's whole-position byte
035e	and its sub-pixel low byte
0361	scale it down the same way
036a	bias to the sprite origin
036c	write the second coordinate
036e	copy the second attribute byte raw
0373	step to the next object record
0375	repeat for all eighteen objects
0378	walk the sprite display list
037b	all 24 records
037e	reflect the first coordinate -- negate it
0380	back off by the sprite's own extent
0382	store the reflected coordinate
0385	isolate the attribute's two flip bits
0387	toggle both -- mirror the sprite's own pixels
038b	keep the colour nibble unchanged
038d	recombine colour with the toggled flip bits
0391	reflect the second coordinate
0393	back off by the sprite's extent
0397	skip the tile-code byte -- it needs no change
0398	repeat for every record
039b	paint nothing unless a game is in progress
03a0	point at the count column
03a3	stride of one tilemap row down
03a6	read the actor count
03a9	show at least one cell -- count plus one
03aa	clamp to the eight-cell column height
03ae	the clamp value
03b2	stamp a filled cell
03b4	step down one row
03b5	fill up to the count
03b9	cells left = column height minus the filled part
03ba	column full -- nothing left to erase
03bc	stamp a blank cell over the remainder
03be	step down one row
03bf	erase the rest -- clearing any taller stack from before
03c2	point at the bottom cell of the phase gauge
03c5	stride of one tilemap row up
03c8	read the phases-remaining counter
03cc	zero -- leave the bar as it is
03cd	filled cells = counter minus one
03cf	none filled -- go blank the whole bar
03d1	cap at the five available cells
03d5	clamp to five
03d9	stamp a filled segment
03db	step one row up
03dc	fill from the bottom up
03e0	cells left above the filled part
03e1	bar full -- done
03e3	stamp a blank segment
03e5	step one row up
03e6	blank up to the top of the five-cell bar
03e9	the first canned-field selector
03eb	eleven pre-authored fields
03ef	stamp one canned banner / points field
03f4	next field selector
03f5	draw all eleven attract fields
03f7	point at where the first high-score digit lands
03fa	one tilemap row down per digit
03fd	ten high-score entries
03ff	source the packed-BCD high-score table
0403	unpack a score byte -- paint its units digit
0406	paint its tens digit one row below
0407	drop to the next digit
0408	advance to the next score byte
040a	unpack the middle byte
040d	its tens digit
0411	unpack the top byte
0414	the top place is a leading zero -- suppress it
0416	otherwise paint the leading digit
0417	re-base the cursor two cells right for the next entry
041b	restore the one-row-down stride
0420	paint all ten scores as side-by-side columns
0422	paint the packed-BCD digit side panel
0425	paint the status-tile side panel
0429	read the packed-BCD byte to unpack -- tens in the high nibble, units in the low
042c	keep the whole byte -- the high nibble is recovered after the store
042d	mask to the low nibble -- the units digit
042f	paint the units digit into the current cell
0430	step the cursor to the next digit cell
0431	bring the whole byte back for its high nibble
0432	shift the high nibble down into the low four bits -- the tens digit
0436	isolate the tens digit -- zero here marks a suppressible leading zero
0442	stride of one tile-plane row down between stacked digits
0445	advance to this group's first source byte
044a	paint the first byte's tens digit
044b	step down one row
044c	lay the fixed separator tile between the two digit pairs
044e	step down another row
044f	advance to the group's second source byte
0456	paint the second byte's tens digit -- skipped when it is a leading zero
048c	write the third (bottom) cell of this panel entry
048d	advance to the next source record
048f	re-base the cursor across to the next panel column
0492	apply the re-base
0496	score-accrual handler -- BCD-add the pending award into the active score, repaint its column, promote any new high score
0506	the fixed score-award payout table -- three packed-BCD bytes per award type, low byte first
051c	score-award payouts continue here -- three packed-BCD bytes per entry
0529	more score-award payout entries -- three packed-BCD bytes each
0562	zero the counter's low byte
0565	zero the counter's middle byte
0568	zero the counter's high byte -- the score now reads zero
056a	recover the counter selector
056b	aim at player 1's score, top byte first -- the score-column painter's entry
056e	and player 1's on-screen score column
0572	which counter? test the selector
0575	selector 1 -- player 2's score, top byte
0578	and player 2's score column
057c	step the selector toward the high-score case
057f	otherwise the high score, top byte
0582	and the high-score column
058d	read the current counter byte
058e	shift its high nibble down into the low four bits -- the more-significant digit
0595	re-read the byte for its low nibble -- the less-significant digit
0599	step to the next-lower counter byte
05b2	double the field selector -- each pointer-table slot is two bytes
05b3	stash the selector -- its top bit chooses erase vs digit-paint mode
05b4	point at the field pointer table
05b7	mask to a 7-bit table index -- drop the mode bit
05bc	index the table by the field number
05bd	recover the selector for the paint mode
05be	fetch the field's record-list pointer, low byte
05c0	...and its high byte -- the head of the field's record list
05c1	point the walk cursor at the record list
05cc	read the next character of the field string
05cd	'.' marks the end of this record
05d1	'?' marks the end of the whole field
05d3	field finished -- return
05d4	char minus '0' gives the digit's tile code
05d6	stamp the digit tile
05d7	advance to the next character
05d8	step the cursor one row up -- the field stacks bottom to top
05e0	read the next character of the field string
05e1	'.' ends this record
05e5	'?' ends the whole field
05e7	field finished -- return
05e8	overwrite the cell with the blank tile -- erasing the field
05ea	advance to the next character
05eb	step the cursor one row up
05ee	credit-count handler -- select the credit field and draw it, then lay the count as two digit tiles
0600	isolate the tens nibble of the packed-BCD credit count
0604	shift the tens nibble down into the low four bits -- the tens digit
0608	write the tens digit tile to the credit display
061a	read the next byte of the ROM block being checksummed
061c	fold the byte into the running checksum
061e	count down one of the 0x1f block bytes
0621	compare the summed total against its expected value
0623	total matches -- block intact, return
0627	double to reach the fault counter at 0x8a3c
0628	checksum failed -- bump the integrity-fault counter
062a	stash the input byte -- its two nibbles convert separately
062b	isolate the low nibble (the units digit)
062f	decimal-correct the low nibble to a clean 0-9 digit
0630	hold the units digit aside
0631	reload the input for its high nibble
0632	isolate the high nibble
063a	high nibble becomes the count of sixteens to weight in
063b	clear the running decimal total
067b	clear A to mask the vblank interrupt
067c	block a re-entrant NMI while this frame's work runs
067f	point at the staged sprite display list
0682	attribute-half cursor into the sprite bank
0686	position-half cursor into the sprite bank
0689	default copy count for the first sprite group
068e	is this the busiest in-play sub-state?
0692	other states copy a single group of 0x18 records
0699	point at the target/collision sprite slots
069c	three records in this group
06a1	point at the enemy scan-box sprite entries
06a4	eleven records in this group
06a9	point at the formation-coordinate sprite slots
06ac	six records in this group
06b1	kick the watchdog timer -- the written value is immaterial, only the periodic write matters
06c6	point at this frame's P2 input cell
06c9	read the P2 control port (active-low)
06cc	invert so a pressed control reads as a set bit
06cd	store this frame's P2 controls
06d3	store this frame's P1 controls
06d5	read the coin/start/service port
06d9	store this frame's coin/start/service bits
06da	point at the scroll-worker pacing counter
06dd	tick it down one this frame
06de	point at the master per-frame clock
06e1	tick the master frame clock -- phases animations and gates the integrity checks
06ef	dispatch on the master game state into the handler table
06f0	handler table -- state 0 points at the attract setup handler
06fd	latch the flip-screen line from the orientation flag
070f	write 1 back to re-arm the vblank NMI for the next frame
0714	read the first of four source bytes for this record
0715	write it to the high attribute slot -- the attribute pair is stored swapped
0719	read the second source byte
071a	write it to the low attribute slot
071e	read the third source byte
071f	write it to the position cursor
0722	read the fourth source byte
0723	write the second position byte
0726	step the attribute cursor toward the next record
072d	one screen row = 0x20 tiles blanked this pass
0732	rows remain -- return, leaving the wipe to continue next frame
0736	gate on the boot self-test tally -- only a wholly-intact program image passes
073e	clear the in-play gate flag -- entering attract, not live play
0741	advance the master state selector to 1 -- next frame runs the attract sub-state machine
0743	clear A to rewind the play sub-state index
0747	point at the attract field colour-column source table
074d	first attract-setup redraw command
0750	queue the display command into the redraw ring
0751	second attract-setup redraw command
0755	third attract-setup redraw command (0x0502)
0758	clear A to rewind the attract sub-state to its first demo phase
0763	read the next colour byte from the source table
0764	write it into this attribute-map cell
0765	step down one row (0x20 cells) in the same column
0767	past the last map row?
076b	wrap back to the top row for the next column
076d	move into the attribute-map region of the video page
076f	advance to the next source byte
0772	column index within the row
0774	all 0x1f columns painted?
0779	attract field colour-column source data -- the table read by this loop
0799	a checksummed data block -- also the crash-landing address a failed integrity check jumps into
07d0	a data block a failed integrity check jumps into to derail the machine -- the bytes are not valid code
086a	packed data-table bytes -- read as data elsewhere, not run as code here
089c	stack the shared return address the dispatched attract handler returns through
08a0	dispatch on the attract sub-state into the jump table that follows
08a1	attract sub-state handler table
08b4	clear a hardware output latch
08bd	point at the attract sub-state selector
08c0	advance to the next attract sub-state
08c1	point at a ROM table to scan
08f8	walk to the next byte of the protected block
08f9	fold each byte into the running checksum
08fc	compare the block's checksum against its expected total (0x63) -- a mismatch spins here forever on a tampered image
0900	point at the color-source block just verified
0906	point at the second protected block (0x0831)
0909	byte count for the second checksum
090b	seed the running sum with the first byte
090c	walk to the next byte of the second protected block
090d	fold each byte into the running checksum
0910	compare against the expected total (0xaa) -- a mismatch spins back to re-verify
0917	load the first attract display command (0x0611)
091a	enqueue it onto the display-command ring
091b	swap in the second command code (0x060b)
091d	enqueue the second display command
091e	point at the attract sub-state cell
0921	jump the attract sub-state straight to 7 -- skips ahead in the show
092c	row-batch width fed to the tilemap clear -- 0x19 tiles blanked this frame
0931	rows still draining -- bail until the clear finishes on a later frame
0935	point at the attract sub-state cell
0938	advance the attract sub-state once the clear drains
093c	point at the copy-protect stall byte (0x07f5)
093f	the value an intact ROM holds there -- any other value hangs the machine
094a	the program-signature pointer table base (0x0976)
094d	index the table by the current signature counter
0951	the fixed offset (0x1c) sampled past each table pointer
0953	add the sample offset onto the fetched pointer
0957	carry the offset add into the pointer's high byte
0958	read the byte the signature pointer addresses
095a	read the expected signature byte from the walk-down block
095d	compare expected against sampled -- a mismatch traps into the table as code
0960	step down to the next expected signature byte
0964	color-source table for the attract field (0x07d9)
096a	first attract display command (0x068b)
096e	second command code (0x068e)
0971	third display command (0x0200)
0976	the program-signature pointer table -- eight little-endian pointers 0x20 apart into the protected region; a tamper mismatch above runs this data as code
0986	point at this attract step's frame-delay countdown (0x8e50)
0989	tick the delay
098a	not elapsed yet -- wait another frame
0991	point at the attract sub-state cell
0994	advance to the next attract sub-state
0995	the attract-script table base (0x0b26)
099c	start of an unreachable leftover region -- never run
0a28	reseed the animation-tick countdown -- 0x0a displayed frames between steps
0a2a	drop to the animation phase counter (0x8d40)
0a2b	read the phase before bumping -- picks the frame to draw now
0a2c	bump the phase counter for the next tick
0a2d	keep the low two bits -- the phase walks 0,1,2,3
0a2f	the four-entry table of per-phase tile artwork (0x26f6)
0a35	save the selected artwork pointer across the first paint
0a36	top on-screen copy of the 2x2 block (0x866a)
0a3c	restore the artwork pointer for the second paint
0a3d	bottom on-screen copy of the block (0x86aa)
0a40	one tilemap row is 0x20 tile codes -- the stride to drop a row
0a44	stamp the top-left cell
0a45	step right to the top-right column
0a48	stamp the top-right cell
0a49	drop straight down one tilemap row
0a4c	stamp the bottom-right cell
0a4d	step back left under the anchor
0a50	stamp the bottom-left cell -- closes the 2x2 square
0a52	start of an unreachable data/table region -- not run
0bdd	read the next reference byte for the HUD strip check
0bde	compare it against the on-screen HUD tile
0be1	step up one tilemap row in the HUD strip
0be2	advance to the next reference byte
0be4	test the reference list for its 0xff terminator -- whole strip matched
0be7	the -0x440 step back to the cross-check cell
0bec	the per-sub-state lookup table (0x20cb)
0bf2	index the table by the current sub-state
0bf4	cross-check the looked-up byte against the strip cell -- a disagreement means a tampered HUD
0c1f	test whether any credit has been banked
0c20	none banked -- stay in attract
0c21	point at the top-level game state (0x8805)
0c24	advance off attract toward the game
0c2a	start of an unreachable code/data region -- not run
0c45	double the entry index -- two bytes per word
0c48	the doubled index as the byte offset into the table
0c49	point at the requested table entry
0c4a	read the entry's low byte
0c4c	read the entry's high byte -- completes the little-endian word
0c60	pet the hardware watchdog so board setup can span frames
0c66	top-left cell of the tile region to wipe (0x8442)
0c6c	point at the fill row counter (0x8809)
0c6f	load the row budget -- 0x0f fill rows to meter out
0c71	step to the board-build sub-state index
0c72	advance to the next handler -- the fill/board-intro beat
0c7a	run length -- 0x1d (29) blank cells stamped per run
0c7c	the blank tile code (0x10) -- the empty-cell glyph
0c7e	fill one row-run with the blank tile
0c7f	the 3-cell gap skipped between the two runs -- the playfield edge margin
0c85	fill the second row-run
0c8a	point at the erase row counter (0x8809)
0c8d	tick one erase pass off the count
0c8e	rows still owed -- paint two more next frame
0c8f	step to the board-build sub-state index
0c90	advance the sub-state -- the intro build fires just this once
0c91	base of the anti-tamper checksum sweep (0x0779)
0c94	clear the running sum and the overflow tally
0c97	seed the running sum with the first ROM byte
0ce8	advance to the next byte of the 0x20-byte table being summed
0ceb	pull the folded low half back for the integrity compare
0cec	compare the running sum against its expected value 0xd3 -- a self-test over the table at 0x0b26
0cee	no-op where the mismatch branch was patched out -- a bad sum no longer acts
0cf1	expected overflow-tally value 0x0b for the second half of the check
0cf3	compare the overflow count against 0x0b
0cf4	no-op filling the second patched-out mismatch branch -- the whole self-test is inert
0d04	read the next column byte from the source table
0d05	stamp it into the current video cell
0d09	step the destination up one screen row (stride -0x20)
0d0d	peek the steering byte that follows the 12-byte column
0d0e	0xff marks the tile plane finished -- switch over to the attribute plane
0d12	0xee marks the whole two-plane stamp finished
0d14	stop once the end marker is seen
0d15	offset that jumps the destination to the top of the next column, one cell right
0d1d	reload the 12-cell column length
0d21	point the source at the attribute-plane column table (0x0d48)
0d24	aim at the attribute-plane destination cell (0x82a7)
0d2f	packed tile-code column data -- 12 bytes per vertical strip, columns back-to-back
0d4f	attribute-plane column data -- per-cell colour codes
0d5f	the 0xee byte just past here is the end-of-stamp marker that halts the copy
0d7b	test the one-player start button (bit 3 of the debounced coin/start sample)
0d80	test the two-player start button (bit 4)
0d82	neither start button of interest is down -- return
0d86	a two-player game costs two credits
0d88	can't afford both -- ignore the press
0d89	charge the two credits up front
0d8e	point at the ROM integrity table (0x776b) for the anti-tamper fold
0d93	seed the fold accumulator from the byte count
0d9b	advance to the next byte of the integrity table
0d9e	pull the folded low half back
0d9f	combine both halves of the fold
0da0	mask with the tamper pattern 0xab -- an unaltered table yields zero
0da4	point at the tamper-strike counter (0x89ea)
0da7	bump it -- the table folded wrong, so record a strike
0db5	the in-play master-state value (3)
0dba	value 1 -- opens the game-active gate and sets the normal screen orientation
0dc2	pre-play board-setup display command 0x0604
0dc5	post it -- lay out the fresh playfield
0dc9	point at the periodic-event scheduling pair (0x8d21)
0dcc	clear the wave-event latch -- nothing pending at the life's start
0dcf	reload the periodic-event timer to 0x20
0dd1	start-of-life display/sound cue 0x0400
0dd4	post it -- open the new life
0dd8	test bit 0 of the two-player flag
0dd9	one-player game -- nothing more to do
0dda	bump the cue to 0x0401, the two-player variant
0ddb	post the second-player start-of-life cue
0ddd	point at the 12-byte two-player status panel block (0x8e1f)
0de2	blank the panel so it starts empty
0e64	the sound-command ring's read/head cursor cell (0x8a41)
0e67	read the head slot index
0e69	high byte 0x8a -- the ring slots live in the 0x8a00 page
0e6b	read the command queued in the head slot
0e6c	0xff marks the slot empty
0e6e	nothing queued this beat -- return
0e73	demo-sounds DIP bit 0 -- forward sound even on the attract screens
0e7a	otherwise stay silent unless a game is in progress
0e8f	drop the command byte into the audio processor's one-byte mailbox (port 0xa100)
0e92	the high level to strobe onto the audio-interrupt line
0e94	raise the audio-interrupt line -- its rising edge wakes the audio processor to read the mailbox
0e97	no-op padding that widens the strobe enough for the audio processor to catch the edge
0e9d	drop the level back to 0 for the falling edge
0e9e	lower the audio-interrupt line to rest -- arms the next command
0eb6	hold the command byte to append
0eb7	point at the sound-command ring write cursor
0eba	read the tail -- index of the next free ring slot
0ebb	form the tail slot address from the index
0ebc	...on the shared 0x8a work page
0ebe	drop the command byte into the tail slot
0ec0	at the last ring slot?
0ec2	if so, wrap the cursor back to the first slot
0ec4	otherwise step the cursor to the next slot
0ec5	store the advanced write cursor
0ec8	wrap -- back to the first ring slot 0x43
0eca	commit the wrapped cursor
0ecf	command 0x00 -- tell the audio side to fall silent
0ed0	append it to the ring unconditionally, whatever the play state
0ed2	sound command 0x01
0ed4	hand to the play-gated appender -- queued only while a game runs
0ed6	sound command 0x02
0ed8	append to the ring unconditionally
0eda	lead byte 0x82 of the catch-scored cue
0edc	append it to the ring
0edf	follow-up byte 0x03 of the cue
0ee1	append it -- paid out to the audio side right after 0x82
0ee3	read the wave-teardown state
0ee7	bail while the enemy formation is being dismantled -- suppress 0x04
0ee8	read the rope-grab-active flag
0eec	bail while a grab is underway -- suppress 0x04
0eed	sound command 0x04
0eef	hand to the play-gated appender -- only when both are idle
0ef1	sound command 0x05
0ef3	append to the ring unconditionally
0ef5	sound command 0x06
0ef7	hand to the play-gated appender
0ef9	sound command 0x07
0efb	hand to the play-gated appender
0efd	sound command 0x08
0eff	hand to the play-gated appender
0f01	sound command 0x09
0f03	append to the ring unconditionally
0f05	sound command 0x0a
0f07	hand to the play-gated appender
0f09	preset sound 0x0b -- the coin/credit acknowledge blip
0f0b	drive the audio mailbox directly -- latched at once, skipping the ring
0f0d	sound command 0x0b
0f0f	hand to the play-gated appender
0f11	sound command 0x0c
0f13	hand to the play-gated appender
0f15	sound command 0x0d
0f17	hand to the play-gated appender
0f19	sound command 0x0e
0f1b	hand to the play-gated appender
0f1d	sound command 0x0f
0f1f	hand to the play-gated appender
0f21	lead code 0x95 of the pair
0f23	append it via the play-gated appender
0f26	follow-up code 0x10
0f28	append it -- paid out after 0x95, and only while play is live
0f2b	sound command 0x11
0f2d	hand to the play-gated appender
0f30	first code 0x95 of a three-code burst
0f32	append it via the play-gated appender
0f35	second code 0x03
0f37	append it
0f3a	third code 0x11
0f3c	append it -- burst drained one code per frame, in order, only during play
0f3f	sound command 0x12
0f41	hand to the play-gated appender
0f44	sound command 0x13
0f46	hand to the play-gated appender
0f49	sound command 0x14
0f4b	hand to the play-gated appender
0f4e	lead code 0x82 of the board-setup cue
0f50	append it to the ring unconditionally
0f53	follow-up code 0x95
0f55	append it -- both queued regardless of play state
0f58	sound command 0x96
0f5a	queue it for the audio processor -- only while a game is live
0f5d	sound command 0x97
0f62	sound command 0x18
0f64	queue it unconditionally -- even in attract
0f67	sound command 0x15
0f6c	sound command 0x19
0f71	sound command 0x15
0f76	the warning-siren enable gate
0f79	is the siren already owned elsewhere?
0f7a	yes: this producer stays silent
0f7b	the round counter
0f7e	its low bit picks the siren variant
0f80	base siren command 0x1a -- 0x1b on odd rounds
0f82	queue the siren command
0f88	the actor-spawn lead command 0x82
0f8d	the spawn voice: run led by 0x1c
0f92	end-of-phase cue: run led by 0x1d
0f97	the round counter
0f9a	shift bits 1..2 down
0f9b	keep two bits -- holds for two rounds, repeats every eight
0f9d	lead command 0x1e..0x21 by round
0fa2	the round counter
0fa5	drop bit 0, line up the variant bits
0fa6	keep the 0..3 variant selector
0fa8	lead command 0x22..0x25 by round
0fad	run led by 0x26
0fb2	sound command 0x27
0fb7	sound command 0x15
0fbc	the frame-setup run, led by 0x28
0fc1	lead command 0x29 -- then fall into the shared run
0fc3	queue the caller's lead byte
0fc6	trailer byte 0x15
0fd0	trailer byte 0x17 -- closes the run
0fd5	the main-loop phase selector
0fd8	keep the low three bits -- this frame's handler index
0fda	phases 0 and 1 run their own full frame
0fdc	skip the shared tail for those
0fde	the shared object/sprite tail
0fe1	phases 2..5 return into it
0fe2	jump through the six-entry handler table by the index
0fe3	phase 0 -- re-arm the frame
0fe5	phase 1 -- the active-play frame
0fe7	phase 2 -- delayed bonus-stage tally
0fe9	phase 3 -- repaint the HUD digit fields
0feb	phase 4 -- the hunter-spawn display
0fed	phase 5 -- dwell, then advance the round
0fef	the per-stage countdown reload
0ff1	the per-stage countdown
0ff4	re-seed it at the top of the frame
0ff5	point at the round counter
0ff7	does this round ask for the object-freeze audit?
0ffb	run the object-freeze integrity check
1000	arm the launch-flip latch
1003	arm the arrow/formation launch
1006	default the phase selector to active play
1009	queue the frame-setup sound run
100c	the pending sub-state byte
1011	anything scheduled?
1012	nothing pending: idle re-arm, done
1013	promote the pending sub-state into the selector
1016	refresh the HUD on its sixteen-frame cadence
1019	read the player's controls into the lead actor
101c	end the stage once its countdown expires
101f	run this frame's object-update passes
1022	service enemy spawns
1025	step every enemy actor's state
1028	advance the enemy formation
102b	rebuild the sprite display list
102e	run the master actor-update pipeline
1031	pay one queued sound out to the audio processor
1035	step the two target-actor records
1038	sweep every enemy actor's state
103b	advance the enemy formation
103e	rebuild the sprite display list
1044	re-arm the launch latch every frame
1047	the lead actor's record -- the player
104b	the target-actor records
104f	the lead actor's state byte
1052	is the player slot live?
1053	not live: release the controls
1055	the wave-teardown state
105b	or the secondary teardown flag
105c	paused or tearing down: release the controls
105e	the screen-flip flag -- which player's panel
1062	flipped screen: read the player-1 input port
1065	game not in play here -- skip the control read
1067	read the player control port
106a	flip the active-low port so a held control reads as a set bit
106b	stash it as the player's aim/heading byte
106e	read the actor's lock flag
1071	still between shots?
1072	leave the aim as sampled while the actor is locked
1073	otherwise drop the fire bit of the aim byte
1078	no actor here -- clear the aim byte outright
107d	read the per-stage countdown
1080	stage still running?
1081	stage still running -- nothing to do
1082	point at the play-loop sub-state selector
1085	step it out of active play into the scripted phase-complete chain
1086	the phase-1-complete display command
1089	queue it into the display ring
108c	arm the scripted-phase dwell timer to 0x40 frames
1090	point at the scripted-phase dwell timer
1094	still counting?
1095	dwell expired -- advance the script
1097	still waiting -- burn one frame
1099	point at the sub-state selector
109c	advance the script to the HUD-digit phase
109d	the bonus-stage tally display command
10a0	queue it
10a2	read the hunter-spawn subcounter (HUD field 1)
10a5	ten or more?
10a7	single digit -- draw it as is
10aa	pack the value into decimal digits first
10ad	point at field 1's video cell
10b0	paint it as a stacked two-digit field
10b3	re-read the subcounter
10b6	skip the re-centred draw when zero
10b7	zero -- skip the re-centred second draw
10b9	above eleven?
10bb	yes -- skip it too
10bd	centre the value about the middle of the 1..11 band
10c1	exactly centred: use it as is
10c3	above centre: count the mirror down
10c5	count up to the mirror point
10cb	count down to the mirror point
10d0	the mirrored value (12 minus the original)
10d1	stash it in the shared dwell cell
10d4	double it for the tile index
10d6	pack to decimal
10d9	point at the re-centred field's cell
10dc	paint it
10df	read HUD field 2's value
10e2	ten or more?
10e4	single digit -- as is
10e7	pack to decimal
10ea	point at field 2's cell
10ed	paint it
10f0	read HUD field 3's value
10f4	drawn only when nonzero
10f5	zero -- skip field 3
10f8	point at the dwell cell
10fa	fold field 3 into it
10fb	store the running total back
10fc	double field 3 for the tile index
10fe	pack to decimal, tallying hundreds
1102	the hundreds tally
1103	any hundreds?
1104	no hundreds digit
1107	paint the hundreds digit
110a	point at field 3's tens/units cell
110e	paint them
1111	point at the sub-state selector
1114	advance the script to the next phase
1115	chirp the phase sound
1119	the one-row-up stride (-0x20)
111c	keep the packed byte aside
111d	shift the tens nibble down into 0..9
1123	...into the low nibble
1125	is the tens digit zero?
1126	nonzero tens -- draw it
1128	leading zero -- use the blank tile instead
112a	stamp the tens digit
112b	step one row up
112c	recover the byte
112d	isolate the units nibble
112f	stamp the units digit above the tens
1131	start the running decimal total at zero
1132	clear the hundreds tally
1133	count up one
1135	keep it valid packed decimal
1138	each 99-to-00 rollover is a hundreds carry
1139	repeat for the whole binary count
113c	point at the shared dwell timer
1140	has the dwell elapsed?
1141	expired -- advance the script
1143	still counting -- burn a frame
1144	the hunter-spawn display command
1147	keep it flowing while the timer runs
1149	reseed the dwell timer for the next state
114b	point at the sub-state selector
114d	advance to sub-state 5
114f	point at the dwell timer
1153	dwell elapsed?
1154	expired -- do the hand-off
1156	still counting -- burn a frame
1159	point at the sub-state scratch block
115b	nine bytes
115d	wipe it, resetting the play-loop sub-state machine
115e	silence the sound
1163	step the in-play sub-state to phase 6
1166	point at the enemy-spawn gate cell
1169	read the spawn accumulator
116c	combined with the gate
116d	both zero -- a quiescent machine?
116e	nothing to spawn -- done
116f	otherwise seed a fresh hunter
1171	point at the enemy spawn-cadence timer
1175	is the spawn timer still running
1176	cadence expired -- consider a spawn
1178	still counting -- age the cadence
1179	not a spawn frame -- leave
117a	read the stage countdown
117d	point at the active-enemy count
117f	how many more this stage may hold
1180	at the cap -- no spawn
1181	over the cap -- no spawn
1183	the current active-enemy count
1184	already six on screen?
1186	pool full -- no spawn
1187	point at the enemy pool
118b	six records to scan
118d	the spawn entry Y seed
118f	try to claim this record
1192	record stride
1195	next record
1197	scan the pool
119a	read the record's liveness header
119d	either header byte
11a0	test the live bit
11a1	already live -- skip this slot
11a3	mark the slot live
11a7	seat its opening state index
11ab	plant the seed Y
11af	clear the fine position
11b2	clear the sub-position
11b5	clear the coarse counter
11b8	clear the just-advanced latch
11bb	seed the facing byte
11bf	clear the paced-spawn field
11c2	the per-round velocity table
11c5	read the round counter
11c8	keep the low six bits -- a slow-cycling index
11ca	four rounds share one entry
11ce	clamp it to the table length
11d0	look up this round's descent velocity
11d1	store the marching velocity
11d4	its negation
11d6	store the per-frame step
11d9	the enemy's four-frame animation
11dc	arm it, rewound to frame 0
11df	the per-round spawn-cadence table
11e2	read the round counter
11e7	index by round
11eb	look up the cadence reload
11ec	reseed the spawn-cadence timer
11ef	the cumulative hunter-spawn count
11f2	tally this spawn
11f3	the per-wave active-enemy count
11f6	bump it
11f7	unwind an extra frame to end the pool scan
11f9	per-round spawn-cadence reload values -- looser early, tighter later
1209	per-round enemy descent speeds -- climb with the round
1219	point at the enemy pool
121d	record stride
1220	fourteen records
1223	step this record's state machine
1227	next record
1229	sweep the whole pool
122c	read the record's liveness header
122f	either byte
1232	test the live bit
1233	dormant slot -- nothing to run
1234	read the record's state index
1237	keep the state index
1239	past the seventeen behaviours?
123b	out of range -- skip
123c	jump to the handler for this state
123d	enemy state-handler table -- one address per sub-state
125f	burn one frame off the phase timer
1262	still settling -- wait
1263	promote the actor to the next phase
1266	the descent/settle animation
1269	raise the just-advanced latch
126d	restart the animation for the new phase
1270	step this object's animation
1273	the per-frame step
1276	its magnitude
1279	the fine sub-position
127c	would this step carry past zero?
127d	not yet
127f	spend one off the coarse lifetime counter
1282	advance the sub-position by the step
1285	store it back
1288	the coarse counter
128b	has it reached the end
128c	still travelling -- done
128d	journey over -- blank the object's sprite band
1290	the on-screen enemy tally
1293	one fewer enemy
1294	the per-stage countdown
1299	any budget left
129a	none -- skip the spend
129c	tick the stage toward zero
129d	read the in-play sub-state
12a0	in the active-play state?
12a4	point at the spawn-phase counter
12a5	bump it
12a6	the pre-tick stage value
12a8	fits one decimal digit?
12aa	no -- leave the HUD digit
12ab	update the stage-countdown HUD digit
12af	step this actor's animation
12b2	read the just-advanced latch
12b6	already committed -- just move it
12b9	the fine position
12bc	advance by the marching velocity
12bf	no column crossing
12c1	carry into the coarse column
12c4	store the fine position
12c8	read the stage countdown
12cb	stage almost over?
12cd	near the end -- route to the spawn cadence
12d0	the round schedule table
12d3	read the round counter
12d8	four rounds share one schedule
12dc	fetch this round's target-column row
12e0	the animation frame counter
12e3	its low nibble
12e5	picks the target column for this frame
12e6	keep the target column
12e7	the actor's own column
12ea	reached the scheduled column?
12eb	exactly there -- drop a companion object
12ee	already well past it?
12f0	not far enough yet -- keep travelling
12f1	mark the actor done spawning
12f5	the arrival animation
12f8	switch it to its arrival look
12fb	per-round spawn-schedule row pointers
130b	spawn-schedule columns -- where along its run an enemy drops a child
1383	the scheduled value
1384	inside the valid range?
1386	out of range -- no spawn
1387	in range -- spawn the companion
1389	does this actor have queue work pending?
138d	no -- leave it
138e	yes -- run the animation-restart step
1391	actor already committed to arriving?
1395	yes -- do nothing
1396	no -- run the per-frame spawn schedule
1399	read the actor's growth sub-state
139c	still coming into existence?
139e	yes -- to the spawn-step guard
13a0	fully grown?
13a2	yes -- to the schedule dispatch
13a4	the shared spawn-step timer
13a8	still pacing
13a9	elapsed -- emit a child
13ab	still pacing -- burn a frame
13ac	not yet
13ad	the latched step count
13ae	supply spent?
13b0	yes -- decline the spawn
13b1	keep the delay-timer pointer aside
13b2	the per-round reload table
13b5	read the round counter
13ba	look up this round's spawn beat
13bb	reload the spawn-step timer
13bc	point at the sprite-object pool
13c0	record stride
13c3	five slots
13c5	read a slot's liveness header
13c8	either byte
13cb	test the live bit
13cc	free slot found
13ce	next slot
13d0	scan the pool
13d2	no free slot -- give up
13d3	per-round drop-delay values
13db	the animation-frame counter
13de	advance it for a fresh id
13e1	skip zero
13e2	take it as the new collision id
13e3	stamp it on the parent
13e6	the parent's animation script
13e9	point the parent at it
13ef	rewind its frame hold
13f3	seed the parent's frame-delay pacer
13f7	set the parent's arrival state
13fb	build the child in the free slot
13fe	the per-frame velocity
1401	its magnitude
1404	the fine position
1407	would the step wrap past zero?
140a	spend one off the lap counter
140d	advance the position by the velocity
1410	commit it (also the cadence path's count)
1413	carry the same value as the count
1414	read the stage countdown
1417	stage almost over?
1419	near the end -- to the spawn cadence
141c	read the actor's phase byte
141f	past its opening moments?
1421	settled -- keep its current animation
1422	clear the queue-work flag
1426	the actor's four-frame animation
1429	restart it from frame 0
142c	mark the child slot live
1430	seat its entry state
1434	give it the parent's collision id
1438	clear its facing byte
143b	clear its frame hold
143e	the parent's fine X
1441	offset to the child's spawn X
1443	plant it
1446	the parent's fine position
1449	offset half a cell
144b	plant the child's
144e	the parent's Y
1451	one row up
1453	plant the child's Y
1456	the parent's column
1459	one over
145b	plant the child's column
145e	read the speed index
1461	clamp below eight
1465	clamp it
1467	the speed-to-velocity table
146a	look up the marching velocity
146b	read the round counter
146e	odd or even round?
1470	the velocity magnitude
1473	flip its direction on odd rounds
1475	give the child its velocity
1478	match the parent's
147b	the child's animation
147e	store the paired step
1481	point the child at its script
1487	seed its frame-delay pacer
148b	arm the child's animation
148e	child launch-speed table -- one per difficulty step
1496	step this object's animation
1499	the per-frame step
149c	its magnitude
149f	the fine position
14a2	would the step wrap past zero?
14a5	spend one lap as it climbs
14a8	walk the position up by the step
14ab	store it
14ae	the lap counter
14b1	read the object's active flag
14b5	inactive -- consider arming a drop
14b8	climbed enough laps?
14ba	yes -- settle
14bc	still rising -- keep going
14bf	still rising
14c0	clear the sub-state
14c4	reseed its timer -- back to the idle look
14ca	climbed enough for an inactive object?
14cc	not yet -- keep rising
14cd	the drop animation
14d0	arm it
14d3	enter the drop sub-state
14d7	seed its timer
14de	read the object's score/prize value
14e1	the special-target flag
14e5	ordinary object -- skip the bonus math
14e7	the object's bonus index
14eb	empty slot -- skip the tally
14ed	clamp the level to five
14f1	clamp the index
14f6	level one -- value stays one
14fa	one shifted left by the index -- the bonus value
14fc	shift up by the level
14fe	the HUD field 3 accumulator
1501	add this bonus in
1502	store the total
1503	point at field 2's source
1505	bump it
1506	the animation-hold length
1508	seed the object's frame delay
150c	the object's shape table
150f	fetch its shape
1512	arm the animation
1515	advance the object's state
1518	step the animation
151b	burn a frame off the delay
151e	still waiting
151f	the HUD field 3 total
1522	double for the tile index
1525	is there anything to show
1526	nothing to draw
1528	pack to decimal, tallying hundreds
152c	the hundreds tally
152d	any hundreds digit
152e	no hundreds
1530	paint the hundreds digit
1533	point at the score field cell
1537	paint the tens/units
153a	read the object's stage index
153d	final stage?
153f	yes -- to the completion path
1543	advance the stage index
1546	seed a one-frame delay
154a	advance the object's state
154d	step the death animation
1550	burn a frame off the retire timer
1553	still dying -- wait
1554	timer up -- blank the record and free the slot
1557	state-8 animation-script table with embedded turn/blank scripts
1583	the HUD-refresh tick
1586	advance it each frame
1589	every sixteenth frame?
158b	not yet
158c	which half of the count
158e	the HUD-refresh command
1593	the alternate refresh command
1595	queue the HUD repaint
1596	read the ROM-tamper strike counter
1599	any strikes recorded
159a	clean image -- done
159b	tick the active player's play timer
159e	the end-of-life housekeeping step
15a1	queue it to run after the sub-state
15a2	read the in-play sub-state index
15a5	low five bits
15a7	jump to this sub-state's handler
15a8	in-play sub-state handler table -- one entry per round phase
15d1	read the game-active flag
15d4	still playing
15d5	still in play -- stay
15d6	read the slot-1 coinage
15d9	free play?
15db	yes -- to the attract epilogue
15de	read the credit count
15e1	any credit
15e2	no credit -- park out of play
15e3	the master game state
15e6	drop to board-build
15e8	the in-play sub-state
15ea	reset it
15ec	re-init the board and HUD RAM
15ef	zero the sprite list and actor arena
15f2	the reset attribute column
15f5	one row up per cell
15f8	eight tiles
15fa	the blank tile
15fc	blank the cell
15fe	clear the column
1601	run the row-by-row tile fill
1604	still painting in -- wait
1605	re-arm the fill cursor
1608	wipe the actor arena
160c	clear the wave-event latch
160f	the round-init RAM block
1614	clear it
1615	the round-script scratch block
161a	clear it too
161b	clear a launch scratch cell
1621	read the two-player flag
1627	one player -- skip the cosmetic setup
1629	the once-per-round latch
162d	already done this round -- skip
1630	arm the once-per-round latch
1633	read the cabinet type
1637	read the active player
163a	upright cabinet
163c	cocktail -- face this player's side
163d	set the flip-screen flag
1643	the player-select banner sound
1649	the second-player variant
164a	queue it
164b	the player-select banner tiles
164e	paint the banner
1653	seed the phase timer
1656	the in-play sub-state
1659	advance to the next setup phase
165a	read the active player
165d	player 0's saved bank
1660	the live round page
1663	0x3f bytes
1667	player 0 selected
1669	player 1's saved bank instead
166c	restore this player's saved state into the live page
166e	read the wave-arrival counter
1674	two fewer
1676	set the rope-segment count for the wave
1679	a round-init gate cell
167d	not ready -- wait
167e	clear it
1684	the round message source
1687	the display message buffer
168a	read a message byte
168b	terminator?
168d	message copied -- done
168e	store it
1691	copy the round message
1694	the round message source
1697	the display message buffer
169a	read a source byte
169b	terminator?
169d	matched -- clear the buffer
169f	still matching the buffer?
16a0	mismatch -- select the round display list
16a4	compare on
16a6	the message buffer
16aa	seven bytes
16ac	clear it
16b7	the phase timer
16ba	tick it
16bb	still counting -- wait
16bc	re-arm the tile fill
16bf	queue the round-intro fanfare
16c2	read the play-mode latch
16c7	ordinary round
16cb	bonus path -- jump to sub-state 16
16d0	clear the intro sub-phase tick
16d3	refresh the score HUD
16d6	read the play-mode latch
16da	ordinary round
16dc	read the round counter
16e3	one bonus-intro image
16e9	go seat the pointers
16eb	the other bonus-intro image
16f1	go seat the pointers
16f3	read the round-in-progress flag
16f7	mid-round -- resume image
16f9	read the game-active flag
16ff	read the round counter
1702	odd round?
1704	the odd first-round image
170a	go seat the pointers
170d	the even first-round image
1713	go seat the pointers
1715	read the round counter
1718	odd round?
171a	the odd resume image
1720	go seat the pointers
1722	the even resume image
1728	record the image's end
172c	record the image source
172f	its tilemap destination
1732	record it
1735	its colour-plane destination
1738	record it
173d	seed the spawn-cadence timer
1740	the in-play sub-state
1743	advance to the intro-delay phase
1744	the round-start sound
1747	queue it
1748	prime the round message compare
175d	re-run the display-list interpreter -- keep the intro on screen
1760	the intro sub-phase tick
1763	advance it
1765	reached the wrap point?
1767	not yet -- hold
1768	reset the tick
176a	the two-wrap one-shot
176e	count this wrap
1770	first wrap -- wait for the second
1772	clear the one-shot
1773	read the play-mode latch
1777	bonus path -- straight to active play
1779	read the round-in-progress flag
177d	mid-round -- skip level start
177f	read the game-active flag
1783	fresh game -- begin the level
1785	read the round counter
1788	odd round?
178c	re-read it
1790	nonzero -- begin the level
1794	arm the deeper level-intro branch
179a	mark the round under way
179e	seat the wave-arrival counter
17a1	paint the ROUND-N HUD
17a4	draw the phase gauge
17a7	lay out the level furniture
17ac	seed a per-level timer
17af	seed the two-tile animation hold
17b2	seed the rope-draw step timer
17b5	build the spawn setup
17b8	rebuild the sprite list
17bb	the in-play sub-state
17be	enter active play
17c1	point at the player/lead-actor slot
17c5	read the play-mode latch
17c9	the bonus-stage seed table
17cc	bonus path
17ce	read the round counter
17d1	odd round?
17d3	the odd-round seed row
17d8	the even-round seed row
17dd	seat the tile-animation cursor
17e1	record stride
17e4	four player records
17e6	mark the record live
17ea	the seed Y
17eb	plant it
17ef	the seed column
17f0	plant it
17f4	next record
17f6	seed all four
17f8	back to the lead slot
17fc	read the flip-screen flag
1800	upright
1802	cocktail -- nudge the column
1808	the shared idle animation script
180b	seat the animation cursor
180e	advance the four actors' animation
1811	read the play-mode latch
1815	bonus path -- build the eagle wave
1817	read the game-active flag
181d	the demo/attract marker
1826	jump to the high-score-entry teardown
1829	the in-play sub-state
182c	advance to wave spawn
182d	the wave-spawn message source
1830	the display message buffer
1833	read a byte
1834	terminator?
1836	copied -- done
1837	de-bias the tile code
1839	store it
183c	copy the message
1848	read the round counter
184d	no wave this round
184f	re-read the round
1854	cap the wave size
1858	clamp the count
1860	keep the low two bits of the requested group size
1863	wave size grows with the round
1865	record it
1869	the wave-shape table
186c	fetch this round's shape
1870	point at the enemy pool
1874	the wave size
187a	seed the enemy's fine position
187e	mark it live
1882	seat its coarse counter
1886	plant its Y
1889	spread the wave across columns
188a	take the low nibble of the packed position
188c	fold it into the row byte
188f	take the high nibble of the packed position
1891	add it to the running column accumulator
1893	plant its fine position
1896	no carry -> skip the row bump
1898	carry -> advance to the next row
189c	the enemy animation
189f	arm it
18a2	record stride
18a5	next slot
18a7	seed the whole wave
18a9	the in-play sub-state
18ac	advance to the post-spawn state
18af	sample the joystick into the player's aim
18b2	run player movement
18b5	advance the lead actor
18b8	update the rope/launch pipeline
18bb	step the enemy actors
18be	step the projectiles
18c1	rebuild the sprite list
18c4	service the bonus-award tally
18c7	pick the next wave's speed
18ca	run collisions
18cd	arm and tick the warning siren
18d0	refresh the round/stage HUD
18d3	drive the score HUD
18d6	tick the idle siren
18da	read the award milestone (packed decimal)
18de	queue empty -- reload it
18e0	hold the queued amount
18e1	read the active player
18e4	player 1's score high byte
18e8	player 0 active
18ea	player 2's score high byte instead
18ed	the active score's high byte
18ee	reached the milestone?
18ef	not yet
18f0	the phase-gauge counter
18f4	already at the cap
18f8	saturating-bump the gauge -- the extra-life award
18f9	read the bonus-award switch
18fd	the generous milestone step
1901	the tighter step
1902	advance the milestone
1903	keep it packed decimal
1904	store the next milestone
1907	refresh the score HUD
190a	play the tally sound
190e	read the bonus-award switch
1912	the generous first milestone
1916	the tighter first milestone
1918	seed the award queue
191c	read the stage countdown
1920	wave still running -- wait
1921	read the lead actor's state
1925	lead actor busy -- wait
1926	the first enemy's state byte
1929	record stride
192c	six enemies
192e	the busy phase
1930	any enemy still busy?
1931	yes -- hold off
1932	next enemy
1933	scan them all
1935	the in-play sub-state
1938	advance the wave sequencer
1939	read the round counter
193c	odd round?
193e	odd round -> take the simpler ramp
1940	half the round
1943	the difficulty base
1946	plus the round term
1948	the wave-arrival counter
194b	even rounds fold in waves arrived
194d	hit the speed ceiling?
1951	pin to the maximum speed
1955	odd round: start from the round number
1956	the difficulty base
1959	plus the round -- odd rounds
195a	hit the ceiling?
195e	pin to the maximum
1960	commit the speed index
1964	clear the player's aim flags
1967	clear the wave scratch
196e	read the siren busy latch
1972	already claimed this round
1973	read the spawn-phase counter
1976	attack phase?
1978	below five -- just tick the countdown
197a	exactly five -- arm the siren
197c	above five -- claim the siren for the round
197f	read the grab-active flag
1983	grab in progress -> skip the sound
1985	fire the higher-phase siren sound
198a	read the grab-active flag
198e	grab in progress -> skip
1990	the siren-enable gate
1994	already armed?
1995	already enabled
1997	enable the siren
1999	step to the siren frame countdown
199b	arm the second siren cell
199d	fire the phase-five siren sound
19a0	read the wave-event latch
19a4	already fired this wave
19a5	the wave-teardown flag
19a9	wave tearing down -- skip
19aa	the periodic-event timer
19af	expired -- re-fire
19b1	age it
19b3	reload the 0x20-frame period
19b5	step back to the wave-event latch
19b6	latch the wave event
19b8	fire the siren-tile run
19bc	the actor arena
19c2	0x200 bytes
19c5	seed the first byte to zero
19c7	propagate zero across the whole arena
19ca	read the game-active flag
19ce	a game is running -- silent
19cf	read the siren-enable gate
19d3	siren disabled -- nothing
19d4	the siren toggle countdown
19d7	tick it
19d8	not time to toggle
19d9	reload the 0x18-frame period
19db	point at the siren phase byte
19dc	which note is current?
19de	currently high -> drop it
19e0	flip to the up note
19e2	its sound command
19e5	queue it
19e7	flip to the down note
19e9	its sound command
19ec	queue it
19ee	update the formation and playfield
19f1	advance the actors
19f4	step the enemy actors
19f7	step the projectiles
19fa	run the lead-actor secondary state
19fd	rebuild the sprite list
1a01	clear the board's per-round scratch
1a04	reset the spawn-phase counter
1a07	reset the rope-draw count
1a0a	the default stage seed
1a0c	read the round counter
1a0f	round one?
1a11	round 2 or higher -> keep 0x30
1a13	shorter first stage
1a15	the stage countdown
1a18	seat it
1a19	point at the round counter
1a1b	advance the round
1a1d	odd result?
1a1f	odd -- let the round run
1a21	read the game-active flag
1a25	no game -- cold return to attract
1a28	read the play-mode latch
1a2c	already armed -- clear the display list
1a2e	undo the round bump
1a31	latch the bonus play-mode
1a34	seed the stage countdown
1a39	seed the bonus-intro timer
1a3f	the display-list block
1a44	clear it
1a47	point at a colour-plane cell
1a49	clear it
1a4b	player 0's saved bank
1a4e	the live round page
1a51	0x3f bytes
1a54	read the active player
1a5a	player 1's bank instead
1a5d	park the live page into this player's bank
1a60	reset the in-play sub-state
1a64	read the play-mode latch
1a68	bonus path -- reseed counters
1a6a	silence the sound
1a6d	clear the board scratch
1a71	clear the once-per-round latch
1a74	read the game-active flag
1a78	no game -- cold return to attract
1a7b	the phase-gauge counter
1a80	gauge empty -- to high-score insert
1a82	drain one phase
1a83	just emptied -- to high-score insert
1a85	refresh the score HUD
1a88	sub-state 10 (gauge drain)
1a8a	read the active player
1a90	player 2's variant
1a91	store the computed sub-state index
1a92	set the in-play sub-state
1a96	queue the round-clear sound
1a99	the in-play sub-state
1a9c	read the active player
1aa2	player 2's variant
1aa3	advance the sub-state
1aa5	clear the high-score insert rank
1aa8	clear the rope-segment count
1aab	clear the marker layout pointer
1aae	insert this score into the high-score table
1ab2	ten entries of three bytes each
1ab6	three-byte score stride
1ab9	player 1's score buffer
1abd	read the active player
1ac3	player 2's buffer instead
1ac5	the top of the high-score table
1ac9	the score's high byte
1acc	compare against this rank
1acf	differs -> decide by this byte
1ad1	the middle byte
1ad4	on a tie, compare it
1ad9	the low byte
1adc	and the low byte
1adf	beats this rank -- insert here
1ae1	next rank down
1ae3	count the rank
1ae4	three bytes per entry
1ae7	beat none of the ten -- no place
1ae8	keep scanning
1aea	the winning rank
1aec	record it
1af1	the table tail
1af7	slide the lower entries down one rank
1afa	the new low byte
1afd	write it in
1b00	the middle byte
1b03	write it
1b06	the high byte
1b09	write it
1b0e	the play-time side table
1b12	the active play-timer
1b15	read the active player
1b1b	player 2's play-time slot
1b20	seed the play-time gate marker
1b24	shift the paired time table down
1b27	slide the play-time entries down
1b29	copy the finishing time
1b31	record this game's length
1b33	the panel-tile side table
1b39	slide its entries down
1b3d	the blank tile
1b3f	three cells
1b41	clear the new entry's panel cells
1b43	run the row-by-row tile fill
1b46	still painting -- wait
1b47	re-arm the fill cursor
1b4a	queue a screen-text draw
1b4d	paint the field furniture
1b50	a display command
1b53	queue it
1b54	send sound 2
1b56	queue the redraw
1b57	run the integrity/timer pass
1b5c	advance to the high-score-entry sub-state
1b60	clear the phase timer
1b63	a program block to fold
1b69	read a byte
1b6a	mask it
1b6d	fold into the running sum
1b70	over the whole block
1b72	does the fold match?
1b74	clean -- skip
1b76	the tamper-freeze flag
1b79	corrupted image -- trip it
1b7a	the ROM banner string
1b7d	the tile buffer
1b80	read a character
1b81	terminator?
1b83	copied -- done
1b84	bias it into a tile code
1b86	store it
1b89	copy the banner
1b8c	run the tile fill
1b8f	still painting -- wait
1b90	queue a screen-text draw
1b93	paint the field furniture
1b96	a display command
1b99	queue it
1b9a	send sound 3
1b9c	queue the redraw
1b9d	run the integrity/timer pass
1ba2	advance to high-score entry
1ba7	seed the phase timer
1bab	read the two-player flag
1baf	one player -- just save
1bb1	player 1's lives
1bb5	player 1 out -- just save
1bb9	hand the turn to player 1
1bbc	player 0's bank
1bbf	the live page
1bc2	0x3f bytes
1bc5	park the live page into player 0's bank
1bc8	reset the in-play sub-state
1bcc	player 0's lives
1bd0	no -> keep the current player
1bd3	mark player 0 active
1bd6	player 1's bank
1bd9	the live page
1bdc	0x3f bytes
1bdf	park the live page into player 1's bank
1be2	reset the in-play sub-state
1be5	a program block to fold
1bea	read a byte
1beb	mask it
1bed	fold into the running sum
1bf1	carry the high byte
1bf3	over the block
1bf7	does the low fold match?
1bf8	no -- trip the tamper counter
1bfc	and the high fold?
1bfd	both match -- clean
1bfe	the tamper counter
1c01	corrupted -- bump it
1c03	the phase timer
1c06	tick it
1c07	still counting
1c08	a panel-render selector
1c0a	stage a panel field
1c0f	stage another
1c14	and another
1c17	queue a screen-text draw
1c1a	paint the high-score-entry furniture
1c1d	refresh the panel
1c20	the name-entry sound
1c23	queue it
1c24	the in-play sub-state
1c27	advance to the round-end decision
1c29	read the insert rank
1c2d	no high score earned -- done
1c2e	the entry cursor's colour cell
1c32	step to the earned rank's column
1c36	record the entry cell
1c39	prime the name entry
1c3c	the name-entry index
1c3f	seed it
1c41	the initials prompt string
1c44	the display message buffer
1c47	read a byte
1c48	terminator?
1c4a	copied -- done
1c4b	de-bias the tile code
1c4d	store it
1c50	copy the prompt
1c53	read the round counter
1c56	odd round?
1c58	yes -> its alternate board build
1c5a	run the even-round name-entry frame
1c5f	run the odd-round name-entry frame
1c62	rebuild the sprite list
1c66	the phase timer
1c69	tick it
1c6a	read the reset-scan latch
1c6e	not armed -- animate the wipe
1c70	the phase timer
1c72	armed and expired -- commit the transition
1c74	run the name-entry pre-pass
1c77	read the insert rank
1c7b	no entry active -- done
1c7c	the phase timer
1c7f	one frame in eight?
1c81	not yet
1c82	the wipe fill tile
1c85	the wipe column cell
1c88	one row down per cell
1c8b	0x1c cells
1c8d	stamp the shimmer tile
1c8e	step down one row
1c8f	down the column
1c91	step the fill tile
1c92	past the last animated tile?
1c96	wrap it
1c98	store the next fill tile
1c9c	the reset attribute column
1c9f	one row up per cell
1ca2	eight tiles
1ca4	the blank tile
1ca6	blank the cell
1ca7	climb one row up
1ca8	clear the column
1caa	a program block to fold
1cb3	read a byte
1cb4	fold into the sum
1cb6	next cell
1cb7	over the block
1cba	does the checksum match?
1cbc	no -- abort the transition
1cbd	clear the reset-scan latch
1cbe	disarm the reset-scan latch
1cc1	read the two-player flag
1cc5	one player -- reseed in place
1cc7	read the active player
1ccb	player 0 finished -- hand to player 1
1ccd	player 0's lives
1cd1	player 0 out -- reseed in place
1cd4	make player 0 active
1cd7	restart the sub-state sequence
1cda	player 1's saved bank
1cdf	wipe it
1ce0	the fill left A zero -- one
1ce1	set upright orientation
1ce4	re-arm the tile fill
1ce7	the first scroll column's cell
1cea	cap it
1cec	one row up per cell
1cef	step up a row
1cf0	a body tile
1cf2	step up another row
1cf3	the other body tile
1cf6	player 1's lives
1cfa	player 1 out -- reseed in place
1cfd	restart the sub-state sequence
1d00	player 0's saved bank
1d05	wipe it
1d06	the fill left A zero -- one
1d07	make player 1 active
1d0a	re-arm the tile fill
1d0d	the second scroll column's cell
1d10	cap it
1d12	stamp its two body tiles
1d15	clear the whole live state page
1d16	the live round page
1d1b	wipe the player's working state
1d1c	read the two-player flag
1d20	one player -- stamp the second column
1d23	two players -- stamp the first column
1d26	read the credit count
1d2a	no credit -- cold return to attract
1d2d	clear the game-active flag
1d30	reset the sub-state
1d33	one -- restore normal upright orientation
1d34	set upright orientation
1d37	two -- the board-build state
1d38	drop to board-build for the next board
1d3c	clear the in-play gate
1d3d	clear the game-active flag
1d40	reset the in-play sub-state
1d43	clear the active player
1d46	clear the two-player flag
1d49	reset the attract sub-state
1d4d	hand the top level to the attract machine
1d50	set upright orientation
1d53	mark the demo running
1d56	zero the sprite list and arena
1d59	silence the sound
1d5c	the attract banner string
1d5f	the display message buffer
1d62	read a byte
1d63	terminator?
1d65	copied -- done
1d66	de-bias the tile code
1d68	store it
1d69	advance the source
1d6a	advance the buffer
1d6b	copy the banner
1d6e	the bonus-intro timer
1d71	the pre-decrement value drives the branch
1d72	tick it
1d73	at the mid-point?
1d75	not the first tick -- hold or expire
1d77	stage the bonus banner
1d7a	the bonus fanfare
1d7d	queue it
1d7e	chirp
1d83	still counting
1d84	reset the sub-state
1d87	the play-mode latch
1d89	arm the bonus round
1d8b	the spawn-cadence timer
1d8e	seed it
1d90	read the round counter
1d93	test round bit 1
1d95	set -> return
1d98	set the bonus-stage marker
1d9c	read the round counter
1d9f	test round bit 1
1da1	set -- run the level-intro path
1da3	run the ordinary-round variant
1da7	run the bonus-round variant
1daa	a program block to sample
1db2	-- the fixed program cell the probe re-reads
1db3	expect 0x20 of each
1db6	clear the tally
1db7	sample one bit
1dbb	tally it
1dbc	sample another bit
1dc0	tally it
1dc1	over the block
1dc3	does the tally match?
1dc4	clean -- done
1dc7	mismatch -- trip a tamper flag
1dd3	read the round-in-progress flag
1dd7	the round counter
1dda	mid-round
1ddc	read the game-active flag
1de0	yes -> draw the plain tag
1de2	the round counter
1de3	odd round?
1de5	odd -- the alternate job is eligible
1de8	round zero?
1de9	round zero -> alternate tag
1deb	the round counter
1dec	odd or even?
1dee	one fanfare
1df3	the other fanfare
1df6	paint the intro tiles
1df9	a fill value
1dfb	a colour-plane column
1dfe	one row down
1e01	four cells
1e03	flood it
1e04	next row down
1e05	down the column
1e07	the neighbouring column
1e0c	flood it too
1e0d	next row down
1e0e	down four rows
1e11	read the play-mode latch
1e15	bonus path
1e17	draw the special round tag
1e1a	paint the resume tiles
1e1d	a colour-plane column
1e20	one row down
1e23	sixteen cells
1e25	a fill value
1e27	flood it
1e28	next row down
1e29	down the column
1e55	the board-clear flag
1e5a	step to the object-freeze flag
1e5c	point at a tamper strike counter
1e5e	board being cleared or tampered?
1e60	the player/lead-actor slot
1e64	yes -- freeze the aim
1e66	read the game-active flag
1e6a	no game -- nothing to read
1e6b	the target-actor record
1e6f	the player's state
1e73	busy -- freeze the aim
1e75	the wave-teardown flag
1e7b	tearing down?
1e7c	yes -- freeze the aim
1e7e	read the flip-screen flag
1e82	player 1's control port
1e85	upright
1e87	player 2's control port (cocktail)
1e8a	flip the active-low port
1e8b	store it as the aim/heading byte
1e8e	shift the fire bit up
1e90	lift the aim bit toward the carry
1e91	the fire edge-detect cell
1e94	shift the fresh aim-bit sample out into carry
1e95	rotate the fire history
1e98	last three fire samples
1e9a	a fresh press?
1e9c	yes -- leave the fire bit set
1e9d	otherwise clear the fire bit
1ea2	frozen -- clear the aim byte
1ead	read the tamper-freeze flag
1eb1	tampered -- skip the HUD setup
1eb3	the round-frame column
1eb6	its fixed tile source
1eb9	one row up per cell
1ebc	read a frame tile
1ebd	stamp it
1ebe	advance the source
1ebf	climb one row up -- the field paints bottom-up
1ec0	reached the blank cap?
1ec2	lay out the frame
1ec4	read the round counter
1ec7	round number is one higher
1eca	convert to decimal by counting up
1ecc	decimal-adjust -- count up in packed BCD
1ecd	round+1 counts -- the round as two BCD digits
1ecf	keep the packed round number
1ed2	the tens digit
1ed8	isolate the tens digit
1eda	its tile cell
1ede	nonzero?
1ee0	blank a leading zero
1ee2	stamp the tens digit
1ee3	recover the BCD round
1ee4	the units digit
1ee6	its tile cell
1ee9	stamp it
1eeb	the tens again
1ef1	shift down to the tens digit
1ef3	odd or even round?
1ef5	the selector-glyph table
1ef8	pick the glyph
1efb	its destination
1efe	stamp it
1f01	the round-number HUD field
1f04	blit the round glyph block
1f07	recover the BCD round once more
1f09	the units digit
1f0b	stash it for the label
1f0e	stamp the round-marker glyph
1f11	refresh the round/stage HUD
1f14	refresh the timer readout
1f18	the tamper-flag slots
1f1b	seven of them
1f1d	read one
1f1f	any armed?
1f20	tampered -- skip the refresh
1f21	check them all
1f23	reset the tens count
1f25	point at the stage countdown
1f27	the stage countdown
1f28	divide by ten
1f2a	underflow -> done
1f2c	count the tens
1f2d	repeat
1f2f	the once-per-level marker
1f33	already drawn this level
1f35	the stage countdown
1f38	still in the first stretch?
1f3a	yes -- mark it done
1f3c	the stage-boundary table
1f41	at a stage boundary?
1f42	yes -- redraw the stage label
1f44	no -> next threshold
1f46	scan the boundaries
1f48	none matched -> return
1f49	latch the level tag as done
1f4b	set the once-per-level marker
1f4e	the stage index
1f4f	milestone index nonzero?
1f50	not the first stage -- just the label
1f52	read the round counter
1f55	round number is one higher
1f59	convert to decimal
1f5b	decimal-adjust -- count up in packed BCD
1f5c	the round as two BCD digits
1f5e	one round-glyph row
1f61	test the tens bit
1f63	set -> tens tile source
1f65	the other row
1f68	the round-number field
1f6b	blit the round glyph block
1f6e	the blank tile
1f72	clear the trailing cells
1f73	the stage countdown
1f76	mirror it to the stage-digit cell
1f7a	the stage-label table
1f7d	pick the label by stage
1f80	its HUD cell
1f83	blit the stage-label block
1f8c	four rows
1f8e	hold the row count
1f90	three columns
1f92	read a source tile
1f93	stamp it
1f94	next column
1f95	advance the source
1f96	across the row
1f9a	drop to the next screen row
1f9b	the row count
1f9d	next block
1f9e	all four rows done
1f9f	keep the row count
1fa1	next row
1fe2	tail tile codes of the round-number digit-glyph table (0x1fda)
1fe7	tile codes of the alternate round-number digit-glyph table (0x1fe6)
1ffc	test the glyph selector bit
1ffe	glyph table A
2001	bit clear -- use A
2003	glyph table B
2006	its destination cell
2009	stamp the 3x3 glyph
2028	more packed tile codes of the round-number digit-glyph tables
203b	first pictorial 3x3 round-marker glyph -- nine tile codes, three per row
2044	the nine tile codes of the following 3x3 glyph block
2065	the gauge's bottom cell
2068	one row up per cell
206b	read the phase-gauge counter
206f	zero -- leave the gauge as is
2070	filled cells is the counter minus one
2072	none filled
2074	cap at five
2078	clamp to full
207a	remember how many are filled
207c	fill a cell
207e	climb one row up
207f	fill from the bottom up
2081	subtract the filled count from five
2083	the remaining empty cells
2084	gauge full -- done
2086	blank a cell
2088	climb one row up
2089	blank the rest
208c	the code-sample start
208f	sixteen samples
2091	the reference bytes
2094	read a reference byte
2095	does the sampled code match?
2096	mismatch -- trip the flag
2098	advance the reference
209a	step the pointer by eight
209c	step the sample eight bytes on
209f	carry the high byte
20a0	the next sample address -- every eighth byte
20a1	check all sixteen
20a3	clean -- leave the flag
20a6	raise the signature-mismatch flag
20d4	the grab-active flag
20d7	read the play-mode latch
20db	ordinary round
20dd	bonus round -- clear the grab flag
20e0	point at the high-score-table corruption flag
20e2	a launch-state cell
20e4	combined with its neighbour
20e5	set -> handle it
20e7	restore the grab-flag pointer
20e8	read the grab flag
20ea	grab active -- run the reduced lead-actor pass
20ed	the lead-actor slot
20f1	drive player vertical motion and status render
20f4	run the launch/target pipeline
20f7	animate the round decoration
20fa	advance the actors' animation
20fd	run the formation manager
2101	run the launch state driver
2104	arm a target off the fire trigger
2107	advance every live target
210b	the player/lead-actor slot
210f	did the player fire?
2113	consume the fire event
2117	no fire -- done
2118	the fire-once latch
211c	already arming a shot?
211d	already fired this pass
211e	set the fire-once latch
211f	the target-slot pair
2123	the launch state
2126	past the arming phase?
2128	below 2 -> scan for a free slot
212a	the second slot's marker
212d	sitting ready-idle?
2131	the second slot's header
2135	first slot must be fully free
2137	clear the marker
213b	flag it a two-axis flyer
213f	slot stride
2142	two slots
2144	free slot?
2148	yes -- seed a target here
214a	next slot
214c	scan the pair
2150	check for any active shot
2152	a spawn gate cell
2153	tampered?
2154	one active -> service it
2156	none -> return
2157	the target-slot pair
215b	two slots
215d	remember the count
2160	slot occupied?
2164	advance this target
2167	slot stride
216a	next slot
216f	loop
2171	both slots
2173	the animation cursor low byte
2179	cursor still on the idle script?
217b	does the cursor hold its expected value?
217c	no -- just advance the actors' animation
2180	clear the fire-once latch
2184	mark the slot live
2188	the launch source Y
218b	just above it
218d	plant the target's Y
2190	the launch source column
2193	beside it
2195	plant the target's column
2198	a two-axis flyer?
219e	seed its shape
21a6	skip the special seeding
21a8	seed the flyer's shape
21b2	mark the launch armed
21b6	the companion sprite record
21bb	wipe it
21bc	the flash/hit cells
21c1	the slot address
21c3	which of the two slots?
21c7	the second lane sits one cell along
21c8	clear its flash cell
21cb	clear its hit cell
21cc	advance the actors' animation
21cf	is this target in its launch entry?
21d3	yes -- play the scripted entry
21d5	its entry timer
21d9	already announced -- skip the cue
21db	start it
21de	kick its entry animation
21e1	a two-axis flyer?
21e5	yes -- fly its scripted path
21e7	pick this record's hit flag by parity
21e9	which slot?
21eb	its hit flag
21f0	the odd slot's hit flag
21f1	read the hit flag
21f2	was it hit?
21f3	not hit -- keep living
21f5	consume the hit
21f7	and delete the target
21f9	its countdown
21fc	age it
21fe	timed out -- delete it
2200	store it
2204	the launch sub-phase
2207	below 1 -> done
2209	not armed -- hold still this frame
220c	set the launch render seed
2210	advance the sub-phase
2213	its Y
2216	slide it down four
2218	store it
221b	off the bottom?
221d	no -- still on screen
221e	clear the whole record
2221	0x18 bytes
2224	delete the target -- blank its record
2226	the phase-dwell countdown
222a	expired -- load the next flight phase
222d	the phase's X velocity
2231	take the actor slot's low address
2233	which slot?
2235	its X, low
2238	its X, high
223b	point at the X-direction sign table
2240	pick the other slot's direction entry
2241	the flight direction
2242	hit flag set?
2246	drift X one way
2249	or the other
224b	store X, low
224e	store X, high
2251	the phase's Y velocity
2255	its Y, low
2258	its Y, high
225b	advance Y
225d	flown past the bottom?
225f	yes -- retire it
2261	store Y, low
2264	store Y, high
2267	the phase-dwell countdown
226a	tick it
226c	clear the motion counter
226d	clear the flight scratch
2270	clear the motion index
2273	clear the launch state
2276	clear the launch state
2279	disarm the launch
227c	clear the launch-armed flag
227f	delete the flyer's record
2282	the flight phase index
2285	the dwell-count table
2288	look up this phase's dwell
2289	seed the dwell countdown
228c	the phase index
228f	the X-velocity table
2292	look up this phase's X velocity
2295	store it
2299	the phase index
229c	the Y-velocity table
229f	look up this phase's Y velocity
22a2	store it
22a6	the phase index
22a9	step to the next phase
22ab	past the last phase?
22ae	hold on the final phase
22b1	read the grab-active flag
22b5	grab in progress -- freeze the animation
22b6	the player/lead-actor record
22ba	step its animation
22bd	record stride
22c0	next companion record
22c2	step it
22c7	step the third
22cc	step the fourth
22d0	the two target records
22d4	record stride
22d7	two of them
22d9	clear the presence code
22da	target present?
22e0	fold its presence bit in
22e1	next record
22e3	both
22e6	the frame-hold countdown
22ea	hold expired -- read the next frame
22ec	still holding -- burn a frame
22f0	the shared animation cursor
22f3	the next tile
22f4	control marker?
22f6	yes -- handle it
22f8	set the actor's tile
22fc	the colour
22fd	set it
2301	the frame delay
2302	seed the hold
2306	advance the cursor
230a	fold the target presence code
230d	both targets present?
230f	no -> take the branch pointer
2311	the reset script
2314	rewind the cursor to it
2317	read on
231a	the jump target low
231b	follow the script jump
231f	the jump target high
2320	set the script cursor high byte
2323	read on
2329	does the aim say rise?
232d	no -- take the descent branch
232f	step the player up
2332	its Y
2335	at the top bound?
2339	clamp it
233d	re-derive the stacked sprite rows
2340	the tile-anim cursor
2344	at the strip end?
2348	the cell's tile
2349	and its tile still below the base
234d	the tamper-flag slots
234f	seven
2351	step to one
2352	read it
2353	is it active
2354	any armed -- run the render tick anyway
2356	check them all
2358	clean and idle -- skip the tick
2359	retreat the tile-strip animation
235c	the status-render ring
235f	tick it
2361	wrap at eight
2364	did the ring wrap
2365	not a wrap -- hold the panel
2366	point at the render phase
2367	advance the animation one frame
2368	repaint the status widget
236a	does the aim say descend?
236e	no -- idle
236f	step the player down
2372	its Y
2375	at the bottom bound?
2379	clamp it
237d	re-derive the stacked sprite rows
2380	the tile-anim cursor low byte
2383	at the strip end?
2387	a spawn-gate block
238c	read one
238e	any strike set -> continue
2391	check the block
2393	read a VRAM balance cell
2396	add its partner
2399	combine two field cells
239a	keep the low nibble
239d	idle -- skip
239e	advance the tile-strip animation
23a1	the status-render ring
23a4	tick it
23a6	wrap at eight
23a9	did the ring wrap
23aa	not a wrap -- hold the panel
23ab	point at the render phase
23ac	step the animation one frame
23ad	the render phase
23ae	keep it 0..3
23b1	the tile-block table
23b4	fetch this phase's descriptor
23b8	the first status square
23bb	paint it
23bf	the second square
23c1	paint it
23c4	the third square
23c6	one alternate block
23c9	the render phase
23cc	its parity
23d0	the other block
23d3	paint the third square
23d7	the player record
23db	the base Y
23de	slot 3 sits at the base
23e1	one tier up
23e3	slot 2's Y
23e6	overlapping slightly
23e8	slot 1's Y
23ec	the tile-anim parity
23ef	bump it
23f0	even frame?
23f2	odd -- leave it to the advance half
23f3	the tile-anim cursor
23f6	the cell's tile
23f7	the rewind marker?
23fb	step the cell one tile lower
23fe	reset it to the base tile
2400	step the cursor back one cell
2401	store the cursor
2405	the tile-anim parity
2408	bump it
2409	odd frame?
240b	even -- leave it to the retreat half
240c	the tile-anim cursor
240f	the cell's tile
2410	at the top of the range?
2414	step the cell one tile higher
2417	advance to the next cell
2418	seed it with the entry tile
241a	store the cursor
241e	run the launch/target pipeline
2421	advance the actors' animation
2424	run the formation manager
2427	read the tamper-freeze flag
242b	tampered -- abandon the lead-actor state
242c	the lead-actor record
2430	its state index
2433	low three bits
2435	jump to the state's handler
2436	death-phase handler table
2442	the first tamper strike counter
2446	the last one
2448	either armed?
2449	tampered -- freeze the lead actor
244a	seed the pacing delay
244e	advance to the drop state
2451	the lead record
2454	the next record
245a	preserve a copy of the record
245c	its Y
245f	lift it one row
2461	store it
2464	the lift shape table
2467	restyle the four-actor group
246a	the wave-teardown flag
246e	tearing down -- skip the sound
246f	play the lift sound
2473	burn a frame off the delay
2476	still waiting
2477	a board-clear gate cell
247b	branch when that actor is present
247d	reseed the delay
2481	advance to the nudge state
2484	its Y
2487	drop it one row
2489	store it
248d	clear a per-actor flag
2490	the drop shape table
2493	restyle the group
2497	burn a frame off the delay
249a	still waiting
249b	advance to the descent state
249e	the nudge shape table
24a1	restyle the group
24a4	the lead record
24a8	its Y
24ab	nudge it down
24ad	store it
24b0	its column
24b3	nudge it over
24b5	store it
24b9	step the descent sub-position
24bc	every other frame
24c0	every other frame
24c2	ease the column over
24c5	its Y
24c8	ease it down
24ca	store it
24cd	reached the floor?
24cf	not yet -- keep falling
24d0	play the landing sound
24d3	seed a short delay
24d7	advance to the settle state
24db	burn a frame off the delay
24de	still waiting
24df	its Y
24e2	settle it down
24e4	store it
24e7	its paired position
24ea	move it the other way
24ec	store it
24ef	stamp the settled shape
24f3	seed a long hold
24f7	advance to the final state
24fb	burn a frame off the delay
24fe	still waiting
24ff	the score-drip accumulator
2503	is a score drip still pending
2506	the in-play sub-state instead
2508	push it to phase 7
250a	a spawn gate cell
250e	nothing to draw -- done
250f	one record stride
2512	four records
2514	read a source tile
2515	set the actor's display shape
2519	next record
251b	restyle the whole run
251d	the board-clear flag
2520	the object-freeze flag
2523	board being cleared?
2524	yes -- tear the board down
2527	send a sound command
2529	queue a display command
252a	the spawn-phase counter
252e	completed its full run?
2530	the ordinary fill value
2532	not yet -- just blank the scratch
2534	the object-freeze flag as fill value
2537	reseed the spawn-phase counter
2539	the rope-draw counter
253b	reseed it
253d	clear the formation-slot block
2540	clear a scratch block
2541	the animation/launch scratch
2546	blank it
2547	point at the player-object teardown flags
254b	blank another block
254c	a per-round scratch block
2551	blank it
2552	clear the lead-actor state
2555	clear the first target record
2558	clear the second
255b	clear a launch cell
255e	clear the sub-state scratch tail
2563	read the play-mode latch
2567	bonus round -- freeze the decoration
2568	the two-tile animation hold timer
256c	has the hold elapsed
256d	elapsed -- advance the picture
256f	still holding -- burn a frame
2571	reseed the hold timer
2573	the phase byte
2574	advance it
2576	read the round counter
2579	odd round?
257b	one on-screen anchor
257e	the phase
257f	odd round -> tile set B
2581	the even-round anchor
2583	the even-round picture pair
2586	phase parity
2588	even -> keep source A
258a	its other frame
258f	the odd-round picture pair
2592	phase parity
2596	its other frame
2599	hold the source run while the first block is stamped
259a	draw the top tile row
259d	move down to the second row
25a0	back the destination up to the higher block
25a2	draw the bottom tile row
25a6	read the round number
25a9	test its low enable bit
25ab	even round -> the elevator variant
25ae	count down the rope-draw step timer
25b1	tick it one frame
25b2	not expired -> return
25b3	reload it
25b5	any rope phase?
25b9	none -> done
25ba	keep the remaining count
25bb	read the readout-mode flag
25be	currently retracting?
25bf	yes -> the retract path
25c1	restore the remaining count
25c2	point at the reveal-phase cell
25c5	point at the revealed-so-far tally
25c8	rope fully drawn?
25c9	already even: skip the reveal step
25cb	read the reveal phase
25cd	already extending?
25cf	extend one more rope segment
25d0	step the reveal phase
25d1	store the phase back
25d2	point the rope draw at its VRAM column
25d5	seat the readout cursor
25db	read the reveal phase
25dc	not extending -> skip
25dd	phase idle: skip
25df	read the readout cursor low byte
25e2	reached the bottom of the column?
25e4	not yet: skip
25e6	clear the phase
25e7	stop extending
25e8	clear the anim-armed latch
25eb	read the revealed count
25ec	rope count below 7?
25ee	fewer: skip the far-edge check
25f0	read the cursor low byte
25f3	at the top marker?
25f7	load the readout-complete marker
25f9	enable the formation
25fc	cap the count at 7
25fe	use the count as the row-copy loop length
25ff	segment stride, up the column
2602	extending?
2606	no -> the static draw
2608	point at the readout's frame countdown
260b	set a longer step timer
260d	cursor step of one tile row up
2610	step the draw pointer up a row
2614	move it up one row
2616	store the raised cursor
261a	point at the readout-mode flag
261b	test the phase bit
261d	rope-end tile A
2620	odd frame: keep it
2622	rope-end tile B
2625	blank the cell below the new segment
2629	blank the second of the pair
262d	play the rope-extend sounds
2630	queue the reveal sound cue
2633	join the row-draw loop
2635	read the readout-mode flag
2638	test the phase bit
263a	retract tile A
263d	clear: keep it
263f	retract tile B
2642	point four rows up the draw column
2646	take its high byte
2648	move the erase pointer up four rows
264c	read the top cell there
264f	already blanked?
2653	yes: nothing to erase, go finish
2655	blank-tile fill value
2657	step of two rows up per pass
265a	blank the retracted segment cells
265d	and the cell beside it
2660	move up two rows
2662	erase the whole column top-down
2664	play the retract sound
2667	seven segments to redraw
2669	go finish
266b	read the readout-mode flag
266e	test the phase bit
2670	static rope tile A
2673	clear: keep it
2675	static rope tile B
2678	point at the draw column, stride up
267c	destination step of two rows up
267f	hold the source pointer for the second cell
2680	read the source tile
2681	draw the segment's upper-left tile
2685	read the next source tile
2686	upper-right tile
268a	read the source tile for the row above
268b	lower-left tile
268f	read the next tile
2690	lower-right tile
2693	move the cursor up two rows
2696	up the whole column
2698	retracting?
269c	yes -> skip the cap
269e	point at the rope cap position
26a3	copy the cursor into HL
26a6	read the readout-mode flag
26a9	test the phase bit
26ab	cap tile set A
26ae	clear: keep it
26b0	cap tile set B
26b3	draw the rope cap
26b6	blank the cell above it
26b8	point at the readout-mode flag
26bb	advance the rope-draw anim phase
26fa	packed pointer bytes (0x26fe, 0x2706 ...) -- table data, not executable code here
2720	a 16-bit offset ramp climbing 0x0000 up to 0x0300 and mirroring back -- a positional lookup
2730	continues the symmetric offset ramp
2750	sprite tile-code runs, each closed by an 0xff terminator
2760	more sprite tile-code sequences
2778	dispatch on the launch state
277b	keep the low three bits as the state
277d	jump through the launch-state table
277e	launch-state handler table
278f	already armed?
2793	yes -> check the launcher
2795	lane spawn running?
2799	not ready: fall to the alternate arm test
279b	point at the launch-hold cell
279f	launch already latched?
27a0	already held: fall through
27a2	latch the launch
27a3	go raise the armed flag
27a5	any stage countdown?
27a9	none -> wait
27aa	act only every eighth count
27ac	off-beat: wait
27ad	set the launch-armed flag
27af	raise the launch-armed flag
27b2	read the enemy-column tally
27b5	launcher reached row 0x3c?
27b7	not yet -> wait
27b8	first target busy?
27bb	its busy bit set?
27bd	yes -> wait
27be	second target busy?
27c1	its busy bit set?
27c3	yes -> wait
27c4	point at the launch state selector
27c7	advance the launch state
27c8	load the launch step timer
27ca	seed the launch-flip countdown
27cd	in active play?
27d1	yes -> skip the demo marker
27d3	read the freeze flag
27d6	point at the launch-armed flag
27d9	check the play-mode and armed flags
27da	neither set: skip
27dc	load the attract launch tile
27de	write a demo marker tile
27e1	read the pending-launch count
27e4	seeded launch latch present?
27e5	none: skip the hold store
27e7	carry it into the launch latch
27ea	draw the launcher sprite
27ed	point at the launch sprite artwork
27f0	stamp the launch 2x2 sprite and return
27f3	read the enemy-column tally
27f6	launcher above row 0x34?
27f8	no -> try to spawn
27fa	point at the launch step timer
27fd	count down the flip timer
27fe	still counting: wait
27ff	reload it
2801	step back to the animation-phase cell
2802	advance the flip phase
2803	test the phase low bit
2805	aim at the launch sprite cell
2808	point at the even-phase artwork
280b	flip phase set -> sprite A
280d	clear -> sprite B
2810	draw the launcher sprite
2813	point at the first target record
2816	record stride
2819	scan the two target records
281b	read a blocker's busy byte
281d	free slot -> spawn here
281f	advance to the next slot
2820	scan the blocker slots
2822	none free -> return
2823	set the launch state to 2
2825	commit it as the launch state
2828	mark the target slot active
2829	play the launch sound
282c	aim at the launch sprite cell
282f	point at the launched-object artwork
2832	draw the launcher sprite
2835	read the freeze flag
2838	point at the launch-armed flag
283b	check the play-mode and armed flags
283c	neither set: skip the status tile
283e	load the launch status tile
2840	clear the demo marker tile
2843	raise the launched-object active flag
2845	activate the launched actor record
2848	seed its X near the launcher
284b	offset it twelve rows down
284d	store the launched-object screen row
2850	load the launched-object column
2852	seed its state field
2856	play-mode latch set?
285a	yes -> skip the spawn
285c	scan the six hunter slots
2860	slot stride, down
2863	six record slots to scan
2865	read the record's live word low
2868	this slot free?
286b	yes -> seed it
286d	step to the previous record
286f	try the next slot
2871	none free -> return
2872	seed the hunter's state
2876	seed its phase timer
287a	clear its state field
287e	seed its X
2882	clear its sub-step
2886	seed its Y
288a	seed its sprite tile
288e	seed its sprite attribute
2892	remember the hunter record pointer
2896	point at the launch state selector
2899	advance the launch state
289a	hunter-spawn flip flag set?
289e	clear: skip the twin bump
28a0	point at the twin-count cell
28a2	yes -> bump the hunter subcounter
28a4	point at the reveal tally
28a6	seed the hunter-spawn countdown
28a8	send a sound command
28ab	post it to the frame command ring
28ad	point at the launch delay
28b0	count down the hunter-spawn countdown
28b1	still counting
28b2	already zero: fall through
28b4	tick the delay
28b5	not expired -> return
28b6	point at the launch state selector
28b8	advance the launch state
28b9	read the freeze flag
28bc	play-mode latch set?
28bd	yes -> return
28be	clear the accumulator
28bf	clear the hunter record
28c2	blank 0x18 record bytes
28c4	clear the whole record
28c5	idle launch state -- nothing to do
28c6	keep the shots moving
28c9	read the attract readout mode
28cc	even round?
28ce	point at the play sub-state index
28d1	set: leave the index
28d3	yes -> set the play sub-state to 6
28d6	read the wave-complete flag
28d9	formation active?
28da	clear: leave the index
28dc	yes -> set the play sub-state to 4
28df	point at the lead actor record
28e3	push the post-handler return address
28e7	count down the actor's phase timer
28ea	still running -> return
28eb	read the actor's state
28ee	keep the low three bits as the state
28f0	dispatch on it
28f1	enemy-state handler table
2901	set the phase timer to 1
2905	move the actor down one
2908	read the path position
290b	reached the floor 0xdc?
290d	arrived: take the landing branch
290f	repaint the sprite
2912	read the sprite-slot status
2915	at the tile-anim limit?
2917	yes -> return
2918	step the walk animation
291b	paint the actor sprite and return
291e	load the landed sprite tiles
2921	seat the landing animation on the actor
2924	point at the actor's landed-count cell
2927	seed the actor's state field
2929	step to the state field
292b	bump the lead actor state
292e	read the actor column
292f	nudge the actor up three rows
2931	store the adjusted column
2933	clear the second actor's position
2936	clear the actor's twin-row cache
2939	checksum a 0x20-byte ROM span from 0x0859
293c	seed the running checksum
293f	fold a byte into the low half
2940	sum the bytes
2942	advance the pointer
2943	sum the whole run
2945	match the expected 0x63?
2947	no -> the tamper path
294a	0x20 reference bytes to verify
294c	compare the span against the mirror table
294f	step back one reference byte
2950	read the reference byte
2951	match?
2952	no -> the tamper path
2956	verify the whole reference block
2958	play the grab sound
2974	within the 32-byte anti-tamper signature block (0x2960-0x297f) checked byte-for-byte -- any mismatch diverts to a tamper trap
2980	byte data following the checked signature block -- outside the byte-for-byte compare
29a0	set the phase timer to 3
29a4	every fourth frame
29a7	read it
29aa	every fourth frame
29ac	not a flap frame: skip the tile swap
29ae	read the current wing tile
29b1	toggle between the two walk tiles
29b3	load the up-wing tile
29b5	was the other -- keep the first
29b7	load the down-wing tile
29b9	store the walk tile
29bc	move the actor left two
29bf	raise it two rows
29c1	store the new row
29c4	reached the left edge 0x2c?
29c6	still descending: return
29c7	arena tile occupied?
29cb	yes -> the branch state
29ce	form the ready digit tile
29d0	arm the formation-spawn timer
29d3	set the phase timer
29d7	advance the state
29da	checksum a 0x20-byte ROM span from 0x0879
29dd	block length and sum seed
29e0	read a program byte
29e1	sum the bytes
29e4	fold the whole block
29e6	match the expected 0x37?
29e8	no -> a different state
29eb	compare the span against the mirror table
29f0	point at the reference block
29f3	read a reference byte
29f4	compare against the region
29f5	mismatch -> restart the descent
29fa	compare the whole block
29fc	send a sound command
29ff	post it to the frame command ring
2a01	set the phase timer to 8
2a05	set the sprite's flip bit
2a09	aim at the status tiles
2a0c	load the marker tile
2a0e	draw the three hook tiles
2a10	and the next
2a12	and the next
2a13	advance the state
2a17	checksum a 0x20-byte ROM span from 0x0839
2a1a	block length
2a1c	sum the bytes
2a1e	sum the whole run
2a20	match the expected value?
2a21	no -> the tamper path
2a24	send a sound command
2a27	post it to the frame command ring
2a28	wave-arrival count below 9?
2a2c	already at nine?
2a2e	below -> return
2a2f	cap it at 8
2a32	set the phase timer to 3
2a36	every fourth frame
2a3c	read it
2a3e	not a flap frame: skip the tile swap
2a40	read the current wing tile
2a43	toggle the two carry tiles
2a45	load the up-wing tile
2a47	was the other -- keep the first
2a49	load the down-wing tile
2a4b	store it
2a4e	advance the Y sub-position half a row
2a50	add it to the actor's fractional column
2a53	store it
2a56	read the whole column
2a59	carry into the Y
2a5b	carry: bump the column
2a5c	move the actor down
2a5d	store the new column
2a60	at row 0x52?
2a62	not there -- check the next
2a64	send a sound command
2a67	enqueue it
2a69	at row 0x64?
2a6b	not there -- check the far limit
2a6d	send a sound command
2a70	enqueue it
2a72	at row 0xac?
2a74	not yet -> return
2a75	advance the state
2a79	checksum-compare a 0x68-byte block against its mirror
2a7c	point at the compare source
2a7f	0x68 bytes to verify
2a81	read a source byte
2a82	subtract the table byte
2a83	mismatch -> back to the walk state
2a86	advance both pointers
2a88	verify the whole run
2a8a	set the phase timer to 0x30
2a8e	clear the sprite's flip bit
2a92	advance the state
2a96	checksum-compare a 0x20-byte block against its mirror
2a99	point at the compare source
2a9c	0x20 bytes to verify
2a9e	read a source byte
2a9f	subtract the table byte
2aa0	mismatch -> back to the reach state
2aa3	advance both pointers
2aa4	walk the reference downward
2aa5	verify the whole run
2aa7	set the phase timer to 0x18
2aab	set the sprite's flip bit
2aaf	advance the state
2ab3	set the phase timer to 2
2ab7	every fourth frame
2abd	read it
2abf	not a flap frame: skip the tile swap
2ac1	read the current wing tile
2ac4	toggle the two tiles
2ac6	load the up-wing tile
2ac8	was the other -- keep the first
2aca	load the down-wing tile
2acc	store it
2acf	move the actor down one
2ad2	read the new row
2ad5	reached row 0xc0?
2ad7	not yet -> return
2ad8	read the actor column
2adb	nudge it left three
2add	store the shifted column
2ae0	advance the state
2ae3	set a long phase timer
2ae8	zero-fill the whole actor arena
2ae9	point at the enemy-actor arena
2aec	zero the first byte
2aed	destination one byte up
2af0	the arena span
2af3	blank the whole enemy arena
2af5	clear the per-round phase
2af8	clear the wave-arrival count
2afb	clear the rope segment count
2afe	load the attract-return sub-state
2b00	set the play sub-state to 6
2b23	count down the phase timer
2b26	tick it
2b27	reset-scan latch set?
2b2b	none pending: take the rebuild path
2b2d	read the round-tick countdown
2b2f	timer expired -> finish the wipe
2b31	run the collision/hit scan
2b3d	rotate the result flag out
2b3e	act only on certain frames
2b3f	set up the column wipe
2b42	load the rebuild write cursor
2b45	one tile row per step
2b48	0x1c cells down the column
2b4a	paint the tile down the column
2b4b	drop down one row
2b4c	fill the whole column
2b4e	step the rebuild row index
2b4f	advance the fill tile, wrapping to 6
2b51	not yet: keep it
2b53	wrap the row index back to six
2b55	store the next fill tile
2b59	blank eight rows up from 0x855f
2b5c	one row up per step
2b5f	eight cells to reset
2b61	with the blank tile
2b63	reset a strip cell
2b64	step up one row
2b65	reset the whole strip
2b67	checksum ten VRAM cells from 0x82bc
2b6a	one row up per step
2b6d	seed the strip checksum, ten cells
2b70	read a strip cell
2b71	sum them
2b73	step up one row
2b74	sum the whole strip
2b77	match 0xaa?
2b79	no -> return
2b7a	clear the accumulator
2b7b	clear the reset-scan latch
2b7e	two-player game?
2b82	no -> skip the swap
2b84	read the active-player index
2b87	player 1 active?
2b88	yes -> run the formation seed
2b8a	read player 1's lives
2b8d	lead actor past state 3?
2b90	below the trigger?
2b92	no -> return
2b93	run the formation spawn scan
2b96	run the enemy-object motion
2b9a	early wave?
2b9e	below two?
2ba0	yes -> draw the queue marker
2ba3	count down the formation-spawn timer
2ba7	already zero: fall through
2ba8	elapsed -- launch one object
2baa	tick the wave delay
2bab	still counting -> return
2bac	point at the formation spawn table
2bb0	stride back one record
2bb3	0x11 formation slots
2bb5	seed each free formation slot
2bb6	service one record
2bba	step to the previous record
2bbc	service the whole bank
2bbf	arrival count of one?
2bc1	point at the first status tile
2bc4	yes -> just the second column
2bc6	read the status tile
2bc7	marker already drawn?
2bc9	no: paint it
2bcb	yes -> bail out of the caller
2bcd	point at the marker source
2bd0	draw the marker tiles
2bd3	point at the second status tile
2bd6	read that cell
2bd7	second marker already drawn?
2bd9	yes -> return
2bda	point at the marker source
2bdd	draw the second marker
2be5	slot already active?
2be8	or in its high byte
2beb	rotate the free bit out
2bec	yes -> skip
2bed	mark the slot active
2bf2	seed its state
2bf6	clear its X fraction
2bf9	clear its Y fraction
2bfc	seed its X
2c00	seed its Y
2c04	point at the level counter
2c07	step the wave-arrival count
2c08	pick a side by parity
2c0a	even: keep zero
2c0c	odd: mark the mirror side
2c0d	store the side/direction
2c10	point at the spawn animation script
2c13	set up the record's sprite
2c16	read the level counter
2c19	clamp the arrival count at 0x0a
2c1d	clamp it to ten
2c20	subtract from 0x20 for the delay
2c22	set the next formation-spawn interval
2c23	store it
2c26	seed the record's speed field
2c2a	return past the loop wrapper
2c2c	walk the enemy records
2c30	record stride
2c33	0x11 slots
2c36	step each active enemy
2c3a	step to the next record
2c3c	service the whole bank
2c3f	record active?
2c42	or in its high byte
2c45	rotate the free bit out
2c46	no -> skip
2c47	read the record state
2c4a	state below the motion range?
2c4c	below the first active state?
2c4e	yes -> skip
2c4f	dispatch on the enemy motion state
2c50	enemy-motion handler table
2c58	fold the record into the sprite list
2c5b	read the Y fraction
2c5e	add the fall speed to the Y sub-position
2c61	carry into the Y
2c63	carry: drop one row
2c66	store the sub-position
2c6a	read the whole row
2c6d	reached row 0x12?
2c6f	not yet -> return
2c70	sweep all enemy records
2c74	0x11 records to sweep
2c76	promote each landed record
2c79	record stride
2c7c	step to the next record
2c7e	sweep the whole bank
2c80	play the arrival sound
2c83	return past the loop wrapper
2c85	record in the falling state?
2c88	in the launched state?
2c8a	no -> return
2c8b	advance it to the landed state
2c8f	set up its landed sprite
2c92	seat it on the record
2c95	point it at its motion script
2c98	seat the path pointer low
2c9b	seat the path pointer high
2c9e	reset the script index
2cb3	fold the record into the sprite list
2cb6	fetch the record's motion-script pointer
2cb9	load the path pointer high
2cbc	read the next path byte
2cbd	script loop marker 0xff?
2cbf	data byte: use it
2cc1	set the loop flag
2cc4	step past it
2cc5	skip the marker
2cc7	script end 0x88?
2cc9	no: apply the step
2ccb	advance the record's state
2cce	set up the next sprite
2cd1	seat it on the record
2cd4	set the phase timer to 0x20
2cd9	advance the script pointer
2cda	store the path pointer low
2cdd	store the path pointer high
2ce0	moving right?
2ce4	rightward: take that branch
2ce6	use the step as a subtrahend
2ce7	read the X fraction
2cea	subtract the step from the X
2ceb	borrow into the X high byte
2ced	borrow: drop one column
2cf0	store the X low byte
2cf4	add the step to the X
2cf7	carry into the X high byte
2cf9	carry: bump one column
2cfc	store the X low byte
2d24	fold the record into the sprite list
2d27	add the sink speed to the Y sub-position
2d2a	add the fall step
2d2d	carry into the Y
2d2f	carry: drop one row
2d32	store the Y fraction
2d35	read the whole row
2d38	reached row 0x19?
2d3a	not yet -> return
2d3b	advance the state
2d3f	zero the Y
2d42	clear the whole row
2d45	clear the script pointer
2d48	return past the loop wrapper
2d4a	clear the projectile-active cell
2d4c	clear the wave hold timer
2d4f	return past the loop wrapper
2d66	skip during a grab
2d6a	frozen: return
2d6b	read the wave-progress cell
2d6e	wave still ramping?
2d70	yes -> wait
2d71	extend the rope
2d74	step the rope cells
2d78	dispatch on the rope-extend state
2d7b	jump through the arrow-build table
2d7c	rope-extend handler table
2d80	read the wave-progress cell
2d83	all segments extended?
2d85	point at the arrow-build count
2d88	already at the limit?
2d89	yes -> return
2d8a	extend one more segment
2d8b	point at the arrow slot index
2d8f	fewer than four segments so far?
2d91	yes: proceed
2d93	otherwise gate on the ROM tamper strikes
2d97	clean -> return
2d98	advance the extend index
2d99	compute the new segment's VRAM column
2d9c	look up this slot's column
2d9e	form the arrow screen cursor
2da0	seat the arrow write cursor
2da3	read the arrow slot index
2da7	point past the active cell timers
2daa	step to this segment's timer
2dac	reach this slot's record
2dae	arm its timer
2db0	step to the arrow beat cell
2db2	advance the extend state
2db3	step to the arrow phase cell
2db5	seed the extend step timer
2dbc	point at the arrow-build delay
2dbf	count down the extend step timer
2dc0	already zero: fall through
2dc3	tick the delay
2dc4	still counting -> return
2dc5	reload it
2dc7	step to the arrow ready cell
2dca	reached the last frame?
2dcc	no: take the draw branch
2dce	clear the accumulator
2dcf	reset the frame index
2dd0	step to the arrow beat cell
2dd2	go back to the idle extend state
2dd3	read the arrow slot index
2dd6	step to the arrow ready base
2dd8	index this slot
2dda	mark this rope cell active
2ddd	look up this frame's segment tiles
2de0	fetch its address word
2de3	load the arrow write cursor
2de6	draw them at the segment column
2de9	point at the arrow-draw count
2dec	advance the segment draw frame
2e22	any rope cells yet?
2e26	none -> return
2e27	walk each rope cell
2e2b	use the slot count as the loop count
2e2c	step each cell
2e2d	service one arrow
2e31	step to the next arrow record
2e33	service every arrow
2e36	read the arrow state
2e39	cell inactive?
2e3b	yes -> skip
2e3c	dispatch on the cell state
2e3d	rope-cell handler table
2e45	index the cell's frame timer
2e48	keep its low two bits
2e4a	double it
2e4b	offset into the beat table
2e4d	form the beat-cell address
2e50	count it down
2e52	look up the cell's VRAM column
2e54	keep its low two bits
2e56	point at the arrow-column table
2e59	look up this arrow's column
2e5e	act every fourth frame
2e61	only act every fourth beat
2e63	off-beat: return
2e64	wait for the cell timer
2e67	still counting: return
2e68	reload the cell timer
2e6a	scan the three spawn-object slots
2e6e	record stride
2e71	three actor slots to scan
2e73	read the slot's live word low
2e76	or in its high byte
2e79	found a free slot?
2e7a	yes -> use it
2e7c	step to the next slot
2e7e	scan the slots
2e80	none free -> return
2e81	read the attract phase
2e84	clamp the round number at 0x10
2e88	clamp it to 0x10
2e8a	derive and store the spawn timer
2e8c	complement it
2e8d	store the launch column
2e8f	take the loop index
2e90	complement it
2e91	keep the low two bits as the side
2e93	store the slot index
2e94	read the record's low pointer byte
2e96	keep its low two bits
2e98	look up the object's starting X
2e9c	mark the object active
2ea0	seed its state
2ea4	seed its X
2ea7	seed its X whole part
2eab	seed its Y
2eaf	seed its sprite tile
2eb3	seed its sprite attribute
2eb7	advance the cell state
2eba	compute the cell's VRAM column
2ebd	point at the arrow spawn animation
2ec0	draw the rope cell
2ec3	play the spawn sound
2ecb	wait for the cell timer
2ece	not ready -> return
2ecf	read the attract phase
2ed2	clamp the round number at 0x10
2ed6	clamp it to 0x10
2ed8	derive and store the next timer
2ed9	offset toward the string row
2edb	store the string row
2edc	index the matching formation record
2ee0	record stride
2ee3	step to the side field
2ee4	use it to index the actor slot
2ee6	step to it
2eea	advance its sprite tile
2eed	reset its Y low byte
2ef1	raise it one row
2ef4	advance the cell state
2ef7	compute the cell's VRAM column
2efa	point at the pull-down animation
2efd	draw the rope cell
2f01	run the tension pass
2f04	wait for the cell timer
2f07	not ready -> return
2f08	reload the cell timer
2f0a	point at the formation records
2f0e	record stride
2f11	step to the side field
2f12	index the matching formation record
2f14	step to it
2f18	step its sprite tile back
2f1b	set its Y sub-position
2f1f	drop it one row
2f22	advance the cell state
2f25	compute the cell's VRAM column
2f28	point at the release animation
2f2b	draw the rope cell
2f2f	wait for the cell timer
2f32	not ready -> return
2f33	read the wave-progress cell
2f36	any rope segments?
2f37	none -> return
2f38	hold the column
2f39	read the attract phase
2f3c	halve the round number twice
2f40	cap at the fastest speed tier
2f44	clamp to three
2f46	keep it as the row base
2f47	add the difficulty setting
2f4a	isolate its select bit
2f4c	fold it in
2f4d	add the row base
2f4e	look up the descent-speed table for this tier
2f51	fetch the release row word
2f54	swap it into HL
2f55	read the segment count
2f58	step back one
2f59	clamp the segment index below 0x20
2f5d	clamp to 0x1f
2f5f	read this segment's target row
2f61	keep it
2f62	read the arrow column
2f63	at the last column?
2f65	yes: skip the tweak
2f67	step back two columns
2f6a	read that neighbour cell
2f6b	blend in the neighbor column's row
2f6d	fold in the offset
2f6f	read the column
2f70	step forward two columns
2f74	store the target row
2f78	step to the side field
2f79	index the matching formation record
2f7a	point at the target actor bank
2f7d	index the actor slot
2f7e	step to it
2f81	clear the accumulator
2f82	blank 0x18 record bytes
2f84	clear the formation record
2f85	advance this arrow's state
2f86	advance the cell state
2f89	compute the cell's VRAM column
2f8c	point at the retire animation
2f8f	draw the rope cell
2fcb	a descending byte-ramp (0x40 down by 4, each value doubled) -- lookup data in the rope-cell handler region, not code
2fdd	continues the ramp after a short spike (the 0x48 run) then resumes stepping down
305f	look up this cell's grab row
3061	keep its low two bits
3063	point at the clear-column table
3066	look up this record's column
3067	keep it
3068	the player's row less a margin
306b	offset back seven
306e	widen the band by fourteen
3070	passenger above the player's reach?
3071	yes -> no grab
3072	take the low bound
3073	passenger below the reach?
3074	yes -> no grab
3075	wave forming or tearing down?
3078	read the caught gate
307c	yes -> no grab
307d	raise the freeze latch
307f	set the grab-active flag
3082	play the grab sound
3085	return past the loop wrapper
308b	formation enabled?
308f	no -> return
3090	read the attach phase
3093	formation already forming?
3094	yes -> its dispatch
3096	scan the enemy records for formation slots
309a	point at the launched-object slot list
309e	record stride
30a1	0x11 records to scan
30a3	read the record state
30a6	record empty?
30a7	yes -> use it
30a9	record in the ready state?
30ab	yes -> use it
30ad	next record
30af	scan the bank
30b1	none found: clear the active flag
30b2	none collected -> clear the slot table
30b6	read the record's busy byte
30b9	record busy?
30ba	yes -> skip it
30bc	copy the record pointer
30bf	record this slot's pointer
30c2	and the high byte
30c5	mark it ready
30c9	seed its state
30cd	advance the slot pointer
30d1	filled all four slots?
30d3	collected four slots yet?
30d5	not yet: keep scanning
30d7	point at the attach phase
30da	begin forming the wave
30dc	step to the attach timer
30dd	seed the formation timer
30e0	push the post-handler return address
30e4	read the formation phase
30e7	keep the low two bits
30e9	index the attach-state table
30ea	dispatch on it
30eb	formation-phase handler table
30f1	walk the four formation slots
30f5	point at the seed data
30f8	four records to seat
30fa	fetch this slot's record pointer
30fd	and its high byte
3104	read a seed byte
3105	set its X
3109	read the next seed byte
310a	set its Y
310e	read the next seed byte
310f	set its sprite tile
3113	read the next seed byte
3114	set its sprite attribute
3117	set its speed field
311b	next slot
3120	seat all four records
3122	seed the descent countdown
3124	seed the shared frame-delay timer
3127	point at the attach phase
312a	advance the formation phase
312b	blank-tile value
312d	blank the target-formation cells
3130	aim at the launch status block
3133	three columns
3135	three by three
3137	blank the status cell
3138	step to the next column
3139	across the row
313a	fill the whole status block
313c	arm the hunter script pointer
313f	seat the path pointer
3142	play the formation sound
3145	run the record-retire scan
3148	checksum-compare a 0x40-byte block
314b	point at the reference block
314e	0x40 bytes to verify
3150	read the snapshot low byte
3151	compare against the reference
3152	mismatch -> the tamper path
3154	read the snapshot high byte
3156	compare against the reference
3157	mismatch: bail
315a	read a snapshot byte
315b	compare each byte
315c	mismatch -> the tamper path
3160	verify the whole block
3163	zero-fill the whole game-state page
3164	point at the game-state page base
3167	aim the copy one byte ahead
316a	zero the first cell
316b	blank the whole state page
316e	point at the descent countdown
3171	count down the shared frame-delay timer
3172	already zero: fall through
3175	tick it
3176	still counting -> return
3177	fetch the lead formation record's pointer
3179	read the slot pointer low
317b	read the slot pointer high
317c	copy it into the record index
317f	load the descent path pointer
3182	any hunter-script step left?
3183	zero: take the free-fall branch
3184	none -> drift on the speed field
3186	add the script's Y step
3189	carry into the Y
318b	carry: drop one row
318e	store the Y sub-position
3191	step past the path byte
3192	read the path step
3194	advance the script pointer
3197	join the settle check
3199	drift the formation on its speed field
319c	no wrap: skip
319e	carry: bump the row
31a1	read the speed field
31a4	add the X step
31a7	carry into the X
31a9	carry: bump the column
31ac	store the X sub-position
31af	past the swoop point?
31b3	read the whole row
31b6	alt mode: take that branch
31b8	convert the formation X to a screen row
31bb	offset toward the catch line
31bd	keep it
31be	read the catch reference row
31c1	player above the formation?
31c2	below: skip
31c4	raise the catch-mode flag
31c6	start the wave swoop
31c9	mark the swoop launched
31cc	point at the alternate path
31cf	arm the swoop script pointer
31d2	play the swoop sound
31d7	formation reached row 0x1b?
31d9	not yet -> project the sprites
31db	seed the descent countdown
31de	point at the attach phase
31e1	advance the formation phase
31e2	play the sound
31e5	read the formation's X and Y
31e8	read the record row
31eb	walk the slot pointers
31ef	three bytes per sprite
31f2	point at slot 1's record
31f5	and high
31f8	reach its sprite fields
31f9	read the sub-column
31fc	copy the X sub-position
31ff	copy the X
3201	read the sprite artwork
3204	copy the Y sub-position
3206	take the row
3207	offset it two
3209	copy the Y, two rows down
320a	point at slot 2's record
320d	and high
3210	reach its sprite fields
3214	copy its X sub-position
3216	offset the column two
3217	copy its X, two columns over
3219	write the sprite tile
321b	read the sprite artwork
321e	copy its Y sub-position
3221	write the sprite Y
3222	point at slot 3's record
3225	and high
3228	reach its sprite fields
322c	copy its X sub-position
322f	copy its X, two columns over
3231	write the sprite tile
3233	read the sprite artwork
3236	copy its Y sub-position
3239	copy its Y, two rows down
323b	write the sprite Y
323c	four slots
323e	record page settled at 0x8c?
3241	in the target page?
3243	yes -> tally it
3246	next slot
324a	check them all
324d	record landed past column 0x40?
3250	below 0x40?
3252	no -> return
3253	point into the record page
3255	reach its retire timer
3258	read it
3259	subtract 0x40 from its column tally
325c	no underflow: return
325d	step to the next field
325e	underflow -> drop the counter
325f	board cleared?
3263	yes -> the tamper check
3266	checksum a 0x20-byte ROM span from 0x0799
3269	seed the running checksum
326c	read a byte
326d	sum the bytes
326f	advance the pointer
3270	sum the whole run
3272	match 0xdc?
3274	no -> the trap
327a	point at the once-only guard
327d	already summed this frame?
327f	yes -> return
3280	mark it done
3281	scan the playfield tiles
3284	clear the running sum
3287	read a tile
3288	add each tile into the sum
3289	carry across
328a	carry into the high byte
328c	carry: bump the high half
328d	across a row
328e	reached the column end?
3291	no: keep folding
3295	hop past the column margin
3296	step to the next row
3299	no page cross: continue
329b	step the high byte
329c	past the tilemap end?
329d	until the whole field is summed
329f	no: continue
32a1	compare the low sum against the four allowed values
32a4	four references to try
32a6	read the summed low half
32a7	match?
32a8	yes -> check the high byte
32aa	step to the next reference
32ab	try them all
32ad	no match -> the tamper trap
32b0	high sum matches?
32b2	matches the paired reference?
32b3	yes -> ok
32b4	try the next pair
32b6	mismatch -> the tamper trap
32bd	any teardown active?
32c1	no -> return
32c2	phase 2 -> pull the player up
32c4	yes: take that branch
32c6	past phase 2 -> return
32c7	clear the accumulator
32c8	point at the wave-event latch
32cb	clear the wave-event latch
32cc	step to the periodic timer
32cd	reload the periodic-event timer
32cf	play the swoop sound
32d2	point at the wave-event state
32d5	advance the teardown phase
32d6	checksum a 0x20-byte ROM span from 0x0779
32d9	seed the running checksum
32dc	read a byte
32dd	sum the bytes
32df	advance the pointer
32e0	sum the whole run
32e2	keep the fingerprint bits
32e4	mismatch -> the tamper path
32e8	point at the wave counter
32eb	raise the player two rows
32ec	step it again
32ed	read it
32ee	reached the top?
32f0	at the cap: skip the advance
32f2	repaint the player sprite
32f6	play a sound
32f9	arena cell occupied?
32fd	yes -> wait
32fe	load the freeze marker
32ff	set the grab-active flag
3302	point at the wave-event state
3305	advance the teardown phase
3307	three tiles per row
330a	hold the stride
330b	three tiles across
330d	read a source tile
330e	copy a tile
330f	advance both pointers
3311	across the row
3313	restore the stride
3314	step to the next row
3315	read the row counter
3318	count the rows
3319	store it back
331c	done three rows?
331e	loop three rows
3320	reset the row counter
3321	reset the row counter
3325	two-tile row stride
3328	read the top-left source tile
3329	copy the first tile
332a	advance the source
332c	read the top-right tile
332d	copy the second tile
332e	advance the source
332f	step down a row
3330	read the bottom-right tile
3331	store the lower-left tile
3332	advance the source
3333	step back to the bottom-left
3334	read the bottom-left tile
3335	store the lower-right tile
333d	hunter-formation launch seed -- slot-1 first sprite tile (-> record +0x0f)
333e	slot-1 second sprite tile (-> record +0x10)
333f	slot-2 opening-animation index (-> record +0x04)
3340	slot-2 spawn coordinate (-> record +0x06)
3341	slot-2 first sprite tile (-> record +0x0f)
3343	slot-3 opening-animation index (-> record +0x04)
3344	slot-3 spawn coordinate (-> record +0x06)
3345	slot-3 first sprite tile (-> record +0x0f)
3346	slot-3 second sprite tile (-> record +0x10)
3347	end-of-table marker 0xff -- four launch slots seeded
3377	point at the enemy records
337b	record stride
337e	0x0e records
3380	service one record
3381	step each record
3385	next record
3387	service the whole bank
338a	read the record's live word low
338d	record inactive?
3390	rotate the free bit out
3391	yes -> skip
3392	read the record's state
3395	keep the low five bits
3397	below the first active state?
3399	past the motion range -> handled elsewhere
339a	dispatch on the state
339b	enemy-actor state-0 vector -> 0x33bd (tick the state timer, advance the frame)
339d	state-1 vector -> 0x3423
339f	state-2 vector -> 0x3536
33a1	state-3 vector -> 0x355b
33ad	state-9 vector -> 0x3d5c (animation-phase handler)
33af	state-10 vector -> 0x3d8f (blank the sprite band on timer expiry)
33b1	state-11 vector -> 0x3e69
33b7	state-14 vector -> 0x3f72
33b9	state-15 vector -> 0x3f7c
33bb	state-16 vector -> 0x3fe9 -- last entry of the 17-state dispatch table
33bd	count down the record's phase timer
33c0	still running -> return
33c1	advance the record's state
33c4	second pass?
33c8	yes -> its branch
33ca	read the spawn-phase counter
33cd	keep its low nibble -- the phase that indexes the turn-column table
33cf	point at the per-phase turn-column table
33d2	look up this phase's turn column
33d3	publish it as the shared turn column every mover reads
33d6	compare it against this actor's target column
33d9	equal: break the tie on the actor's aim vs its sub-position
33db	limit above the target: seat walk frame 0
33dd	...and the straight-run animation
33e0	no carry: keep it
33e2	limit below the target: bump to turn frame 1
33e3	...and the turn-around animation
33e6	store the chosen frame into the actor
33e9	point the actor at that animation and restart it
33ec	equal case: read the actor's aim
33ef	against its sub-position within the tile
33f2	aim still trails: seat the aim as the turn frame
33f4	aim caught up: defer to the interior-band arm
33f7	point at the caught-count cell
33fa	advance the eagle target-column bias
33fb	load the settle beat
33fd	reload the stage countdown to 6
3400	clear the accumulator
3401	clear the spawn-active flag
3404	clear the record's pass flag
3407	choose the target column
340a	point at the settle-left script
340d	test the direction flag
3411	up -> that sprite set
3413	down -> the other sprite set
3423	step this actor's animation first
3426	test the mode byte's low bit -- which movement arm runs
342a	clear: the actively-moving arm
342c	set: the arming arm waits on the animation-armed latch
342f	arrow anim still armed?
3430	yes -- idle this frame so a fresh animation can't race ahead
3431	latch clear: drop this actor out of the arming arm
3435	hand to the interior-band arm
3437	moving arm: read the actor's state byte
343a	moving vertically?
343b	nonzero -- the column-step mover; else fall into the X-move body
343e	the actor's sub-position within the tile
3441	add the speed to the sub-position
3444	no tile crossed
3446	carried past 0xff -- one whole column crossed
3449	store the new sub-position
344d	the shared turn column
3451	read the whole row
3454	wrap it inside the 32-column page
3456	below the target?
3457	still short -- keep walking
3458	landed exactly on it
345a	overshot: arm the turn-around
345e	the turn-around animation
3461	point the actor at it and restart
3464	on the turn column -- is the limit itself zero?
3465	limit 0: no interior to build -- straight to despawn
3468	read the in-play sub-state
346b	only sub-state 4 may build the band
346d	any other sub-state -- wait
346e	read the speed field
3471	has it caught up to the just-advanced position?
3472	not yet -- wait for the exact frame
3473	the interior-band-built latch
3477	no -- build it
347a	yes -- just mark this actor active
347f	building: clear the actor's active byte first
3483	the spawn-phase counter
3487	phase snapshot at 7?
3489	at or above 7 -- skip the band, go to despawn
348b	cap the phase snapshot at 0x0a
348d	held at the cap
348f	step the phase up one
3490	read it
3491	the per-phase turn-column table
3494	look up the new turn column
3495	reseed the shared turn column for the next wave
3498	the interior band's screen cell
349e	stamp the top-left interior tile
34a1	the top-right tile
34a3	step one tilemap row down
34a6	the bottom-left tile
34a9	the bottom-right tile
34ab	load the splash marker
34ad	raise the built latch so later movers skip the rebuild
34b0	blank the actor's sprite band -- it vanishes next frame
34b3	the live-enemy tally
34b6	one fewer enemy on the field
34b7	the per-stage countdown
34ba	read the stage countdown
34bc	zero: skip the tick
34bd	yes -- don't underflow it
34bf	tick the stage countdown down one
34c0	the in-play sub-state
34c3	the one sub-state that also steps the spawn phase
34c5	no: skip
34c7	point at the spawn-phase counter
34c8	advance it
34c9	the stage countdown value to display
34cd	point at the countdown display
34d0	one tilemap row over -- where the tens digit goes
34d3	below ten?
34d5	single digit -- draw it as-is
34d7	two-digit path: the play-mode latch
34da	play-mode latch set?
34db	an alternate mode owns the readout -- leave it
34dc	convert the count to two decimal digits...
34dd	...by adding one, count times, with decimal adjust
34df	decimal-adjust the tally
34e0	loop until the count is packed as BCD
34e3	write the ones digit
34e5	draw the units digit
34e6	move to the tens cell one row over
34e7	take the packed count
34e8	shift the tens digit down into the low nibble
34ec	keep it
34ef	suppress a leading zero
34f0	draw the tens digit
34f2	the actor's signed step
34f5	negate the vertical speed
34f7	keep it
34f8	read the Y fraction
34fb	sub-position underflow?
34fc	no: skip the row bump
34fe	borrow -- step the whole column down one
3501	apply the step to the sub-position
3504	store the Y fraction
3507	keep the new sub-position for the aim test
3508	the shared turn column
350c	read the whole row
350f	keep the low five bits
3511	at the turn column?
3512	exactly on it
3514	still above it -- keep travelling
3515	below it: is the column zero?
3516	end of the track -- despawn
3519	read the play sub-state index
351c	only in play sub-state 4
351e	only sub-state 4 acts
351f	past the turn -- disarm the actor's latch
3524	on the turn column: column zero?
3525	end of track -- despawn
3528	read the play sub-state index
352b	only in play sub-state 4
352d	only sub-state 4 turns
352e	read the speed field
3531	caught up to the new sub-position?
3532	not yet -- hold the turn off
3533	arm the interior band
3536	step the actor's animation
3539	spend one frame of the hold countdown
353c	still holding -- stay parked on this frame
353d	hold lapsed: the actor's flag byte
3540	high nibble set? -- this is the wave-tail actor
3542	plain actor -- just blank it
3544	the wave-tail tally
3547	one more lapse
3548	read it
3549	third pass?
354b	not yet
354d	point at the lane-spawn pacer
354e	clear the accumulator
354f	clear the lane-spawn pacer -- ends the spawn run
3550	clear the launch-arm latch -- frees the next wave to arm
3553	the blank fill value
3554	copy the record pointer
3556	point the fill at the actor record
3557	the sprite-band width
3559	zero the band -- the sprite stops being drawn
355a	return -- the sprite band is now all-zero, so the actor draws nothing next frame
355b	step the actor's animation
355e	the committed-to-target latch
3562	already latched -- just walk and dispatch
3565	the fine X
3568	add the per-frame step
356d	carried -- bump the coarse column
3573	carry it to the tails
3574	the stage countdown
3579	yes -- hand to the phase dispatch
357c	the active-lane count -- picks the target source
3580	lanes active: the alternate source
3582	normal play: the per-round target-column table
358a	halved -- selects the table row
358c	fetch that row's base
3590	the rolling frame counter
3593	low three bits pick a column in the row
3595	read the target column
359b	yes -- the pre-spawn guard
359e	still too near the edge it entered?
35a0	yes -- keep walking
35a1	far enough -- latch onto the target
35a5	the approach animation
35a8	the approach-variant flag
35ac	default approach
35ae	variant approach
35b1	point the actor at it and restart
35b4	lane path: the skip-lookup flag
35b8	clear -- step on the actor's own column
35ba	the alternate lane target table
35bd	indexed by the per-slot spawn tally
35c0	read the target from it
35c2	the actor's own column
35c5	straight to the range gate
3617	the actor's advanced X
361a	not yet -- nothing spawns this pass
361b	crossed below -- try the pre-spawn gate
361d	the end-of-move flag
3621	move still in progress -- nothing to close out
3622	step landed -- run the end-of-move dispatch
3625	the approach-committed flag
3629	already committed -- keep the chosen approach
362a	not yet -- re-resolve the target column
362d	the actor's phase byte
3630	low band?
3632	a settling actor -- the end-of-move guard
3634	high band?
3636	a targeting actor -- the target resolver
3638	middle band: the wave-progress counter
363d	no -- run the delay
363f	yes -- freeze the lower middle phases
3642	only the top middle phase slips through
3644	below it -- idle this frame
3645	the per-actor delay counter
364a	elapsed
364c	tick the delay down
364d	still waiting
364e	delay elapsed: the actor's X
364f	in the near half of the screen?
3651	far half -- don't reload or act
3652	aim at the delay counter
3653	the per-round delay-reload table
3656	the round
365b	fetch the reload value
365c	reload the delay, then fall into the pre-spawn gate
365d	this actor's spawn-arm bit
3661	clear -- spawn unconditionally
366a	six records to scan
366c	this record's state
3671	tally it
3672	next record
3675	exactly one in that state?
3676	no -- refuse the spawn
3677	seat a window over the sprite-object pool
367e	five slots to offer the spawner
3680	a candidate slot's first header byte
3687	clear -- this slot is free
3689	occupied -- next slot
368b	try the rest of the window
368d	pool full -- nothing spawns
3696	is this a lane actor?
369a	no -- skip the lane bookkeeping
369c	the per-slot spawn tally
369f	bump it
36a0	the active-lane count
36a5	none -- leave the pacer alone
36a7	consume one lane
36a8	the lane-spawn pacer
36ab	seed it with the pre-decrement lane count
36ac	its companion reset latch
36ad	clear it
36af	the machine-wide animation-frame id
36b2	step it
36b3	skip 0 on wrap...
36b5	...0 is reserved as no-sprite
36b7	tag the new actor with this frame id
36ba	the default spawn animation
36bd	the variant flag
36c3	the turn-variant animation
36c6	store the animation pointer, low
36cc	clear the animation sub-step
36d0	seed the spawn countdown
36d4	initial state
36d8	build the attribute byte
36db	initialise the found slot from the template
36de	the round number
36e1	clamp the round below 16
36e5	at 16 or over, pin it to 0x0e
36e8	the difficulty setting
36eb	doubled -- two rows per difficulty step
36ec	plus the round -- the base-table index
36ed	the attribute base table
36f0	seed the value from it
36f1	the record's armed bit
36f5	clear -- no step-down here
36f7	step the value down one
36f8	hit zero -- stop stepping
36fa	the record's phase bit
36fe	clear -- no second step
3700	step down once more
3701	zero -- stop
3704	the actor's phase field
370a	no -- skip the phase step-down
370c	early -- step down one
370d	zero -- stop
370f	and once more
3719	yes -- bias the value up by three
371c	the attribute merge table
371f	look up the merge bits
3720	lay them over the existing attribute
3723	store the attribute byte
3757	the signed velocity
375d	the low X byte
3763	borrow -- step the column/lap counter down
3766	apply the velocity to X
376d	the stage countdown
3772	yes -- the phase-state AI; else the end-of-move dispatch
3775	the in-play sub-state
3778	the board-finish phase?
377a	yes -- retire the actor
377c	otherwise the move counter
3781	still mid-pass -- leave it
3782	clear the animation latch
3786	the turn-around animation
3789	the variant flag
378d	default
378f	the variant turn-around
3792	point the actor at it and restart -- it reverses
3795	finish phase: the move counter
3799	not yet -- keep moving
379a	blank the sprite band -- the actor disappears
379d	mark the new slot live
37a1	its starting state
37a5	its collision key
37a9	clear the facing/variant flag
37ac	clear the frame-hold
37af	copy the template X, biased into sprite space
37b7	copy the template's paired position, biased likewise
37bf	the Y coordinate, nudged up one row
37c7	the column companion, nudged over one
37cf	the normal-speed table
37d2	the difficulty
37d9	yes -- the faster speed table
37dc	the speed-escalation index
37e3	clamp to the last entry
37e5	fetch the speed magnitude
37e6	the round
37eb	the magnitude
37ec	even -- travel one way
37ee	odd -- mirror the facing
37f0	the new actor's velocity
37f3	mirror it into the template too
37f6	the animation-pointer table
37f9	the template flag
37fc	its high nibble -- the shape selector
37fe	shift the nibble down to a table index
3802	fetch the animation-stream pointer
3805	the anim-override flag
3809	none -- use the looked-up stream
380b	override -- the fixed spawn animation
380e	store the anim flag
3811	the animation pointer, low
3817	the spawn frame delay
381b	announce the spawn with its sound
381e	store the animation pointer, low byte
3824	restart the sequence at frame 0
3829	actor animation script: each step writes a sprite tile pair (fixed 0x40 plus an animating shape) and a hold count; shapes cycle 0x26,0x27,0x28,0x27 then loop to the start
382a	animating shape tile 0x26 (-> record +0x0f)
382d	animating shape tile 0x27
3839	shape tile 0x26 -- first step of the tile cycle (this variant's fixed tile byte 0xc0)
383c	shape tile 0x27
3842	shape tile 0x27 -- cycle's last step
3844	0xff control code -- ends the script and reloads the animation pointer to loop
3845	loop-back pointer (low byte) to this script's start
3847	next actor-animation script begins (fixed tile byte 0x44)
3848	shape tile 0x26 -- first step (this variant's fixed tile byte 0x44)
384b	shape tile 0x27
3851	shape tile 0x27 -- cycle's last step
3853	0xff control code -- ends the script and loops
3854	loop-back pointer (low byte) to this script's start
3865	step this actor's animation
3868	tick the actor's countdown timer
386b	still counting -- hold this phase
386c	expired: advance the actor's sub-state
386f	clear its status bit
3876	check the record lies in the spawned-object band
3879	below the band -- done
387d	below the band base -- done
387e	in-band: run down two more record fields
3884	the free-running frame counter
3888	the integrity check runs only when it reads zero
3889	the top of the checked ROM block
388c	running sum
388e	carry tally
388f	fold each ROM byte into a running sum, walking downward
3892	accumulate the sum
3895	count an overflow
3896	the terminator marking the block bottom
3898	compare the byte under HL against 0x1a -- test the cell for that tile value
3899	keep folding until it
389b	add the carry tally to the sum
389d	the bits that must come out clear
389f	genuine ROM -- nothing amiss
38a0	a patched ROM: raise...
38a3	...the signature-mismatch flag
38a5	per-step speed ramp -- 16 values rising 0x10->0x17 then held, indexed by an animation phase
38b5	pointer table -- 16-bit entry addresses (0x38cb, 0x38da, ...) into the scripts that follow
39af	step the enemy's animation
39b2	the round-frame counter
39b5	its low bit alternates the motion axis
39b7	even frame: horizontal travel; else the vertical mover
39ba	the enemy's signed vertical velocity
39c0	the low byte of the vertical position
39c6	borrow into the coarse Y
39c9	apply the velocity
39cf	the coarse on-screen Y -- shrinks as it rises
39d2	the behaviour flag
39d6	plain climb -- the arrive-at-top step
39db	yes -- restart the actor's state machine
39df	yes -- coast this frame; else the fire/drop gate
3a10	the enemy's firing-state gate -- the status byte's high nibble must be set to shoot
3a12	not in a firing state -- no shot
3a13	read this enemy's shot-cooldown counter
3a16	is the cooldown spent?
3a17	ready -- go line up the shot
3a19	still recovering -- spend one cooldown frame
3a1d	read the player's X position
3a21	read the screen-flip flag
3a25	is the screen flipped?
3a27	upright -- take the X as-is
3a29	flipped -- mirror the player's X across the screen axis
3a2b	fold the pixel X down to its 8-pixel tile column
3a2e	keep the low five bits -- a column in 0..31
3a32	re-test the flip flag
3a33	upright -- no column nudge
3a35	flipped -- shift the aim column back two to re-register with the field
3a3b	test the round's parity
3a3e	even round -- aim straight at the player's column
3a40	odd round -- lead the target by four columns
3a42	does the aim column match this enemy's own column?
3a45	aligned -- fire a shot into a free slot
3a47	not aligned -- no shot this frame
3a6c	point at the launch counter
3a6f	count this launch attempt
3a70	base of the three-slot shot pool
3a74	three slots to check
3a76	record stride
3a79	read a slot's presence header
3a80	slot free -- claim it
3a82	step to the next slot
3a84	keep scanning the pool
3a86	every slot busy -- drop the launch this frame
3a87	read the launcher's aim/heading source
3a8a	strip the heading bias
3a8c	halve it -- headings are spaced two apart
3a8e	fold to a heading index in 0..7
3a91	default shot-coordinate table
3a97	test the round's parity
3a99	even round -- keep the default table
3a9b	odd round -- the alternate shot-coordinate table
3a9f	look up this heading's coordinate record
3aa3	seed the shot's heading low byte
3aab	mark the shot record seeded
3aaf	default throw animation for the firing enemy
3ab2	test the launcher's facing flag
3ab8	facing set -- the alternate throw animation
3abe	isolate the two mode bits
3ac0	are both set?
3ac4	both set -- the third throw animation
3ac7	arm the firing enemy's throw animation
3acd	recoil -- knock the step back
3acf	store the recoiled step
3ad2	mark the new shot slot live
3ad6	seed its state index -- enters hatching
3ada	seed its facing/variant flag
3ade	read the alternate play-mode latch
3ae2	default shot hit-flash animation
3ae5	normal mode -- keep the default
3ae7	alternate mode -- its hit-flash animation
3aed	test round bit two
3af1	set -- the upgraded hit-flash animation
3af4	store the shot's animation pointer low byte
3af7	store its high byte
3afa	clear the frame-hold so the first frame shows at once
3afe	clear the shot's armed/phase bit
3b02	seed the shot's state-pacing timer
3b09	back-link the shot to the launcher, low byte
3b0f	point at the rotating display-attribute index
3b14	wrap it to 0..7
3b17	default attribute table
3b1d	test the round's parity
3b21	odd round -- the alternate attribute table
3b24	load D as the index for the table lookup that follows
3b25	look up this index's attribute byte
3b26	rotate the firing enemy's own display attribute
3b29	return -- the looked-up step value is left in the actor record's +0x15 field
3be3	tick this enemy's animation stream
3be6	homing approach or free-run slide?
3bea	homing -- take the homing path
3bec	free-run -- read the sub-position
3bef	step it by the fixed free-run increment
3bf4	overflow -- carry one into the row counter
3bf7	store the advanced sub-position
3bfe	reached the arrival row?
3c00	not yet -- keep sliding in
3c01	arrived -- go tally it
3c10	homing -- read the homing velocity
3c19	about to wrap past zero?
3c1c	borrow one off the row counter
3c1f	step the sub-position by the velocity
3c26	fetch the linked shadow record's address, low
3c2f	mirror the position into the linked record
3c35	mirror the row into the linked record
3c38	homing arrival -- has the row masked to zero?
3c3a	not yet -- keep homing in
3c3b	point at the wave-arrival tally
3c3e	one more enemy arrived this stage
3c3f	point at the live-enemy count
3c42	one fewer live enemy
3c43	retarget to the wave-progress counter
3c45	bump wave progress -- ramps enemy fire aggression
3c46	read the band-kind field
3c49	isolate its high nibble
3c4b	plain kind -- just blank the sprite band and stop
3c4e	else blank the band, then run the lane reset
3c51	read the lane-reset one-shot latch
3c54	already fired this pass?
3c55	yes -- nothing more to do
3c56	point at the arrival counter
3c5b	reached the second qualifying arrival?
3c5d	not yet -- wait
3c5e	retarget to the lane-spawn countdown
3c60	clear the lane-spawn countdown
3c61	clear the launch-arm latch
3c64	clear the board-script advance guard
3c67	clear the slot-sweep latch
3c6c	re-seed the spawn-cadence timer
3c6f	arm the lane-reset one-shot so it will not re-run
3c72	read the screen-orientation flag
3c75	upright?
3c76	upright play -- skip the integrity probe
3c77	read the stage countdown
3c7a	still early in the stage?
3c7c	yes -- skip the integrity probe
3c7d	top of the program window to fingerprint
3c80	the count of bytes to fold
3c83	read a byte of the program image
3c84	walk downward
3c85	fold it into the running sum
3c88	loop over the window
3c8a	does it match the intact-image fingerprint?
3c8c	intact -- done
3c8d	else point at the tamper-strike slot
3c90	record a tamper strike
3c92	tick the parent's animation stream
3c95	count down the release timer
3c98	not due yet -- keep waiting
3c99	base of the four-slot formation table
3c9d	record stride
3ca0	four slots to try
3ca2	try to seat a child in this slot
3ca5	step to the next slot
3ca7	keep scanning for a free slot
3ca9	every slot full -- re-arm the release timer
3cae	read this slot's presence byte
3cb5	slot occupied -- keep scanning
3cb6	claim the free slot -- mark it live
3cbb	seed the child's spawn state
3cbf	the child's animation sequence
3cc2	store its pointer low
3cc8	reset the child to its first animation frame
3ccb	flip the parent into its launch state
3ccf	enable the parent's motion
3cd3	give the parent its launch velocity
3cd7	the parent's launch/drop animation
3cda	restart the parent on that animation
3cdd	read the parent record's field +4 -- decremented, seeds the spawned child's +4
3ce0	one row above
3ce2	place the child there
3ce5	read the parent's position field +3
3ce8	copy it into the spawned child record (+3)
3ceb	read the parent's field +6 -- incremented, sets the child just beside the parent
3cee	one column over
3cf0	place the child there
3cf3	read the parent's field +5
3cf6	copy it into the child (+5)
3cf9	enable the child's motion
3cfd	give the child the same launch velocity
3d01	step the freshly seated child's animation once
3d04	take the freshly seeded child-record pointer
3d07	link the child into the parent, low byte
3d0a	link the child into the parent's follow-on record field (+0x14/+0x15)
3d0e	return -- child actor spawned and linked to its parent
3d99	the turn-animation table
3d9c	read the variant/select flag
3d9f	keep its low two bits -- the turn selector
3da1	map turn variants 1..3 onto table indices 0..2
3da2	look up that variant's animation
3da5	install the turn animation and restart it
3da8	seed the turn motion byte
3dac	advance the enemy into its turn state
3db0	queue the turn's sound effect
3e69	tick the hatch countdown
3e6c	still dormant -- wait
3e6d	fetch the spawn-descriptor pointer, low
3e73	step past the descriptor's two-byte header
3e75	read the descriptor's type byte
3e76	below the recognized type window?
3e78	yes -- abandon the hatch and blank the sprite band
3e7b	at or above the window?
3e7d	yes -- abandon and blank
3e80	advance to the first position byte
3e82	seed the object's Y low byte
3e87	start one row above the descriptor value
3e88	seed the object's Y high byte
3e8d	seed the object's X low byte
3e92	seed the object's X high byte
3e95	clear the pointer high byte -- mark the descriptor consumed
3e99	advance the object from hatching into flight
3e9c	tick the object's animation stream
3e9f	waypoint path or free flight?
3ea3	waypoint -- follow the canned path
3ea6	free flight -- read the horizontal velocity
3eaf	add the horizontal velocity
3eb5	carry into the X high byte
3eb8	homing or drift descent?
3ebc	drift path
3ebe	homing -- take the current vertical step
3ebf	shrink it toward the target
3ec1	underflowed -- target reached
3ec7	ease it upward by the shrunk step
3ecd	borrow into the Y high byte
3ed0	save the shrunk vertical step
3ed3	read the X high byte
3ed6	isolate the tile column
3ed8	far enough across the field?
3eda	not yet -- keep flying
3ee0	still too far out -- keep flying
3ee1	the settle/landing animation
3ee4	seat it and restart
3ee7	arm the landing-state timer
3eeb	hand the record to its landed state
3eef	clear presence byte 0...
3ef3	...set byte 1 -- live but no longer in waypoint mode
3ef8	target reached -- clear the homing bit so it drifts from now
3efd	zero the vertical step -- no more homing motion
3f01	drift -- bump the cadence counter
3f07	one frame in four...
3f09	...idle, no vertical move this frame
3f0b	grow it by one -- accelerate the fall
3f0d	remember the increased step
3f10	add the step to the Y low byte
3f18	carry into the Y high byte
3f1b	go test the landing gate
3f1d	waypoint -- read the path-script pointer, low
3f23	read the lead byte
3f25	a loop marker?
3f29	skip past the marker to the real dx
3f2a	read dx
3f2e	subtract dx -- waypoint X moves left
3f34	borrow into the X high byte
3f37	advance to the dy byte
3f39	add dy to the Y low byte
3f41	carry into the Y high byte
3f44	step past the dy byte to the next pair
3f46	was this pair a loop point?
3f4a	rewind to the loop marker so the pair repeats
3f4d	write the path pointer back, low
3f56	reached the landing row?
3f58	not yet -- keep flying
3f59	land -- seat the settle animation
3f5c	the plummet-animation table
3f5f	read the object's variant byte
3f62	keep its low two bits -- the falling-object kind
3f64	bias down to a table index
3f65	look up that kind's plummet animation
3f68	point the object at it and restart from frame one
3f6b	seed the fall velocity
3f6f	advance to the running fall state
3f72	tick the object's animation stream
3f75	count the dwell down one frame
3f78	still dwelling -- stay in this state
3f79	dwell up -- advance to the catch state
3f7c	tick the caught object's animation stream
3f7f	take one gravity step
3f82	still airborne -- resume the fall next frame
3f83	the splash-animation table
3f89	keep its low two bits
3f8b	bias down to a table index
3f8c	look up that kind's splash animation
3f8f	seat it and restart
3f92	hand the record to its splash state
3f96	reload the splash-hold timer
3f9a	chime the two catch sound commands
3f9d	point at the live-enemy count
3fa0	one fewer live enemy on the field
3fa1	point at the stage countdown
3fa4	test the record's path flag
3fa8	set -- take the special path
3fab	is the quota already exhausted?
3fac	yes -- nothing to decrement
3fad	count one off the stage quota
3fae	repaint the stage-countdown digits
3fb1	special path -- force the stage countdown to zero
3fb5	repaint the now-zero stage-countdown digits
3fb8	top of the program block to fingerprint
3fbe	read a byte of the program image
3fbf	hit the block's end marker?
3fc1	yes -- finish the fold
3fc3	fold it into the running sum
3fc6	count an overflow
3fc8	walk downward through the block
3fcb	subtract the overflow count -- forms the check value
3fcc	does it match the intact-image value?
3fce	intact -- done
3fd1	altered image -- raise the catch tamper strike
3fd8	add the fall velocity
3fdb	no row crossing -- skip the carry into the row
3fdd	crossed a row -- carry one into the whole-row counter
3fe3	read the whole-row counter
3fe6	reached the landing row? -- carry reports still-falling
3fe9	top of the 16-byte program block to fingerprint
3fec	sixteen bytes to fold
3ff0	walk downward
3ff1	fold it into the running sum
3ff4	loop over the block
3ff6	test bit 0 of the fingerprint
3ff8	bit 0 set -- image altered
3ffa	test bit 5
3ffc	bit 5 clear -- image altered
3ffe	test bit 7
4000	bit 7 set -- fingerprint healthy, return
4001	point at the tamper-strike counter
4004	record a tamper strike
4006	frames left holding the current picture?
400c	still holding -- spend one hold frame
4010	reassemble the animation-script pointer, low
4017	a jump/loop opcode?
4019	yes -- follow the jump
401b	real frame -- store the tile code
401f	store the sprite attribute/colour byte
4024	store the new hold count
4029	save the advanced script pointer, low
4030	jump opcode -- read the new script address low
4036	read the new script address high
403a	re-read at the new location
403c	frames left holding the current frame?
4042	still holding -- spend one hold frame
4046	reassemble the stream pointer, low
404d	a jump opcode?
404f	yes -- follow the jump
4051	real frame -- store the display value
4055	store the per-frame parameter
405a	store the new hold count
405f	save the advanced pointer, low
4066	jump opcode -- read the new address low
4067	read the script's redirect target low byte
4068	reload the actor's animation-stream pointer low byte (record +0x0c) -- the script jumped itself
406c	read the new address high
406d	store the redirect high byte (record +0x0d) -- the stream now runs from the new address (loop/jump)
4070	re-read at the new location
4072	pointer table -- 16-bit entry addresses (0x407a, 0x408f, 0x4086, 0x409b) for the scripts below
40bd	base of the four-slot formation table
40c1	record stride
40c4	four records to step
40c6	preserve the loop counter across the call
40c7	run this record's current state handler
40cb	advance to the next record
40cd	loop over all four
40d0	read the record's presence byte
40d7	slot dormant -- skip it
40d8	read the record's state byte
40db	mask to the low five bits
40dd	is the state past the last handler?
40df	yes -- out of range, skip
40e0	dispatch through the state jump table that follows
40e1	object state-handler table -- one address per state, 0..16
4103	tick the object's animation stream
4106	count down the phase dwell
4109	still dwelling -- hold this phase
410a	dwell up -- advance to the next phase
410d	clear the phase's scratch field
4111	read the free-running frame counter
4115	not the zero crossing -- skip the integrity check
4116	top of the program block to fingerprint
4119	the block length
411c	clear the overflow count
411d	clear the running low total
411f	take its low nibble
4121	fold it into the running total
4125	count an overflow
4127	loop over the block
4129	the intact-image low total
412b	does the running total match?
412c	no -- record a strike
4130	require exactly one overflow
4131	both hold -- image intact, return
4132	point at the signature tamper-strike counter
4135	record a tamper strike
4137	tick the object's animation stream
413a	read the signed descent step
4143	will the step underflow the fine byte?
4146	yes -- borrow one off the row
4149	add the descent step to the fine position
4153	reached the landing row?
4155	still travelling -- keep descending
4159	its value plus one...
415a	...latch as the landing sound id
415e	reset the object to its settled phase
4162	load the settled dwell
4166	the landing-animation table
4169	look up this type's landing animation
416c	seat it and restart
416f	tick the object's animation stream
4172	count down the dwell
4175	still lingering -- stay on screen
4176	dwell up -- blank the sprite band so the object vanishes
4179	stub state handler -- hands control straight back, the deliberate do-nothing slot in the object state table
417a	read the object's arm index -- which animation this object should adopt now
417d	point at the arm-animation pointer table
4180	look up the animation-sequence pointer for that arm index
4183	install the looked-up animation sequence into the object record
4186	seat a fixed dwell before the object's next display event
418a	step the object from re-arm into its counting-down state -- falls straight into the countdown tail
418d	step the object's animation -- walk its tile/attribute script if the frame-hold has expired
4190	tick the display-event countdown down one
4193	still counting down -- hold in place this frame
4194	read the object's armed seed -- which variant of the strip to paint
4199	a zero seed leaves the base offset untouched
419b	nonzero seed -- drop one first so successive seeds pick successive strip variants
419c	load the base display command -- type byte 0x03, base low byte 0x12
419f	bias the low byte by the seed to select the strip variant
41a1	enqueue the two-byte display command into the display-command ring
41a2	re-arm the countdown to a single frame
41a7	store the bumped seed count back into the record
41aa	set the object to state 2
41ae	hand off to the shared dwell/dispatch tail -- blanks the sprite band for the frame
4221	step this moving object's animation program one tick
4224	test the movement-mode flag -- set = stepping down its column, clear = moving across in X
4228	down-moving: take the descend branch
422a	moving across: advance one column in X and count the columns crossed
422d	read the object's progress phase
4230	mask to the 0..31 travel counter
4232	reached the across-travel threshold?
4234	not yet -- fall into the shared spawn-cadence tail
4236	far enough -- flip the movement mode to down-stepping
423a	point at the turn-around animation script
423e	clear the shared turn-column threshold to zero
4241	arm the turn animation and restart it from the first frame
4244	down-moving: step the object one row down its tile column
424a	the 0..31 travel counter
424c	reached the down-travel threshold?
424e	past it -- fall into the shared tail
4251	read the stage clock
4256	very early in the stage -- skip the tamper signature check
4258	clear the movement mode back to across
425c	point at the turn-around animation script
4261	latch the turn-column threshold to the at-the-limit sentinel -- the turn fires on the next comparison
4264	arm the turn animation
4269	only the first steps of the stage run the check
426a	prepare the signature fold
4273	fold the running signature over the program bytes
4275	a byte mismatched -- go bump the tamper strike
427b	reached the terminator with the sum clean -- signature intact
427c	keep folding
4281	signature mismatch -- bump the tamper strike tally
4290	below the cadence phase?
4292	nothing to do this frame
4296	read the spawn-cadence delay
4298	already reseeded -- run the spawn sweep
429f	burn down the spawn-cadence delay one frame
42a1	read the stage clock
42a6	record stride is 0x18 bytes
42ab	point at the enemy-actor pool
42b4	scan the pool for a record already in state 7
42bb	step to the next record
42c6	reseed the spawn-cadence delay
42c9	point at the three-slot spawn-object table
42cd	three slots to offer
42cf	offer each record to the slot initializer in turn
42d5	step 0x18 bytes to the next record
42da	test the record header -- both bytes zero means the slot is free
42e1	occupied -- pass this record over
42e2	claim the slot -- mark it live
42e6	seed the new object's starting state
42f9	copy four bytes of position from the parent record into the new object
42fd	seed the new object's X velocity
4302	and its negated mirror component
4308	read the round counter
430e	round selects this round's descent parameters
4310	pick the descent parameters for this round
4317	clear the cadence delay
431d	arm the new object's animation
4320	seat the parent's dwell
4324	seat the new object's dwell
4328	step the parent's state
432b	drop one stack level -- unwind the sweep, one object born this pass
4350	step the actor's animation this frame
4353	tick the phase timer down one
4356	still holding -- wait another frame
4357	timer lapsed -- step the record to the neighbouring state handler
435a	choose the turn arm by bit 0 of the flag byte
435e	even flag -- latch the turn-column limit and arm the turn script
4361	odd flag -- clear the turn-column limit and arm the turn script
4364	read the object's dwell countdown
4368	dwell elapsed -- begin the fall
436a	still idling -- burn down the dwell
436d	hang motionless this frame
436e	step the object's animation
4371	integrate one gravity step downward
4374	still above the landing row -- keep falling
4375	reached the landing row -- blank the sprite band and retire the object
4378	stub state handler -- the do-nothing slot in the object state table
4381	byte budget for this paint run -- 0x1d cells
4383	read the display sub-phase selector
4386	primary destination pointer into video RAM
4389	primary source pointer into the layout stream
438e	sub-phase zero -- use the primary pointer pair
4390	otherwise the alternate destination pointer
4393	and the alternate source pointer
4397	fetch the next byte of the layout stream
439a	skip opcode -- jump a gap in the layout
439e	reload opcode -- load a new destination and end the run
43a0	literal byte -- paint it straight into video RAM
43a1	step the source
43a2	step the destination
43a3	loop until the byte budget is spent
43a5	nudge the destination past three cells
43ac	pick which pointer pair to save
43ae	save the advanced primary destination for the next call
43b1	and the advanced primary source
43b6	save the advanced alternate destination
43b9	and the advanced alternate source
43bf	read the skip distance
43c5	advance the destination by that distance, painting nothing
43c9	shrink the remaining budget by the same distance
43ca	more budget left -- keep interpreting
43ce	reload opcode: step past the 0xff marker to reach its operands
43cf	read the reload record's new destination low byte -- where painting resumes on screen
43d0	load the new destination low byte from the stream
43d2	read the new destination high byte for the resumed paint address
43d3	and its high byte
43d5	read the reload record's step-count operand
43d6	hold that step count for the display-list progress counter
43da	fold this record's step count into the display-list step counter (0x88b7)
43db	fold the following byte into the sub-phase tick counter
43de	advance the stream pointer past the 4-byte reload record
43df	end the run
43e1	display-list skip opcode -- jump the paint cursor ahead 16 cells, leaving them unchanged
43e3	literal display-list tiles -- copied straight into the on-screen layout
4412	more display-list literal tiles for the on-screen layout
442c	display-list skip opcode -- advance the paint cursor 20 cells, painting nothing
442f	literal tile between the skip runs
4430	display-list skip opcode -- skip 7 cells in the layout
4436	display-list skip opcode -- skip 7 cells before the next tile run
44b2	display-list literal tiles painted into the screen layout
44c4	display-list literal tile run for the on-screen layout
44d9	display-list literal tiles for the layout
44e3	display-list skip opcode -- skip 7 cells in the layout
44f0	display-list literal tiles for the layout
44f6	display-list skip opcode -- jump the paint cursor ahead 16 cells
44fd	display-list literal tiles for the on-screen layout
4507	display-list skip opcode -- skip 7 cells in the layout
4509	display-list skip opcode -- advance the paint cursor 20 cells
450b	literal tiles resuming after the skips
455e	display-list literal tiles -- a later section of the layout stream
456d	display-list literal tiles -- layout stream data
457c	display-list literal tiles -- layout stream data
458b	first tile code of the even first-round background layout run
458f	lead tile of the repeating pair that heads each layout run
4590	second tile of that repeating head pair
4595	background tile in the even first-round layout
459a	background tile opening this layout run
459e	lead tile heading the next layout run
459f	its paired head tile
45a4	background tile in the even first-round layout
45a9	background tile in the even first-round layout
45ab	skip -- advance ten cells, leaving that stretch of background blank
45ad	lead tile heading the next layout run
45ae	its paired head tile
45b3	tile code opening a short background run
45b6	skip -- ten-cell gap before the next run
45ef	lead tile heading a layout run
45f0	its paired head tile
45f5	tile code opening a four-tile background run
45f6	next tile of that run
45f9	background tile closing the run
45fc	tile code opening a background run in the even first-round layout
45fd	next tile of that run
45ff	another tile in the run
4601	background tile continuing the run
4603	paired head tile of the layout run
4608	tile code opening a short background run
460c	background tile closing the run
460f	tile code opening a background run
4610	next tile of the run
4612	another tile in the run
4615	lead tile heading the next layout run
4616	its paired head tile
461b	tile code opening a short background run
461e	next tile of the run
461f	background tile closing the run
4622	tile code opening a background run in the even first-round layout
4624	next tile of the run
4626	another tile in the run
4628	lead tile heading the layout run
4629	its paired head tile
462a	skip -- seven-cell gap in the layout run
462e	first painted tile of the odd first-round background layout
462f	its paired head tile
4630	skip -- seven-cell gap after the run head
4634	lead tile heading the next layout run
4635	its paired head tile
4636	skip -- seven-cell gap in the layout
463a	lead tile heading another layout run
463c	skip -- seven-cell gap in the layout
4640	lead tile heading another layout run
46e6	tile code in the odd resume-round background layout
46e8	another tile in this background run
46e9	tile code continuing the run
46ea	repeat of the run's opening tile
46ec	background tile in the run
46f0	lead tile heading the next layout run
46f1	its paired head tile
46f7	tile code opening a resume-round background run
46f8	start of a four-tile pattern that repeats across the run
46f9	fill tile of the repeating pattern
46fb	closing tile of the repeating four-tile unit
46fd	the pattern repeats -- second unit begins
4701	third repeat of the four-tile unit
4705	fourth repeat of the unit
4708	background tile after the repeating run
470a	next tile of that run
470b	another tile in the run
470c	lead tile heading the next layout run
470d	its paired head tile
4710	tile code opening a short background run
4712	background tile closing the run
4713	start of a four-tile pattern that repeats across this resume-round run
4714	second tile of the repeating unit
4715	doubled fill tile of the pattern
4717	the pattern repeats -- next unit
471c	another repeat of the four-tile unit
471d	second tile of that unit
4720	final repeat of the unit
4724	background tile after the repeating run
4726	next tile of that run
4727	another tile in the run
4728	lead tile heading the next layout run
4729	its paired head tile
472c	tile code opening a background run
472d	next tile of the run
472e	closing tile of the run
472f	tile code opening a resume-round background run
4730	background tile -- this 0x69 recurs at regular spacing down the run
4741	background tile after the run
4744	lead tile heading the next layout run
4745	its paired head tile
4746	skip -- short three-cell gap in the layout
4748	tile code opening a background run
4750	lead tile heading the next layout run
4751	its paired head tile
4754	tile code opening a short background run
4755	next tile of the run
475e	lead tile heading a resume-round layout run
475f	its paired head tile
4760	skip -- three-cell gap in the layout
4762	background tile -- painted twice for a two-cell block
4766	lead tile heading the next layout run
4767	its paired head tile
476a	background tile closing the run
47b2	layout-stream skip -- step the paint cursor 3 cells, painting nothing
47b4	start of this row's painted glyph run
47b8	fixed two-cell marker painted on the layout row
47bc	start of the next row's painted glyph run
47f7	this row's painted glyph run
47fb	fixed two-cell row marker
47ff	start of the next row's painted glyph run
4804	last glyph of the row before the skip
4805	layout-stream skip -- advance the paint cursor 17 cells to the next row
4808	fixed two-cell row marker
480c	start of this row's painted glyph run
480f	this row's painted glyph run
4815	a short glyph group after an in-row gap
4819	a glyph after an in-row skip
4822	start of this row's painted glyph run
4825	start of a wide band of pattern-fill tiles spanning the row
4838	second cell of the fixed row marker
483b	start of the next row's painted glyph run
483e	start of this row's painted glyph run
4844	start of a horizontal bar -- a run of fill tiles across the row
4853	fixed two-cell row marker
4857	start of the next row's painted glyph run
4859	start of this row's painted glyph run
485f	edge tile at the start of the bar-fill run
4860	run of bar-fill tiles across the row
4870	fixed two-cell row marker
4877	start of a patterned strip -- a repeating four-tile motif across the row
488a	edge tile ending the strip
488c	fixed two-cell row marker
4893	start of a patterned strip -- a repeating tile motif across the row
48a6	edge tiles ending the strip
48a8	fixed two-cell row marker
48ac	a short glyph group following the row
48af	start of a patterned strip -- a repeating tile motif across the row
48c2	edge tile ending the strip
48c4	fixed two-cell row marker
48c8	a short glyph group
48cb	start of a patterned strip -- a repeating tile motif across the row
48e0	fixed two-cell row marker
48e2	layout-stream skip -- 3-cell gap before this row's content
48e4	a short glyph group
48e8	fixed two-cell row marker
48ec	a glyph before the solid rule
48ed	start of a solid horizontal rule -- a run of one fill tile
48ef	continuation of the solid horizontal rule
48fd	end cap terminating the solid rule
4907	advance distance -- jump the paint cursor 22 cells to the next row
490a	layout-stream skip -- 3-cell gap before this row's content
490c	this row's painted glyph pair
4910	fixed two-cell row marker
4912	layout-stream skip -- 3-cell gap before this row's content
4914	this row's painted glyph pair
4918	fixed two-cell row marker
491a	layout-stream skip -- 3-cell gap before this row's content
491c	this row's painted glyph pair
49ae	screen-layout picture data -- disassembles as code here, but the screen loader copies these bytes to the tilemap rather than running them
49c4	more picture bytes -- still data, not instructions
49ce	more picture bytes
49d8	more picture bytes
49f4	more picture bytes
4a0b	read the round counter
4a0e	only the odd-bit round variant draws the marker
4a11	read the spawn-phase counter
4a14	snapshot the phase count for other consumers
4a17	mirror it as the rope/lift row count
4a1b	nonzero phase -- draw the marker stack
4a1d	phase zero -- fixed glyph anchor in the tilemap
4a20	save the marker layout pointer
4a28	draw the capping glyph block
4a2c	one marker segment per phase step
4a2d	top of the marker column in the tilemap
4a30	save the marker layout pointer
4a35	step up two tile rows between segments
4a38	left tile of the segment's top pair
4a3b	right tile of the top pair
4a3d	move up one row
4a3e	left tile of the segment's bottom pair
4a41	right tile of the bottom pair
4a43	up to the next segment
4a44	one segment per phase step
4a46	widen the upward step to clear the top of the finished marker stack before the cap
4a48	position the cap above the stack
4a49	point at the cap glyph block to draw
4a4c	draw the capping glyph block
4a50	screen-layout picture data resumes -- tilemap bytes, not code
4c97	one of the selectable full-screen graphic blocks -- a display-mode flag picks it to paint; the ROM-signature guard also jumps here, so a tampered board stalls in this data
4cb3	more of the screen-graphic block -- reads as code, but it is picture data
4ccf	more of the screen-graphic block
4ceb	more of the screen-graphic block
4cfc	more of the screen-graphic block
4d07	more of the screen-graphic block
4d21	more of the screen-graphic block
4d73	tile codes of a round-background display list -- copied straight into the playfield character map by the paint interpreter
4d7b	more tile codes of the same background list -- one byte per playfield cell
4d85	continuation of the background tile-code stream
4dd0	first cells of the paired color stream -- literal bytes painted into color RAM for the same background
4dd5	color-attribute bytes of the background color stream -- written into color RAM cell by cell
4def	more color cells of the same background color stream
4e09	color cells continuing the background color stream
4e23	color cells of the background color stream
4e3d	trailing color cells of the background color stream
4e3f	reload opcode -- jumps the color-RAM paint cursor to a fresh cell and ends the pass
4e40	low byte of the reload's new color-RAM destination (0x82a2)
4e42	reload's tick value -- added into the paint sub-phase frame counter
4e4f	color cells of the background color stream
4e55	skip opcode -- steps the color-RAM cursor forward 2 cells, leaving them unpainted
4e86	tile codes of a second round-background display list -- painted into the playfield character map
4ea2	more tile codes of that background list
4ebe	tile codes continuing the background list
4eda	trailing tile codes of the background list
4ef1	skip opcode -- advances the tile-map cursor 3 cells without painting
4f09	round playfield graphic stream -- packed tile-code data the display-list paints across this span, not executable code
4f45	round playfield graphic stream continues -- more tile-code data
4fb1	round playfield graphic stream continues -- more tile-code data
4fbb	round playfield graphic stream continues -- more tile-code data
4fc8	round playfield graphic stream continues -- more tile-code data
4fd2	round playfield graphic stream continues -- more tile-code data
4fe7	round playfield graphic stream continues -- more tile-code data
5005	round playfield graphic stream continues -- more tile-code data
5020	tail of the round graphic stream -- last tile-code bytes before the layout stream at 0x5039
509a	round playfield layout stream -- tile-placement data paired with the graphic stream to position each tile
50e0	tail of the round layout stream -- final placement bytes before the integrity gate at 0x50f1
50f1	read the object-freeze tamper flag
50f5	flag set on a tampered board -- divert off the normal path
50f7	point at the tilemap-checksum guard code
50fd	read the next byte of the guard code
50fe	the routine's terminator byte?
5102	fold it into the running sum
5106	carry into the high byte
5108	keep folding
510e	compare the sum against its expected sentinel
510f	hand off to the tilemap-checksum guard
511b	read the round counter
511e	branch on round parity
5120	even round -- run the one-shot formation-init branch
5122	odd round: run spawn scheduler A -- formation enemies
5125	run spawn scheduler B -- shot targets
5128	run the third spawn scheduler
512f	nothing pending here
5131	hunter-flip early branch
5135	run the per-frame spawn-script pipeline pass
5138	read the script advance guard
513c	a script step is still holding -- skip the spawn-timer tick
513d	tick the spawn-cadence timer -- seeds the next enemy when it lapses
5141	even round -- bring the formation object to life
5144	then run the shared tail
5146	install pass -- seed the spawn program when the stage clock hits a threshold
5149	arm pass -- count free enemy slots and raise the sweep go-signal
514c	release pass -- pace the cursor and activate one lane enemy
5150	read the script advance guard
5154	a program is already in force -- stay inert
5155	this round's script-threshold row
515b	round selects the script row
515d	index into the row of {stage-threshold, value} records
5161	read the stage clock
5166	stage barely started -- nothing to arm yet
5167	does the clock sit on this threshold?
5168	on a threshold -- install this program
516b	step to the next stride-2 record
5172	latch the advance guard -- re-arms once per threshold
5173	read the matched record's value byte -- the key selecting which spawn program to install
5175	stash the record's value byte
5178	index data table A by that value
517e	read the program blob's first byte: the initial delay before the first scripted enemy release
517f	seed the script pacing timer
5182	step past the delay byte to the first scripted spawn step
5183	seed the live script cursor
5187	restore the program key to index the alternate target-column/animation table
5188	index data table B by the same value
518e	point the alternate target-column source at that row
5192	clear, about to zero the per-spawn tally and re-open the one-shot lane reset
5193	reset the per-spawn tally
5196	re-open the one-shot lane reset
519a	round-to-script-row pointer table, indexed by the round's low nibble -- each word addresses that round's spawn records
51ba	per-round spawn records -- descending {stage-threshold, value} pairs; the arm matches the pair whose threshold equals the stage clock
526a	word table (based at 0x5264) mapping a program key to its enemy-release script blob
527a	enemy-release script blob -- initial delay then paced spawn steps
5284	enemy-release script blob -- paced spawn steps ending in an 0xff terminator
52a3	more enemy-release script-blob bytes
52b3	word table (based at 0x52b0) mapping a program key to its alternate target-column/animation source
52c4	first of ten 5-byte records addressed by the pointer list just above -- each a short run of small values that rise then fall
52db	interior records of that table -- a run of equal bytes marks a flat/steady entry
52e3	closing records of the table, just before the live routine at 0x52f6
52f6	read the script advance guard
52fa	no program in force -- nothing to arm
52fb	read the sweep latch
52ff	already armed this window -- stay locked out
5300	scan six enemy records, free count in C
5303	point at the enemy-actor pool
5309	read the record header
530b	both header bytes zero means the slot is free
530e	tally a free slot
530f	step to the next record
5313	at least four slots open?
5315	fewer than four free -- do not arm yet
5316	latch the free-slot count -- arms the scripted lane sweep
531c	fold 23 bytes of the program image
5321	fold the next program byte into the running sum
5326	does the low byte land on its sentinel?
5329	sum missed -- tamper
532e	checksum intact -- done
5332	checksum miss -- bump the tamper strike tally
5334	read the sweep latch
5338	sweep not armed -- no-op this frame
5339	read the live script cursor
533e	ordinary byte or the 0xff terminator?
533f	ordinary byte -- pace the next release
5341	terminator: the program ran out
5345	read the stage clock
5349	clock not yet past the armed threshold -- wait
534b	tear down: clear the advance guard
534e	clear the sweep latch
5351	clear the spawn-cadence timer -- board can arm its next program
5358	tick the pacing timer down
5359	still counting -- wait between releases
535b	reseed the timer from the script byte
535d	step the cursor to the next byte
5361	point at the enemy-actor pool
5368	sweep six slots
536b	offer each record to the activator
536f	step 0x18 bytes to the next record
5374	test the record header -- occupied if either byte is set
537a	occupied -- pass over
537e	tally a release
537f	claim the record -- mark it live
5386	default entry column
538a	odd round keeps the wide column
538c	even round -- narrow entry column
538e	stamp a fresh lane enemy into the record
53a0	seed the entry column 0xff -- the body runs its full start-of-scan countdown
53a2	run the shared spawn body -- stamp the actor into the claimed record
53b0	zero descriptor index -- nothing to spawn
53b2	read the spawn latch
53b6	a formation is already alive -- do not rebirth it
53b7	read the frame clock
53bb	not at the zero crossing -- wait for the pinned frame
53bd	raise the spawn latch -- born once per opportunity
53c0	point at the formation lead record
53c8	seed the record's X velocity
53cb	negate it
53cd	store the negated component
53d0	mark the record live
53d4	seed its starting state
53dc	seed the object kind
53e6	form the sentinel
53e7	latch the turn-column threshold to the sentinel
53ed	arm the record's turn animation
53f0	read the round counter
53f6	speed index would exceed the table?
53fa	cap the spawn-speed index at 6
53fc	publish the derived spawn-speed index
5403	publish the spawn-speed value for this round
540d	read the round counter
5412	even round -- formations do not appear
5419	blank the six-byte formation spawn-cursor row
541f	blank the second formation state row -- scheduler restarts clean
5420	point at the formation record table
5427	arm the first three slots
542a	initialise each record from the next parameter entry
542e	step 0x18 bytes to the next slot
5433	read the record header
5439	slot holds a live actor -- leave it untouched
543a	mark the slot live
543f	clear its state
5445	seed the starting Y
5449	seed the starting column
544d	clear the animation frame index
5450	the per-slot sprite-frame table
5453	read the formation spawn cursor
5457	pull this member's motion parameter from the table
5458	store it into the record
545b	the per-slot rise-step table
545f	pick this slot's vertical step
5460	pull and negate this member's speed
5462	store the step into the record
5465	the per-slot descriptor-pointer table
5469	index the animation-script table by cursor
546c	read the descriptor's type byte
546d	store the member's arm index
5470	the animation-script pointer table
5473	index the animation-pointer table
5476	install the animation-sequence pointer low byte
5479	and its high byte
547c	seat the dwell countdown
5480	prime the animation so a picture shows the first frame
5484	advance to the next spawn slot
5485	bump the spawn cursor to the next member
5489	mark the slot live
548e	clear the state
5491	clear the record's sub-state byte
5494	seed the starting Y
5498	seed the starting column
549c	take the sprite frame from B
549f	read the actor's kind/arm index
54a3	index the animation-pointer table by kind
54a6	look up the animation pointer
54a9	install the animation
54ac	seat the dwell countdown
54b1	look up the base speed for this kind
54b5	the current round number
54b8	keep the low three round bits
54bb	times three -- three bytes per round
54bc	round times three -- speed steepens with the round
54bd	pick this round's rise step
54be	negate the derived speed
54c0	publish it into the record
54c3	drop one stack level -- return above the caller
54c5	read the round counter
54c8	from round four on, spawn unconditionally
54ca	round 4 and up -- always run
54cc	rounds zero and one take the easier gate
54ce	read the operator difficulty switch
54d1	early rounds: test against the lower threshold
54d3	mid rounds: require difficulty of at least two
54d5	rounds 2-3 -- need difficulty at least 2 to spawn
54d8	early rounds: require difficulty of at least three
54da	rounds 0-1 -- need difficulty at least 3 to spawn
54db	point at the group-spawn countdown
54de	tick the formation spawn countdown
54df	not due yet -- wait
54e0	the spawn-interval reload table
54e3	the spawn-type cursor
54e6	schedule cursor low nibble picks the next interval
54e8	pick the next reload interval
54e9	reload the countdown from the interval table
54ef	advance the schedule cursor
54f0	point at the formation record table
54f4	record stride
54fa	read the record header
54fd	both header bytes zero means the slot is free
5500	occupied -- skip this record
5502	the new record's sprite frame
5504	point at the actor spawn-type table
5507	the spawn-type cursor
550a	schedule cursor picks the kind due next
550c	pick this spawn's type
550d	stamp the chosen kind into the record
5510	hand off to the actor constructor -- bring it to life
5514	step to the next record
5516	loop over the slots
5519	read the round counter
551c	round two and up spawn unconditionally
551e	round 2 and up -- always allowed
5520	read the operator difficulty switch
5523	require difficulty of at least two
5525	early rounds gated on difficulty
5526	point at the spawn-interval countdown
5529	tick the shot-target spawn countdown
552a	not due yet -- wait
552b	the interval reload table
552e	the spawn sequence index
5531	sequence cursor picks the next interval
5533	pick the next interval
5534	reload the countdown from the interval table
553a	advance the sequence cursor
553b	point at the spawned-object pool
5545	read the record header
5548	both header bytes zero means the slot is free
554b	occupied -- skip this record
554d	the new record's sprite frame
554f	point at the actor spawn-type table for this pool
5552	the spawn sequence index
5555	sequence cursor picks the kind due next
5557	pick this spawn's type
5558	stamp the chosen kind into the record
555b	hand off to the actor constructor
555f	step to the next record
5561	loop over the slots
5564	point at the formation-spawn reload timer
5567	tick it
5568	not due yet
5569	the interval reload table
556c	the spawn sequence index
5571	pick the next interval
5572	reload the formation-spawn timer
5578	advance the spawn sequence index
5579	point at the formation-spawn table
557d	record stride
5580	the current round number
5583	from round four, spawn two at once
5587	the difficulty setting
558a	test it
558b	difficulty zero -- no spawn this pass
558c	below four spawns one, else two
558e	spawn a single record
5592	spawn a pair of records
5595	read the slot's active word
5598	fold in the high byte
559b	slot busy -- skip it
559d	point at the guarded ROM region
55a0	point at its expected-complement bytes
55a3	eight bytes to verify
55a5	read a guarded ROM byte
55a6	add its expected complement -- should cancel to zero
55a7	nonzero -- the ROM was altered
55a9	next ROM byte
55ab	verify all eight
55ad	signature intact -- carry on
55af	point at the tamper-freeze flag
55b2	trip it -- the code was tampered
55bd	the new record's sprite frame
55bf	the spawn-type lookup table
55c2	the spawn sequence index
55c7	pick this spawn's type
55c8	store it as the record's type index
55cb	seat the record
55ce	swap back to the outer sweep's registers (loop counter and record stride, held in the alternate bank) before stepping to the next actor record
55cf	step to the next slot
55d1	loop over the slots
55d4	small per-entry parameter bytes (values 0x0b-0x28)
55f4	a rising-then-falling offset ramp (0x10 up to 0xf0, then back down) -- a movement/position offset curve
5624	the 0x5627 lookup table (19 entries) begins -- indexed by (0x8d14 & 0x0f), its value is stamped into the actor's +0x17 field
5654	pointer list -> five animation scripts (0x5661, 0x567c, 0x5697, 0x56b2, 0x56cd), then the first script starts
5674	animation-script bytes -- 3-byte steps (sprite tile, frame, 0x10 dwell), 0xff ends a script
5694	0xff ends a script; the next (tile base 0x49) follows its back-pointer
56c4	the last script (tile base 0x40) begins
56e4	0xff closes the final script, trailing back-pointer 0x56d9
56e8	the enemy respawn timer
56eb	test it
56ec	expired -- time to launch another
56ee	tick the timer down
56f2	no new enemy this frame
56f3	the current round number
56f6	even or odd round
56f8	even rounds run the climb-in path instead
56fb	the target enemy count for this stage
56fe	point at the live-enemy count
5701	target minus live -- the shortfall
5702	already at target
5703	already over target
5704	keep the shortfall
5705	the speed index
5708	below three uses speed+4 as the cap
570c	cap the live count at six
5710	otherwise cap at speed plus four
5713	the live-enemy count
5716	compare to the cap
5717	at the cap -- launch no more
5718	point at the enemy actor table
571c	six enemy slots
571e	the launching sprite code
5720	try to seat an enemy in this slot
5723	advance to the next actor record
5726	step to the next slot
5728	scan all six slots
572b	read the slot's active word
572e	fold in the second flag byte
5731	rotate its low bit into carry
5732	slot in use -- leave it
5733	take the shortfall as the wave size
5734	claim the slot -- mark it active
5738	set the launch state
573c	stamp the sprite code
573f	clear the rest of the record
5740	clear the sub-state
5743	clear the facing byte
5746	clear the sprite frame
5749	clear the work byte
574c	arm the motion flag
5750	clear the step accumulator
5753	the odd-round start-Y table
5756	the current round number
5759	even or odd round
575b	odd round keeps the odd table
575d	the even-round start-Y table
5760	the difficulty setting
5763	clamp difficulty to three
5767	cap the base column
5769	the base spawn column
576a	the gauge phase counter
576d	past phase four adds the column bias
5771	the spawn column bias
5774	add it to the base column
5776	the current round number
5779	even or odd round
577b	even rounds nudge the column by wave progress
577e	the current round number
5781	offset the column by the round
5783	past column thirty-one
5787	clamp to the rightmost column
5789	hold the spawn column
578a	look up the start X for this column
578b	store the enemy's X
578e	negate the step
5790	store it -- the enemy tracks leftward
5793	the launch animation script
5796	arm it on the record
5799	the odd-round start-Y table
579c	the current round number
579f	even or odd round
57a1	odd round keeps its table
57a3	the even-round start-Y table
57a6	the chosen column
57a7	pick the respawn delay for this column
57a8	reload the enemy respawn timer
57ab	point at the live-enemy count
57ae	one more enemy on screen
57af	advance the staged approach
57b2	drop the slot-loop return -- done for this frame
57b4	the stage countdown
57b7	only shift the column late in the stage
57ba	the wave progress counter
57bd	subtract the early-wave margin
57bf	still early -- no column shift
57c0	shift the spawn column by wave progress
57c3	drop the wave-size counter
57c4	last one placed -- run the wave-complete tail
57c6	point at the approach step counter
57ca	test it
57cb	idle -- nothing to step
57cd	approach already finished
57cf	approach already finished
57d1	advance the approach one step
57d2	point at the first stage timer
57d5	first stage done
57d7	tick the first stage timer
57d8	set the record's approach field
57dc	set its approach attribute
57e1	point at the second stage timer
57e4	second stage done
57e6	tick the second stage timer
57e7	set the record's approach field
57eb	set its flipped approach attribute
57f0	point at the third stage timer
57f3	third stage done
57f4	tick the third stage timer
57f5	set its final approach attribute
57fa	restart the approach step counter
57fc	the current round number
57ff	even or odd round
5801	even round -- take the even placement branch
5803	the speed index
5807	the spawn column bias
580a	add it to the speed
580b	past column thirty-one
580f	clamp to the rightmost column
5811	hold the placement column
5812	swap the record pointer into HL
5813	the odd-round coordinate table
5816	column times three -- three bytes per column
5817	add the column back -- times three per entry
5818	read the first coordinate byte
581a	write it into the record
581d	read the second coordinate byte
581e	write it into the record
5821	read the third coordinate byte
5822	write it into the record
5823	mark this as the final approach step
5825	run the staged approach
5828	past column thirty-one
582c	clamp to the rightmost column
5830	the even-round coordinate table
5833	share the coordinate writer above
5835	the special-actor active flag
5839	already active -- just step its approach
583b	raise the spawn-active latch
583d	raise the special-actor active flag
5840	arm the record's motion byte
5843	set its approach field
5847	set its approach attribute
584a	set its state
584e	the special-actor animation script
5851	arm it on the record
5854	point at the guarded ROM block
5857	eighty-two bytes to sum
585b	read a byte
585c	accumulate it
585f	carry into the high total
5860	next byte
5861	sum the whole block
5863	compare the low total to its expected value
5865	tampered -- flag it
5867	the expected high total
5869	compare it
586a	checksum matches -- ROM intact
586d	mismatch -- trip the integrity fault byte
5871	record this stage's speed index
5874	the target enemy count for this stage
5877	point at the live-enemy count
587a	target minus live
587b	already at target
587c	already over target
587d	the live-enemy count
5880	cap at six on screen
5882	already at the cap
5883	raise the spawn-active latch
5885	raise the special-actor active flag
5888	point at the enemy actor table
588c	six enemy slots
588e	the climbing sprite code
5890	try to seat an enemy in this slot
5893	next actor record
5896	step to the next slot
5898	scan all six slots
589b	a descending value curve (0x80 down to 0x14) -- a trajectory/position ramp for a spawned actor
58ab	continues the descending ramp, leveling toward 0x14
58bb	ramp tail, then a second copy of the descending curve begins (0x80..)
58db	an ascending value curve (0x10 up to 0x1c) begins -- the mirror/return ramp
58fb	ramp tail, then another ascending curve (0x10..0x1c)
591b	ramp tail, then 3-byte records begin -- a spawn/movement pattern table
592b	more 3-byte pattern records
596b	a run of repeated (0x06 0x00 0x00) triples -- an idle/hold pattern
598b	pattern records resume varying
59e8	the slot-one coinage setting
59eb	free play
59ed	no coin accounting needed
59ee	the slot-two coinage setting
59f1	free play
59f3	no coin accounting needed
59f4	debounce coin slot one
59f7	tally slot-one coins toward a credit
59fa	debounce and tally coin slot two
59fd	pulse the coin meter
5a00	run the periodic ROM-checksum tamper guard
5a03	finish the coin pass
5a06	read the coin input port
5a09	shift the slot-one coin bit down
5a0c	point at the slot-one debounce ring
5a0f	shift this frame's coin sample into the ring
5a12	keep the low three samples
5a14	look for a clean rising edge
5a16	not a clean edge -- ignore
5a17	register the accepted coin
5a1a	one credit
5a1c	add it to the credit count
5a1f	read the coin input port
5a22	point at the slot-two debounce ring
5a25	shift the slot-two coin bit down
5a27	shift this frame's coin sample into the ring
5a2a	keep the low three samples
5a2c	look for a clean rising edge
5a2e	not a clean edge -- ignore
5a30	register the accepted coin
5a33	point at the slot-two coin count
5a36	count this coin
5a39	the coins-per-credit accumulator
5a3a	add one coin unit
5a3c	store it back
5a40	reached the coins-per-credit threshold
5a41	not enough coins yet
5a44	round down to whole credits
5a46	carry the remainder
5a4b	fold it back into the accumulator
5a4c	store the remainder
5a4e	check the credit-award nibble
5a50	the free-credit marker
5a52	bank the credit
5a54	award a batch of credits
5a56	read the coin input port
5a59	point at the slot-one debounce ring
5a5c	shift the slot-one coin bit down
5a5d	shift this frame's coin sample into the ring
5a60	keep the low three samples
5a62	look for a clean rising edge
5a64	not a clean edge -- ignore
5a66	register the accepted coin
5a69	point at the slot-one coin count
5a6c	count this coin
5a6f	the coins-per-credit accumulator
5a70	add one coin unit
5a72	store it back
5a76	reached the coins-per-credit threshold
5a77	not enough coins yet
5a7a	round down to whole credits
5a7c	carry the remainder
5a81	fold it back into the accumulator
5a82	store the remainder
5a84	check the credit-award nibble
5a86	the free-credit marker
5a88	bank the credit
5a8a	award the full ninety-nine credits
5a8c	point at the credit count
5a8f	add the awarded credits
5a90	store the new total
5a91	past the ninety-nine cap
5a95	clamp to ninety-nine
5a97	the credit-display command
5a9a	queue the credit-display refresh
5a9c	the slot-one coin count
5a9f	test it
5aa0	no coin pending
5aa1	point at the coin-meter pulse timer
5aa6	pulse already running
5aa8	start a coin-meter pulse
5aab	drive the coin-meter output high
5aaf	tick the coin-meter pulse
5ab0	pulse just finished
5ab2	read the pulse timer
5ab3	halfway through the pulse
5ab5	not yet
5ab6	drop the coin-1 meter low
5ab7	drop the coin-meter output
5abb	point at the slot-one coin count
5abe	one fewer coin pending
5ac0	the slot-two coin count
5ac3	test it
5ac4	no coin pending
5ac5	point at the coin-meter pulse timer
5aca	pulse already running
5acc	start a coin-meter pulse
5acf	drive the second coin-meter output high
5ad3	tick the coin-meter pulse
5ad4	pulse just finished
5ad7	halfway through the pulse
5ad9	not yet
5ada	drop the coin-2 meter low
5adb	drop the second coin-meter output
5adf	point at the slot-two coin count
5ae2	one fewer coin pending
5ae4	run the odd-round actor-box pass
5ae7	run an actor-box update pass
5aea	run another actor-box update pass
5aed	resolve projectile hits on both actor boxes
5af0	advance the formation and wave state
5af3	run the round-five integrity check
5af6	scan projectiles against the target slots
5af9	scan the enemies for a target lock
5afc	resolve actor-vs-object collisions
5aff	run the enemy-table update pass
5b02	tear down finished lanes
5b06	the current round number
5b09	only guard round five
5b0b	not round five -- skip
5b0c	point at the guarded routine
5b17	six bytes to sum
5b19	read a byte
5b1a	accumulate it
5b1d	carry into the high total
5b1e	hold the low sum
5b1f	next byte
5b20	sum all six
5b22	fold in the high total
5b23	compare to the expected checksum
5b25	checksum matches -- code intact
5b26	point at the tamper-freeze flag
5b2a	trip it -- the code was altered
5b2c	the lane-spawn countdown
5b2f	test it
5b30	no lane spawn pending
5b31	the live-lane count
5b35	lanes still active -- wait
5b36	the lane-ready flag
5b3a	already ready -- go launch
5b3c	point at the first enemy's frame
5b3f	record stride
5b42	six enemy slots
5b44	the descending sprite frame
5b46	the current round number
5b49	even or odd round
5b4b	odd round keeps that tag
5b4d	the climbing sprite frame
5b4f	read this enemy's sprite frame
5b50	matches the launch frame
5b51	found one ready to launch
5b53	next slot
5b54	scan all six
5b57	point at the enemy actor table
5b5b	record stride
5b5e	six enemy slots
5b61	launch this enemy
5b65	next slot
5b67	scan all six
5b6a	clear the lane-spawn countdown
5b6d	clear the launch-arm latch
5b71	read this enemy's state
5b74	only launch-ready enemies
5b76	not landed -- skip
5b77	the launch-armed bit
5b7b	not armed -- skip
5b7c	read its sprite frame
5b7f	past the launch-frame range
5b81	still airborne -- skip
5b82	commit the launch
5b86	point at the enemy actor table
5b8a	record stride
5b8d	six enemy slots
5b90	check this enemy for a target lock
5b94	next slot
5b96	scan all six
5b99	the motion-armed bit
5b9d	exempt -- always check
5b9f	the current round number
5ba2	even or odd round
5ba4	odd round -- skip
5ba5	the record's active bit
5ba9	inactive -- skip
5baa	the record's visible bit
5bae	invisible -- skip
5baf	read its state
5bb2	only tracking enemies
5bb4	not attacking -- skip
5bb5	point at the actor coordinate boxes
5bb8	point at the first target record
5bbc	two target records
5bbe	target active
5bc2	inactive -- skip it
5bc5	target already claimed
5bc9	claimed -- skip it
5bcb	the vertical hit window
5bcd	the flip-screen flag
5bd1	screen flipped -- keep the wider window
5bd3	narrow the window when upright
5bd5	read the enemy's coarse Y
5bd8	its fine Y
5bdb	combine coarse and fine into a scaled Y
5be4	bias by the window
5be5	minus the target's Y
5be8	take the absolute distance
5bec	farther than the vertical window
5bee	too far -- try the next target
5bf0	advance to the box's X
5bf2	the horizontal hit window
5bf4	the current round number
5bf9	even or odd round
5bfb	narrow the window this round
5bfd	read the enemy's coarse X
5c00	its fine X
5c03	combine coarse and fine into a scaled X
5c0c	bias by the window
5c0d	minus the target's X
5c10	take the absolute distance
5c14	farther than the horizontal window
5c16	too far -- try the next target
5c18	the hit animation script
5c1b	the alternate-frame bit
5c1f	use the alternate script
5c21	pouncing -- use the pounce animation
5c24	arm the hit animation on the enemy
5c27	set its hit field
5c2b	set its hit attribute
5c2f	point at the sprite-object table
5c33	record stride
5c36	five object slots
5c38	match this enemy's link id
5c3b	against the object's link id
5c3e	found the linked object
5c40	next object slot
5c42	scan all five
5c44	drop the return -- a hit resolved this frame
5c46	advance past this target record
5c48	step to the next target field
5c4a	record stride
5c4d	step to the next target
5c4f	two targets checked
5c50	check the other target
5c54	the object death-script pointer table
5c57	read the enemy's type field
5c5a	isolate its high nibble
5c5c	shift it down to an index
5c60	fetch the death script for this type
5c63	the object's alternate-frame bit
5c67	use the primary script
5c69	use the alternate script
5c6c	mark the struck object as hit
5c70	arm its death animation
5c75	low byte of the new animation-script pointer into the actor record
5c78	high byte too -- the record now plays the new script
5c7b	rewind the animation to step 0 -- the old index is stale against a new script
5c80	animation-script record -- steps of (tile, frame, dwell) closed by 0xff, then a back-pointer
5c90	pointer list -> the per-actor animation scripts (0x5c8c, 0x5ca8, 0x5cb1, ...)
5ca0	pointer-list tail, then a script (tile base 0x40) begins
5cb0	script back-pointer, then the next script (tile base 0x41)
5cc0	0xff-closed scripts (tile bases 0x49, 0x4a) with their back-pointers
5cd0	next scripts (tile bases 0x41, 0x44)
5ce0	next scripts (tile bases 0x4e, 0x4f)
5cf0	a script (tile 0x44), then a longer four-step script (frame 0xa1, dwell 0x08)
5d00	the four-step script continues and 0xff ends it, back-pointer 0x5cfc
5d0b	point at the first enemy actor record
5d0f	record stride -- 0x18 bytes per actor
5d12	six enemy slots to service
5d15	tick this record's animation-hold clock
5d19	advance to the next enemy record
5d1b	repeat for all six slots
5d1e	is this actor flagged to always animate?
5d22	yes -- skip the odd-round gate
5d24	read the round counter
5d27	even or odd round
5d29	otherwise animate only on odd rounds -- skip this frame on even
5d2a	skip a dormant slot -- active flag clear
5d2e	inactive -- skip
5d2f	only run the hold clock while the actor is armed
5d33	not reacting -- skip
5d34	count the animation-hold timer down
5d37	still dwelling on this cell -- done
5d38	read the phase counter
5d3b	keep its low two bits (0..3)
5d3d	phase exhausted -- stop the animation
5d3f	step to the next cell
5d40	save the stepped phase
5d43	re-arm the hold clock for the next cell
5d48	disarm -- the animation has run out
5d4d	point at the fixed reference object -- its X/Y centre
5d51	point at the first target coordinate slot
5d55	point at the first projectile record
5d58	three candidate pairs to test
5d5a	test this pair for an overlap, claiming it on a hit
5d5d	target slots are 4 bytes apart
5d60	step to the next target slot
5d62	record stride 0x18
5d64	step to the next projectile record
5d65	repeat for all three pairs
5d68	read the record's kind byte
5d6a	empty slot -- skip
5d6b	already caught (kind 5)?
5d6d	skip a claimed record
5d6e	upright X registration bias (-4)
5d72	read the screen-orientation flag
5d76	upright screen -- keep the upright bias
5d78	flipped-screen X bias (+5)
5d7a	and the Y bias for the flipped screen
5d7c	reference X
5d7f	add the X bias -- the box edge
5d81	reference Y
5d84	add the Y bias
5d86	target X
5d89	horizontal gap to the source box
5d8c	absolute value of the gap
5d8e	gap must be under 4 pixels
5d90	too far horizontally -- no hit
5d91	target Y
5d94	shift by the +8 margin
5d96	vertical gap
5d99	absolute value
5d9b	vertical gap must be at least 9 -- reject if closer
5d9d	too near -- no hit
5d9e	and under 15
5da0	too far vertically -- no hit
5da1	point the record cursor at the arrow
5da2	aim the index register at the struck record
5da4	a hit -- tear the record's kind down
5da8	seat its post-catch state
5dac	and its new mode byte
5db0	mark it caught
5db4	address of its landing animation script
5db7	store the script pointer high byte
5dba	and low byte
5dbd	queue the catch sound
5dc0	unwind past the pair loop -- one catch per pass
5df7	read the grab latch
5dfb	a grab is already in progress -- do nothing
5dfc	read the formation-busy flag
5dff	point at the wave-teardown state
5e02	combine with the wave-teardown flag
5e03	a formation or teardown is busy -- skip the grab test
5e04	point at the arrow tip as the reference object
5e08	point at the first target coordinate slot
5e0c	point at the first projectile record
5e0f	three slots to sweep
5e11	test this slot for a grab, claiming it on a hit
5e14	target slots 4 bytes apart
5e17	next target slot
5e19	record stride 0x18
5e1b	next projectile record
5e1c	repeat for all three slots
5e1f	read the record's kind byte
5e21	empty slot -- nothing to catch
5e22	already caught?
5e24	skip a claimed record
5e25	upright X bias (+9)
5e29	read the screen-orientation flag
5e2d	upright screen -- keep the upright bias
5e2f	flipped-screen X bias (-9)
5e31	and the flipped Y bias
5e33	reference X
5e36	add the X bias
5e37	offset to the grab point
5e38	reference Y
5e3b	add the Y bias
5e3d	target X
5e40	horizontal gap
5e43	absolute value
5e45	gap must be under 2 pixels -- a tight catch
5e47	too far horizontally -- no grab
5e48	target Y
5e4b	+8 margin
5e4d	vertical gap
5e50	absolute value
5e52	vertical gap must be under 9
5e54	too far vertically -- no grab
5e55	raise the grab-in-progress flag
5e57	raise the grab latch -- a catch has landed
5e5a	point the record cursor at the target
5e5b	aim the index register at the caught record
5e5d	address of the catch spawn template
5e60	install the caught actor's animation, rewound to step 0
5e63	seat its timer field
5e67	tear the record's kind down
5e6b	seat its post-catch state
5e6f	and its mode byte
5e73	queue the grab sound
5e76	unwind past the slot loop -- one grab per pass
5e78	read the round counter
5e7b	low bit -- odd round?
5e7d	even round -- skip the collision sweep this frame
5e7e	point at the first actor-record slot -- the target box
5e82	two parity passes
5e84	slot stride 4
5e87	parity selector 0 for the first pass
5e88	stash the parity in the interrupt register
5e8a	scan this shooter against the formation
5e8b	screen this parity's formation record against the slot
5e8f	advance to the next actor-record slot
5e91	parity selector 1 for the second pass
5e95	run the second parity
5e98	read the parity selector
5e9a	assume the parity-0 formation record
5e9e	pick the pair by index
5e9f	parity 0 -- keep it
5ea1	parity 1 -- use the other formation record
5ea5	is this pair active?
5ea9	dormant -- nothing to scan
5eaa	latch the chosen pair so the sweep body can find it
5eae	which sweep flavour does the pair want?
5eb2	point at the coordinate boxes to scan
5eb6	four slots
5eb8	point at the records to test
5ebb	flavour bit set -- run the mark-struck-and-flash sweep instead
5ebd	read the slot's lead/presence byte
5ebf	empty slot -- step to the next
5ec1	hop to the state byte
5ec3	read the state byte
5ec6	busy or mid-action (>=4)?
5ec8	not catchable -- skip
5eca	bias the coordinates and check it still clears the bottom
5ecd	dropped off the bottom -- skip
5ed0	target box X
5ed3	horizontal gap
5ed6	absolute value
5ed8	gap must be under 10
5eda	too far horizontally -- skip
5edc	target box Y
5edf	+8 margin
5ee1	vertical gap
5ee4	absolute value
5ee6	gap must be under 9
5ee8	too far vertically -- skip
5eea	clear the member -- it is struck
5eeb	a genuine overlap -- tear the caught record down
5eed	seat its post-catch state
5ef0	and its mode byte
5ef2	recover the latched target pair
5ef6	already wiped once this pass?
5efa	yes -- just sound the hit
5efc	point at the struck target record
5eff	0x17 bytes
5f01	wipe the struck target record
5f02	queue the hit sound
5f06	slot stride 4
5f09	advance the coordinate cursor
5f0b	record stride 0x18
5f0d	advance the record cursor
5f0e	test the next slot
5f11	read the slot's state byte
5f13	empty slot -- skip
5f15	already struck this pass?
5f17	skip
5f19	bias the coordinates and check it clears the bottom
5f1c	off the bottom -- skip
5f1f	target box X
5f22	horizontal gap
5f25	absolute value
5f27	gap must be under 7
5f29	too far horizontally -- skip
5f2b	target box Y
5f2e	+8 margin
5f30	vertical gap
5f33	absolute value
5f35	gap must be under 6
5f37	too far vertically -- skip
5f39	a hit -- mark the slot struck
5f3b	point at the first screen-flash cell
5f3e	read the parity
5f40	parity 0 -- use the first cell
5f42	parity 1 -- use the second flash cell
5f43	light the flash cell
5f45	queue the hit sound
5f47	coordinate stride 4
5f4a	advance the coordinate cursor
5f4c	record stride 0x18
5f4f	advance the record cursor
5f50	test the next slot
5f52	test the remaining slots
5f53	upright X registration bias (+6)
5f55	read the screen-orientation flag
5f59	upright screen -- keep the upright bias
5f5b	flipped-screen X bias (-2)
5f5d	actor X
5f60	apply the orientation bias
5f61	hand back the biased X
5f62	actor Y
5f65	+8 margin
5f67	still above the bottom row of the field? -- carry reports on-screen
5f6a	point at the first actor-record slot -- the box
5f6e	two slots to sweep
5f70	slot stride 4
5f73	parity 0
5f74	stash the parity in the interrupt register
5f76	scan this shooter against the enemies
5f77	scan the enemy records against this box
5f7b	advance to the second slot box
5f7d	next parity from the counter
5f7e	second-box parity
5f80	run the second slot
5f83	assume the parity-0 formation record
5f87	read the parity
5f8a	parity 0 -- keep it
5f8c	parity 1 -- the other record
5f90	read the record's kind/liveness byte
5f94	nothing armed in this slot -- done
5f95	latch the active hit type -- the threshold selector
5f98	keep the type for the scan
5f99	point at the enemy coordinate boxes
5f9d	six enemy records
5f9f	point at the first enemy record
5fa2	read the record's active flag
5fa4	empty slot -- advance
5fa6	hop to the state byte
5fa8	read the record's kind
5fab	the catchable kind (5)?
5fad	wrong kind -- advance
5faf	upright X bias (+6)
5fb1	read the screen-orientation flag
5fb5	upright screen -- keep the upright bias
5fb7	flipped-screen X bias (-5)
5fb9	enemy box X
5fbc	apply the bias
5fbd	offset to the box edge
5fbe	enemy box Y
5fc1	+8 margin
5fc4	target box X
5fc7	horizontal gap
5fca	absolute value
5fcc	keep the horizontal gap
5fcd	the hit type
5fce	type 3 wants a wider window
5fd0	restore the gap
5fd1	other types use the tight window
5fd3	type 3 -- gap must be under 16
5fd5	too far -- advance
5fd7	passed -- test the vertical axis
5fd9	tight window -- gap must be under 8
5fdb	too far -- advance
5fdd	target box Y
5fe0	+8 margin
5fe2	vertical gap
5fe5	absolute value
5fe7	keep the vertical gap
5fe8	the hit type
5fe9	type 3?
5feb	restore the gap
5fec	other types -- tight window
5fee	type 3 -- gap must be under 18
5ff0	too far -- advance
5ff4	tight window -- gap under 8
5ff6	too far -- advance
5ff8	the hit type
5ff9	type 3?
5ffb	yes -- retire the struck record
5ffd	point HL at the target box
6000	the target box's low address selects which flag cell
6001	assume the first struck-record flag cell
6004	is this the first target slot?
6006	yes -- keep it
6008	otherwise the second flag cell
600b	raise the struck-record flag
600d	its partner cell six bytes on
6011	raise the partner flag too
6013	queue the hit sound
6016	unwind past the caller's loop -- one hit per pass
6018	coordinate stride 4
601b	advance the coordinate cursor
601d	record stride 0x18
601f	advance the record cursor
6020	one slot down
6021	test the next record
6025	aim the index register at the struck record
6028	point at the type-3 hit tally
602b	bump the tally
602c	hand the struck record to the retire/reset handler
602f	point at the first target box
6033	two boxes to scan
6035	parity 0
6036	stash the parity
6038	box stride 4
603b	scan this shooter against the objects
603c	run the single-slot proximity scan for this box
6040	advance to the second box
6042	next parity
6043	second-box parity
6045	scan the second box
6048	assume the parity-0 presence record
604c	read the parity
604f	parity 0 -- keep it
6051	parity 1 -- the other presence record
6055	read its kind/liveness byte
6059	empty -- nothing to scan
605a	kind 3 excluded here
605c	skip
605d	latch the active object type
6060	point at the object coordinate boxes
6064	five object records
6066	point at the first sprite-object record
6069	read the record's active flag
606b	empty slot -- advance
606e	hop to the state byte
6070	read the state
6073	the collidable kind (5)?
6075	wrong kind -- advance
6078	read the round counter
607b	odd round?
607d	odd round -- run the award resolver
6080	upright X bias (+6)
6082	read the screen-orientation flag
6086	upright screen -- keep the upright bias
6088	flipped-screen X bias (-2)
608a	object box X
608d	apply the bias
608e	offset to the box edge
608f	object box Y
6092	+8 margin
6095	target X
6098	horizontal gap
609b	absolute value
609d	gap must be under 9
609f	too far -- advance
60a1	target Y
60a4	+8 margin
60a6	vertical gap
60a9	absolute value
60ab	gap must be under 8
60ad	too far -- advance
60af	offset to the record's collision tag (+0x14)
60b3	point at the enemy actor pool
60b7	read the struck record's tag -- the key
60b8	six enemy records to search
60ba	record stride
60bc	does this enemy carry the key?
60bf	match -- inspect it
60c1	next enemy record
60c4	keep searching
60c6	no match -- mark the hit and seed the record
60c8	is the matched enemy armed?
60cc	not armed -- fall through to the seed
60ce	read the active object type
60d1	type 3?
60d3	other type -- engage the matched target record
60d5	back the pointer up to the record base
60d9	point at the parity-1 hit-flag cell
60dd	read the interrupt-register parity
60df	parity set -- keep the second cell
60e1	parity 0 -- step to the first hit-flag cell
60e3	raise the hit flag for this parity slot
60e7	the fresh record's opening datum
60ea	seed a new actor record with it
60ed	offset back to the collision key
60f0	resolve which enemy the shot struck
60f2	coordinate stride 4
60f5	advance the coordinate cursor
60f7	record stride 0x18
60f9	advance the record cursor
60fa	one record down
60fb	test the next object record
60ff	assume the parity-0 target record
6103	read the parity
6105	parity 0 -- keep it
6107	parity 1 -- the other target record
610b	engage the target record -- seat its state
610f	and its active marker
6113	queue the hit sound
6116	unwind past the caller's loop
611f	form the pointer to the collision key
6120	read the key the shot carries
6121	six enemy records to search
6123	record stride
6126	point at the enemy actor pool
612a	does this enemy carry the key?
612d	match -- dispose of it
612f	next enemy record
6131	keep searching
6133	no match -- read the active object type
6136	type 3?
6138	yes -- suppress the miss cue and continue
6139	queue the shot sound -- it hit nothing
613d	is the struck record live/armed?
6141	not live -- give up and clear the active type
6143	read the round counter
6146	odd round?
6148	odd round -- reset the record
614a	read the active object type
614d	type 3?
614f	not type 3 -- reset the record
6151	even round, type 3 -- take the record's own tag as the key
6154	point at the sprite-object pool
6158	record stride
615b	six slots to search
615d	does this object carry the tag?
6160	match -- engage it
6162	next object record
6164	keep searching -- reset the actor if none match
6167	blank the record's lead byte -- free the slot
616a	seat its idle opening state
616e	and its mode byte
6172	reset its flag byte
6176	and its timer field
617a	clear its collision tag
617d	clear its animation step
6180	read the active object type
6183	type 3?
6185	other type -- queue the shot sound and bail
6187	type 3 -- queue its event sound
618b	clear the active object type
618e	unwind the caller's frame
6190	engage the matched object -- seat its state
6194	and its parameter -- the object turns on
6198	now reset the actor record and bail
619a	queue the shot sound
619d	clear the active type and bail
619f	stamp the record's opening lead byte
61a2	seat its opening state
61a5	and its mode byte
61a7	step 0x10 bytes into the record
61ab	plant the marker the per-frame scan looks for
61ad	step four more bytes -- to the tag field
61b0	store the caller's datum low byte
61b2	and high byte -- record pointer left at +0x17
61b8	point at the object's link id
61b9	step to the record's collision tag
61bc	read the tag -- the search key
61bd	point at the enemy actor pool
61c1	record stride
61c4	six slots to search
61c6	does this enemy carry the key?
61c9	match -- inspect it
61cb	next enemy record
61ce	keep searching
61d4	no match -- re-test the pair by plain proximity
61d7	read the matched enemy's busy field
61db	busy -- fall back to the proximity gate
61dd	read its state byte
61e4	keep the state's high nibble
61e6	nibble 0 -- run the proximity gate
61e9	nibble 0x40?
61eb	yes -- the award path
61ed	nibble 0x50?
61ef	yes -- the boundary/bounce handler
61f2	nibble 0xf0?
61f4	yes -- the tight-box handler
61f7	nibble 0xd0?
61f9	yes -- the boundary/bounce handler
61fc	upright X bias (+6)
61fe	read the screen-orientation flag
6202	upright screen -- keep the upright bias
6204	flipped-screen X bias (-2)
6206	actor X
6209	apply the bias
620a	offset to the box edge
620b	actor Y
620e	+8 margin
6211	object X
6214	horizontal gap
6217	absolute value
6219	gap must be under 9
621b	too far -- back to the sweep
621e	object Y
6221	+8 margin
6223	vertical gap
6226	absolute value
6228	gap must be under 8
622a	too far -- back to the sweep
622d	point the record cursor at the object
622e	aim the index register at the record
6230	address of the award animation descriptor
6233	install the actor's animation, rewound to step 0
6236	base of the round-indexed delta table
6239	read the round counter
623c	round within the group of eight
623e	halve it -- one delta per pair of rounds
623f	look up the round delta from the table
6241	the record's position/score field
6244	add the round delta
6245	store it back
6248	point at the enemy actor pool
624c	the record's tag -- the search key
624f	six enemy records
6251	record stride
6254	does this enemy carry the key?
6257	match -- award it too
6259	next enemy record
625c	keep searching
625e	base of the round-indexed delta table
6261	read the round counter
6264	round within eight
6266	halve it
6267	look up the round delta
6269	the enemy's position/score field
626c	add the round delta
626d	store it back
6270	re-arm the enemy slot
6274	assume the parity-0 target buffer
6277	read the parity
6279	parity 0 -- keep it
627b	parity 1 -- the other buffer
627e	0x18 bytes
6281	wipe the parity target buffer
6282	queue the hit sound
6285	unwind the caller's frame
6287	keep the state nibble
6288	upright X bias (+6)
628a	read the screen-orientation flag
628e	upright screen -- keep the upright bias
6290	flipped-screen X bias (-2)
6292	actor X
6295	apply the bias
6296	offset to the box edge
6297	actor Y
629a	+8 margin
629d	object X
62a0	horizontal gap
62a3	absolute value
62a5	gap must be under 6 -- a tight window
62a7	too far -- back to the sweep
62aa	object Y
62ad	+8 margin
62af	vertical gap
62b2	absolute value
62b4	gap must be under 7
62b6	too far -- back to the sweep
62b9	the state nibble
62ba	nibble 0x50?
62bc	yes -- mark the hit and seed the record
62bf	point the record cursor at the object
62c0	aim the index register at the record
62c2	address of the bounce animation descriptor
62c5	install its animation, rewound to step 0
62c8	base of the round-indexed delta table
62cb	read the round counter
62ce	round within eight
62d0	halve it
62d1	look up the round delta
62d3	the record's position/score field
62d6	add the round delta
62d7	store it back
62da	point at the enemy actor pool
62de	the record's tag -- the search key
62e1	six enemy records
62e3	record stride
62e6	does this enemy carry the key?
62e9	match -- award and re-arm it
62eb	next enemy record
62ee	keep searching
62f0	base of the round-indexed delta table
62f3	read the round counter
62f6	round within eight
62f8	halve it
62f9	look up the round delta
62fb	the enemy's position/score field
62fe	add the round delta
62ff	store it back
6302	set the re-arm marker on the enemy slot
6306	address of the re-launch animation script
6309	install it, rewound to step 0
630c	wipe the parity target buffer, sound the hit, and unwind
630f	upright X bias (+6)
6311	read the screen-orientation flag
6315	upright screen -- keep the upright bias
6317	flipped-screen X bias (-2)
6319	actor X
631c	apply the bias
631d	offset to the box edge
631e	actor Y
6321	+8 margin
6324	target X
6327	horizontal gap
632a	absolute value
632c	gap must be under 5 -- the tightest window
632e	too far -- back to the sweep
6331	target Y
6334	+8 margin
6336	vertical gap
6339	absolute value
633b	gap must be under 5
633d	too far -- back to the sweep
6340	a tight overlap -- mark the hit and seed the record
6368	point at the actor coordinate boxes
636c	two boxes
636e	box stride
6371	first-box parity
6372	start on target pair zero
6375	scan the arrows against this box
6379	next box
637b	second-box parity
637c	switch pairs
637e	both boxes
6381	point at the target slots
6385	three arrow slots
6387	point at the arrow table
638a	read the arrow's state
638c	inactive -- skip
638e	the upright X offset
6390	the flip-screen flag
6394	screen flipped -- keep it
6396	the flipped X offset
6398	arrow X plus offset
639c	offset to the box edge
639d	arrow Y plus eight
63a3	the target's X
63a6	box X minus arrow X
63a9	absolute distance
63ab	horizontal gap under six
63ad	too far
63af	box Y plus bias
63b2	centre it
63b4	minus arrow Y
63b7	absolute distance
63b9	vertical gap under six
63bb	too far
63bd	point the record cursor at the arrow
63be	aim at the shot record
63c0	clear its active flag
63c4	mark it retiring
63c8	set its teardown state
63cc	set its spawn delay
63d3	point at the first hit flag
63d6	read the parity
63d9	first box
63db	point at the second hit flag
63de	raise the hit flag
63e0	the spawn animation script
63e3	arm it
63e6	play the hit sound
63e9	the hunter-spawn display command
63ec	queue it
63ed	drop the return -- a hit resolved
63ef	target slot stride
63f4	arrow record stride
63f7	next shot record
63f8	scan all three
6404	the play-mode latch
6408	latched -- force the scan
640a	the current round number
640d	even or odd round
640f	odd round with no latch -- nothing to scan
6410	point at the actor coordinate boxes
6414	two boxes
6416	box stride
6419	first-box parity
641a	start on target pair zero
641d	scan the object bank against this box
6421	next box
6423	second-box parity
6424	switch pairs
6426	both boxes
6429	target slot stride
642e	record stride
6431	next spawn record
6432	scan all three
6435	point at the second target slots
6439	point at the spawn-object table
643c	the play-mode latch
6440	not latched -- keep those
6442	point at the target slots
6446	point at the arrow table
6449	three slots
644b	read the object's state
644d	inactive -- skip
644f	the upright X offset
6451	the flip-screen flag
6455	screen flipped -- keep it
6457	the flipped X offset
6459	object X plus offset
645d	offset to the box edge
645e	the slot's Y
6461	object Y plus eight
6464	box X minus object X
6467	distance to the slot
646a	take the absolute value
646c	horizontal gap under seven
646e	too far
6470	box Y plus bias
6473	centre it
6475	minus object Y
6478	take the absolute value
647a	vertical gap under seven
647c	too far
647e	point the record cursor at the object
647f	aim at the slot record
6481	clear its active flag
6485	mark it retiring
6489	set its teardown state
648d	set its spawn delay
6494	point at the first hit flag
6497	read the parity
649a	first box
649c	point at the second hit flag
649f	raise the hit flag
64a1	the spawn animation script
64a4	arm it
64a7	play the hit sound
64aa	the play-mode latch
64ae	latched -- skip the spawn command
64b0	the hunter-spawn display command
64b3	queue it
64b4	point at the hit tally
64b7	count this hit
64b8	point at a guarded ROM block
64bb	point at its expected bytes
64be	read a guarded ROM byte
64bf	compare to the expected value
64c0	mismatch -- flag it
64c2	back one source byte
64c3	on one table byte
64c4	the remaining count
64c6	all verified
64c8	keep checking
64ca	point at the terminator tamper counter
64cd	trip it -- the ROM was altered
64ce	drop the return -- a hit resolved
64e2	advance the hunter timers
64e5	point at the hunter table
64e9	run the hunter state machine
64ec	point at the enemy actor table
64f0	point at the hunter table
64f4	update the enemies against the hunters
64f7	advance the special objects
64fb	read the record's state
64fe	dispatch on it
6505	point at the shared frame-delay timer
6508	set a twenty-eight-frame delay
650a	record stride -- walk backward
650d	three flock members
650f	point at the blink countdown
6511	prime it
6514	seat this flock member
6518	advance its state
651b	next member
651d	all three members
651f	play the spawn sound
6523	read the member's active word
6529	rotate the low bit out
652a	already active -- leave it
652b	the signature-mismatch flag
652f	tampered -- do not spawn
6530	claim the member -- mark active
6534	clear its column fraction
6537	clear its row fraction
653a	stamp the sprite code
653e	the shared frame-delay
6541	stagger this member by it
6544	shrink the delay for the next
6546	store it back
6549	set its animation frame
654d	set its animation tile
6551	set its X step
6555	set its Y step
6559	the object-spawn display command
655c	queue it
655d	the current round number
6561	not the first round -- done
6562	the extra first-round command
6564	queue it
6566	point at the launch-flip countdown
6569	read it
656b	expired -- move the flock
656d	tick it down
656f	point at the phase toggle
6571	advance the phase
6572	even or odd phase
6574	point at the Y step
6576	odd phase -- descend
6578	set the descend step
657a	the column fraction
657d	add the X step
6580	no carry
6582	carry into the column
6585	and into the second member
6588	and the third member
658b	store the column fraction
658e	mirror it to the second member
6591	mirror it to the third member
6594	finish the move
6596	set the ascend step
6598	the column fraction
659b	subtract the X step
659e	no borrow
65a0	borrow from the column
65a3	and from the second member
65a6	and the third member
65a9	store the column fraction
65ac	mirror it to the second member
65af	mirror it to the third member
65b2	the row fraction
65b5	subtract the Y step
65b8	store it
65bb	mirror it to the second member
65be	mirror it to the third member
65c1	no borrow
65c3	the row
65c6	climb one row
65c8	store it
65cb	adjust the second member
65cd	mirror it
65d0	adjust the third member
65d2	mirror it
65d5	point at the phase toggle
65d7	even or odd phase
65d9	the even-phase animation table
65dc	even phase
65de	the odd-phase animation table
65e1	record stride -- backward
65e4	three members
65e6	advance the flock tiles
65ea	point at the hunter table
65ee	read the group's row
65f1	below row twelve
65f3	not at the top yet -- wait
65f4	the arrival tile
65f6	set it on the group
65f9	and on the second member
65fc	and the third member
65ff	the arrival step
6601	set its step
6604	and the second member
6607	and the third member
660a	the arrival state
660c	set it on the group
660f	and the second member
6612	and the third member
6615	arm the shared phase gate
6618	arm the shared phase countdown
661b	point at the playfield image
661f	clear the running sum
6622	ten rows to check
6624	read a playfield byte
6627	compare to its mirror copy
662a	mismatch -- the screen was altered
662d	accumulate the byte
6632	step back one column
6634	step back one column group
663c	scan the ten rows
663e	ten more rows
6640	advance to the next region
6642	move up four rows
664c	read a playfield byte
664d	accumulate it
6653	step to the next column
6659	scan the region
665b	the running sum
665c	compare to the expected total
665e	mismatch -- the screen was altered
6661	the high half
6662	second checkpoint failed
6666	record stride -- backward
6669	three members
666c	ascend this member
6670	next member
6672	all three
6674	point at the hunter table
6678	blink the group
667c	read the member's retire flag
6680	already retiring -- skip
6681	the row fraction
6684	add the Y step
6687	no carry
6689	climb one row
668c	store the row fraction
668f	read the row
6692	below the top row
6694	not there yet
6695	mark the member retiring
6699	clear its sprite code
669a	clear its frame
669d	clear its row
66a1	point at the blink countdown
66a4	tick it
66a7	not yet
66a8	reload the blink countdown
66ab	advance the blink phase
66ac	even or odd phase
66ae	the even-phase blink table
66b1	even phase
66b3	the odd-phase blink table
66b6	record stride -- backward
66b9	three members
66bb	advance the blink tiles
66c5	record stride
66c8	three enemies
66cb	run this enemy's state machine
66cf	next enemy
66d1	all three
66d3	the lead enemy's state
66d7	inactive -- done
66d8	point at the wave number
66dd	expired -- flip the animation
66df	tick it down
66e1	reload the wave counter
66e5	advance the flip phase
66e6	even or odd phase
66e8	the flip-animation command
66eb	even phase
66ed	the alternate flip command
66ef	queue it
66f1	read the enemy's state
66f4	dispatch on it
66fd	the shared phase gate
6701	closed -- wait
6702	point at the shared phase countdown
6705	read it
6707	expired
6709	tick it down
670b	reload the phase countdown
670d	advance the enemy's state
6711	clear its column fraction
6714	clear its row fraction
6717	stamp the sprite code
671b	set its animation frame
671f	the descent animation script
6722	arm it
6725	set its descent step
672a	advance its animation
672d	the row fraction
6730	add the descent step
6733	no carry
6735	drop one row
6738	store the row fraction
673b	read the row
673e	reached row twenty-four
6740	arrived -- seat it in a spawn slot
6742	point at the spawn-object table
6746	record stride
6749	three spawn slots
674b	the slot's retire flag
674f	occupied -- try the next
6751	read the enemy's row
6754	match a slot at the same row
6757	found the slot
6759	next slot
675b	scan all three
675e	point at the wave-arrival counter
6761	count this arrival
6762	mark the slot retiring
6766	the enemy's column fraction
6769	shift into slot coordinates
676b	no borrow
676d	nudge the slot's column
6770	store the slot's column fraction
6773	the enemy's row fraction
6776	bias it
6778	no carry
677a	nudge the slot's row
677d	store the slot's row fraction
6780	set the slot's animation tile
6787	link the enemy to the slot -- low
678a	link the enemy to the slot -- high
678d	the shared frame-delay
678f	prime it
6792	advance the enemy's state
6795	set its ascent step
6799	the ascent animation script
679c	arm it
67a0	point at the shared frame-delay
67a3	read it
67a5	expired
67a7	tick it down
67a9	advance its animation
67ac	the linked slot pointer -- low
67af	the linked slot pointer -- high
67b2	any linked slot
67b4	none -- move only this record
67b9	the slot's row fraction
67bc	subtract the ascent step
67bf	no borrow
67c1	climb the slot one row
67c4	store the slot's row fraction
67c7	the enemy's row fraction
67ca	subtract the ascent step
67cd	no borrow
67cf	climb one row
67d2	store the row fraction
67d5	read the row
67d8	reached the top
67da	not yet
67db	advance the enemy's state
67df	point at the playfield image
67e2	column stride -- upward
67e5	ten rows, seed the sum
67e8	read a playfield byte
67e9	accumulate it
67eb	step up a row
67ec	sum the column
67ee	the expected checksum
67f0	compare
67f1	mismatch -- do not start the round
67f5	mark the round in progress
67f8	arm the phase timer
67fb	arm the play-state index
67ff	point at the frame-timer block
6802	nine bytes
6804	clear it
6805	point at the actor table
6808	clear the first byte
680c	the table length
680f	clear the whole actor table
6811	the arena fill tile
6813	point at the arena rows
6816	twenty-nine columns
6818	twenty-nine cells across
681a	fill a row with the tile
681b	step three tiles on
681e	next row
681f	fill every column
6822	the enemy-dispatch gate
6826	closed -- done
6827	point at the enemy table
682b	skip to the fourth record
6830	read its state
6833	dispatch on it
683a	advance its state
683e	clear its column fraction
6841	clear its row fraction
6844	stamp the sprite code
6848	set its animation frame
684c	the ascent animation script
684f	arm it
6852	set its ascent step
6857	advance its animation
685a	the row fraction
685d	subtract the ascent step
6860	no borrow
6862	climb one row
6865	store the row fraction
6868	read the row
686b	reached row twenty-seven
686d	not yet
686e	advance its state
6871	point at a screen region
6874	point at its expected bytes
6877	eight rows, seed the sum
687a	read an expected byte
687b	add the screen byte
687c	fold into the running sum
687d	keep the sum
687e	next expected byte
687f	step up a row
6880	step up a row
6886	sum the eight rows
6888	eight more rows
688a	step to the next region
688b	move up four rows
688e	read a screen byte
688f	accumulate it
6891	step down a row
6892	step down a row
6897	sum the region
6899	the expected total
689a	compare
689b	mismatch -- run the tamper handler
689e	the ready display command
68a1	queue it
68ac	point at the tile-checksum latch
68b0	already run -- skip
68b1	already done -- skip
68b2	mark it run
68b3	point at the screen tiles
68b6	clear the running sum
68b9	read a tile
68ba	accumulate it
68bf	step to the next tile
68c1	end of the row block
68c3	end of the row
68c7	skip the row gap
68c8	skip the row's margin
68cd	next page
68ce	past the last row
68cf	past the tile RAM
68d1	keep summing
68d3	point at the checkpoint table
68d6	four checkpoints
68d8	the low sum byte
68d9	match a checkpoint
68da	found it
68dc	next checkpoint
68df	no match -- take the fault branch
68e2	the high sum byte
68e4	match the checkpoint's high byte
68e5	matches -- intact
68e6	keep checking
68e8	mismatch -- take the fault branch
68f8	run the first sub-pass
68fb	run the second sub-pass
68fe	run the third sub-pass
6901	run the fourth sub-pass
6905	point at the shared frame-delay
6909	test it
690a	expired
690c	tick it down
690e	point at the wave number
6910	read it
6911	point at the arrived-wave count
6913	all of this wave arrived
6914	all placed -- done
6915	past the spawn cap
6917	too many -- wait
6918	point at the enemy table
691c	point at the object records
6920	record stride
6923	eight pairs
6926	spawn a paired enemy and object
692a	next enemy
692c	next object
692e	all eight
6931	read the slot's active word
6937	rotate the low bit out
6938	occupied -- leave it
693a	clear its column fraction
693d	clear its row fraction
6941	mark the enemy active
6944	mark the object active
6947	stamp the enemy sprite code
694b	set its animation frame
694f	set the object's column
6953	set the object's row fraction
6957	set the object's column index
695b	set its animation frame
695f	set its animation frame index
6963	set its animation tile
6967	set the enemy's step
696b	set the object's step
696f	the spawn animation script
6972	arm it
6977	prime the shared frame-delay
697a	the wave number
697e	not the first wave -- skip the banner
6980	the wave-spawn banner command
6983	queue it
6984	the follow-up banner command
6986	queue it
6987	point at the wave-number tile
698a	the arrived-wave count
698d	loop that many times
698f	build its packed-decimal value
6991	adjust to decimal
6992	count up to it
6994	keep the value
6995	the tens digit
6997	shift it down
699b	draw the tens digit
699c	up one row
69a0	the ones digit
69a1	the units digit
69a3	draw the ones digit
69a4	play the wave sound
69a7	point at the wave number
69aa	count this wave
69ab	drop the return
69ad	point at the enemy table
69b1	point at the object records
69b5	record stride
69b8	eight pairs
69ba	step this descending pair
69bb	move this formation object
69bf	next enemy
69c1	next object
69c3	all eight
69c6	read the enemy's active flag
69ca	inactive -- skip
69cb	read its state
69cf	not descending -- skip
69d0	advance its animation
69d3	the object's row fraction
69d6	subtract its step
69d9	no borrow
69db	climb the object one row
69de	store the object's row fraction
69e1	the enemy's row fraction
69e4	subtract its step
69e7	no borrow
69e9	climb one row
69ec	store the row fraction
69ef	read the row
69f2	reached row six
69f4	not there -- done
69f6	point at the blink countdown
69fa	already ticking -- wait
69fb	already blinking -- done
69fc	start the blink
69fe	past the top row
6a00	not yet
6a02	point HL at the enemy record
6a05	record length
6a07	clear the enemy record
6a08	point HL at the object record
6a0a	aim at the object record
6a0b	record length
6a0d	clear the object record
6a0f	point at the blink countdown
6a12	test it
6a14	not blinking -- done
6a15	step to the spawn-phase toggle
6a16	the blink phase
6a17	blink finished
6a19	suspend the sweep at the top spawn phase
6a1a	point at the blink frame timer
6a1e	expired
6a20	tick it down
6a22	point at the enemy table
6a26	record stride
6a29	eighteen records
6a2b	promote this record
6a2c	try to spawn into this slot
6a30	next record
6a32	all eighteen
6a35	read the slot's active word
6a38	fold both liveness bytes together
6a3b	rotate the low bit out
6a3c	occupied -- leave it
6a3e	clear its column fraction
6a41	clear its row fraction
6a45	mark it active
6a48	set its state
6a4b	stamp the sprite code
6a4f	set its animation frame
6a53	set its step
6a57	point at the blink frame timer
6a5a	prime it
6a5c	point at the phase toggle
6a5e	read the phase
6a5f	advance it
6a60	second promotion
6a62	phase 2 -> pick its animation
6a64	later promotion
6a66	first promotion
6a67	phase 0 -> default animation
6a69	point at the blink frame timer
6a6b	reload it longer
6a6d	the later promotion script
6a72	the second promotion script
6a77	the third promotion script
6a7a	arm it
6a7d	drop the return
6a7f	the blink countdown
6a83	not blinking -- run the finisher
6a85	point at the enemy table
6a89	record stride
6a8c	eighteen records
6a8e	advance this record
6a8f	step this object's state
6a93	next record
6a95	all eighteen
6a98	read the record's state flag
6a9c	inactive -- skip
6a9d	read its state
6aa0	fold state down to (state-1)&3
6aa1	keep the low two bits
6aa3	dispatch on it
6aa4	state 1 -> descend one step
6aa6	state 2 -> re-init the round arena
6aa8	advance its animation
6aab	the row fraction
6aae	subtract the step
6ab1	no borrow
6ab3	climb one row
6ab6	store the row fraction
6ab9	read the row
6abc	not at the top -- wait
6abd	keep descending until it reaches the bottom
6abe	clear the tile-sum latch
6ac1	advance its state
6ac5	the wave number
6ac8	only on wave two
6aca	check only on wave 2
6acb	the tile-sum latch
6acf	already summed -- done
6ad1	latch it summed
6ad4	point at the score row
6ad7	clear the running sum
6ada	a tile
6adb	add a tile
6adc	keep the sum
6add	no carry
6adf	carry into the sum's high byte
6ae0	next column
6ae2	within the row
6ae4	end of the field
6ae6	past it
6ae8	skip the gap
6ae9	keep summing
6aeb	end of the block
6aed	keep summing across the row
6aef	skip to the next block
6af3	no carry
6af5	carry into the row's high byte
6af6	past the last block
6af7	past the region
6af9	sum every row up to the last
6afb	the low sum byte
6afc	the expected value
6afe	matches -- check the high byte
6b00	mismatch -- run the tamper handler
6b03	the high sum byte
6b04	the expected value
6b06	mismatch -- run the tamper handler
6b09	total matches 0x29b8 -- image intact
6b13	point at the two-tile hold timer
6b16	read it
6b18	expired
6b1a	tick it down
6b1c	reload the hold timer
6b1e	step to the animation phase
6b1f	advance the two-tile phase
6b20	read the phase
6b21	even or odd
6b23	the even-phase tile pair
6b26	point at its screen cell
6b29	even phase
6b2b	the odd-phase tile pair
6b2f	draw the top tile
6b32	down to the lower cell
6b37	draw the bottom tile
6b3b	the game-active flag
6b3f	no game running -- skip
6b40	the pending-object state
6b44	busy -- skip
6b45	the current round number
6b48	even or odd round
6b4a	odd round -- skip
6b4b	point at the pending-object countdown
6b4f	test it
6b50	idle -- skip
6b51	about to fire
6b53	on the last count, fire the promotion
6b55	tick it down
6b57	the promotion play-state
6b59	enter the promotion state
6b5c	mark the pending-object state busy
6b5f	clear the countdown
6b61	park the countdown at the commit sentinel
6b64	record stride
6b67	point at the enemy table
6b6b	point at the promoted-object list
6b6f	eleven records
6b71	read the record's column
6b74	isolate the column
6b76	left of the field
6b78	out of range -- skip
6b7a	right of the field
6b7c	out of range -- skip
6b7e	point HL at the record
6b81	store its address -- low
6b84	store its address -- high
6b87	read its frame
6b8a	remember it in the list
6b8d	blank the record's frame
6b91	advance the list cursor
6b97	next record
6b99	scan all eleven
6b9b	the first promote command
6b9e	queue it
6b9f	the second promote command
6ba2	queue it
6ba3	the third promote command
6ba6	queue it
6ba7	the fourth promote command
6baa	queue it
6bab	the fifth promote command
6bae	queue it
6baf	hand off to the display builder
6bb2	point at the pending-object countdown
6bb5	tick it
6bb6	not yet
6bb7	point at the promoted-object list
6bbb	list stride
6bbe	eleven entries
6bc1	read the entry's high address
6bc5	empty -- skip
6bc7	read its low address
6bca	read its saved frame
6bcd	step 6 bytes into the record
6bcf	restore the frame
6bd0	next entry
6bd2	all eleven
6bd4	the play-ready state
6bd6	enter it
6bd9	the first help-clear command
6bdc	queue it
6bdd	the second help-clear command
6be0	queue it
6be1	the third help-clear command
6be4	queue it
6be5	the fourth help-clear command
6be8	queue it
6be9	the fifth help-clear command
6bec	queue it
6bee	the aim-indicator mode
6bf2	off -- run the scan
6bf4	point at the aim flags
6bf7	mode one
6bf8	mode 1 -> aim below
6bfa	set the up-aim bit
6bfc	clear the down-aim bit
6bfe	point at the aim-indicator timer
6c01	tick it
6c02	not yet
6c04	clear the aim mode
6c05	clear the aim-indicator mode
6c07	set the down-aim bit
6c09	clear the up-aim bit
6c0b	point at the aim-indicator timer
6c0e	tick it
6c0f	not yet
6c11	clear the aim mode
6c12	clear the aim-indicator mode
6c14	scan for a target lock
6c18	point at the shooter position
6c1c	point at the target slots
6c20	point at the arrow table
6c23	three arrow slots
6c25	test this arrow for an aim lock
6c28	advance the target-record pointer
6c2b	next target slot
6c2d	arrow record stride
6c2f	next arrow
6c30	scan all three
6c32	point at the aim flags
6c35	clear the up-aim bit
6c37	clear the down-aim bit
6c39	point at the proximity hit flag
6c3c	clear it
6c3f	the arrow's active bit
6c41	inactive -- skip
6c42	the X window
6c46	arrow X plus window
6c4a	offset ahead
6c4b	projectile Y
6c50	target X plus bias
6c53	shift into the compare frame
6c55	minus arrow X
6c58	absolute distance
6c5a	horizontal gap under twenty-four
6c5c	too far
6c5f	target Y plus bias
6c62	centre it
6c64	minus arrow Y
6c67	below the arrow
6c69	absolute distance
6c6b	vertical gap under fourteen
6c6d	too far
6c6e	point at the proximity hit flag
6c71	raise it
6c73	read the arrow Y
6c76	point at the aim flags
6c79	target above
6c7a	below -- take the lower test
6c7c	above the mid line
6c7e	near -- close aim
6c80	set the up-aim bit
6c82	clear the down-aim bit
6c84	close-aim mode
6c86	point at the aim-indicator mode
6c89	set the mode
6c8b	set the aim-indicator timer
6c8d	drop the return
6c8f	far above the mid line
6c91	far -- point down
6c93	set the down-aim bit
6c95	clear the up-aim bit
6c97	far-aim mode
6c99	store the mode
6c9b	far below the mid line
6c9d	near -- lower aim
6c9f	set the down-aim bit
6ca1	clear the up-aim bit
6ca3	drop the return
6ca5	set the up-aim bit
6ca7	clear the down-aim bit
6ca9	drop the return
6cab	the game-active flag
6caf	no game running -- skip
6cb0	the catch-in-progress flag
6cb4	catching -- skip
6cb5	the wave-teardown state
6cb9	point at the aim flags
6cbc	idle -- keep the aim flags
6cbe	clear the aim flags
6cbf	during teardown, clear the aim flags
6cc1	update the aim indicator
6cc4	the proximity hit flag
6cc8	a hit is pending -- skip
6cc9	point at the aim flags
6ccc	the launch state
6ccf	already launching
6cd1	while a shot is launching, force aim-below
6cd3	the current target lock
6cd7	already locked -- track it
6cda	point at the shooter X
6cdd	point at the enemy table
6ce1	point at the enemy scan Y-slots
6ce5	six enemies
6ce7	read this enemy's active flag
6ceb	active -- consider it
6ced	next enemy record
6cf0	next enemy
6cf2	next column entry
6cf5	next scan slot
6cf7	scan all six
6cf9	the current target lock
6cfd	nothing locked -- done
6cfe	the shooter X
6d02	the locked target pointer
6d06	point at the aim flags
6d09	the target's coordinate
6d0a	compare to the shooter
6d0b	target is to the right
6d0d	aim up
6d0f	clear the down aim
6d12	aim down
6d14	clear the up aim
6d17	read the enemy's coordinate
6d1a	above the band
6d1c	out of reach -- skip
6d1e	below the band
6d20	out of reach -- skip
6d22	distance from the shooter
6d23	no borrow
6d25	make it positive
6d27	the current best distance
6d2b	first candidate -- take it
6d2e	not closer -- skip
6d30	closer -- take it
6d31	record the new best distance
6d34	take the candidate's column pointer
6d37	store the lock target low byte
6d38	latch the target pointer -- low
6d3b	store the lock target high byte
6d3c	latch the target pointer -- high
6d3f	take the enemy record pointer
6d42	point past the enemy's active byte
6d43	store the locked block low byte
6d44	latch the enemy pointer -- low
6d47	store the locked block high byte
6d48	latch the enemy pointer -- high
6d4b	keep scanning
6d4d	the locked enemy pointer
6d50	read its state
6d52	still alive -- track it
6d54	the locked target pointer
6d57	read its coordinate
6d58	above the band
6d5a	drifted off the left -> drop the lock
6d5c	below the band
6d5e	still in range -> keep tracking it
6d60	clear the lock
6d61	point at the target lock
6d64	five bytes
6d66	clear the lock block
6d68	keep the target coordinate
6d69	the current round number
6d6c	even or odd round
6d6e	the shooter X
6d73	bias it upward
6d77	bias it downward
6d79	point at the aim flags
6d7c	keep the biased position
6d7d	the input-rotate latch
6d80	advance it
6d81	step it
6d84	every eighth frame
6d86	not this frame
6d88	the biased position
6d89	plus eight
6d8b	compare to the target
6d8c	below -- no step
6d8e	minus sixteen
6d90	compare to the target
6d91	the step size
6d93	within reach -- step
6d95	no step
6d96	store the aim step
6d97	the biased position
6d98	compare to the target
6d99	aligned
6d9b	target above -- aim down
6d9e	target below -- aim up
6da1	clear the up aim
6da3	clear the down aim
6da6	the intro phase index
6da9	dispatch on it
6daa	phase 0 -> seat the launch script
6dac	phase 1 -> run the intro frame
6dae	phase 2 -> draw the hit tally
6db0	phase 3 -> timing gate
6db2	phase 4 -> scale the target count
6db4	phase 5 -> tick the target group
6db6	phase 6 -> seat play-ready
6db8	prime the intro
6dbb	the current round number
6dbe	divide by four
6dc2	cap at seven
6dc6	clamp to seven
6dc8	keep the low three bits
6dca	the launch-script table
6dcd	fetch this round's launch script
6dd0	store the launch-script pointer
6dd4	the intro delay
6dd6	arm it
6dd9	point at the intro phase index
6ddc	advance the phase
6ddd	the current round number
6de0	divide by eight
6de6	not every eighth round
6de7	point at the guarded block
6dea	point at its expected copy
6ded	ninety-six bytes
6def	read an expected byte
6df0	compare to the guarded byte
6df1	mismatch -- take the fault branch
6df4	next byte
6df6	verify all ninety-six
6df9	point at the animation frame counter
6dfc	tick it
6dfd	not zero yet
6dff	step the flock animation
6e02	advance the shared animation
6e05	point at the script frame timer
6e08	tick it
6e09	not yet
6e0a	reload it
6e0c	the script read pointer
6e0f	read the next script byte
6e10	advance the text cursor
6e11	advance the read pointer
6e14	the script write pointer
6e17	write the byte to the screen
6e18	column stride -- upward
6e1c	advance the write pointer
6e1f	point at the script step count
6e22	tick it
6e23	not yet
6e24	reload the step count
6e26	point at the script frame timer
6e29	reload it
6e2b	advance the script column tick
6e2c	bump the script phase
6e2d	the script write pointer
6e30	clear the running sum
6e33	fourteen rows
6e35	read a drawn byte
6e36	accumulate it
6e3b	step up a row
6e3d	step up a row
6e42	sum the column
6e44	the expected checksum word
6e47	compare the low byte
6e48	the low half against it
6e49	mismatch -- take the fault branch
6e4d	the expected high byte
6e4e	compare it
6e4f	mismatch -- take the fault branch
6e52	advance the compare cursor
6e53	advance the checksum pointer
6e59	run the map draw
6e5c	run the launch and integrity checks
6e5f	run the wave seeding
6e62	run the status render
6e65	hand off to the display builder
6e68	run a gameplay sub-pass
6e6b	run another sub-pass
6e6e	resolve actor-vs-object collisions
6e71	run the frame finisher
6e75	point at the tamper-freeze flag
6e78	the signature-mismatch flag
6e7b	combine them
6e7c	tampered -- freeze the machine
6e7f	advance the launch sequence
6e82	advance the hunter launch
6e86	point at the intro delay
6e89	read it
6e8b	expired
6e8d	tick it down
6e8f	the launch sequence counter
6e92	test its second bit
6e94	the shorter reload
6e98	the longer reload
6e9a	reload the intro delay
6e9b	the launch script pointer
6e9e	read the next script byte
6e9f	end of script
6ea1	end of script -- done
6ea2	advance the script cursor
6ea3	advance the script pointer
6ea6	the script's slot selector
6ea7	point at the launch record base
6eab	record stride
6eae	skip to the numbered record
6eb0	find it
6eb2	point at the projectile slots
6eb8	three slots
6eba	read the slot's state
6ebc	found a free slot
6ebe	next slot
6ebf	scan all three
6ec1	no free slot -- back up the script
6ec4	rewind one byte
6ec5	store the script pointer
6ec9	seat a hunter in the slot
6ecd	the launch animation script
6ed0	arm it
6ed3	register the launch
6ed6	point at the launch sequence counter
6ed9	advance it
6edb	point at the enemy table
6edf	record stride
6ee2	fourteen records
6ee5	step this launched record
6ee9	next record
6eeb	all fourteen
6eed	the launch script pointer
6ef0	read the current byte
6ef1	not the end marker
6ef3	still launching
6ef4	point at the projectile slots
6ef7	record stride
6efa	three slots
6efc	read the slot's state
6efe	still busy -- wait
6eff	next slot
6f00	all three idle
6f02	point at the intro phase index
6f05	advance the phase
6f06	point at the hit tally
6f07	the phase-complete command
6f0a	queue it
6f0b	the target-group count
6f0f	times three
6f12	matches the expected count
6f13	the mismatch command
6f16	tally short of triple -> keep it
6f18	jump straight to the tally state
6f1a	set the phase
6f1d	the alternate command
6f1f	the intro delay
6f21	arm it
6f24	queue the command
6f26	point at the enemy target records
6f29	forty-eight bytes
6f2b	clear them
6f2d	read the record's state
6f30	retiring
6f32	run the retire handler
6f35	below the animated range
6f37	states 0x0b and up branch below
6f39	just step its animation
6f3d	dispatch on its state
6f3e	state 0x0b -> seed the enemy into flight
6f40	state 0x0c -> fly in and land
6f42	point at the intro phase index
6f45	advance the phase
6f46	point at the hit tally
6f47	read the follow-on count
6f49	none
6f4c	draw that many markers
6f4f	point at the score cell
6f52	read the current value
6f55	step to the second digit pair
6f57	double it
6f58	double it, decimal-adjusted
6f59	to packed decimal
6f5a	write it back
6f5e	point at the intro delay
6f61	read it
6f62	at the marker point
6f64	near the end -> run the tally sub-timer
6f66	point at the aim-indicator mode
6f69	inactive
6f6a	nothing hit -> skip the tally sound
6f6c	the hunter-spawn command
6f6f	queue it
6f70	the board-clear flag
6f74	board cleared -- wait
6f75	tick the aim timer
6f76	still holding -- wait
6f77	point at the intro delay
6f79	tick it
6f7a	not yet
6f7b	reload the intro delay
6f7d	the current round number
6f80	only round three
6f82	other rounds -- set the state
6f85	point at the guarded block
6f88	point at its expected copy
6f8b	one hundred twenty-one bytes
6f8d	read an expected byte
6f8e	compare to the guarded byte
6f8f	mismatch -- take the fault branch
6f92	next byte
6f94	verify them all
6f98	point at the intro phase index
6f9a	jump to the closing state
6f9d	the target-group count
6fa0	point at the score cell
6fa3	store it
6fa6	times five
6faa	store the scaled count
6fad	column stride -- upward
6fb0	three cells
6fb2	blank three HUD cells above it
6fb3	clear a cell
6fb5	clear the column
6fb7	point at the intro phase index
6fba	advance the phase
6fbb	point at the intro delay
6fbd	arm it long
6fbf	point at a guarded routine
6fc3	point at its expected bytes
6fc6	sixty-eight bytes
6fc8	read a guarded byte
6fcb	compare to the expected value
6fcc	mismatch -- wipe the machine
6fce	advance the low pointer
6fd5	carry the high pointer
6fd7	next expected byte
6fd8	verify them all
6fda	clear the bonus tally
6fdd	the bonus display command
6fe0	queue it
6fe2	clear the work RAM start
6fe3	tamper detected -> wipe the work-RAM block
6fe6	point one byte on
6fe9	clear the first byte
6fea	wipe all of work RAM
7032	the target-group count
7036	test it
7037	nonzero -- tick the marker sound
703a	point at the countdown
703b	the group timer
703c	test it
703d	expired
703f	tick it down
7041	every sixteenth frame
7044	not yet
7045	point at the proximity hit flag
7047	toggle it
7048	even or odd
704a	the marker command
704d	set -- keep it
704f	the alternate marker command
7051	queue it
7053	reload the countdown
7055	point at the intro phase index
7057	advance the phase
7059	tick the countdown
705a	the hunter-spawn command
705d	queue it
705f	point at the intro delay
7062	tick it
7063	not yet
7064	finish the round intro
7067	clear the hit tally
7068	clear the running target-hit tally
706b	the play-ready state
706d	enter it
7071	point at the playfield image
7074	column stride -- upward
7077	ten rows
7079	read a playfield byte
707a	step up one row
707b	compare to its mirror copy
707c	mismatch -- run the tamper handler
707f	scan the ten rows
7081	point at the animation frame counter
7084	tick it
7085	still counting -- skip the step
7087	step the flock animation
708a	advance the shared animation
708d	point at the script frame timer
7090	tick it
7091	not yet
7092	reload it
7095	tick the step count
7096	the script column tick
709a	the script pointer table
709d	fetch the next script pointer
70a0	store the script write pointer
70a4	point at the script column tick
70a7	tick it
70a8	not yet
70a9	point at the script frame timer
70ac	reload it
70b0	clear the script sub-state
70b1	point at the banner region
70b5	clear the running checksum
70b6	fourteen columns
70b8	twenty-nine rows
70ba	read a banner byte
70bb	accumulate it
70be	carry into the high byte
70c0	next row
70c1	sum the column
70c4	step to the next column
70c9	next page
70ca	all columns
70cb	sum all columns
70cd	the expected checksum word
70d1	compare the low byte
70d2	mismatch -- run the tamper handler
70d6	the expected high byte
70d7	compare it
70d8	mismatch -- run the tamper handler
70dc	clear the checksum word
70df	clear the launch sequence counter
70e2	the play state
70e4	enter play
70e7	hand off to the play dispatcher
71b9	read the bonus-stage outer phase
71bc	return address for the post-phase sprite rebuild
71bf	so each phase body tails back through it
71c0	jump via the bonus-phase table below
71c1	phase 0 -> eagle approach
71c3	phase 1 -> wave launch
71c5	phase 2 -> stage teardown
71c7	step the eagle-approach state machine
71ca	then run the shared per-frame world update
71ce	the wave hold timer
71d1	read the inter-wave hold timer
71d3	hold drained? proceed
71d5	still holding -> tick the hold down and wait
71d7	the secondary aim gate
71da	is any eagle target present?
71dd	folded together
71de	point at the aim-indicator flags
71e1	a target is in play -> compare its approach position
71e3	read the latched enemy X
71e7	already latched -> mark aim on-target
71e9	the eagle's advancing approach coordinate
71ec	past the far threshold?
71ee	higher -- point down
71f0	latch the enemy X once
71f3	set the aim indicator to below
71f5	set the aim indicator to below
71f8	set the aim indicator to on-target
71fa	set the aim indicator to on-target
71fd	the eagle's advancing approach coordinate
7200	exactly at the near threshold?
7202	arrived -> step the records-arrived sub-phase
7204	still short -> refresh aim from position
7206	force the below aim indicator
7208	point the aim down
720b	read the records-arrived sub-phase
720f	already counted -- the next stage
7213	first arrival -> enter sub-phase 1
7216	clear the aim indicator
7218	clear the aim indicator
721b	sub-phase 2?
721d	sub-phase 2 -> paint the grid marker
7221	advance to sub-phase 2
7226	arm the aim indicator
722a	the eagle-finish flag
722d	read the grid-advance done latch
722f	grid sweep finished -> close the phase
7232	the eighth-frame tick
7234	step it
7236	only every eighth frame steps a marker
7238	not this frame -> just guard the edge and return
723b	the eagle's column coordinate
723e	shift down three -- column to grid-cell index
7244	one past the index
7245	as a row step
7246	base of the eagle grid in video RAM
7249	one row back per step
724c	walk up to this eagle's grid row
724f	re-read and edge-guard the coordinate
7252	shift down three -- to grid-cell index
7259	as a column step
725a	walk across to this eagle's grid column
725d	stamp the marker tile
725f	offset into the colour-attribute plane
7263	the column coordinate
7266	select a colour bank from its low bits
7268	on a cell boundary
726a	the row coordinate
726d	pick the colour attribute by cell
726f	its low bits
7275	paint the marker's colour attribute
7278	paint an alternate colour attribute
7281	paint an alternate colour attribute
7284	paint an alternate colour attribute
7287	read the eagle's advancing grid coordinate
728a	reached the far edge of the grid?
728c	short of the edge -> hand the coordinate back
728f	at the edge -> raise the grid-advance done latch
7293	clear the aim-indicator flags
7296	clear the latched enemy X
729c	step the eagle wave to its next outer phase
729e	zero the records-arrived count for the new phase
72a0	run the shared per-frame world update first
72a3	then drive the eagle wave-launch machine
72aa	read the wave-live flag
72ac	a wave is live -> service its records
72ae	no wave yet -> seed the next one
72b2	read the live-record count
72b6	wave emptied -> hand to the inter-wave idle handler
72b9	base of the eagle records
72bd	record stride
72c0	the wave index
72c3	two records per wave index
72c4	records to walk
72c6	step this eagle record's state machine
72ca	advance to the next record
72cc	walk every live record
72cf	read the record's occupancy words
72d2	record slot occupied?
72d6	empty slot -> skip it
72d7	the record's life-phase byte
72da	jump via the record-phase table below
72db	phase 0 -> approach and arrive
72dd	phase 1 -> dive or climb
72df	phase 2 -> retire the record
72e1	is the target slot still occupied?
72e5	wave still in flight -> don't overwrite it
72e7	raise the wave-live flag
72ed	bump the wave index
72ef	the fourth wave is special
72f5	re-arm the outer phase
72f8	reload the inter-wave hold
72fb	two records per wave index
72fc	set this wave's record count
7300	the eagle-wave parameter table
7303	record stride
7306	base of the eagle records
730a	mark the record active
730f	copy the target-column parameter
7314	copy the next wave parameter
7319	copy the start-row parameter
731e	copy the last wave parameter
7324	odd or even record of the pair?
7328	odd record -> seed its sub-row fraction
732c	seed the fraction field for every record
7330	next record
7332	seed all this wave's records
7338	clear the outer phase
733a	clear the records-arrived count
733c	the live eagle's on-screen column
733f	shift down three -- to a grid-cell index
7345	at this record's target column?
734b	or one cell short of it?
734e	not there yet -> wait
734f	the eagle's on-screen row
7352	shift down three -- to a grid-row index
7358	bias to the arrival band
735a	reached this record's target row?
7360	back off to the band's low edge
7362	within the arrival band?
7365	not yet -> wait
7366	arrived -> advance the record to dive/climb
736b	odd or even half of the pair?
736f	even half: its arrival animation
7372	start the record's arrival animation
7375	set the even half's glide speed
737c	tally this arrival
7380	whole wave arrived?
7388	queue the wave-arrival command
738a	odd half: its arrival animation
738d	start the record's arrival animation
7390	set the odd half's glide speed
7395	advance the eagle's on-screen animation
739a	diver (even) or climber (odd)?
739e	diver: the sub-row fraction
73a1	add the glide speed
73a7	fraction overflow -> step down one row
73a9	step down one row
73ac	the on-screen row
73af	reached the bottom row?
73b1	not yet -> keep gliding
73b2	at the bottom -> retire the record next frame
73b6	climber: the sub-row fraction
73b9	subtract the glide speed
73bf	fraction borrow -> step up one row
73c1	step up one row
73c4	the on-screen row
73c7	reached the top row?
73c9	not yet -> keep gliding
73ca	at the top -> retire the record next frame
73ce	point HL at this eagle record
73d5	the whole 0x18-byte record
73d7	blank the record
73db	one fewer live record in the wave
73dc	wave not empty yet
73df	wave emptied -> seed the inter-wave hold
73e6	read the inter-wave hold timer
73e8	hold elapsed?
73ea	still resting -> tick the hold down
73ec	the wave index
73f0	no waves flown yet -> just reseed
73f7	announce the wave -- fire its sound/display
73f8	reload value for the inter-wave hold countdown -- 0x18 frames of breather before the next wave builds
73fa	reseed the hold for next time
73fd	zero -- about to clear the wave-launch flag
73fe	point at the wave-launch flag; clearing it hands control back to the wave-launch driver to build the next wave
7401	drop the launch flag -> re-arm the pipeline for a new wave
7403	unreachable data table -- fixed-size records with an embedded 0x7403 back-pointer, not entered as code
7424	read the inter-wave hold timer
7426	hold elapsed?
7428	still holding -> tick it down
742a	start of the 9-byte wave/phase control block
742d	nine bytes
742f	wipe the wave/phase control block
7430	base of the enemy arena
7433	three records wide
7435	clear the enemy arena
7436	clear the in-play sub-state
7439	clear the latched enemy X
743e	point the machine at the attract sequence
7442	read the attract/self-test selector
7445	keep its low two bits
7447	jump via the state table below
7448	state 0 -> arm display list + verify ROM
744a	state 1 -> paint screen + HUD checksum
744c	state 2 -> live gameplay frame
744f	restart the attract display sub-phase timer
7458	seed the graphic-stream read pointer
745b	seed the layout-stream read pointer
7462	seed the tile-plane paint cursor
7468	seed the colour-map paint cursor
746e	advance the selector to state 1
746f	reference copy of the boot code
7472	the live boot code at 0x0000
7475	eight bytes to verify
7478	compare live code against the reference
7479	first-stage mismatch -> into the second-stage compare
747e	loop the first-stage compare
7480	second-stage live code
7489	compare it against its reference
748a	mismatch -> divert to the tamper path
7495	carry the compare cursor across a page
7497	loop the second-stage compare
749a	unreachable code block -- writes a hardware latch (0xa180) and sweeps a record run, but no call or jump reaches it
7517	paint the attract screen through the display-list interpreter
751d	tick the sub-phase timer
751f	first delay elapsed?
7521	still counting -> repaint again next frame
7526	step the second one-shot delay
7528	restart the sub-phase timer
752b	first pass of the second delay -> wait one more
752c	first HUD strip
752f	clear the running column sum
7532	two strips to sum
7534	fourteen cells per strip
7537	fold each cell into the checksum
753d	step up one row
7543	sum the strip
7546	second HUD strip
7549	sum both strips
754c	demand the exact expected total
754e	wrong -> stop the machine (tamper reflex)
7552	high byte off -> stop the machine
7558	checksum clean -> advance the selector to gameplay
7559	cue the start-of-game audio
755d	release the next queued enemy
7560	step every enemy actor forward
7563	repaint the stacked two-tile enemy animation
7566	service the blink timer
7569	rebuild the hardware sprite list
7570	read the shared release delay
7572	delay elapsed?
7574	still waiting -> tick the release delay down
7576	the wave-release index
7579	all eight enemies released?
757b	yes -> nothing left to spawn
757c	base of the enemy-actor records
7580	base of the paired sprite-object records
7584	record stride
7587	eight slot pairs to offer
758a	try to release an enemy into this slot
758e	advance to the next slot pair
7592	sweep the slots until one takes
7595	read the slot's occupancy words
7598	slot already live?
759c	occupied -> leave it, try the next
759d	claim the slot: mark the enemy active
75a2	clear its position fractions
75a8	seed its start row
75ac	seed its start column
75b3	first two waves draw a single sprite only
75b8	clear the paired sprite's fractions
75be	seed the paired sprite's row
75c2	seed the paired sprite's column
75c9	index by the paired-sprite variant
75cc	fetch this release's paired-sprite tile
75d3	fetch its animation pointer
75d6	store the paired sprite's animation pointer
75dc	set the paired sprite's speed
75e0	mark the paired sprite active
75e7	advance the paired-sprite variant index
75e8	set the enemy's descent speed
75ef	cap the type index at two
75f8	fetch this release's enemy type
75f9	reseed the release delay from the type
75ff	bump the wave-release index
7601	third release onward uses the other script
7606	pick the enemy's animation script
7608	pick the enemy's animation script
760b	start the enemy's animation
7611	release index times four
7613	stagger the paired sprite by it
7616	drop the sweep's return -- one release per frame
7621	cover the whole 14-record enemy pool
7623	into the shared animation walk
7625	cover only the first eight records
7627	cursor at the enemy-actor records
762b	record stride
762f	tick this record's animation state
7633	next record
7635	sweep the run of records
7638	the record's state byte
763b	keep the low two bits
763d	jump via the record-state table below
763e	state 0 -> descend and gather
7640	state 1 -> hold, then promote
7642	state 2 -> wait out the wave
7644	is this record active?
7648	empty slot -> skip
7649	advance the record's animation frame
764f	subtract the step from the sub-position
7652	no borrow -> stay on this row
7654	borrow -> step the record down one row
765a	the record's row
765d	reached the gather row?
765f	not yet -> keep descending
7662	arm the group's gather countdown
766c	promote every record to state 1
7671	across the whole pool
7673	abandon the rest of this frame's sweep
7675	advance the record's animation frame
767b	read the gather countdown
767d	gather countdown elapsed?
767f	still gathering -> tick it down
768b	promote the first eight records to state 2
7690	clear a field across the paired-sprite records
769c	clear the wave latch
76a1	advance the play phase
76a4	abandon the rest of this frame's sweep
76a6	read the wave-busy latch
76aa	wave still busy -> hold
76ab	advance the record's animation frame
76b2	read the blink countdown
76b4	countdown elapsed?
76b6	still counting -> tick it down
76b8	reload the 22-frame blink period
76bb	step the blink phase
76bd	its low bit alternates the two frames
76bf	the 3f/46 tile pair
76c4	the swapped 46/3f pair
76c7	the first blink cell
76ca	two rows down to the second cell
76ce	paint the first cell
76d2	paint the second cell
76d4	enemy descent animation-script data
76d5	data table bytes -- 0xff-terminated records with embedded 0x76xx back-pointers, reached indirectly not as straight-line code
76e6	the two swap-tile pairs the blink reads: 3f/46 then 46/3f
76ea	step every object slot one frame
76ed	advance the enemy actors one frame
76f0	rebuild the hardware sprite list from the moving world
76f4	point at the first of six object records (0x8ba0)
76f8	record stride -- 0x18 bytes per object slot
76fb	six slots to step this frame
76fe	service the object at the current slot
7702	step to the next 0x18-byte slot
7704	loop across all six object slots
7707	read the slot's first presence-header byte
770a	OR in the second header byte -- the combined liveness flag
770d	rotate bit 0 into carry -- the slot's live bit
770e	dormant slot -- skip it this frame
770f	read the object's state index
7712	low two bits pick one of four life-stage handlers
7714	dispatch through the state table -- arm, move, draw, or self-check
771d	tick the slot's spawn-delay countdown
7720	still counting down -- leave the slot empty this frame
7721	point at the shared spawn-ring cursor (0x8d57)
7724	read the current spawn index
7726	step the ring on for the next object armed
7727	stamp this object's spawn index into the record
772b	point at the spawn-word table
772e	double the index -- one 16-bit word per entry
772f	fetch the spawn word low byte
7730	store the spawn word low byte
7734	read the spawn word high byte
7735	store the high byte -- the object's shape/behaviour identity
7738	initial travel speed -- -20 per frame
773a	seed the object's signed step speed
773d	promote the slot from arm to move state -- and fall into the mover
7740	step the object's animation one frame
7743	read the signed travel speed
7746	negate it -- the underflow threshold
7749	read the coarse position along the travel axis
774c	would this step carry the position below zero?
774f	borrow one from the high half of the position
7752	advance the position by the speed
7755	store the stepped position
7759	read the sub-position -- progress through the current cell
775c	keep the low 5 bits -- the in-cell counter
775e	reached the next grid cell yet?
7760	not across a cell -- done this frame
7761	crossed a cell -- advance to the object's next state
7764	reload the frame-hold timer for the new phase
7768	queue the per-cell step sound
776b	read the animation selector
776e	point at the arm-animation word table
7771	fetch this phase's animation pointer
7774	install the fresh animation into the record
7777	point at the ROM integrity-guard table
777a	fold five guard bytes
777e	clear the running checksum
777f	read a guard byte
7780	mask to its low 5 bits
7782	fold it into the running total
7784	across all five guard bytes
7787	add the two halves of the total
7788	bias by 0xc7 -- an intact image sums to zero
778a	image intact -- done
778b	point at the object-mover tamper counter
778e	tampered image -- bump a tamper strike
7790	step the object's animation one frame
7793	tick the frame-hold timer
7796	still holding -- paint nothing this frame
7797	sprite index -- selects the tile pattern to stamp
779a	point at the lower-row tile table
779d	fetch the lower block's tile word
77a0	read the tilemap anchor for the lower block
77a6	stamp the lower 2x2 tile block
77a9	point at the upper-row tile table
77af	fetch the upper block's tile word
77b5	reload the tilemap anchor
77b8	-0x400 -- one block-row up the screen
77bb	address the upper block above the lower
77bc	stamp the upper 2x2 block -- the two stack into one tall figure
77bf	point at the object-drawn flag
77c4	already raised this pass?
77c6	raise the object-drawn latch -- and fall into the slot teardown
77c8	clear A to blank the slot
77c9	blank the slot's leading state bytes
77de	blank the display-command scratch
77e1	read the slot's spawn index
77e4	is it due to reappear?
77e6	index below 5 -- leave the slot cleared
77e7	reseed the header byte
77eb	reseed the state byte to the move phase
77ef	arm the countdown that later fires the slot's display command
77f3	point at a fixed on-screen colour strip
77f6	step up one tile row per cell
77f9	ten colour cells to sum
77fc	read a colour cell
77fd	step up one row to its neighbour
77fe	the cell must equal the one above -- a uniform colour column
77ff	altered strip -- divert into the crash trap
7801	fold the cell into the running sum
7803	across all ten cells
7805	bias the sum by 0x83
7807	point at the expected checksum sentinel
780a	does the sum match the intact-board total?
780b	mismatch -- divert to the tamper handler
780e	ret -- its 0xc9 opcode doubles as the checksum's expected total
780f	-0x20 -- one tilemap row up
7812	read the first source tile
7813	stamp the bottom-left cell
7815	step one column right
7817	stamp the bottom-right cell
7819	rise one tile row
781b	stamp the top-right cell
781c	step one column left
781f	stamp the top-left cell -- closing the 2x2 block above the anchor
7875	colour-strip mismatch lands here -- bytes decode as garbage to crash the CPU
7876	data/pointer bytes -- part of the checksum reference block; entries point back into this region (0x7875)
7881	tick the per-slot cadence countdown
7884	run the integrity scan only on the frame it expires
7885	point at the table of expected running checksums
7889	start of the program-image region to sum
788c	clear the 16-bit running total
788f	nine 32-byte blocks to check
7891	32 bytes per block
7893	read a program byte
7895	fold it into the running total
7898	carry into the high byte
789c	expected cumulative total, low byte
78a0	total drifted -- abort, attract stays put
78a3	expected cumulative total, high byte
78a7	total drifted -- abort
78ac	step to the next block's expected-total word
78b4	on to the next block
78b5	across all nine blocks
78b9	program image intact -- arm the next attract phase (0x8e51)
78bc	base of the on-screen-picture checksum walk
78c3	step down one tile row
78c8	twelve cells per column
78ca	read a picture cell
78d1	fold it into the field total
78d2	step down a row
78d4	down the column
78d6	alternate the column's scan direction
78da	flip to stepping up the neighbour column
78dd	cross into the neighbour column
78ed	add the two halves of the field total
78ee	bias -- an intact picture sums to zero
78f0	picture altered -- divert
78f3	point at the enemy-actor arena
78f7	zero count -- clear a full 256-byte page
78f8	wipe the enemy arena
78f9	clear 0x37 trailing bytes
78fb	wipe the trailing block
78fc	re-seed this actor slot for the armed phase
7912	read the global in-play gate
7916	no game running -- no clock to advance
7917	read the active player
791b	default to player 1's freeze gate
791e	default to player 1's timer bank
7921	player 1 -- keep those pointers
7923	else point at player 2's timer bank
7925	and player 2's freeze gate
7927	read this player's freeze gate
7929	gate set -- hold the clock frozen
792b	read the seconds BCD digit
792d	is this an odd second?
792f	even second -- roll the frame counter at 59
7933	odd second -- roll at 60, trimming toward true seconds
7934	read the frame sub-counter
7935	reached the roll point?
7938	below it -- count one more frame
793a	a whole second elapsed -- zero the frame counter
793d	bump the seconds digit
7940	isolate the units nibble
7942	units overflow past 9?
7944	no -- store and stop
7946	clear the units nibble
7948	carry into tens-of-seconds
794a	seconds reached 60?
794d	below 60 -- store and stop
794e	seconds wrap to 00
7951	carry one minute
7954	minutes units nibble
7956	overflow past 9?
795c	carry into tens-of-minutes
795e	store the minutes digit
7960	build a display command -- class 0x06, argument 0x09
7963	enqueue it into the display-command ring
7964	point at the guarded code block (0x2901)
796c	clear both running checksums
796d	0x5b bytes to fold
796f	read a block byte
7973	fold into the plain running sum
7976	carry into the high byte
797a	even address?
7980	fold even bytes into a position-sensitive companion sum
7986	across the whole block
7989	plain-sum low vs the baked signature
798c	signature miss -- refuse to run on a tampered image
7990	plain-sum high vs its signature
7993	miss -- divert
7997	companion-sum low vs its signature
799e	companion-sum high vs its signature
79a1	any signature miss -- tamper divert
79a4	read the active player
79a8	default to player 1's timer minutes byte
79ae	else player 2's timer minutes
79b1	point at the timer-digit video column
79b4	step up one tile row
79b7	two digit passes -- minutes then seconds
79b9	read a packed-BCD timer byte
79bd	keep the high nibble
79c3	paint the tens digit tile
79c4	up one tile row
79c6	isolate the low nibble
79c8	paint the units digit tile
79c9	up one tile row
79ca	is this the minutes pass?
79ce	drop the spacer tile between the digit groups
79d1	step down to the seconds byte
79d3	second digit pass
79db	blank the three timer source bytes now the tiles hold the value
79dc	point at the anti-tamper flag block
79df	seven flags to scan
79e3	a flag set -- run the tail integrity guard
79e6	scan all seven flags
79e8	all clear -- done
79e9	base of the code region to sum (0x68ac)
79ec	clear the 16-bit total
79ef	read a byte
79f0	reached the terminating ret (0xc9)?
79f2	end of the summed region
79f7	carry into the high byte
79f8	fold into the running total
79fa	next byte
79fc	point at the baked checksum reference word
7a00	computed low byte vs the reference
7a01	low-byte miss -- hard integrity trap
7a06	computed high byte vs the reference
7a07	high-byte miss -- soft divert into a gameplay routine
7a0b	checksum reference word, then attract-mode text -- read as data, not code
7a0c	high byte of the message table's guard word (0x24f8) -- verified before the table is trusted, a mismatch traps
7a0d	start of the message-address index -- each little-endian pair is the ROM address of one on-screen string
7a6c	message-address index -- more string pointers
7a7c	message-address index -- unused slots all point at 0x7e56, a blank one-space string
7a8c	on-screen text -- "game over" banner (each string is position byte + attribute byte, tile-encoded text, 0x3f terminator)
7a9c	on-screen text -- "push start button" (attract prompt)
7aac	on-screen text -- "player one"
7abc	on-screen text -- "player two", then "high score" begins
7acc	on-screen text -- "high score" / "credit"
7adc	on-screen text -- "credit" tail / "free play"
7aec	on-screen text -- "free play" tail / start of the attract story
7afc	on-screen text -- attract story: "in the forest..."
7b0c	on-screen text -- story tail / "bonus point" heading
7b1c	on-screen text -- bonus-points display template ("200x - 00")
7b2c	on-screen text -- "your play time"
7b3c	on-screen text -- "number of pigs" (piglet-tally heading)
7b4c	on-screen text -- "...taken" / "play"
7b5c	on-screen text -- "pooyan" banner, bracketed by icon glyphs
7b6c	on-screen text -- "character" banner
7b7c	on-screen text -- "poo yan" banner
7b8c	on-screen text -- attract story: "when 7 wolves join"
7b9c	on-screen text -- attract story: "on the cliff, they"
7bac	on-screen text -- attract story: the wolves drop the giant rock
7bbc	on-screen text -- story tail "...rock!!"
7bcc	on-screen text -- "nice shoot" (praise line)
7bdc	on-screen text -- "bonus point"
7bec	on-screen text -- "(c) konami 1982" copyright line
7bfc	on-screen text -- attract dialogue: "mama help!"
7c0c	on-screen text -- attract dialogue: "oh boy!"
7c1c	on-screen text -- attract dialogue: "mama!" / "mama!!"
7c2c	on-screen text -- "1st bonus after"
7c3c	on-screen text -- "50000 pts"
7c4c	on-screen text -- "one player only"
7c5c	on-screen text -- "one or two players"
7c6c	on-screen text -- "score ranking" heading
7c7c	on-screen text -- ranking tail / "1st"
7c8c	on-screen text -- "2nd" / "3rd" / "4th" rank labels
7c9c	on-screen text -- padding then "5th"
7cac	on-screen text -- "6th" / "7th" rank labels
7cbc	on-screen text -- "8th" / "9th" / "10th" rank labels
7ccc	on-screen text -- "(c) konami 1982" copyright line
7cdc	on-screen text -- "bonus stage" heading
7cec	on-screen text -- "perfect" (bonus-stage result)
7cfc	on-screen text -- "30000 pts"
7d0c	on-screen text -- "and bonus every 70000 pts"
7d1c	on-screen text -- "...70000 pts" tail / "and"
7d2c	on-screen text -- "bonus every 80000 pts"
7d3c	on-screen text -- "2nd phase gets"
7d4c	on-screen text -- "...gets harder"
7d5c	on-screen text -- "as you lose"
7d6c	on-screen text -- "more pigs!"
7d7c	on-screen text -- "difficult" / "in the"
7d8c	on-screen text -- "in the second phase"
7d9c	on-screen text -- "about 10 seconds!"
7dac	on-screen text -- "one wolf"
7dbc	on-screen text -- "400 pts" / "two wolves"
7dcc	on-screen text -- "two wolves ... 400/800"
7ddc	on-screen text -- "800 pts" / "some wolves"
7dec	on-screen text -- "some wolves ... 400/800"
7dfc	on-screen text -- ".../1600 pts" (multi-wolf bonus tiers)
7e0c	on-screen text -- "bonus point"
7e1c	on-screen text -- score-table row: "meat ... 00 pts"
7e2c	on-screen text -- score-table row: "wolf ... 00 pts"
7e3c	on-screen text -- score-row tail / "bonus"
7e4c	on-screen text -- "bonus stage" / a lone blank string
7e5c	on-screen text -- "double" / "perfect" (bonus-stage results)
7e6c	end of the message table (final terminator)
7e6d	read the player-1 lives dip setting
7e70	fewer than four lives?
7e72	default 3-life board -- the guard never arms
7e73	read the free-running vblank counter
7e77	fire only on its zero crossing -- once every 256 frames
7e78	top of the ROM span to sum
7e7d	clear the running sum and the carry tally
7e7e	read a ROM byte
7e7f	walk downward through the span
7e81	fold into the 8-bit running sum
7e84	tally an overflow past 255
7e85	the terminator byte 0x34
7e87	reached the span's end?
7e88	keep summing
7e8b	combine carries and sum into a signature
7e8c	mask three signature bits
7e8e	intact image -- no strike
7e8f	point at the ROM tamper-strike counter
7e92	tampered image -- bump a strike, failing quietly
7e94	point at the start-button poll
7e97	stack it as the shared return -- every path ends by polling start
7e98	read the run-once latch
7e9c	write-anim already finished -- just poll start
7e9d	read the pending high-score rank
7ea1	an entry is pending -- run a write-anim handler
7ea4	nothing pending -- arm the latch, marking write-anim done
7ea8	read the write-anim handler selector
7eab	dispatch the seed, step, or append handler
7eb2	point at the top-row stamp cell
7eb5	stash the stamp base for the second walk
7eba	row budget -- three rows
7ebd	read the pending rank (winning rank + 1)
7ec3	seed the 16-bit inter-row countdown (0x03a0)
7ec6	base-minus-one record anchor
7eca	step once per rank
7ecb	record stride -- three bytes per entry
7ece	walk to this rank's record
7ed2	store the record pointer
7ed6	read the cabinet mode
7eda	cocktail cabinet -- keep player 1's port
7edc	read the active player
7ee0	upright with player 2 up -- read player 2's port
7ee2	player 1 input port
7ee7	player 2 input port
7eea	park the chosen control source
7ef1	reload the stamp base
7ef5	stamp stride -- two cells per rank
7ef7	walk to this row's video cell
7ef9	store the advanced stamp pointer
7eff	draw the row's first tile now
7f00	seed the animated tile index (0x11)
7f05	advance to the stepper handler
7f0a	per-step delay -- 12 frames
7f0e	read the 16-bit inter-row countdown
7f12	tick it down
7f1d	countdown drained -- tear the animation down
7f20	read the animation's data pointer
7f23	step-down flag set?
7f27	step-up flag set?
7f29	neither -- no step, go lay a row
7f2b	point at the per-step delay
7f2e	tick the per-step delay
7f2f	still pacing -- wait
7f32	reload the delay
7f35	point at the tile index
7f38	step the tile index up
7f3a	climbed past the high bound (0x2c)?
7f3e	wrap down to the low bound
7f45	tick the per-step delay
7f46	still pacing -- wait
7f49	reload the delay
7f4f	step the tile index down
7f51	dropped below the low bound (0x10)?
7f55	wrap up to the high bound
7f57	read the video write pointer
7f5b	the stepped tile index
7f5c	stamp it on screen -- and fall into the row-appender
7f5d	read the animation data pointer
7f60	read the byte it addresses
7f61	point at the phase ring
7f64	bring bit 4 of the byte down to bit 0
7f68	shift that bit into the phase ring
7f6b	keep the low three phase bits
7f6d	is this the fire phase?
7f6f	off phase -- only the ring advanced
7f73	reseed the inter-row countdown (0x03a0)
7f76	read the current tile index
7f79	the work-block write cursor
7f7c	append the tile to the block record
7f7e	bump the write cursor
7f81	point at the remaining-rows tally
7f84	count one row off
7f8a	block fully drawn -- finish the animation
7f8c	read the tile index
7f8f	the video row pointer
7f92	stamp this row's tile
7f93	-0x20 -- one tilemap row up
7f97	back the pointer up one row for the next row
7f9c	re-prime the new cell with tile 0x11
7f9f	next frame runs the stepper again
7fa4	reset the tile index for the next row
7fa8	enqueue the silence sound command
7fab	read the count of rows drawn
7faf	nothing on screen -- skip the erase
7fb1	that many cells to blank
7fb2	the blank tile (0x10)
7fb4	the video-RAM cursor
7fb7	step up one tile row per cell
7fba	the work-block record pointer
7fbe	blank an on-screen cell
7fbf	blank the matching record byte
7fc2	up one tilemap row
7fc5	across all drawn rows
7fc7	point at the phase timer
7fca	reload it to time the next phase
7fcd	stop dispatching write-anim handlers
7fd2	arm the round-end reset scan
