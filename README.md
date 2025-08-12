# Line Select: Outwards/Inwards (Up/Down)

Four precise line-wise selection commands that **pin** one end so "inwards" always trims from that side:

- **Line Select: Select One Line Up** – expand selection upward by one whole line (bottom stays pinned)
- **Line Select: Deselect One Line From Top** – shrink selection from the top by one line (bottom stays pinned)
- **Line Select: Select One Line Down** – expand selection downward by one whole line (top stays pinned)
- **Line Select: Deselect One Line From Bottom** – shrink selection from the bottom by one line (top stays pinned)

Works with multiple cursors/selections.

## Commands
- `lineSelect.outwardsUp`
- `lineSelect.inwardsUp`
- `lineSelect.outwardsDown`
- `lineSelect.inwardsDown`

Default keybindings (change as you like):
- Expand SelectionOne Line Up: `ctrl+shift+up`
- Shrink Selection One Line From Top: `ctrl+alt+shift+up`
- Expand SelectionOne Line Down: `ctrl+shift+down`
- Shrink Selection One Line From Bottom: `ctrl+alt+shift+down`


## Install from source
```bash
npm install
npm run build
# in VS Code: F5 to launch Extension Development Host
```

## Package and install

```bash
npm run package
code --install-extension line-select-quad-0.0.1.vsix
```

## Why not just keybindings?

Keybindings using `cursorMove` can expand/shrink, but when you cross the anchor they **flip direction**. These commands **pin** the intended end, so “inwards” always trims from that side and never reverses.
