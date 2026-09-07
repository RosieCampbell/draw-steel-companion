# Guided play prototype

Open **guided.html**. The trainer.html address now opens the integrated Learn area. The original sheet remains at index.html for compatibility, without a link from the guided interface.

## Design

The entry point is Play, with My Hero and Learn alongside it. Play has three perspectives: My turn, Other turns, and Between fights. Hero health, Focus, surges, Mark and condition reminders stay nearby. The layout uses a warm paper background, dark ink, steel-blue controls, a small geometric Memonek illustration, serif headings and plain-language sans-serif controls. On narrower screens the sidebar becomes a compact status panel above the action flow.

This is a working vertical slice through a combat round, not a replacement for every option in the full sheet. The first visit starts in practice mode. Live mode is an explicit choice and is remembered on that browser. Practice uses its own storage key; live mode uses the existing play-sheet key. Existing inventory and campaign data are retained. Notes and guided metadata survive opening the full sheet. Use only one tracker actively; the guided prototype detects another tracker changing its data and reloads before accepting a new action. The older sheet does not provide reciprocal conflict detection or track the guided action budget.

## A complete practice round

1. Begin an encounter, then begin your turn to gain 2 Focus.
2. Choose Mark a foe. Name a target and confirm it is valid and in range.
3. Choose Patient Shot. Confirm the target, choose any modifiers, enter two physical dice or roll them digitally.
4. Read the result aloud. The calculation is shown beneath it. Previewing does not spend anything.
5. Record the action. Main action, surges and the first Mark-damage Focus gain update together. Undo reverses the whole operation.
6. Finish your turn. Resolve any saves/EoT effects using the reminder.
7. During other turns, record the ally heroic trigger, a Mark benefit, or Overwatch when the table confirms their requirements.
8. Start a new round separately from beginning your turn, or end combat and spend a Recovery.

My Hero includes kit selection after a respite, notes, manual resource adjustments and JSON restore. Downloads are available in both modes and labeled as practice or hero backups. Learn contains five scenarios, a searchable rules and ability library, test and attack roll practice, flashcards with saved review intervals, and a 12-question quiz. Rules distinguish Everyone from personal class, ancestry and kit features. Damage tables explain the characteristic, kit and item contributions separately from the power roll. Stamina, Focus and surges are editable inline, with damage/healing shortcuts. My Hero includes editable campaign values, projects, consumables and equipment.

## Intentional limits

- The app does not know enemy defenses, positions, potency resistance or ally resources. Confirm requirements at the table; targets resolve their own damage mitigation, healing and movement.
- Mark, Patient Shot, the active melee signature, Mind Game, basic Strike Now!, Squad! Forward!, Move, Disengage, Catch Breath and Defend are represented. Other maneuvers, upgraded Strike Now!, Overwatch’s slow rider and potency surges use the integrated rules/manual adjustments.
- Conditions remind and restrict some obvious actions; conditional banes from fear, taunt, grabs and terrain must be entered manually. Saving throws and effect expiration are not automatic. Movement is recorded as an action, not tracked square by square.
- A granted-extra-action/manual-correction control is explicit. It does not grant permission to take extra actions; the table determines that. Main-action trade-down is supported.
- Local preview and the published site have different browser storage. To transfer a live session between addresses, use a JSON backup. No network or account synchronization exists.

## Validation

40 automated tests cover the original companion and prototype. The guided tests include a full round, action costs, pure roll previews, natural 19–20, surge limits, Dazed, extra actions, action trade-down, dying recovery, legacy data, practice isolation, live-mode confirmation, conflict detection, learning feedback and labels/links. Existing tracker tests continue passing.

The browser-control connection reports no available browser despite the ambient open-tab context. Actual visual, touch, and screen-reader checks remain outstanding. The preview is ready for the user to try; no claim of completed visual QA is made.

## Reference-only Learn revision
Learn now opens directly to a searchable, scope-filtered rules reference. Training scenarios, dice exercises, flashcards and quizzes have been removed from the guided interface. Entries use rulebook terminology, identify the source book and label condensed wording; character-specific explanations remain separate. General maneuvers and Charge have individual entries. Legacy learning metadata is preserved for compatibility. The current suite has 39 tests, including reference search and filtering.
