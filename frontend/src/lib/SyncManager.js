import { offlineOrderService } from './OfflineOrderService';
import { supabase } from './supabaseClient'; // eslint-disable-line no-unused-vars

import toast from 'react-hot-toast';

/**
 * SyncManager
 * Orchestrates the synchronization between Local DB and Cloud (Supabase)
 */
export const syncManager = {
    isSyncing: false,

    /**
     * Start listening for online events
     */
    init() {
        window.addEventListener('online', () => {
            console.log('[SyncManager] Back online! Starting sync...');
            this.syncPendingOrders();
            toast.success('İnternet bağlantısı geldi. Veriler senkronize ediliyor...', { icon: '🔄' });
        });

        window.addEventListener('offline', () => {
            toast('İnternet bağlantısı kesildi. Offline mod aktif.', { icon: '📡' });
        });
    },

    /**
     * Sync all pending orders from IDB to Supabase
     */
    async syncPendingOrders() {
        if (this.isSyncing) return;
        this.isSyncing = true;

        try {
            const pendingOrders = await offlineOrderService.getPendingOrders();
            if (pendingOrders.length === 0) {
                this.isSyncing = false;
                return;
            }

            console.log(`[SyncManager] Found ${pendingOrders.length} pending orders.`);
            let successCount = 0;

            for (const order of pendingOrders) {
                const { id: localId, ...payload } = order; // Assuming 'id' is the local ID and the rest is the payload

                // Attempt to insert into Supabase
                // Note: We strip strictly local fields before sending
                const { data, error } = await supabase // eslint-disable-line no-unused-vars
                    .from('pos_orders')
                    .insert([payload])
                    .select()
                    .single();

                if (error) {
                    console.error(`[SyncManager] Failed to sync order ${localId}: `, error);
                    // Optional: Increment retry_count here
                } else {
                    console.log(`[SyncManager] Synced order ${localId} -> Cloud ID: ${data.id} `);
                    await offlineOrderService.removeOrder(localId);

                    // Also sync items if they were saved separately? 
                    // For now assuming payload is the full order or handled via backend function
                    // If items are separate, we needs a more complex transactional sync.
                    // MVP: Payload includes everything needed or simple order creation.

                    successCount++;
                }
            }

            if (successCount > 0) {
                toast.success(`${successCount} adet geçmiş sipariş senkronize edildi!`, { duration: 4000 });
            }

        } catch (error) {
            console.error('[SyncManager] Sync failed:', error);
        } finally {
            this.isSyncing = false;
        }
    }
};
