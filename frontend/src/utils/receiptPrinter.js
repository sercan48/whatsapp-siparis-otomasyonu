import { printToThermalPrinter } from '../lib/escposService';

export const printReceipt = async (order, printerConfig = null) => {
    if (!order) return;

    // If thermal printer configured, use ESC/POS
    if (printerConfig && printerConfig.type === 'thermal') {
        const result = await printToThermalPrinter(order, printerConfig);
        if (result.success) {
            console.log('✅ Thermal print successful');
            return;
        } else {
            console.warn('⚠️ Thermal print failed, falling back to HTML print');
        }
    }

    // Fallback to HTML print dialog
    const width = '80mm'; // Standard Thermal Paper Width

    // Calculate Totals
    const items = order.items || [];
    const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const date = new Date(order.created_at).toLocaleString('tr-TR');

    const receiptHTML = `
        <html>
            <head>
                <title>Fiş - Sipariş #${order.id.slice(0, 6)}</title>
                <style>
                    @page { margin: 0; size: auto; }
                    body {
                        font-family: 'Courier New', monospace;
                        width: ${width};
                        margin: 0;
                        padding: 5px;
                        font-size: 12px;
                        color: #000;
                    }
                    .header { text-align: center; margin-bottom: 10px; border-bottom: 1px dashed #000; padding-bottom: 5px; }
                    .store-name { font-size: 16px; font-weight: bold; margin-bottom: 2px; }
                    .meta { font-size: 10px; margin-bottom: 5px; }
                    .items { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
                    .items th { border-bottom: 1px solid #000; text-align: left; padding: 2px 0; font-size: 11px; }
                    .items td { padding: 2px 0; vertical-align: top; }
                    .qty { width: 25px; font-weight: bold; }
                    .price { text-align: right; white-space: nowrap; }
                    .total-section { border-top: 1px dashed #000; padding-top: 5px; text-align: right; font-weight: bold; font-size: 14px; margin-bottom: 10px; }
                    .footer { text-align: center; font-size: 10px; margin-top: 10px; }
                    .legal { font-size: 9px; margin-top: 5px; font-style: italic; }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="store-name">LEZZET DÜNYASI</div>
                    <div class="meta">
                        Tarih: ${date}<br>
                        Masa: ${order.session?.table?.name || 'Paket'}<br>
                        Fiş No: #${order.id.slice(0, 8)}
                    </div>
                </div>

                <table class="items">
                    <thead>
                        <tr>
                            <th class="qty">Ad.</th>
                            <th>Ürün</th>
                            <th class="price">Tutar</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${items.map(item => `
                            <tr>
                                <td class="qty">${item.quantity}</td>
                                <td>
                                    ${item.name}
                                    ${item.note ? `<div style="font-size:10px; font-style:italic;">(${item.note})</div>` : ''}
                                </td>
                                <td class="price">${(item.price * item.quantity).toFixed(2)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <div class="total-section">
                    TOPLAM: ${total.toFixed(2)} TL
                </div>

                <div class="footer">
                    Afiyet Olsun!<br>
                    Bizi tercih ettiğiniz için teşekkürler.
                    <div class="legal">Mali değeri yoktur. Bilgi fişidir.</div>
                </div>
                
                <script>
                    window.onload = function() { window.print(); window.close(); }
                </script>
            </body>
        </html>
    `;

    const popup = window.open('', '_blank', 'width=400,height=600');
    if (popup) {
        popup.document.open();
        popup.document.write(receiptHTML);
        popup.document.close();
    } else {
        alert("Pop-up engelleyiciyi kapatın.");
    }
};
