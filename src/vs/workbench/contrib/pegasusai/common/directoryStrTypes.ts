import { URI } from '../../../../base/common/uri.js';

export type PegasusAIDirectoryItem = {
	uri: URI;
	name: string;
	isSymbolicLink: boolean;
	children: PegasusAIDirectoryItem[] | null;
	isDirectory: boolean;
	isGitIgnoredDirectory: false | { numChildren: number }; // if directory is gitignored, we ignore children
}
