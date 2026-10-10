# Mock Exam

A practice-exam and flashcard trainer. No build step to run it, no dependencies, no
network calls. Open `index.html` in any browser, desktop or mobile.

## Layout

    index.html          markup
    styles.css          presentation
    app.js              behaviour — sessions, rotation, scoring, progress
    data/questions.js   the question bank
    data/cards.js       the flashcards

Data is loaded as plain `<script>` globals rather than `fetch`, so the app works
from `file://` as well as over http.

## Use

- **Flashcards** — tap or click to reveal, swipe left/right to move, mark known / not known.
- **Exam** — 25 / 50 / 100 question sessions, or a full blueprint-weighted paper.
  Modes: blueprint-weighted, weak-area drill, long-form cases, official bank,
  short-form, single section, single module, and re-drill of what you got wrong.
- **Rotation** — on by default; serves the questions you have seen least first, so
  consecutive sessions do not repeat until the bank has been worked through.
- **Progress** — per-section accuracy and coverage, stored in `localStorage` on the
  device. Nothing leaves the browser.

## Keyboard

`A`–`D` select an answer · `Enter` next · `Space` reveal a flashcard, then move to
the next one · `1` / `2` mark it unknown / known · `←` `→` move between cards.

Space never marks a card — only `1` and `2` do.

## Privacy

Entirely client-side. No analytics, no external requests, no telemetry.
