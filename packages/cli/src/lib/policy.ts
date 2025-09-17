import * as fs from 'fs';
import * as path from 'path';
import YAML from 'yaml';
import { z } from 'zod';


export const PolicySchema = z.object({
    requireProvenance: z.boolean().default(true),
    requireSubjectMatch: z.boolean().default(true),
    verifySignature: z.boolean().default(false),
    allowedIssuers: z.array(z.string()).optional(),
});


export type Policy = z.infer<typeof PolicySchema>;


export async function loadPolicy(filePath?: string): Promise<Policy> {
    if (!filePath) return PolicySchema.parse({});
    const abs = path.resolve(String(filePath));
    const raw = await fs.promises.readFile(abs, 'utf8');
    const data = YAML.parse(raw) ?? {};
    return PolicySchema.parse(data);
}
