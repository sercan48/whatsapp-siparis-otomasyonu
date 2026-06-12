/**
 * Generates a UUID v4 compatible string.
 * Uses crypto.randomUUID() if available, otherwise falls back to a manual generator.
 * Necessary for non-Secure contexts (HTTP) where crypto.randomUUID is unavailable.
 */
export const generateUUID = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }

    // Fallback implementation
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
};
