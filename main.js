const { Plugin, Menu } = require("obsidian");
const { ViewPlugin } = require("@codemirror/view");

const COLORS = [
  ["🔴", "Red"],
  ["🟠", "Orange"],
  ["🟡", "Yellow"],
  ["🟢", "Green"],
  ["🔵", "Blue"],
  ["🟣", "Purple"],
  ["🟤", "Brown"],
  ["⚫", "Black"],
  ["⚪", "White"],
];

const gap = String.raw`(?:[\t ]+|$)`;
const indent = String.raw`[\t \u200b\u200c]*`;
const quoteOrCallout = String.raw`(?:(?:>[\t ]*)+(?:\[![^\]]+\][+-]?${gap})?)?`;
const listItemOrTask = String.raw`(?:(?:[-+*]|\d+[.)])[\t ]+(?:\[[^\]]\]${gap})?)?`;
const heading = String.raw`(?:#{1,6}${gap})?`;
const MARKUP_PREFIX = new RegExp(
  `^${indent}${quoteOrCallout}${listItemOrTask}${heading}`,
  "u",
);
const EXISTING_DOT = new RegExp(
  String.raw`^(${COLORS.map(([dot]) => dot).join("|")})\uFE0F?(?:[\t ]|$)`,
  "u",
);

function parseLine(text) {
  const prefix = text.match(MARKUP_PREFIX)[0];
  const rest = text.slice(prefix.length);
  const found = rest.match(EXISTING_DOT);
  return {
    start: prefix.length,
    end: prefix.length + (found ? found[0].length : 0),
    current: found ? found[1] : null,
    space: rest === "" && /\S$/.test(prefix) ? " " : "",
  };
}

function setDot(view, lineNumber, dot) {
  const line = view.state.doc.line(lineNumber);
  const { start, end, current, space } = parseLine(line.text);
  if (current === dot) return;
  const changes = view.state.changes({
    from: line.from + start,
    to: line.from + end,
    insert: dot ? `${space}${dot} ` : "",
  });
  view.dispatch({ changes, selection: view.state.selection.map(changes, 1) });
}

module.exports = class SimpleColorDots extends Plugin {
  onload() {
    this.registerEditorExtension(
      ViewPlugin.define((view) => {
        const remember = (event) => {
          this.rightClick = { view, x: event.clientX, y: event.clientY };
        };
        view.dom.addEventListener("contextmenu", remember, true);
        return {
          destroy: () =>
            view.dom.removeEventListener("contextmenu", remember, true),
        };
      }),
    );
    this.registerEvent(
      this.app.workspace.on("editor-menu", (menu, editor) =>
        this.addMenuItem(menu, editor.cm),
      ),
    );
  }

  addMenuItem(menu, view) {
    const click = this.rightClick?.view === view ? this.rightClick : null;
    this.rightClick = null;
    const clicked = click && view.posAtCoords(click);
    const lineNumber = view.state.doc.lineAt(
      clicked ?? view.state.selection.main.head,
    ).number;
    menu.addItem((item) =>
      item
        .setTitle("Dot color…")
        .setIcon("palette")
        .onClick((event) =>
          this.showPalette(view, lineNumber, {
            x: event?.clientX || click?.x || 0,
            y: event?.clientY || click?.y || 0,
          }),
        ),
    );
  }

  showPalette(view, lineNumber, position) {
    const { current } = parseLine(view.state.doc.line(lineNumber).text);
    const palette = new Menu();
    for (const [dot, name] of COLORS) {
      palette.addItem((item) =>
        item
          .setTitle(`${dot} ${name}`)
          .setChecked(dot === current)
          .onClick(() => setDot(view, lineNumber, dot)),
      );
    }
    palette.addSeparator();
    palette.addItem((item) =>
      item
        .setTitle("Remove dot")
        .setDisabled(current === null)
        .onClick(() => setDot(view, lineNumber, null)),
    );
    const openAfterEditorMenuCloses = () => palette.showAtPosition(position);
    setTimeout(openAfterEditorMenuCloses);
  }
};
