/**
 * ESC/POS Thermal Printer Service (Demo Mode)
 * Simulates ESC/POS commands for thermal printers
 */

// ESC/POS Command Codes
const ESC = '\x1B';
const GS = '\x1D';

export const COMMANDS = {
    INIT: ESC + '@',
    ALIGN_CENTER: ESC + 'a' + '1',
    ALIGN_LEFT: ESC + 'a' + '0',
    ALIGN_RIGHT: ESC + 'a' + '2',
    BOLD_ON: ESC + 'E' + '1',
    BOLD_OFF: ESC + 'E' + '0',
    DOUBLE_HEIGHT: GS + '!' + '\x11',
    NORMAL_SIZE: GS + '!' + '\x00',
    CUT_PAPER: GS + 'V' + '\x41' + '\x00',
    LINE_FEED: '\n'
};

/**
 * Build ESC/POS receipt
 */
export const buildReceiptCommands = (order) => {
    if (!order) return '';

    const items = order.items || [];
    const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const date = new Date(order.created_at).toLocaleString('tr-TR');

    let commands = '';

    // Initialize
    commands += COMMANDS.INIT;

    // Header - Store Name (Bold, Centered, Large)
    commands += COMMANDS.ALIGN_CENTER;
    commands += COMMANDS.DOUBLE_HEIGHT;
    commands += COMMANDS.BOLD_ON;
    commands += 'LEZZET DUNYASI\n';
    commands += COMMANDS.NORMAL_SIZE;
    commands += COMMANDS.BOLD_OFF;

    // Metadata
    commands += COMMANDS.ALIGN_LEFT;
    commands += `Tarih: ${date}\n`;
    commands += `Masa: ${order.session?.table?.name || 'Paket'}\n`;
    commands += `Fis No: #${order.id.slice(0, 8)}\n`;
    commands += '--------------------------------\n';

    // Items
    items.forEach(item => {
        const qty = String(item.quantity).padEnd(3);
        const name = item.name.padEnd(20);
        const price = (item.price * item.quantity).toFixed(2).padStart(8);
        commands += `${qty} ${name} ${price}\n`;
        if (item.note) {
            commands += `    (${item.note})\n`;
        }
    });

    commands += '--------------------------------\n';

    // Total (Bold, Right Aligned)
    commands += COMMANDS.ALIGN_RIGHT;
    commands += COMMANDS.BOLD_ON;
    commands += `TOPLAM: ${total.toFixed(2)} TL\n`;
    commands += COMMANDS.BOLD_OFF;

    // Footer
    commands += COMMANDS.ALIGN_CENTER;
    commands += '\n';
    commands += 'Afiyet Olsun!\n';
    commands += 'Bizi tercih ettiginiz icin\n';
    commands += 'tesekkurler.\n';
    commands += '\n';
    commands += 'Mali degeri yoktur.\n';
    commands += 'Bilgi fisidir.\n';
    commands += '\n\n';

    // Cut paper
    commands += COMMANDS.CUT_PAPER;

    return commands;
};

/**
 * Send to network printer (Demo Mode)
 */
export const printToThermalPrinter = async (order, printerConfig) => {
    const commands = buildReceiptCommands(order);

    // DEMO MODE: Simulate network printing
    if (printerConfig.demo_mode !== false) {
        console.log('🖨️ [DEMO] Thermal Printer Output:');
        console.log('================================');
        console.log(commands.replace(/\x1B/g, '<ESC>').replace(/\x1D/g, '<GS>'));
        console.log('================================');

        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({ success: true, message: 'Demo print completed' });
            }, 1000);
        });
    }

    // REAL MODE: Send to network printer
    try {
        const response = await fetch(`http://${printerConfig.ip_address}:${printerConfig.port || 9100}`, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: commands
        });

        if (!response.ok) throw new Error('Printer connection failed');

        return { success: true, message: 'Print job sent' };
    } catch (error) {
        console.error('Printer error:', error);
        return { success: false, message: error.message };
    }
};

/**
 * Test printer connection
 */
export const testPrinter = async (printerConfig) => {
    const testReceipt = {
        id: 'test-' + Date.now(),
        created_at: new Date().toISOString(),
        session: { table: { name: 'Test' } },
        items: [
            { name: 'Test Urunu', quantity: 1, price: 10.00 }
        ]
    };

    return printToThermalPrinter(testReceipt, printerConfig);
};

export default {
    buildReceiptCommands,
    printToThermalPrinter,
    testPrinter,
    COMMANDS
};
