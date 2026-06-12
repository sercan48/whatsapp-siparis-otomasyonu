import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateUUID } from '../lib/utils';

describe('generateUUID', () => {
    describe('with crypto.randomUUID available', () => {
        it('should use crypto.randomUUID when available', () => {
            const mockUUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
            const originalRandomUUID = crypto.randomUUID;
            crypto.randomUUID = vi.fn(() => mockUUID);

            const result = generateUUID();

            expect(result).toBe(mockUUID);
            expect(crypto.randomUUID).toHaveBeenCalled();

            crypto.randomUUID = originalRandomUUID;
        });
    });

    describe('fallback implementation', () => {
        let originalRandomUUID;

        beforeEach(() => {
            originalRandomUUID = crypto.randomUUID;
            delete crypto.randomUUID;
        });

        afterEach(() => {
            crypto.randomUUID = originalRandomUUID;
        });

        it('should generate valid UUID v4 format', () => {
            const uuid = generateUUID();
            // UUID v4 regex pattern
            const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            expect(uuid).toMatch(uuidV4Regex);
        });

        it('should generate unique UUIDs', () => {
            const uuids = new Set();
            for (let i = 0; i < 100; i++) {
                uuids.add(generateUUID());
            }
            expect(uuids.size).toBe(100);
        });

        it('should have correct length (36 characters)', () => {
            const uuid = generateUUID();
            expect(uuid).toHaveLength(36);
        });

        it('should have version 4 indicator', () => {
            const uuid = generateUUID();
            expect(uuid[14]).toBe('4');
        });

        it('should have valid variant bits', () => {
            const uuid = generateUUID();
            const variantChar = uuid[19];
            expect(['8', '9', 'a', 'b']).toContain(variantChar);
        });
    });
});
