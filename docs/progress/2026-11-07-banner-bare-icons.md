# DQ6: banners get a bare 16px icon

Error banners carried a 48px Jelly (blue on red, indenting the text about 75px at 375). Info banners put
the info icon in a same-colour disc, a circle in a circle. Both now use a bare 16px Lucide stroke icon
(`alert` is new, `info` as before), centred on the first text line in a 1lh box, so it stays aligned
whether the banner inherits 13/19 or 16/24. Edges are equal (px-4). Jelly stays for empty and loading
moments (Q3). UI.md Error/Info banner rows updated. The v3-drift C2 e2e pinned the Jelly; it now checks
no image and a 16px icon centred on line 1.
