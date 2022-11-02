import type { GeneratorConfigWithDefaultValues } from '../../../config/src/types.mjs'
import type { Locale } from '../../../runtime/src/core.mjs'
import {
	importTypes,
	jsDocFunction,
	jsDocImports,
	jsDocType,
	OVERRIDE_WARNING,
	relativeFileImportPath,
	relativeFolderImportPath,
	tsCheck,
	type,
	typeCast,
} from '../output-handler.mjs'
import { writeFileIfContainsChanges } from '../utils/file.utils.mjs'
import { prettify, sanitizePath, wrapObjectKeyIfNeeded } from '../utils/generator.utils.mjs'

const combineNamespacesSingleToObject = (sanitizedLocale: string, namespaces: string[]) => `{
		...${sanitizedLocale}${namespaces
	.map(
		(namespace) => `,
		${wrapObjectKeyIfNeeded(namespace)}: ${sanitizedLocale}_${sanitizePath(namespace)}`,
	)
	.join('')}
	}`

const getLocalesTranslationRowSync = (locale: Locale, namespaces: string[]): string => {
	const sanitizedLocale = sanitizePath(locale)
	const needsEscaping = locale !== sanitizedLocale
	const postfix = namespaces.length
		? `: ${combineNamespacesSingleToObject(sanitizedLocale, namespaces)}`
		: needsEscaping
		? `: ${sanitizedLocale}`
		: ''

	return `
	${wrapObjectKeyIfNeeded(locale)}${postfix},`
}

const getSyncCode = (
	{ utilFileName, formattersTemplateFileName, typesFileName, banner }: GeneratorConfigWithDefaultValues,
	locales: Locale[],
	namespaces: string[],
) => {
	const localesImports = locales
		.map(
			(locale) => `
import ${sanitizePath(locale)} from '${relativeFolderImportPath(locale)}'`,
		)
		.join('')

	const namespaceImports = locales
		.map((locale) =>
			namespaces
				.map(
					(namespace) => `
import ${sanitizePath(locale)}_${sanitizePath(namespace)} from '${relativeFolderImportPath(`${locale}/${namespace}`)}'`,
				)
				.join(''),
		)
		.join('')

	const localesTranslations = locales.map((locale) => getLocalesTranslationRowSync(locale, namespaces)).join('')

	return `${OVERRIDE_WARNING}${tsCheck}
${banner}

${jsDocImports(
	{ from: relativeFileImportPath(typesFileName), type: 'Locales' },
	{ from: relativeFileImportPath(typesFileName), type: 'Translations' },
)}

import { initFormatters } from '${relativeFileImportPath(formattersTemplateFileName)}'
${importTypes(relativeFileImportPath(typesFileName), 'Locales', 'Translations')}
import { loadedFormatters, loadedLocales, locales } from '${relativeFileImportPath(utilFileName)}'

${localesImports}

${namespaceImports}

const localeTranslations = {${localesTranslations}
}

${jsDocFunction('void', { type: 'Locales', name: 'locale' })}
export const loadLocale = (locale${type('Locales')})${type('void')} => {
	if (loadedLocales[locale]) return

	loadedLocales[locale] = ${jsDocType(
		'Translations',
		jsDocType('unknown', `localeTranslations[locale]${typeCast('unknown')}${typeCast('Translations')}`),
	)}
	loadFormatters(locale)
}

${jsDocFunction('void')}
export const loadAllLocales = ()${type('void')} => locales.forEach(loadLocale)

${jsDocFunction('void', { type: 'Locales', name: 'locale' })}
export const loadFormatters = (locale${type('Locales')})${type('void')} =>
	void (loadedFormatters[locale] = initFormatters(locale))
`
}

export const generateSyncUtil = async (
	config: GeneratorConfigWithDefaultValues,
	locales: Locale[],
	namespaces: string[],
): Promise<void> => {
	const { outputPath, utilFileName } = config

	const syncCode = getSyncCode(config, locales, namespaces)
	await writeFileIfContainsChanges(outputPath, `${utilFileName}.sync`, prettify(syncCode))
}
