import type * as ts from 'typescript/lib/tsserverlibrary';

function init(modules: { typescript: typeof ts }): ts.server.PluginModule {
	const tsModule = modules.typescript;

	function create(info: ts.server.PluginCreateInfo): ts.LanguageService {
		info.project.projectService.logger.info('[grandma3-tsserver-plugin] plugin loaded');

		const proxy: ts.LanguageService = Object.create(null);

		for (const k of Object.keys(info.languageService) as Array<keyof ts.LanguageService>) {
			const original = info.languageService[k];

			if (typeof original === 'function') {
				(proxy as any)[k] = (...args: unknown[]) =>
					(original as (...args: unknown[]) => unknown).apply(info.languageService, args);
			} else {
				(proxy as any)[k] = original;
			}
		}

		const functionKinds = new Set<string>([
			tsModule.ScriptElementKind.functionElement,
			tsModule.ScriptElementKind.localFunctionElement,
			tsModule.ScriptElementKind.memberFunctionElement,
			tsModule.ScriptElementKind.constructorImplementationElement,
			tsModule.ScriptElementKind.callSignatureElement,
			tsModule.ScriptElementKind.constructSignatureElement,
		]);

		const valueKinds = new Set<string>([
			tsModule.ScriptElementKind.memberVariableElement,
			tsModule.ScriptElementKind.memberGetAccessorElement,
			tsModule.ScriptElementKind.memberSetAccessorElement,
			tsModule.ScriptElementKind.variableElement,
			tsModule.ScriptElementKind.localVariableElement,
			tsModule.ScriptElementKind.constElement,
			tsModule.ScriptElementKind.letElement,
			tsModule.ScriptElementKind.parameterElement,
			tsModule.ScriptElementKind.moduleElement,
		]);

		function startsWithUppercase(name: string): boolean {
			return /^[A-Z]/.test(name);
		}

		function getDefaultLibGlobalNames(program: ts.Program, sourceFile: ts.SourceFile): Set<string> {
			const checker = program.getTypeChecker();

			const symbols = checker.getSymbolsInScope(
				sourceFile,
				tsModule.SymbolFlags.Value | tsModule.SymbolFlags.Type | tsModule.SymbolFlags.Namespace,
			);

			const result = new Set<string>();

			for (const symbol of symbols) {
				const declarations = symbol.getDeclarations() ?? [];

				if (declarations.length === 0) {
					continue;
				}

				const isOnlyFromDefaultLib = declarations.every((declaration) => {
					const declarationSourceFile = declaration.getSourceFile();

					return program.isSourceFileDefaultLibrary(declarationSourceFile);
				});

				if (isOnlyFromDefaultLib) {
					result.add(symbol.getName());
				}
			}

			return result;
		}

		proxy.getCompletionsAtPosition = (fileName, position, options) => {
			const prior = info.languageService.getCompletionsAtPosition(fileName, position, options);

			if (!prior) return prior;

			const program = info.languageService.getProgram();
			const sourceFile = program?.getSourceFile(fileName);

			const defaultLibGlobalNames =
				program && sourceFile && prior.isGlobalCompletion
					? getDefaultLibGlobalNames(program, sourceFile)
					: new Set<string>();

			const getNewSortText = (entry: ts.CompletionEntry): string => {
				const originalSortText = entry.sortText ?? entry.name;
				const hasSource = typeof entry.source === 'string' && entry.source.length > 0;

				// Reorganize object/member completions separately.
				//
				// For expressions like:
				// seq.
				//
				// TypeScript usually puts all members into the same "11" bucket, so without
				// custom sorting, methods and properties are mixed alphabetically.
				//
				// Desired order:
				// - properties starting with an uppercase character
				// - properties starting with a lowercase character
				// - methods starting with an uppercase character
				// - methods starting with a lowercase character
				// - all remaining entries
				if (prior.isMemberCompletion) {
					if (originalSortText !== '11') {
						return `19_90_${entry.name}`;
					}

					if (valueKinds.has(entry.kind)) {
						const propertyRank = startsWithUppercase(entry.name) ? '10' : '20';

						return `11_${propertyRank}_${entry.name}`;
					}

					if (functionKinds.has(entry.kind)) {
						const methodRank = startsWithUppercase(entry.name) ? '30' : '40';

						return `11_${methodRank}_${entry.name}`;
					}

					return `11_90_${entry.name}`;
				}

				// Keep TypeScript's local/current-scope bucket untouched.
				if (originalSortText === '11') {
					return originalSortText;
				}

				// Pull source/auto-import completions into the custom global ordering.
				//
				// In this project these are usually namespace/module suggestions such as:
				// socket.gettime, socket.bind, lfs.dir, json.encode, ftp.get, etc.
				if (originalSortText === '16' && hasSource) {
					return `15_30_${entry.name}`;
				}

				// Only reorganize TypeScript's normal ambient/global bucket.
				//
				// Observed TS Server buckets:
				// - 11  = locals/current-scope symbols
				// - 15  = ambient globals, grandMA3 globals, keywords, TS built-ins
				// - 16  = auto-import/source suggestions
				// - z15 = deprecated globals
				if (originalSortText !== '15') {
					return originalSortText;
				}

				// Push TypeScript/JavaScript built-in globals to the bottom of the "15" bucket.
				//
				// Examples:
				// Array, Object, Promise, Symbol, Map, Set, Math, JSON, etc.
				if (prior.isGlobalCompletion && defaultLibGlobalNames.has(entry.name)) {
					return `${originalSortText}_90_${entry.name}`;
				}

				// Put TypeScript keywords after useful values, functions, and source completions.
				//
				// Examples:
				// if, for, while, class, interface, function, return, etc.
				if (entry.kind === tsModule.ScriptElementKind.keyword) {
					return `${originalSortText}_80_${entry.name}`;
				}

				// Prefer values/properties/modules before functions.
				if (valueKinds.has(entry.kind)) {
					return `${originalSortText}_10_${entry.name}`;
				}

				// Put functions/methods after values/properties, but before source completions,
				// keywords, and TypeScript built-ins.
				if (functionKinds.has(entry.kind)) {
					return `${originalSortText}_20_${entry.name}`;
				}

				// Keep any remaining items inside the same "15" bucket, between source
				// completions and keywords/default-lib globals.
				return `${originalSortText}_50_${entry.name}`;
			};

			return {
				...prior,
				entries: prior.entries.map((entry) => {
					const newSortText = getNewSortText(entry);

					if (newSortText === entry.sortText) {
						return entry;
					}

					return {
						...entry,
						sortText: newSortText,
					};
				}),
			};
		};

		return proxy;
	}

	return { create };
}

export = init;