# Sheet Password Removal

A TypeScript project to remove worksheet protections from Excel spreadsheets.

## Installation

1. Clone the repository.
2. Run `npm install` to install dependencies.

## Usage

1. Build the project: `npm run build`
2. Run the script: `npm start <input.xlsx>`

Replace `<input.xlsx>` with the path to the protected Excel file, and `<output.xlsx>` with the desired output file path.

## Example

```
npm start protected.xlsx
```

This will create `unprotected.xlsx` without the password.