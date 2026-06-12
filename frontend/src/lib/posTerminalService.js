/**
 * POS Terminal Service (Card Payment Integration)
 * Demo Mode for testing without physical device
 */

/**
 * Payment Request Status
 */
export const PAYMENT_STATUS = {
    PENDING: 'pending',
    PROCESSING: 'processing',
    APPROVED: 'approved',
    DECLINED: 'declined',
    ERROR: 'error'
};

/**
 * Initiate payment on POS terminal
 */
export const initiatePayment = async (amount, terminalConfig) => {
    // DEMO MODE: Simulate payment flow
    if (terminalConfig.demo_mode !== false) {
        console.log('💳 [DEMO] POS Terminal Payment Request:');
        console.log(`Amount: ${amount} TL`);
        console.log('Simulating card swipe...');

        return new Promise((resolve) => {
            setTimeout(() => {
                // 90% success rate in demo
                const isApproved = Math.random() > 0.1;

                const result = {
                    status: isApproved ? PAYMENT_STATUS.APPROVED : PAYMENT_STATUS.DECLINED,
                    amount,
                    transaction_id: 'DEMO-' + Date.now(),
                    approval_code: isApproved ? 'DEMO' + Math.floor(Math.random() * 999999) : null,
                    card_last4: '****' + Math.floor(Math.random() * 9999),
                    timestamp: new Date().toISOString(),
                    message: isApproved ? 'Payment approved' : 'Card declined'
                };

                console.log('💳 [DEMO] Result:', result);
                resolve(result);
            }, 2000); // 2 second delay to simulate processing
        });
    }

    // REAL MODE: Call actual POS terminal API
    try {
        // Example for common Turkish POS providers (Garanti, Akbank, etc.)
        const response = await fetch(`${terminalConfig.api_url}/payment`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${terminalConfig.api_key}`
            },
            body: JSON.stringify({
                amount: amount * 100, // Convert to kuruş
                currency: 'TRY',
                terminal_id: terminalConfig.terminal_id
            })
        });

        if (!response.ok) throw new Error('Terminal API error');

        const data = await response.json();

        return {
            status: data.approved ? PAYMENT_STATUS.APPROVED : PAYMENT_STATUS.DECLINED,
            amount,
            transaction_id: data.transaction_id,
            approval_code: data.approval_code,
            card_last4: data.card_number?.slice(-4),
            timestamp: new Date().toISOString(),
            message: data.message
        };
    } catch (error) {
        console.error('POS Terminal error:', error);
        return {
            status: PAYMENT_STATUS.ERROR,
            amount,
            message: error.message
        };
    }
};

/**
 * Cancel payment transaction
 */
export const cancelPayment = async (transactionId, terminalConfig) => {
    if (terminalConfig.demo_mode !== false) {
        console.log('💳 [DEMO] Payment Cancelled:', transactionId);
        return { success: true };
    }

    // Real cancellation logic
    try {
        const response = await fetch(`${terminalConfig.api_url}/cancel`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${terminalConfig.api_key}`
            },
            body: JSON.stringify({ transaction_id: transactionId })
        });

        return { success: response.ok };
    } catch (error) {
        return { success: false, error: error.message };
    }
};

/**
 * Refund payment
 */
export const refundPayment = async (transactionId, amount, terminalConfig) => {
    if (terminalConfig.demo_mode !== false) {
        console.log('💳 [DEMO] Refund Request:', { transactionId, amount });
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    status: PAYMENT_STATUS.APPROVED,
                    refund_id: 'REFUND-' + Date.now(),
                    amount
                });
            }, 1500);
        });
    }

    // Real refund logic
    try {
        const response = await fetch(`${terminalConfig.api_url}/refund`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${terminalConfig.api_key}`
            },
            body: JSON.stringify({
                transaction_id: transactionId,
                amount: amount * 100
            })
        });

        const data = await response.json();
        return {
            status: data.approved ? PAYMENT_STATUS.APPROVED : PAYMENT_STATUS.DECLINED,
            refund_id: data.refund_id,
            amount
        };
    } catch (error) {
        return { status: PAYMENT_STATUS.ERROR, error: error.message };
    }
};

/**
 * Check terminal status
 */
export const checkTerminalStatus = async (terminalConfig) => {
    if (terminalConfig.demo_mode !== false) {
        return { online: true, battery: 100, demo: true };
    }

    try {
        const response = await fetch(`${terminalConfig.api_url}/status`, {
            headers: { 'Authorization': `Bearer ${terminalConfig.api_key}` }
        });

        const data = await response.json();
        return {
            online: data.online,
            battery: data.battery_level,
            demo: false
        };
    } catch (error) {
        return { online: false, error: error.message };
    }
};

export default {
    initiatePayment,
    cancelPayment,
    refundPayment,
    checkTerminalStatus,
    PAYMENT_STATUS
};
