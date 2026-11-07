# DQ6: banners get a bare 16px icon

Error banners carried a 48px Jelly (blue on red, indenting the text about 75px at 375). Info banners put
the info icon in a same-colour disc, a circle in a circle. Both now use a bare 16px Lucide stroke icon
(`alert` is new, `info` as before), centred on the first text line in a 1lh box, so it stays aligned
whether the banner inherits 13/19 or 16/24. Edges are equal (px-4). Jelly stays for empty and loading
moments (Q3). UI.md Error/Info banner rows updated. The v3-drift C2 e2e pinned the Jelly; it now checks
no image and a 16px icon centred on line 1.

Merged main after #196 added the warn tone (warnBg/warnText, role=status, optional primary action). Warn gets
the same bare 16px treatment with the alert icon (it needs attention). /dev/ui's Banner section gains a warn
sample. C2 now checks all three tones and that the icon actually draws (a stale dev server once served an
empty 16px svg that passed the size check).
