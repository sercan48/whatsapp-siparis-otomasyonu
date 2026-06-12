export const DEMO_TENANT_ID = '5eca8855-9ea0-4d36-b1bf-35c6bf47423a';
export const IS_DEMO_MODE = true;
export const BRAND_NAME = 'SiparişPro'; // Default placeholder

// Fiyatlandırma ve Komisyon Ayarları (Buradan değiştirebilirsiniz)
export const PRICING_CONFIG = {
    subscription: {
        starter: { price: 499, name: 'Başlangıç Paket' },
        pro: { price: 999, name: 'Profesyonel Paket' },
        enterprise: { price: null, name: 'Zincir Mağaza' }
    },
    reseller: {
        commission_rates: {
            bronze: 10, // %10
            silver: 20, // %20
            gold: 30    // %30
        }
    }
};
