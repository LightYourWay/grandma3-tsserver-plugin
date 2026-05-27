import type * as ts from 'typescript/lib/tsserverlibrary';

function init(modules: { typescript: typeof ts }): ts.server.PluginModule {
	const tsModule = modules.typescript;

	function create(info: ts.server.PluginCreateInfo): ts.LanguageService {
		info.project.projectService.logger.info('[tsserver-functions-last] plugin loaded');

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

		proxy.getCompletionsAtPosition = (fileName, position, options) => {
			const prior = info.languageService.getCompletionsAtPosition(fileName, position, options);

			if (!prior) return prior;

			return {
				...prior,
				entries: prior.entries.map((entry) => {
					if (!functionKinds.has(entry.kind)) {
						return entry;
					}

					return {
						...entry,
						sortText: `zzzz_${entry.sortText ?? entry.name}`,
					};
				}),
			};
		};

		return proxy;
	}

	return { create };
}

export = init;
