/* eslint-disable no-cond-assign */
import XRegExpOrig from 'xregexp/lib';
import XRegExpClass, { ExecArray } from 'xregexp/types';

type TRegExp = typeof XRegExpClass;
interface IXRegExp extends TRegExp {
	execLb (str: string, regex: string, flags: string): ExecArray | null;
	testLb (str: string, regex: string, flags: string): boolean;
	searchLb (str: string, regex: string, flags: string): number;
	matchAllLb (str: string, regex: string, flags: string): any[];
	replaceLb (str: string, regex: string, replacement: string, flags: string): string;
}

(function (XRegExp: IXRegExp) {

	function preparePattern(pattern, flags) {
		let lbOpen, lbEndPos, lbInner;
		flags = flags || '';
		// Extract flags from a leading mode modifier, if present
		pattern = pattern.replace(/^\(\?([\w$]+)\)/, function ($0, $1) {
			flags += $1;
			return '';
		});
		if (lbOpen = /^\(\?<([=!])/.exec(pattern)) {
			// Extract the lookbehind pattern. Allows nested groups, escaped parens, and unescaped parens within classes
			lbEndPos = XRegExp.matchRecursive(pattern, /\((?:[^()[\\]|\\.|\[(?:[^\\\]]|\\.)*])*/.source, '\\)', 's', {
				valueNames: [null, null, null, 'right'],
				escapeChar: '\\'
			})[0].end;
			lbInner = pattern.slice('(?<='.length, lbEndPos - 1);
		} else {
			throw new Error('lookbehind not at start of pattern');
		}
		return {
			lb: XRegExp('(?:' + lbInner + ')$(?!\\s)', flags.replace(/[gy]/g, '')), // $(?!\s) allows use of flag m
			lbType: lbOpen[1] === '=', // Positive or negative lookbehind
			main: XRegExp(pattern.slice(('(?<=)' + lbInner).length), flags)
		};
	}

	XRegExp.execLb = function (str, pattern, flags) {
		let pos = 0, match, leftContext;
		const rex = preparePattern(pattern, flags);

		while (match = XRegExp.exec(str, rex.main, pos)) {
			leftContext = str.slice(0, match.index);
			if (rex.lbType === rex.lb.test(leftContext)) {
				return match;
			}
			pos = match.index + 1;
		}
		return null;
	};

	XRegExp.testLb = function (str, pattern, flags) {
		return !!XRegExp.execLb(str, pattern, flags);
	};

	XRegExp.searchLb = function (str, pattern, flags) {
		const match = XRegExp.execLb(str, pattern, flags);
		return match ? match.index : -1;
	};

	XRegExp.matchAllLb = function (str, pattern, flags) {
		const matches = [];
		let
			pos = 0,
			match: ExecArray,
			leftContext: string;

		const rex = preparePattern(pattern, flags);
		while (match = XRegExp.exec(str, rex.main, pos)) {
			leftContext = str.slice(0, match.index);
			if (rex.lbType === rex.lb.test(leftContext)) {
				matches.push(match[0]);
				pos = match.index + (match[0].length || 1);
			} else {
				pos = match.index + 1;
			}
		}
		return matches;
	};

	XRegExp.replaceLb = function (str, pattern, replacement, flags) {
		let output = '', pos = 0, lastEnd = 0, match, leftContext;
		const rex = preparePattern(pattern, flags);

		while (match = XRegExp.exec(str, rex.main, pos)) {
			leftContext = str.slice(0, match.index);
			if (rex.lbType === rex.lb.test(leftContext)) {
				// Doesn't work correctly if lookahead in regex looks outside of the match
				output += str.slice(lastEnd, match.index) + XRegExp.replace(match[0], rex.main, replacement);
				lastEnd = match.index + match[0].length;
				if (!rex.main.global) {
					break;
				}
				pos = match.index + (match[0].length || 1);
			} else {
				pos = match.index + 1;
			}
		}
		return output + str.slice(lastEnd);
	};

}(<IXRegExp>XRegExpOrig));

const XRegExp = <IXRegExp> XRegExpOrig;
export { XRegExp };