import * as fs from 'fs';
import { parseNpmLock } from './npmLock.js';
import { fetchPackument } from './metadata.js';
import { suggestVersionWithProvenance, type Suggestion } from './suggestions.js';
import { verifyOne, type VerifyOptions } from './core.js';


export interface LockfileReportItem {
    name: string;
    version: string;
    hasAttestations: boolean;
    verified?: boolean;
    reason?: string;
    suggestion?: Suggestion;
}


export interface LockfileReport {
    total: number;
    withAttestations: number;
    withoutAttestations: number;
    failures: number;
    items: LockfileReportItem[];
}


export async function verifyLockfile(pathToLockfile: string, opts: VerifyOptions & { deep?: boolean } = {}): Promise<LockfileReport> {
    const raw = await fs.promises.readFile(pathToLockfile, 'utf8');
    const json = JSON.parse(raw);
    const entries = parseNpmLock(json);


    const items: LockfileReportItem[] = [];

    const pool = 8;
    let idx = 0;
    async function worker() {
        while (idx < entries.length) {
            const i = idx++;
            const { name, version } = entries[i];
            try {
                const meta = await fetchPackument(name, version);
                const hasAtt = Boolean(meta.dist.attestations?.url);
                const item: LockfileReportItem = { name, version, hasAttestations: hasAtt };


                if (hasAtt && (opts.verifySignature || opts.deep)) {
                    const r = await verifyOne(name, version, opts);
                    item.verified = r.ok;
                    if (!r.ok) item.reason = r.reason;
                }


                if (!hasAtt) {
                    item.suggestion = await suggestVersionWithProvenance(name, version);
                }


                items.push(item);
            } catch (e: any) {
                items.push({ name, version, hasAttestations: false, reason: `exception:${e?.message || String(e)}` });
            }
        }
    }
    await Promise.all(Array.from({ length: pool }, () => worker()));

    const withAtt = items.filter(i => i.hasAttestations).length;
    const fails = items.filter(i => i.reason && i.hasAttestations).length;

    return {
        total: items.length,
        withAttestations: withAtt,
        withoutAttestations: items.length - withAtt,
        failures: fails,
        items: items.sort((a,b) => a.name.localeCompare(b.name))
    };
}
