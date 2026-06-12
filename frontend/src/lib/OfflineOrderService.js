import { openDB } from 'idb';

const DB_NAME = 'WhatsappPOS_OfflineDB';
const STORE_NAME = 'pending_orders';
const VERSION = 1;

/**
 * OfflineOrderService
 * Manages local storage of orders when internet is disconnected.
 */
export const offlineOrderService = {
    /**
     * Initialize DB
     */
    async initDB() {
        return openDB(DB_NAME, VERSION, {
            upgrade(db) {
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    // Create store with auto-increment ID
                    db.createObjectStore(STORE_NAME, { keyPath: 'localId', autoIncrement: true });
                }
            },
        });
    },

    /**
     * Save order locally
     * @param {Object} orderData - The order payload meant for Supabase
     */
    async saveOrderLocally(orderData) {
        try {
            const db = await this.initDB();
            const timestamp = new Date().toISOString();

            const localOrder = {
                ...orderData,
                offline_created_at: timestamp,
                synced: false,
                retry_count: 0
            };

            const id = await db.add(STORE_NAME, localOrder);
            console.log(`[OfflineService] Order saved locally with ID: ${id}`);
            return { success: true, localId: id };
        } catch (error) {
            console.error('[OfflineService] Failed to save local order:', error);
            return { success: false, error };
        }
    },

    /**
     * Get all pending orders
     */
    async getPendingOrders() {
        try {
            const db = await this.initDB();
            return await db.getAll(STORE_NAME);
        } catch (error) {
            console.error('[OfflineService] Failed to get pending orders:', error);
            return [];
        }
    },

    /**
     * Remove order after successful sync
     * @param {number} localId
     */
    async removeOrder(localId) {
        try {
            const db = await this.initDB();
            await db.delete(STORE_NAME, localId);
            console.log(`[OfflineService] Removed local order ID: ${localId}`);
        } catch (error) {
            console.error('[OfflineService] Failed to remove order:', error);
        }
    },

    /**
     * Clear all orders (Panic button/Debug)
     */
    async clearAll() {
        const db = await this.initDB();
        await db.clear(STORE_NAME);
    }
};
