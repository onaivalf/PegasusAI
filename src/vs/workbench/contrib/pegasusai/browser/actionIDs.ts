// Normally you'd want to put these exports in the files that register them, but if you do that you'll get an import order error if you import them in certain cases.
// (importing them runs the whole file to get the ID, causing an import error). I guess it's best practice to separate out IDs, pretty annoying...

export const PEGASUSAI_CTRL_L_ACTION_ID = 'pegasusai.ctrlLAction'

export const PEGASUSAI_CTRL_K_ACTION_ID = 'pegasusai.ctrlKAction'

export const PEGASUSAI_ACCEPT_DIFF_ACTION_ID = 'pegasusai.acceptDiff'

export const PEGASUSAI_REJECT_DIFF_ACTION_ID = 'pegasusai.rejectDiff'

export const PEGASUSAI_GOTO_NEXT_DIFF_ACTION_ID = 'pegasusai.goToNextDiff'

export const PEGASUSAI_GOTO_PREV_DIFF_ACTION_ID = 'pegasusai.goToPrevDiff'

export const PEGASUSAI_GOTO_NEXT_URI_ACTION_ID = 'pegasusai.goToNextUri'

export const PEGASUSAI_GOTO_PREV_URI_ACTION_ID = 'pegasusai.goToPrevUri'

export const PEGASUSAI_ACCEPT_FILE_ACTION_ID = 'pegasusai.acceptFile'

export const PEGASUSAI_REJECT_FILE_ACTION_ID = 'pegasusai.rejectFile'

export const PEGASUSAI_ACCEPT_ALL_DIFFS_ACTION_ID = 'pegasusai.acceptAllDiffs'

export const PEGASUSAI_REJECT_ALL_DIFFS_ACTION_ID = 'pegasusai.rejectAllDiffs'
