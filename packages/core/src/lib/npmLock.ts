export type LockEntry = { name: string; version: string };

export function parseNpmLock(lockJson: any): LockEntry[] {
    const out: Record<string, string> = {};


    if (lockJson?.packages && typeof lockJson.packages === 'object') {
        // v2+: ключи вида "node_modules/<name>"; пропускаем корень ""
        for (const [k, v] of Object.entries<any>(lockJson.packages)) {
            if (!k || k === '') continue;
            if (!k.startsWith('node_modules/')) continue;
            const name = (v?.name as string) || k.replace(/^node_modules\//, '');
            const version = v?.version as string;
            if (!name || !version) continue;

            if (v?.dev) continue;
            out[name] = version;
        }
    } else if (lockJson?.dependencies) {
        // старые lockfile: плоское дерево dependencies
        const walk = (deps: any) => {
            for (const [name, v] of Object.entries<any>(deps)) {
                if (v?.dev) continue;
                if (v?.version) out[name] = v.version as string;
                if (v?.dependencies) walk(v.dependencies);
            }
        };
        walk(lockJson.dependencies);
    }

    return Object.entries(out).map(([name, version]) => ({ name, version }));
}
