# Silent writing and versioned feedback

Start → editing → explicit Review → review_requested → reviewed → Revise → revising → explicit Recheck → reviewed → explicit Finish → completed.

Hint is an explicit action that leaves the user in editing/revising. Its level advances L1/L2/L3 within the same draft version, then resets after a text edit. Editing, blur, paste, IME, page visibility and autosave only persist local text. Spellcheck/autocorrect are disabled and text is never changed by feedback. No Tutor operation comes from an effect, timer or typing event.

Every change increments draftVersion. A review snapshots its submitted version before work begins. Responses store that snapshot and version, display an old-version notice if the user has edited, and never replace draft text. Finish requires a review of the current version and explicit rating, and cannot count twice for a completed session. New modes/ranges start distinct sessions; existing drafts and histories are retained. Hidden subtitles remain hidden on reload. Memory recall pauses audio until the learner explicitly allows replay.

LRC metadata and questions are not body text by default. Role selection plus Confirm, or explicit selected-lines body confirmation, is a user review. Paragraph practice means a user-defined group of confirmed lines. Re-imported or excluded reference lines invalidate old original comparisons rather than inventing new text.
