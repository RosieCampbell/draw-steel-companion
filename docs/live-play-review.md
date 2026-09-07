# Live-play review

Reviewed 7 September 2026. Priority: using Aravinthaya's companion during live sessions.

## What changed

The original sheet made the player scroll past progression, projects and gear before reaching Mark and round triggers. It also treated the beginning of a personal turn as the beginning of a combat round. These are different events in Draw Steel, and the distinction affects both Focus and triggered actions.

The updated sheet keeps combat tracking together, moves infrequent session tools into a disclosure, and provides a navigation bar and searchable reference. It remains a personal play aid; it does not attempt to adjudicate every rule or automate other players' turns.

| Live task | Original friction or error | Implemented behavior |
| --- | --- | --- |
| Begin a turn | Re-enabled round-limited gains and reactions | My turn adds 2 Focus; New round resets the limits separately |
| Correct a double tap | Repeated My turn could add Focus repeatedly | My turn disables after recording; Undo reverses mistakes |
| Record damage | Multiple taps and separate temporary-Stamina arithmetic | Enter one amount; damage consumes temporary Stamina first |
| Record bleeding | Easy to confuse damage with direct loss | Separate direct Stamina loss control bypasses temporary Stamina |
| Remember conditions | Needed to find and open the reference | Active conditions show reminders at the tracker; dying shows bleeding |
| Find a rule | Reference followed a long console on small screens | Top links, search, and automatic opening of matching sections |
| Change kit | Main references retained Shining Armor attacks | Active melee damage, signature, recovery values and kit summary update together |
| End combat | Temporary Stamina survived, dying recovery stayed blocked | Resources and Mark clear; out-of-combat Recovery spending becomes available |
| Move devices | Download depended on Claude's host API | Standard JSON download, plus copy/paste fallback |
| Restore a session | Invalid JSON structure partially corrupted state | Validate a candidate before replacing state; Undo reverses a valid import |
| Trust saved data | Trainer reset on reload; write failures were silent | Practice state persists; visible save status; corrupt saved state preserved |
| Use keyboard controls | Glossary and tab semantics incomplete | Focus outlines, glossary keyboard activation, arrow-key tabs and expanded-state labels |

## Rules and content review

All ten findings from the initial review have been addressed, including Mind Game's automatic Mark edge, the drill's duplicate Focus award and misleading “free Recovery” wording.

The wider pass also corrected the trainer's dying/dead label, added Patient Shot's adjacent-enemy bane control, clarified Dazed's prohibition on free triggered actions, distinguished ability rolls from saving throws in condition reminders, clarified Mark's line-of-effect requirements in prominent reference text, and removed a reference to Anki/Obsidian files that were not in the repository. The generic power-roll introduction now acknowledges that tests can fail.

References used: supplied *Heroes* and *Starter Rules* PDFs. Printed pages: Heroes 5 (natural rolls), 41 (Memonek traits), 175–178 (Tactician), 220 (Mountain); Starter Rules 27 (conditions), 44 (triggered actions), 54–55 (Stamina and encounter end). The Heroes natural-19/20 rule supports automatic tier 3; that was not a bug. Campaign rewards and the legality of every personal character selection have not been independently established.

## Remaining usability priorities

| Priority | Recommendation | Why it matters / acceptance check |
| --- | --- | --- |
| Next | Validate the revised sheet during one real session on the player's usual device | Record actual pauses, mis-taps and searches; keep fixes driven by observed play |
| Next | Test phone widths, landscape, 200% zoom and screen-reader announcements in a real browser | Confirm no horizontal page overflow, covered buttons, clipped text or excessive announcements |
| Next | Decide whether to retire the trainer's practice tracker | Two trackers still create a possible source of confusion, even with explicit separation. Prefer one authoritative live record |
| Later | Track condition source and duration separately when needed | One chip per condition cannot represent several independent sources or different EoT expiration points |
| Later | Add per-ability reference cards only if search is still too slow | Show cost, action, range, roll, damage and rider together; avoid adding more duplicate explanations |
| Later | Centralize character/kit/rule data | The two self-contained pages duplicate data. A build that emits standalone pages from one data source would reduce drift, but introduces maintenance overhead |
| Later | Add a deliberate respite workflow | Recovery refill and Victory-to-XP conversion are still manual. A single undoable action could reduce between-session bookkeeping |
| Later | Consider backup support for learning progress only if it matters | Play-sheet state exports today; trainer practice and flashcard progress remain device-local |

Keep the live sheet as the entry point. Avoid making it a character builder, general rules encyclopedia or multi-character app until those are actual needs.

## Suggested session check

Before the session, download a backup. On the usual device, try: record 13 damage with 5 temporary Stamina; find Overwatch; mark a creature; take the once-per-round Focus gain before your own turn; start your turn; begin a new round; apply Dazed; end combat at negative Stamina; spend a Recovery; restore the backup. Observe whether each action is easy to find and whether the resulting state is unsurprising. Also verify that a normal JSON download opens correctly on that device.

## Verification and limits

20 automated regression tests pass in jsdom, executing the actual inline scripts and interacting with their DOM controls. Tests cover both pages, reload persistence, malformed and legacy imports, file restore, standard download creation, save failure, round accounting, Undo, negative-Stamina healing, temporary Stamina, kit references, Mark edges, Patient Shot's bane, natural-20 behavior, navigation, keyboard support and internal links. No runtime dependencies were added; jsdom is development-only.

No browser was connected in the review environment. This is a source, rules, interaction-logic and heuristic usability review; visual layout, real downloads, touch behavior and assistive-technology behavior still require the device checks above. It is not a claim that every passage in the rulebooks or every browser combination has been exhaustively verified.
