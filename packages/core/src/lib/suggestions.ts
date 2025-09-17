import semver from 'semver';
import { fetchFullPackument } from './metadata.js';


export interface Suggestion {
    name: string;
    current: string;
    suggested?: string;
    kind: 'minor-or-patch' | 'latest-major' | 'none';
}


/**
 * Ищем ближайшую версию с dist.attestations.url. Сначала в пределах текущего major (>=current < nextMajor),
 * затем — просто последнюю стабильную с аттестациями.
 */
export async function suggestVersionWithProvenance(name: string, current: string): Promise<Suggestion> {
    try {
        const pack = await fetchFullPackument(name);
        const versions: Record<string, any> = pack.versions || {};
        const list = Object.keys(versions).filter(v => semver.valid(v));
        const cur = semver.coerce(current)?.version || current;
        const nextMajor = semver.inc(cur, 'major');

        const sameMajor = list
            .filter(v => semver.gte(v, cur) && (nextMajor ? semver.lt(v, nextMajor) : true))
            .sort(semver.compare);


        const hasProv = (v: string) => Boolean(versions[v]?.dist?.attestations?.url);


        const within = sameMajor.find(hasProv);
        if (within && within !== cur) return { name, current, suggested: within, kind: 'minor-or-patch' };

        const stable = list.filter(v => !semver.prerelease(v)).sort(semver.rcompare).find(hasProv);
        if (stable && stable !== cur) return { name, current, suggested: stable, kind: 'latest-major' };

        return { name, current, suggested: undefined, kind: 'none' };
    } catch {
        return { name, current, suggested: undefined, kind: 'none' };
    }
}
