import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  const cmds: [string, (editor: vscode.TextEditor) => void][] = [
    ['lineSelect.outwardsUp', outwardsUp],
    ['lineSelect.inwardsUp', inwardsUp],
    ['lineSelect.outwardsDown', outwardsDown],
    ['lineSelect.inwardsDown', inwardsDown],
  ];

  for (const [id, fn] of cmds) {
    context.subscriptions.push(
      vscode.commands.registerTextEditorCommand(id, (editor) => fn(editor))
    );
  }
}

export function deactivate() {}

/** Helpers **/

function posLineStart(doc: vscode.TextDocument, line: number): vscode.Position {
  const clamped = Math.max(0, Math.min(line, doc.lineCount - 1));
  return new vscode.Position(clamped, 0);
}

function posEndForExclusiveLine(
  doc: vscode.TextDocument,
  exclLine: number
): vscode.Position {
  if (exclLine < doc.lineCount) return new vscode.Position(exclLine, 0);
  // Exclusive past last line -> end of doc
  return doc.lineAt(doc.lineCount - 1).range.end;
}

/**
 * Determines if the selection contains any partial line selections.
 * Returns true if any part of the selection is partial (not full lines).
 */
function hasPartialLineSelection(sel: vscode.Selection, doc: vscode.TextDocument): boolean {
  if (sel.isEmpty) {
    return false; // Empty selection is treated as cursor, not partial
  }
  
  const pMin = sel.start.isBefore(sel.end) ? sel.start : sel.end;
  const pMax = sel.start.isBefore(sel.end) ? sel.end : sel.start;
  
  // If selection doesn't start at column 0, it's partial
  if (pMin.character !== 0) {
    return true;
  }
  
  // If single line selection, check if it goes to the end of the line
  if (pMin.line === pMax.line) {
    const lineText = doc.lineAt(pMin.line).text;
    // If selection ends before the end of the line content, it's partial
    return pMax.character < lineText.length;
  }
  
  // Multi-line selection: check if it ends at column 0 (full line selection)
  // If it doesn't end at column 0, the last line is partially selected
  return pMax.character !== 0;
}

/**
 * Snap current selection to whole-line bounds.
 * Returns [topInclusiveLine, bottomExclusiveLine].
 * If caret only, becomes [L, L+1] where L is the active line.
 * If ANY partial selection anywhere, select ALL affected lines completely.
 * If full line selection, returns the actual line range for expansion/contraction.
 */
function fullLineRange(sel: vscode.Selection, doc: vscode.TextDocument): [number, number] {
  if (sel.isEmpty) {
    const L = sel.active.line;
    return [L, Math.min(L + 1, doc.lineCount)];
  }
  
  const pMin = sel.start.isBefore(sel.end) ? sel.start : sel.end;
  const pMax = sel.start.isBefore(sel.end) ? sel.end : sel.start;
  
  // If any part of the selection is partial, select all affected lines completely
  if (hasPartialLineSelection(sel, doc)) {
    const topLine = pMin.line;
    const bottomLine = pMax.line;
    // If selection ends at column 0, it means the line above is the last selected line
    const actualBottomLine = pMax.character === 0 ? bottomLine - 1 : bottomLine;
    return [topLine, actualBottomLine + 1];
  }
  
  // Full line selection - return the actual range for normal expansion/contraction
  const top = pMin.line;
  const bottomExclusive = pMax.line;
  return [top, bottomExclusive];
}

/**
 * Build a line selection from [top, bottomExclusive].
 * If anchorAtEnd=true, anchor is the exclusive end (pins bottom side);
 * else anchor is the start (pins top side).
 */
function buildSelection(
  doc: vscode.TextDocument,
  top: number,
  bottomExclusive: number,
  anchorAtEnd: boolean
): vscode.Selection {
  const startPos = posLineStart(doc, top);
  const endPos = posEndForExclusiveLine(doc, bottomExclusive);
  return anchorAtEnd
    ? new vscode.Selection(endPos, startPos)
    : new vscode.Selection(startPos, endPos);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Commands **/

// Outwards Down: expand downward by 1 line (pin top)
function outwardsDown(editor: vscode.TextEditor) {
  const doc = editor.document;
  editor.selections = editor.selections.map(sel => {
    if (sel.isEmpty) {
      // First expand: select just the current line
      const L = sel.active.line;
      return buildSelection(doc, L, L + 1, /*anchorAtEnd*/ false);
    }
    
    // Check if current selection has partial lines
    if (hasPartialLineSelection(sel, doc)) {
      // Convert partial selection to full line selection without expanding
      let [top, botEx] = fullLineRange(sel, doc);
      return buildSelection(doc, top, botEx, /*anchorAtEnd*/ false);
    }
    
    // Full line selection - normal expansion
    let [top, botEx] = fullLineRange(sel, doc);
    if (botEx < doc.lineCount) botEx += 1;
    return buildSelection(doc, top, botEx, /*anchorAtEnd*/ false);
  });
}

// Inwards Down: shrink from bottom by 1 line (pin top)
function inwardsDown(editor: vscode.TextEditor) {
  const doc = editor.document;
  editor.selections = editor.selections.map(sel => {
    // Check if current selection has partial lines
    if (hasPartialLineSelection(sel, doc)) {
      // Convert partial selection to full line selection without shrinking
      let [top, botEx] = fullLineRange(sel, doc);
      return buildSelection(doc, top, botEx, /*anchorAtEnd*/ false);
    }
    
    // Full line selection - normal shrinking
    let [top, botEx] = fullLineRange(sel, doc);
    const size = botEx - top;
    if (size <= 1) {
      // collapse at top line start
      const caret = posLineStart(doc, top);
      const collapsed = new vscode.Selection(caret, caret);
      return collapsed;
    }
    botEx -= 1;
    return buildSelection(doc, top, botEx, /*anchorAtEnd*/ false);
  });
}

// Outwards Up: expand upward by 1 line (pin bottom)
function outwardsUp(editor: vscode.TextEditor) {
  const doc = editor.document;
  editor.selections = editor.selections.map(sel => {
    if (sel.isEmpty) {
      // First expand: select just the current line
      const L = sel.active.line;
      return buildSelection(doc, L, L + 1, /*anchorAtEnd*/ true);
    }
    
    // Check if current selection has partial lines
    if (hasPartialLineSelection(sel, doc)) {
      // Convert partial selection to full line selection without expanding
      let [top, botEx] = fullLineRange(sel, doc);
      return buildSelection(doc, top, botEx, /*anchorAtEnd*/ true);
    }
    
    // Full line selection - normal expansion
    let [top, botEx] = fullLineRange(sel, doc);
    if (top > 0) top -= 1;
    // anchor at exclusive end so bottom stays pinned
    return buildSelection(doc, top, botEx, /*anchorAtEnd*/ true);
  });
}

// Inwards Up: shrink from top by 1 line (pin bottom)
function inwardsUp(editor: vscode.TextEditor) {
  const doc = editor.document;
  editor.selections = editor.selections.map(sel => {
    // Check if current selection has partial lines
    if (hasPartialLineSelection(sel, doc)) {
      // Convert partial selection to full line selection without shrinking
      let [top, botEx] = fullLineRange(sel, doc);
      return buildSelection(doc, top, botEx, /*anchorAtEnd*/ true);
    }
    
    // Full line selection - normal shrinking
    let [top, botEx] = fullLineRange(sel, doc);
    const size = botEx - top;
    if (size <= 1) {
      // collapse at bottom line start
      const bottomLine = clamp(botEx - 1, 0, doc.lineCount - 1);
      const caret = posLineStart(doc, bottomLine);
      const collapsed = new vscode.Selection(caret, caret);
      return collapsed;
    }
    top += 1;
    return buildSelection(doc, top, botEx, /*anchorAtEnd*/ true);
  });
}