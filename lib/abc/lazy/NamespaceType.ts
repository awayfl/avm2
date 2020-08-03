import { release } from '@awayfl/swf-loader';

export const enum NamespaceType {
    Public          = 0,
    Protected       = 1,
    PackageInternal = 2,
    Private         = 3,
    Explicit        = 4,
    StaticProtected = 5
  }
  
export const namespaceTypeNames = ["Public", "Protected", "PackageInternal", "Private", "Explicit", "StaticProtected"];

export function getNamespaceTypeName(namespaceType: NamespaceType): string {
	return release ? String(namespaceType) : namespaceTypeNames[namespaceType];
}
