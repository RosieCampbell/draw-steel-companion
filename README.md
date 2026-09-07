# Draw Steel Companion

An unofficial, fan-made play companion for the **Draw Steel** TTRPG by MCDM Productions.

- **[Play sheet](index.html)** (`index.html`) — a one-page interactive sheet for the tactician Aravinthaya: live trackers (Stamina, Focus, surges, conditions, projects, consumables, gear, kit loadout), a tap-anywhere rules glossary, undo, and file-based save/load between sessions. Styled after the official character sheet.
- **[Rules trainer](trainer.html)** (`trainer.html`) — an interactive tutorial for the starter rules: dice simulators, drills, flashcards, quizzes, and an at-the-table tracker.

Both pages are self-contained HTML files: no build step or runtime dependencies. Open `index.html` for live play; open `trainer.html` to study. Web fonts are optional; system fonts work offline.

## During a session

1. **Start combat** sets Focus to Victories and grants the ancestry surge. It starts round 1 without taking your turn.
2. **My turn** adds 2 Focus once. **New round** resets the two Focus triggers and your triggered action; it does not grant Focus. Undo corrects an accidental tap. For an unusual extra turn, adjust Focus manually.
3. Enter the amount and choose **Take damage**, **Heal**, or **Lose Stamina (bleeding)**. Damage uses temporary Stamina first; direct Stamina loss bypasses it.
4. Use the navigation bar or rule search for actions and conditions. Active conditions show their reminders next to the tracker. Their durations still need to be tracked at the table; the app does not roll saves or automatically end EoT effects.
5. **End combat** clears Focus, surges, temporary Stamina and Mark. You can then spend Recoveries even while dying. If an effect explicitly preserves temporary Stamina after combat, restore its amount manually. Clear unwanted conditions with the separate button.

Progression, projects, inventory and kit selection are under **Between sessions**. Change kits after a respite; kit controls are disabled during combat. Mountain numbers include the campaign's Heelcutter +1 damage assumption.

## Saving

The play sheet and trainer practice tracker save **separately**, in this browser at this site address. They do not sync with each other or between devices. The save status reports write failures. Flashcard progress is separate again.

Use **Download backup file** or **Show backup code** on the play sheet before moving devices or site addresses. Both restore methods validate the data before replacing the current session. Existing play-sheet backups remain supported; older backups without round information load between combats. Undo can reverse a restore. Corrupt stored data is preserved instead of silently overwritten.

## Development checks

Node 24+ is needed only for tests:

```sh
npm ci
npm test
```

The tests execute both pages in a simulated DOM and cover round accounting, damage, healing, backup validation, persistence, kit references, rollers and keyboard controls. They do not replace a visual browser/mobile check. See [the live-play review](docs/live-play-review.md) for scope and remaining usability work.

## Legal

This is an unofficial study aid and play aid. Mechanics are summarized from the *Draw Steel* rules. **Draw Steel™ & © MCDM Productions LLC.** This project is not affiliated with or endorsed by MCDM. If you enjoy the game, buy it at [mcdmproductions.com](https://www.mcdmproductions.com/).
