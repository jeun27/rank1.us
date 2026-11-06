## Focus after x and Undo in the Fix list (QA N1, branch fix/fixes-focus-after-undo)

- After x (or a click) on a fix, the done row left the Open list and focus dropped to the page body. After Undo in the toast, the toast closed and focus was lost too. Keyboard users had to tab from the top.
- Now: after marking done, focus moves to the next fix's check-off (in display order, else the previous one, else the toast's Undo). In "All" the done row stays, so focus stays on it. After Undo, focus goes back to the restored fix's check-off. "s" already kept focus.
- The lookup is scoped to the list (`data-fix-check`), so a pending frame never moves focus into another list.
