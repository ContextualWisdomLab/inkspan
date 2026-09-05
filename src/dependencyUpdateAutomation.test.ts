import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const CONFIG_PATH = '.github/dependabot.yml';

function normalizeYamlText(source: string): string {
    return source.replace(/"/gu, '');
}

function escapeRegExp(source: string): string {
    return source.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function assertSupportedUpdateEntries(config: string): void {
    expect(config).toMatch(/^version:\s*2\s*$/mu);
    const updates = config.split(/(?=^[ \t]*-[ \t]+package-ecosystem:)/mu).slice(1);
    expect(updates).toHaveLength(2);

    for (const [ecosystem, directory] of [
        ['github-actions', '/'],
        ['pip', '/office'],
    ] as const) {
        expect(updates).toEqual(expect.arrayContaining([
            expect.stringMatching(new RegExp(
                String.raw`^\s*-\s+package-ecosystem:\s*${escapeRegExp(ecosystem)}\s*$[\s\S]*?^\s+directory:\s*${escapeRegExp(directory)}\s*$[\s\S]*?^\s+schedule:\s*$\n^\s+interval:\s*weekly\s*$`,
                'mu',
            )),
        ]));
    }
}

describe('dependency update automation', () => {
    it('keeps supported Office and GitHub Actions dependencies on a bounded weekly update path', () => {
        assertSupportedUpdateEntries(normalizeYamlText(readFileSync(CONFIG_PATH, 'utf8')));
    });

    it.each(['monthly', 'daily'])('rejects an Actions %s schedule even when Office remains weekly', (interval) => {
        const config = normalizeYamlText(readFileSync(CONFIG_PATH, 'utf8'))
            .replace('interval: weekly', `interval: ${interval}`);

        expect(() => assertSupportedUpdateEntries(config)).toThrow();
    });

    it('does not add unsupported pnpm 11 or credential-bearing registry configuration', () => {
        const config = normalizeYamlText(readFileSync(CONFIG_PATH, 'utf8'));

        expect(config).not.toMatch(/package-ecosystem:\s*npm\b/u);
        expect(config).not.toMatch(/^registries:/mu);
        expect(config).not.toContain('${{ secrets.');
        expect(config).not.toMatch(/^\s+(?:username|password|token):/mu);
    });
});
