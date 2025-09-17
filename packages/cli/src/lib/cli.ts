#!/usr/bin/env node
import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs';
import chalk from 'chalk';
import { verifyOne } from '@provguard/core';
import { verifyLockfile } from '@provguard/core';
import { loadPolicy, type Policy } from './policy.js';

const program = new Command();
program
    .name('provenance-gatekeeper')
    .description('Verify npm provenance/attestations for packages or lockfiles');


program.command('verify')
    .description('Verify a single package (name@version) or a lockfile')
    .option('-p, --pkg <name@version>', 'package spec, e.g. lodash@4.17.21')
    .option('-l, --lockfile <path>', 'lockfile path (package-lock.json)')
    .option('-P, --policy <path>', 'policy YAML path (.provenance-gatekeeper.yml)')
    .option('--deep', 'when verifying lockfile: also do cryptographic verification for packages that have attestations (slower)')
    .action(async (opts) => {
        const policy: Policy = await loadPolicy(opts.policy);


        if (opts.pkg) {
            try {
                const [name, version] = parseSpec(opts.pkg);
                const res = await verifyOne(name, version, {
                    verifySignature: Boolean(policy.verifySignature),
                    allowedIssuers: policy.allowedIssuers
                });


                if (!res.ok) return fail(`FAIL ${name}@${version}: ${res.reason}`);


                if (policy.requireSubjectMatch && !res.subjectDigests.includes(res.tarballDigest)) {
                    return fail(`FAIL ${name}@${version}: subject digest mismatch`);
                }


                if (policy.verifySignature && !res.signatureVerified) {
                    return fail(`FAIL ${name}@${version}: signature not verified`);
                }


                console.log(chalk.green(`OK ${name}@${version}`));
                console.log(` tarball sha256: ${res.tarballDigest}`);
                if (res.attestationUrl) console.log(` attestations: ${res.attestationUrl}`);
                if (res.signatureVerified) console.log(' signature: verified');
                process.exitCode = 0;
            } catch (e: any) {
                fail(e?.message || String(e));
            }
        } else if (opts.lockfile) {
            const abs = path.resolve(String(opts.lockfile));
            if (!fs.existsSync(abs)) return fail(`Lockfile not found: ${abs}`);


            const report = await verifyLockfile(abs, {
                verifySignature: Boolean(policy.verifySignature),
                allowedIssuers: policy.allowedIssuers,
                deep: Boolean(opts.deep || policy.verifySignature)
            });

            printReport(report);

            const missing = report.withoutAttestations;
            const hasFailures = report.failures > 0;
            if ((policy.requireProvenance && missing > 0) || hasFailures) {
                return fail(`Lockfile verify failed: missing=${missing}, failures=${report.failures}`);
            }
            console.log(chalk.green('Lockfile verify OK.'));
            process.exitCode = 0;
        } else {
            program.help({ error: true });
        }
    });


program.parse();

function parseSpec(spec: string): [string, string] {
    const at = spec.lastIndexOf('@');
    if (at <= 0) throw new Error(`Invalid spec: ${spec}`);
    const name = spec.slice(0, at);
    const version = spec.slice(at + 1);
    if (!name || !version) throw new Error(`Invalid spec: ${spec}`);
    return [name, version];
}


function fail(msg: string) {
    console.error(chalk.red(msg));
    process.exitCode = 2;
}


function printReport(report: any) {
    console.log(chalk.bold('— Provenance risk diff —'));
    console.log(`packages: ${report.total}, with provenance: ${report.withAttestations}, without: ${report.withoutAttestations}, failures: ${report.failures}`);


    if (report.items?.length) {
        const missing = report.items.filter((i: any) => !i.hasAttestations);
        if (missing.length) {
            console.log('Packages without provenance:');
            for (const i of missing.slice(0, 50)) {
                const sfx = i.suggestion?.suggested ? ` → suggest ${i.suggestion.suggested} (${i.suggestion.kind})` : '';
                console.log(` - ${i.name}@${i.version}${sfx}`);
            }
            if (missing.length > 50) console.log(` …and ${missing.length - 50} more`);
        }


        const failed = report.items.filter((i: any) => i.hasAttestations && i.reason);
        if (failed.length) {
            console.log('Packages with provenance but verification FAILED:');
            for (const i of failed.slice(0, 50)) {
                console.log(` - ${i.name}@${i.version} — ${i.reason}`);
            }
            if (failed.length > 50) console.log(` …and ${failed.length - 50} more`);
        }
    }
}
