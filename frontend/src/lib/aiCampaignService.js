/**
 * AI Campaign Visual Generator Service
 * Generates professional Instagram-ready campaign images for restaurants
 * Enhanced with store branding, language support, and smart text placement
 */

// Supported languages
const LANGUAGES = {
    tr: { name: 'Türkçe', discount: 'İNDİRİM', new: 'YENİ', newTaste: 'YENİ LEZZET', special: 'ÖZEL', campaign: 'KAMPANYA', deal: 'FIRSAT MENÜ', happyHour: 'MUTLU SAATLER' },
    en: { name: 'English', discount: 'OFF', new: 'NEW', newTaste: 'NEW TASTE', special: 'SPECIAL', campaign: 'CAMPAIGN', deal: 'DEAL MENU', happyHour: 'HAPPY HOUR' },
    de: { name: 'Deutsch', discount: 'RABATT', new: 'NEU', newTaste: 'NEUER GESCHMACK', special: 'SPEZIAL', campaign: 'AKTION', deal: 'MENÜ ANGEBOT', happyHour: 'HAPPY HOUR' },
    ar: { name: 'العربية', discount: 'خصم', new: 'جديد', newTaste: 'طعم جديد', special: 'خاص', campaign: 'حملة', deal: 'عرض وجبة', happyHour: 'ساعة سعيدة' },
    ru: { name: 'Русский', discount: 'СКИДКА', new: 'НОВИНКА', newTaste: 'НОВЫЙ ВКУС', special: 'ОСОБОЕ', campaign: 'АКЦИЯ', deal: 'КОМБО', happyHour: 'СЧАСТЛИВЫЕ ЧАСЫ' }
};

// Professional prompt templates for different campaign types
const PROMPT_TEMPLATES = {
    discount: {
        story: (data, lang) => `Professional food photography advertisement for Instagram Story (9:16 aspect ratio).

RESTAURANT BRANDING:
- Restaurant name "${data.storeName}" displayed prominently at top
${data.storeLogo ? `- Include restaurant logo in the top-left corner` : ''}

MAIN CONTENT:
- Hero image of ${data.productName} with elegant food styling, dramatic lighting, shallow depth of field
- Bold "${data.discount}% ${lang.discount}" text overlay in modern ${data.language === 'ar' ? 'Arabic' : 'Latin'} typography - positioned in top-right corner
- Original price ${data.originalPrice}₺ crossed out with strikethrough
- New price ${data.newPrice}₺ highlighted in large, eye-catching format - bottom center

TEXT PLACEMENT GUIDE:
- Store name: TOP CENTER
- Discount badge: TOP RIGHT corner
- Product name: MIDDLE CENTER
- Prices: BOTTOM CENTER
- Campaign message: BOTTOM (above prices)

${data.campaignMessage ? `Campaign slogan: "${data.campaignMessage}" - positioned below product` : ''}
Color scheme: ${data.colorScheme || 'warm golden tones with deep shadows'}.
Style: ${data.style || 'premium fine dining aesthetic, professional food photography'}.
Mood: appetizing, luxurious, irresistible.
Language: All text in ${LANGUAGES[data.language]?.name || 'Turkish'}.
No people, focus on the food.`,

        post: (data, lang) => `Professional food photography for Instagram square post (1:1 aspect ratio).

RESTAURANT BRANDING:
- Restaurant name "${data.storeName}" at top
${data.storeLogo ? `- Restaurant logo visible in corner` : ''}

MAIN CONTENT:
- Hero shot of ${data.productName}, dramatic studio lighting, perfect food styling
- "${data.discount}% ${lang.discount}" in bold modern typography - top right
- Price: ${data.originalPrice}₺ → ${data.newPrice}₺ - bottom section

TEXT PLACEMENT:
- Logo/Store name: TOP LEFT
- Discount percentage: TOP RIGHT (bold badge style)
- Product image: CENTER
- Product name: BELOW image
- Prices: BOTTOM CENTER
${data.campaignMessage ? `- Slogan "${data.campaignMessage}": BOTTOM` : ''}

Color palette: ${data.colorScheme || 'rich warm tones, appetizing colors'}.
Style: ${data.style || 'high-end restaurant marketing, magazine quality'}.
Language: ${LANGUAGES[data.language]?.name || 'Turkish'}.`
    },

    newProduct: {
        story: (data, lang) => `Stunning food reveal photography for Instagram Story (9:16 aspect ratio).

RESTAURANT BRANDING:
- "${data.storeName}" restaurant name at top
${data.storeLogo ? `- Logo in top corner` : ''}

MAIN CONTENT:
- New product launch: ${data.productName}
- "${lang.new}" badge prominently displayed - spotlight effect
- Price: ${data.price}₺ displayed elegantly at bottom

TEXT PLACEMENT:
- Store name: TOP CENTER
- "NEW" badge: TOP RIGHT (star burst or ribbon style)
- Product: CENTER with dramatic lighting
- Product name: BELOW CENTER
- Price: BOTTOM CENTER
${data.campaignMessage ? `- Message "${data.campaignMessage}": BOTTOM` : ''}

Style: ${data.style || 'cinematic food photography, movie poster quality'}.
Language: ${LANGUAGES[data.language]?.name || 'Turkish'}.`,

        post: (data, lang) => `Appetizing food photography for Instagram post (1:1 aspect ratio).

RESTAURANT: "${data.storeName}"
${data.storeLogo ? `Logo placement: top-left corner` : ''}

- Introducing: ${data.productName}
- "${lang.newTaste}" text overlay
- Price ${data.price}₺

TEXT LAYOUT:
- Brand: TOP
- NEW badge: TOP RIGHT
- Product: CENTER
- Price: BOTTOM

${data.campaignMessage ? `Tagline: "${data.campaignMessage}"` : ''}
Style: ${data.style || 'contemporary food photography'}.
Language: ${LANGUAGES[data.language]?.name || 'Turkish'}.`
    },

    seasonal: {
        story: (data, lang) => `Seasonal restaurant promotion for Instagram Story (9:16 aspect ratio).

BRAND: "${data.storeName}"
${data.storeLogo ? `Logo in header area` : ''}

${data.seasonTheme || 'Special seasonal'} campaign featuring ${data.productName}.
${data.seasonType === 'summer' ? 'Bright, fresh, vibrant summer colors' :
                data.seasonType === 'winter' ? 'Warm, cozy, festive winter atmosphere' :
                    data.seasonType === 'spring' ? 'Fresh, blooming, light spring vibes' :
                        'Rich, harvest, warm autumn tones'}.

TEXT PLACEMENT:
- Store name: TOP
- "${lang.special}" badge: TOP RIGHT
- Discount ${data.discount}%: prominent display
- Prices ${data.originalPrice}₺ → ${data.newPrice}₺: BOTTOM
${data.campaignMessage ? `- Seasonal message "${data.campaignMessage}": MIDDLE-BOTTOM` : ''}

Style: ${data.style || 'editorial food photography with seasonal props'}.
Language: ${LANGUAGES[data.language]?.name || 'Turkish'}.`,

        post: (data, lang) => `Seasonal promotion for Instagram (1:1).

"${data.storeName}" - ${data.seasonTheme || 'Limited time'} special
${data.productName} with ${data.discount}% discount.
Prices: ${data.originalPrice}₺ → ${data.newPrice}₺
${data.campaignMessage ? `"${data.campaignMessage}"` : ''}

Layout: Brand top, product center, prices bottom.
Style: ${data.style || 'magazine-quality seasonal food photography'}.
Language: ${LANGUAGES[data.language]?.name || 'Turkish'}.`
    },

    combo: {
        story: (data, lang) => `Combo meal advertisement for Instagram Story (9:16).

RESTAURANT: "${data.storeName}"
${data.storeLogo ? `Logo in header` : ''}

${data.productName} combo menu - multiple items beautifully arranged.
"${lang.deal}" badge prominent.
Price: ${data.price}₺ (was ${data.originalPrice}₺)

TEXT PLACEMENT:
- Brand: TOP CENTER
- Deal badge: TOP RIGHT
- Items: CENTER
- Value proposition: MIDDLE
- Price: BOTTOM CENTER (large, bold)
${data.campaignMessage ? `- "${data.campaignMessage}": BOTTOM` : ''}

Style: ${data.style || 'fast-casual dining photography'}.
Language: ${LANGUAGES[data.language]?.name || 'Turkish'}.`,

        post: (data, lang) => `Combo promotion (1:1).
"${data.storeName}" - ${data.productName}
"${lang.deal}" - ${data.price}₺
${data.campaignMessage ? `"${data.campaignMessage}"` : ''}
Style: ${data.style || 'professional combo meal photography'}.
Language: ${LANGUAGES[data.language]?.name || 'Turkish'}.`
    },

    happyHour: {
        story: (data, lang) => `Happy hour promotion for Instagram Story (9:16).

"${data.storeName}" presents:
${data.productName} - ${lang.happyHour}

TIME-LIMITED: ${data.startTime} - ${data.endTime}
${data.discount}% discount
${data.originalPrice}₺ → ${data.newPrice}₺

TEXT PLACEMENT:
- Store: TOP
- "${lang.happyHour}": TOP in neon/glowing style
- Time window: prominent clock graphic
- Product: CENTER
- Prices: BOTTOM

${data.campaignMessage ? `Message: "${data.campaignMessage}"` : ''}
Style: ${data.style || 'dynamic, exciting, nightlife-inspired'}.
Language: ${LANGUAGES[data.language]?.name || 'Turkish'}.`,

        post: (data, lang) => `Happy hour (1:1).
"${data.storeName}" - "${lang.happyHour}"
${data.productName}
${data.startTime}-${data.endTime}: ${data.discount}% off
Style: ${data.style || 'lively food photography'}.
Language: ${LANGUAGES[data.language]?.name || 'Turkish'}.`
    }
};

// Style presets
const STYLE_PRESETS = {
    fineDining: 'Michelin-star quality, dark moody lighting, elegant plating, luxury aesthetic',
    casual: 'Bright and welcoming, rustic touches, homestyle comfort, friendly atmosphere',
    fastFood: 'Bold colors, dynamic angles, energetic, youth-focused, bold typography',
    cafe: 'Soft natural lighting, cozy atmosphere, artisanal presentation, Instagram-worthy',
    streetFood: 'Authentic, vibrant, street culture vibes, bold flavors, urban aesthetic',
    healthyEating: 'Fresh, clean, bright colors, organic textures, wellness-focused',
    traditional: 'Warm, nostalgic, cultural elements, authentic presentation, heritage feel'
};

// Color schemes
const COLOR_SCHEMES = {
    warm: 'warm golden tones, amber highlights, rich browns',
    cool: 'cool blues, fresh greens, crisp whites',
    vibrant: 'bold reds, energetic oranges, eye-catching yellows',
    elegant: 'deep blacks, golden accents, sophisticated neutrals',
    fresh: 'bright greens, clean whites, natural wood tones',
    cozy: 'warm browns, cream tones, soft lighting'
};

/**
 * Generate a professional campaign visual prompt
 */
export const generateCampaignPrompt = (params) => {
    const {
        campaignType = 'discount',
        format = 'story',
        productName,
        productImage,
        originalPrice,
        newPrice,
        discount,
        price,
        campaignMessage,
        stylePreset,
        colorScheme,
        customStyle,
        seasonType,
        seasonTheme,
        startTime,
        endTime,
        productDescription,
        // NEW: Store branding
        storeName = 'Restaurant',
        storeLogo = '',
        language = 'tr'
    } = params;

    const lang = LANGUAGES[language] || LANGUAGES.tr;

    const data = {
        productName,
        originalPrice,
        newPrice,
        discount,
        price,
        campaignMessage,
        style: customStyle || (stylePreset ? STYLE_PRESETS[stylePreset] : undefined),
        colorScheme: colorScheme ? COLOR_SCHEMES[colorScheme] : undefined,
        seasonType,
        seasonTheme,
        startTime,
        endTime,
        productDescription,
        storeName,
        storeLogo,
        language
    };

    const template = PROMPT_TEMPLATES[campaignType]?.[format];
    if (!template) {
        throw new Error(`Unknown campaign type: ${campaignType} or format: ${format}`);
    }

    let prompt = template(data, lang);

    // Add quality enhancers and branding instructions
    prompt += `

QUALITY & BRANDING SPECIFICATIONS:
- Ultra high resolution, 4K quality
- Professional commercial photography
- Perfect text readability and placement
- Brand-consistent design
- Appetizing food styling
- Ready for immediate social media posting
${data.storeLogo ? `- Integrate the restaurant logo naturally into the design` : ''}
- Ensure all text is clearly legible and properly positioned
- Use professional typography that matches the restaurant's style`;

    return prompt;
};

/**
 * Get available languages
 */
export const getLanguages = () => [
    { id: 'tr', name: 'Türkçe', flag: '🇹🇷' },
    { id: 'en', name: 'English', flag: '🇬🇧' },
    { id: 'de', name: 'Deutsch', flag: '🇩🇪' },
    { id: 'ar', name: 'العربية', flag: '🇸🇦' },
    { id: 'ru', name: 'Русский', flag: '🇷🇺' }
];

export const getCampaignTypes = () => [
    { id: 'discount', name: 'İndirim Kampanyası', icon: '🏷️' },
    { id: 'newProduct', name: 'Yeni Ürün Tanıtımı', icon: '✨' },
    { id: 'seasonal', name: 'Mevsimsel Kampanya', icon: '🍂' },
    { id: 'combo', name: 'Menü/Combo Fırsat', icon: '🍔' },
    { id: 'happyHour', name: 'Happy Hour', icon: '🕐' }
];

export const getStylePresets = () => [
    { id: 'fineDining', name: 'Fine Dining / Lüks', icon: '🍾' },
    { id: 'casual', name: 'Casual / Rahat', icon: '🍕' },
    { id: 'fastFood', name: 'Fast Food', icon: '🍟' },
    { id: 'cafe', name: 'Kafe', icon: '☕' },
    { id: 'streetFood', name: 'Sokak Lezzetleri', icon: '🌮' },
    { id: 'healthyEating', name: 'Sağlıklı', icon: '🥗' },
    { id: 'traditional', name: 'Geleneksel', icon: '🍲' }
];

export const getColorSchemes = () => [
    { id: 'warm', name: 'Sıcak Tonlar', color: '#D97706' },
    { id: 'cool', name: 'Soğuk Tonlar', color: '#0EA5E9' },
    { id: 'vibrant', name: 'Canlı Renkler', color: '#EF4444' },
    { id: 'elegant', name: 'Şık / Zarif', color: '#1F2937' },
    { id: 'fresh', name: 'Taze / Doğal', color: '#10B981' },
    { id: 'cozy', name: 'Sıcak / Samimi', color: '#92400E' }
];

export default {
    generateCampaignPrompt,
    getCampaignTypes,
    getStylePresets,
    getColorSchemes,
    getLanguages,
    LANGUAGES,
    STYLE_PRESETS,
    COLOR_SCHEMES
};
