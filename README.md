# grandma3-tsserver-plugin

A TypeScript language server plugin that sorts function completions to the bottom of the autocomplete list.

## Why

The grandMA3 Lua API exposes a large number of global functions. Without this plugin, those functions dominate the autocomplete suggestions and push variables, properties, and other non-function entries out of view. This plugin demotes all function-typed entries so they appear last.

## How it works

The plugin wraps `getCompletionsAtPosition` and prefixes the `sortText` of any function-kinded completion entry with `zzzz_`, which moves them to the end of the sorted list. All other completion kinds are left untouched.

Affected `ScriptElementKind` values:
- `function`
- `local function`
- `member function`
- `constructor`
- `call signature`
- `construct signature`

## Usage

The plugin is consumed as a local dependency of the root project and registered in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "plugins": [
      { "name": "grandMA3-tsserver-plugin" }
    ]
  }
}
```

It is installed automatically via `npm install` in the root project.

## Build

```bash
npm run build
```

Output is written to `../dist/`.
