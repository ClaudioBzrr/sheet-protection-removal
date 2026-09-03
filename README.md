# Sheet Unlocker

Remove protection (password) from Excel spreadsheets (`.xlsx`/`.xlsm`).

## Quick start

```powershell
npm install
npm start            # opens the interactive TUI
```

- No arguments → **TUI**: lists Excel files in the folder, shows which sheets are protected, and generates the unlocked file.
- With a file → TUI with the file pre-selected:
  ```powershell
  npm start -- protected.xlsx
  # or drag the .xlsx onto the .exe
  ```
- CLI mode (non-interactive, ideal for scripts):
  ```powershell
  npm start -- protected.xlsx --cli -o output.xlsx
  ```

## Build the Windows executable (`dist/sheet-unlock.exe`)

Uses Node's [Single Executable Application](https://nodejs.org/api/single-executable-applications.html) (no external packager dependency):

```powershell
npm run build:exe
```

This generates `dist/sheet-unlock.exe` (~90 MB, Node embedded). Usage:

```powershell
.\dist\sheet-unlock.exe                 # TUI
.\dist\sheet-unlock.exe protected.xlsx  # TUI with file
.\dist\sheet-unlock.exe protected.xlsx --cli -o free.xlsx
```

> Requires Node 22+ (tested on Node 24). The `scripts/build-exe.ps1` script detects the current Node SEA sentinel and strips the signature before injecting the blob.

## What is removed

- `<sheetProtection …>` from each `xl/worksheets/*.xml`
- `<workbookProtection …>` from `xl/workbook.xml`

The original file is never modified — the default output is `unprotected_<name>.xlsx` in the same folder.
