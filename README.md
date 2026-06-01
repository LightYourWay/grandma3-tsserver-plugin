# grandma3-tsserver-plugin

A TypeScript language server plugin that improves the editor experience for grandMA3 plugin development.

## Why

The grandMA3 Lua API exposes a large number of global functions. Without this plugin, those functions dominate the autocomplete suggestions and push variables, properties, and other non-function entries out of view. They also get mixed with TypeScript/JavaScript built-ins (`Array`, `Promise`, `Math`, …) and language keywords, which are rarely what you want first. This plugin reorders completions so the entries most relevant to grandMA3 scripting surface first.

## How it works

The plugin wraps `getCompletionsAtPosition` and rewrites the `sortText` of each completion entry to group entries into ranked buckets. It leaves TypeScript's local/current-scope bucket (`sortText === "11"`) untouched and reorganizes the rest.

### Member completions

For member access, TypeScript normally lumps everything into one bucket sorted alphabetically, mixing properties and methods. This plugin reorders them as:

1. Properties starting with an uppercase character
2. Properties starting with a lowercase character
3. Methods starting with an uppercase character
4. Methods starting with a lowercase character
5. All remaining entries

### Global / ambient completions

Within TypeScript's ambient-globals bucket (`sortText === "15"`), entries are ordered:

1. Values / properties / modules
2. Functions / methods
3. Source / auto-import completions (e.g. `socket`, `lfs`, `json`, `ftp` namespace members)
4. Language keywords (`if`, `for`, `class`, …)
5. TypeScript/JavaScript built-in default-lib globals (`Array`, `Object`, `Promise`, `Math`, `JSON`, …)

Built-in default-lib globals are detected by walking the symbols in scope and keeping only those declared exclusively in default library files, so project and grandMA3 globals are preferred over built-ins.

### Entry classification

Function-kinded entries:

- `function`
- `local function`
- `member function`
- `constructor`
- `call signature`
- `construct signature`

Value-kinded entries:

- `property` / member variable
- member get/set accessor
- `var` / `let` / `const`
- local variable
- parameter
- `module`

## Usage

The plugin is consumed as a local dependency of the root project and registered in `tsconfig.json`:

```json
{
	"compilerOptions": {
		"plugins": [{ "name": "grandma3-tsserver-plugin" }]
	}
}
```

It is installed automatically via `npm install` in the root project.

## Build

```bash
npm run build
```

Output is written to `./dist/`.

## Formatting

This project uses [Prettier](https://prettier.io/).

```bash
npm run format        # write
npm run format:check  # check only
```
