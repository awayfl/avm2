import { release } from '@awayfl/swf-loader';

/**
 * Returns |true| if the symbol is available in debug or release modes. Only symbols
 * followed by the  "!" suffix are available in release builds.
 */
export function containsSymbol(symbols: string [], name: string) {
	for (let i = 0; i < symbols.length; i++) {
		let symbol = symbols[i];
		if (symbol.indexOf(name) >= 0) {
			const releaseSymbol = symbol[symbol.length - 1] === '!';
			if (releaseSymbol) {
				symbol = symbol.slice(0, symbol.length - 1);
			}
			if (name !== symbol) {
				continue;
			}
			if (release) {
				return releaseSymbol;
			}
			return true;
		}
	}
	return false;
}