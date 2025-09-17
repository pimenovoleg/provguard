// Примитивный парсер Sigstore bundle → DSSE → in-toto statement
// Цель: достать все subject.digest.sha256 как массив строк (hex без префикса)


export function extractSubjectSha256FromBundle(bundle: any): string[] {
    try {
        const payloadB64 = bundle?.dsseEnvelope?.payload;
        if (typeof payloadB64 !== 'string') return [];


        const payload = Buffer.from(payloadB64, 'base64').toString('utf-8');
        const stmt = JSON.parse(payload);
        const subjects: any[] = Array.isArray(stmt?.subject) ? stmt.subject : [];
        const digests = subjects
            .map(s => (s?.digest?.sha256 ? String(s.digest.sha256) : ''))
            .filter(Boolean)
            .map((s: string) => s.toLowerCase());
        return digests;
    } catch {
        return [];
    }
}
