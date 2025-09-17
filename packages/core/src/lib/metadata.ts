import {json} from 'npm-registry-fetch';


export interface DistInfo {
    tarball: string;
    integrity?: string;
    shasum?: string;
    attestations?: { url?: string };
}


export interface VersionMeta {
    name: string;
    version: string;
    dist: DistInfo;
}

export interface Packument {
    name: string;
    version: string;
    dist: DistInfo;
}

export interface FullPackument {
    name: string;
    'dist-tags'?: Record<string, string>;
    versions: Record<string, VersionMeta>;
}

export async function fetchPackument(name: string, version: string): Promise<Packument> {
    const encoded = `/${encodeURIComponent(name)}/${encodeURIComponent(version)}`;
    const meta = await json(encoded) as any;
    return {
        name: meta.name,
        version: meta.version,
        dist: {
            tarball: meta.dist?.tarball,
            integrity: meta.dist?.integrity,
            shasum: meta.dist?.shasum,
            attestations: meta.dist?.attestations
        }
    };
}

export async function fetchFullPackument(name: string): Promise<FullPackument> {
    const encoded = `/${encodeURIComponent(name)}`;
    const meta = (await json(encoded)) as any;

    const versions: Record<string, VersionMeta> = {};
    for (const [ver, v] of Object.entries<any>(meta.versions || {})) {
        versions[ver] = {
            name: v.name,
            version: v.version,
            dist: {
                tarball: v.dist?.tarball,
                integrity: v.dist?.integrity,
                shasum: v.dist?.shasum,
                attestations: v.dist?.attestations,
            },
        };
    }

    return {
        name: meta.name,
        'dist-tags': meta['dist-tags'] || {},
        versions,
    };
}
