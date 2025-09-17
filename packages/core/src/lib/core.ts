import { fetchPackument } from './metadata.js';
import { sha256hex } from './hash.js';
import { extractSubjectSha256FromBundle } from './dsse.js';
import type { Bundle } from '@sigstore/bundle';
import { verify as sigstoreVerify } from 'sigstore';

export interface VerifyOptions {
    verifySignature?: boolean;
    allowedIssuers?: string[];
}

export type VerifyResult =
    | {
    ok: true;
    name: string;
    version: string;
    tarballDigest: string;
    attestationUrl?: string;
    subjectDigests: string[];
    signatureVerified: boolean;
}
    | {
    ok: false;
    name: string;
    version: string;
    reason: string;
};

/**
 * Проверяет конкретный пакет:
 *  1) достаёт метаданные и URL аттестаций;
 *  2) скачивает DSSE-бандл и тарболл;
 *  3) считает sha256 тарболла;
 *  4) извлекает все subject.digest.sha256 из бандла и сверяет с тарболлом;
 *  5) (опц.) верифицирует подпись Sigstore.
 */
export async function verifyOne(
    name: string,
    version: string,
    opts: VerifyOptions = {}
): Promise<VerifyResult> {
    try {
        const meta = await fetchPackument(name, version);
        const url = meta.dist.attestations?.url;
        if (!url) {
            return {
                ok: false,
                name,
                version,
                reason: 'no-attestations (package/version was not published with npm provenance)',
            };
        }

        const [bundleRes, tarRes] = await Promise.all([
            fetch(url),
            fetch(meta.dist.tarball),
        ]);

        if (!bundleRes.ok) {
            return {
                ok: false,
                name,
                version,
                reason: `failed-to-fetch-attestations (${bundleRes.status})`,
            };
        }
        if (!tarRes.ok) {
            return {
                ok: false,
                name,
                version,
                reason: `failed-to-fetch-tarball (${tarRes.status})`,
            };
        }

        const bundle = (await bundleRes.json()) as Bundle;
        const tarBuf = Buffer.from(await tarRes.arrayBuffer());
        const tarballDigest = sha256hex(tarBuf);

        // DSSE → in-toto: проверяем, что digest из subject совпадает с sha256 тарболла
        const subjectDigests = extractSubjectSha256FromBundle(bundle);
        if (!subjectDigests.includes(tarballDigest)) {
            return {
                ok: false,
                name,
                version,
                reason: 'subject-digest-mismatch (bundle subject sha256 != tarball sha256)',
            };
        }

        let signatureVerified = false;
        if (opts.verifySignature) {
            try {
                await sigstoreVerify(bundle as any, tarBuf, {
                    certificateIssuer:
                        opts.allowedIssuers && opts.allowedIssuers.length === 1
                            ? opts.allowedIssuers[0]
                            : undefined,
                } as any);
                signatureVerified = true;
            } catch (e: any) {
                return {
                    ok: false,
                    name,
                    version,
                    reason: `signature-verify-failed: ${e?.message || String(e)}`,
                };
            }
        }

        return {
            ok: true,
            name,
            version,
            tarballDigest,
            attestationUrl: url,
            subjectDigests,
            signatureVerified,
        };
    } catch (err: any) {
        return {
            ok: false,
            name,
            version,
            reason: `exception:${err?.message ?? String(err)}`,
        };
    }
}
