# DQ18: the partial badge agrees with the n under the %

The Dashboard's partial-run demo read "Last run partial: 250 of 250 answers" while the line under the %
said 240. Cause: the `examplePartial` fixture was marked partial with no failed answers. Live data can't
do that (`private.recompute_run` sets partial only when some answers failed), so the component needs no
special case. The fixture now fails 10 answers (3/3/3/1 per engine), leaving the 240 that
`exampleMetrics` counts. The shell test now checks received < expected and received = the metric's n.
