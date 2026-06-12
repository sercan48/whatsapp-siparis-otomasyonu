import React, { useState, useEffect } from 'react';
import {
    Sparkles, Image, Download, RefreshCw, Instagram, Loader2,
    Wand2, Palette, Tag, Clock, Utensils, Camera, Copy, Check,
    ChevronDown, ImagePlus, Settings, Key, CreditCard, Zap, AlertCircle, Globe, Store
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import {
    generateCampaignPrompt,
    getCampaignTypes,
    getStylePresets,
    getColorSchemes,
    getLanguages
} from '../lib/aiCampaignService';
import { generateImage, getProviders } from '../lib/aiImageService';
import { getCreditStatus, useCredit, logUsage } from '../lib/aiCreditsService';
import toast from 'react-hot-toast';

export const AICampaignVisualGenerator = () => {
    const [tenantId, setTenantId] = useState(null);
    const [generating, setGenerating] = useState(false);
    const [menuItems, setMenuItems] = useState([]);
    const [generatedImage, setGeneratedImage] = useState(null);
    const [generatedPrompt, setGeneratedPrompt] = useState('');
    const [copied, setCopied] = useState(false);
    const [showApiSettings, setShowApiSettings] = useState(false);
    const [step, setStep] = useState(1);

    // Store Info
    const [storeInfo, setStoreInfo] = useState({
        name: '',
        logo_url: ''
    });

    // Credit Status
    const [credits, setCredits] = useState({
        remaining_free: 5,
        price_per_image: 3,
        total_due: 0
    });

    // API Settings
    const [apiSettings, setApiSettings] = useState({
        provider: 'openai',
        apiKey: localStorage.getItem('ai_image_api_key') || ''
    });

    const [formData, setFormData] = useState({
        campaignType: 'discount',
        format: 'story',
        productId: '',
        productName: '',
        productImage: '',
        originalPrice: '',
        newPrice: '',
        discount: '',
        campaignMessage: '',
        stylePreset: 'casual',
        colorScheme: 'warm',
        seasonType: 'summer',
        startTime: '17:00',
        endTime: '19:00',
        language: 'tr' // Default Turkish
    });

    const campaignTypes = getCampaignTypes();
    const stylePresets = getStylePresets();
    const colorSchemes = getColorSchemes();
    const providers = getProviders();
    const languages = getLanguages();

    useEffect(() => {
        init();
    }, []);

    const init = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            setTenantId(user.id);
            loadMenuItems(user.id);
            loadCredits(user.id);
            loadStoreInfo(user.id);
        }
    };

    const loadStoreInfo = async (tid) => {
        try {
            const { data } = await supabase
                .from('tenants')
                .select('name, logo_url')
                .eq('id', tid)
                .single();
            if (data) {
                setStoreInfo({ name: data.name || '', logo_url: data.logo_url || '' });
            }
        } catch (error) {
            console.error('Error loading store info:', error);
        }
    };

    const loadCredits = async (tid) => {
        const status = await getCreditStatus(tid);
        setCredits(status);
    };

    const loadMenuItems = async (tid) => {
        try {
            const { data } = await supabase
                .from('menu_items')
                .select('id, name, price, image_url, category')
                .eq('tenant_id', tid);
            setMenuItems(data || []);
        } catch (error) {
            console.error('Error loading menu:', error);
        }
    };

    const handleProductSelect = (productId) => {
        const product = menuItems.find(m => m.id === productId);
        if (product) {
            const discount = formData.discount || 20;
            setFormData({
                ...formData,
                productId,
                productName: product.name,
                productImage: product.image_url || '',
                originalPrice: product.price,
                newPrice: Math.round(product.price * (1 - discount / 100))
            });
        }
    };

    const handleDiscountChange = (discount) => {
        const newPrice = formData.originalPrice
            ? Math.round(formData.originalPrice * (1 - discount / 100))
            : '';
        setFormData({ ...formData, discount, newPrice });
    };

    const saveApiKey = () => {
        localStorage.setItem('ai_image_api_key', apiSettings.apiKey);
        localStorage.setItem('ai_image_provider', apiSettings.provider);
        toast.success('API ayarları kaydedildi');
        setShowApiSettings(false);
    };

    // STEP 1: Generate Prompt (Free)
    const generatePromptOnly = () => {
        if (!formData.productName) {
            toast.error('Lütfen bir ürün seçin veya adı girin');
            return;
        }

        const prompt = generateCampaignPrompt({
            campaignType: formData.campaignType,
            format: formData.format,
            productName: formData.productName,
            productImage: formData.productImage,
            originalPrice: formData.originalPrice,
            newPrice: formData.newPrice,
            discount: formData.discount,
            price: formData.newPrice || formData.originalPrice,
            campaignMessage: formData.campaignMessage,
            stylePreset: formData.stylePreset,
            colorScheme: formData.colorScheme,
            seasonType: formData.seasonType,
            startTime: formData.startTime,
            endTime: formData.endTime,
            // NEW: Store branding and language
            storeName: storeInfo.name || 'Restaurant',
            storeLogo: storeInfo.logo_url,
            language: formData.language
        });

        setGeneratedPrompt(prompt);
        setStep(2);
        toast.success('Prompt oluşturuldu! Görseli üretmek için aşağıdaki butona tıklayın.');
    };

    // STEP 2: Generate Image (Uses Credit)
    const generateImageWithCredit = async () => {
        if (!apiSettings.apiKey) {
            toast.error('Lütfen API anahtarınızı girin');
            setShowApiSettings(true);
            return;
        }

        setGenerating(true);
        try {
            // Use credit
            const creditResult = await useCredit(tenantId);

            if (!creditResult.success) {
                toast.error('Kredi kullanılamadı');
                return;
            }

            const isFree = creditResult.credit_type === 'free';

            if (isFree) {
                toast.success(`Ücretsiz kredi kullanıldı! (Kalan: ${creditResult.remaining_free})`);
            } else {
                toast.success(`Ücretli görsel: ${creditResult.cost}₺ aylık faturanıza eklenecek`);
            }

            // Generate image
            toast.loading('AI görsel oluşturuluyor...', { id: 'generating' });

            const result = await generateImage(generatedPrompt, {
                provider: apiSettings.provider,
                apiKey: apiSettings.apiKey,
                format: formData.format
            });

            setGeneratedImage(result.imageUrl);
            setStep(3);

            // Log usage
            await logUsage(tenantId, {
                prompt: generatedPrompt,
                imageUrl: result.imageUrl,
                format: formData.format,
                campaignType: formData.campaignType,
                productName: formData.productName,
                provider: apiSettings.provider,
                creditType: creditResult.credit_type,
                cost: creditResult.cost,
                status: 'completed'
            });

            // Refresh credits
            loadCredits(tenantId);

            toast.success('Görsel başarıyla oluşturuldu!', { id: 'generating' });

        } catch (error) {
            console.error('Generation error:', error);
            toast.error(`Hata: ${error.message}`, { id: 'generating' });
        } finally {
            setGenerating(false);
        }
    };

    const copyPrompt = () => {
        navigator.clipboard.writeText(generatedPrompt);
        setCopied(true);
        toast.success('Prompt kopyalandı!');
        setTimeout(() => setCopied(false), 2000);
    };

    const downloadImage = () => {
        if (generatedImage) {
            const link = document.createElement('a');
            link.href = generatedImage;
            link.download = `kampanya-${formData.format}-${Date.now()}.png`;
            link.click();
        }
    };

    const resetForm = () => {
        setStep(1);
        setGeneratedPrompt('');
        setGeneratedImage(null);
    };

    return (
        <div className="max-w-6xl mx-auto p-6">
            {/* Header with Credit Status */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 rounded-xl text-white">
                        <Wand2 className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">AI Kampanya Görseli</h1>
                        <p className="text-slate-500">Instagram için profesyonel görseller</p>
                    </div>
                </div>

                {/* Credit Display */}
                <div className="flex items-center gap-4">
                    <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-xl px-4 py-2">
                        <div className="flex items-center gap-3">
                            <Zap className="w-5 h-5 text-purple-500" />
                            <div>
                                <p className="text-xs text-purple-600">Kalan Ücretsiz</p>
                                <p className="text-lg font-bold text-purple-700">{credits.remaining_free} / 5</p>
                            </div>
                            {credits.total_due > 0 && (
                                <div className="border-l pl-3 ml-2">
                                    <p className="text-xs text-amber-600">Aylık Borç</p>
                                    <p className="text-lg font-bold text-amber-700">{credits.total_due}₺</p>
                                </div>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={() => setShowApiSettings(true)}
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
                    >
                        <Settings className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Progress Steps */}
            <div className="flex items-center justify-center gap-4 mb-8">
                {[
                    { num: 1, label: 'Bilgileri Gir' },
                    { num: 2, label: 'Prompt Oluştur' },
                    { num: 3, label: 'Görsel Üret' }
                ].map((s, idx) => (
                    <React.Fragment key={s.num}>
                        <div className={`flex items-center gap-2 ${step >= s.num ? 'text-purple-600' : 'text-slate-400'}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${step >= s.num ? 'bg-purple-500 text-white' : 'bg-slate-200'
                                }`}>
                                {step > s.num ? '✓' : s.num}
                            </div>
                            <span className="text-sm font-medium hidden sm:inline">{s.label}</span>
                        </div>
                        {idx < 2 && <div className={`w-12 h-0.5 ${step > s.num ? 'bg-purple-500' : 'bg-slate-200'}`} />}
                    </React.Fragment>
                ))}
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
                {/* Form Section */}
                <div className="space-y-4">
                    {/* Campaign Type */}
                    <div className="bg-white rounded-xl border p-4">
                        <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                            <Tag className="w-4 h-4 text-purple-500" />
                            Kampanya Türü
                        </h3>
                        <div className="grid grid-cols-3 gap-2">
                            {campaignTypes.map(type => (
                                <button
                                    key={type.id}
                                    onClick={() => setFormData({ ...formData, campaignType: type.id })}
                                    disabled={step > 1}
                                    className={`p-2 rounded-lg text-center transition-all text-sm ${formData.campaignType === type.id
                                        ? 'bg-purple-500 text-white'
                                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                        } ${step > 1 ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    <span className="text-lg">{type.icon}</span>
                                    <p className="text-xs mt-1">{type.name}</p>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Store Branding & Language */}
                    <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-200 p-4">
                        <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                            <Store className="w-4 h-4 text-blue-500" />
                            Mağaza & Dil
                        </h3>
                        <div className="grid grid-cols-2 gap-3">
                            {/* Store Info Display */}
                            <div className="flex items-center gap-3 bg-white p-3 rounded-lg border">
                                {storeInfo.logo_url ? (
                                    <img src={storeInfo.logo_url} alt="Logo" className="w-10 h-10 rounded-lg object-cover" />
                                ) : (
                                    <div className="w-10 h-10 bg-slate-200 rounded-lg flex items-center justify-center">
                                        <Store className="w-5 h-5 text-slate-400" />
                                    </div>
                                )}
                                <div>
                                    <p className="text-xs text-slate-500">Mağaza Adı</p>
                                    <p className="font-medium text-slate-800 text-sm">{storeInfo.name || 'Ayarlardan girin'}</p>
                                </div>
                            </div>

                            {/* Language Selector */}
                            <div className="bg-white p-3 rounded-lg border">
                                <p className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                                    <Globe className="w-3 h-3" /> Görsel Dili
                                </p>
                                <div className="flex flex-wrap gap-1">
                                    {languages.map(lang => (
                                        <button
                                            key={lang.id}
                                            onClick={() => setFormData({ ...formData, language: lang.id })}
                                            disabled={step > 1}
                                            className={`px-2 py-1 rounded text-xs font-medium transition-all ${formData.language === lang.id
                                                ? 'bg-blue-500 text-white'
                                                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                                                } ${step > 1 ? 'opacity-50' : ''}`}
                                        >
                                            {lang.flag} {lang.id.toUpperCase()}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Format & Product */}
                    <div className="bg-white rounded-xl border p-4">
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="text-xs font-medium text-slate-500">Format</label>
                                <div className="flex gap-2 mt-1">
                                    {['story', 'post'].map(fmt => (
                                        <button
                                            key={fmt}
                                            onClick={() => setFormData({ ...formData, format: fmt })}
                                            disabled={step > 1}
                                            className={`flex-1 py-2 rounded-lg text-sm font-medium ${formData.format === fmt
                                                ? 'bg-pink-500 text-white'
                                                : 'bg-slate-100 text-slate-600'
                                                } ${step > 1 ? 'opacity-50' : ''}`}
                                        >
                                            {fmt === 'story' ? '📱 Story' : '📷 Post'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-medium text-slate-500">Ürün</label>
                                <select
                                    value={formData.productId}
                                    onChange={(e) => handleProductSelect(e.target.value)}
                                    disabled={step > 1}
                                    className="w-full px-2 py-2 border rounded-lg text-sm mt-1"
                                >
                                    <option value="">Seçin...</option>
                                    {menuItems.map(item => (
                                        <option key={item.id} value={item.id}>
                                            {item.name} - {item.price}₺
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <input
                            type="text"
                            value={formData.productName}
                            onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                            disabled={step > 1}
                            className="w-full px-3 py-2 border rounded-lg text-sm mb-3"
                            placeholder="Ürün adı (Örn: Izgara Köfte)"
                        />

                        <div className="grid grid-cols-3 gap-2">
                            <input
                                type="number"
                                value={formData.originalPrice}
                                onChange={(e) => setFormData({ ...formData, originalPrice: e.target.value })}
                                disabled={step > 1}
                                className="px-2 py-2 border rounded-lg text-sm"
                                placeholder="Fiyat"
                            />
                            <input
                                type="number"
                                value={formData.discount}
                                onChange={(e) => handleDiscountChange(e.target.value)}
                                disabled={step > 1}
                                className="px-2 py-2 border rounded-lg text-sm"
                                placeholder="İndirim %"
                            />
                            <input
                                type="number"
                                value={formData.newPrice}
                                disabled={step > 1}
                                className="px-2 py-2 border rounded-lg text-sm bg-green-50 text-green-700 font-bold"
                                placeholder="Yeni"
                            />
                        </div>

                        {/* Product Image Section */}
                        <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                            <label className="text-xs font-medium text-slate-500 mb-2 block">📷 Ürün Görseli (Opsiyonel - AI kalitesini artırır)</label>

                            {formData.productImage ? (
                                <div className="flex items-center gap-3">
                                    <img
                                        src={formData.productImage}
                                        alt="Product"
                                        className="w-16 h-16 rounded-lg object-cover border"
                                    />
                                    <div className="flex-1">
                                        <p className="text-sm text-green-600 font-medium">✓ Görsel yüklendi</p>
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, productImage: '' })}
                                            disabled={step > 1}
                                            className="text-xs text-red-500 hover:text-red-700"
                                        >
                                            Kaldır
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex gap-2">
                                    <label className={`flex-1 flex flex-col items-center justify-center p-4 border-2 border-dashed rounded-lg cursor-pointer hover:border-purple-400 hover:bg-purple-50 transition-all ${step > 1 ? 'opacity-50 pointer-events-none' : ''}`}>
                                        <ImagePlus className="w-6 h-6 text-slate-400 mb-1" />
                                        <span className="text-xs text-slate-500">Görsel Yükle</span>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={(e) => {
                                                const file = e.target.files[0];
                                                if (file) {
                                                    const reader = new FileReader();
                                                    reader.onload = (ev) => {
                                                        setFormData({ ...formData, productImage: ev.target.result });
                                                    };
                                                    reader.readAsDataURL(file);
                                                }
                                            }}
                                        />
                                    </label>
                                    <div className="flex-1 flex flex-col items-center justify-center p-4 border rounded-lg bg-white">
                                        <span className="text-xs text-slate-400 text-center">veya URL yapıştır</span>
                                        <input
                                            type="url"
                                            placeholder="https://..."
                                            disabled={step > 1}
                                            className="w-full mt-1 px-2 py-1 text-xs border rounded"
                                            onChange={(e) => setFormData({ ...formData, productImage: e.target.value })}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Style & Message */}
                    <div className="bg-white rounded-xl border p-4">
                        <div className="flex flex-wrap gap-1 mb-3">
                            {colorSchemes.map(scheme => (
                                <button
                                    key={scheme.id}
                                    onClick={() => setFormData({ ...formData, colorScheme: scheme.id })}
                                    disabled={step > 1}
                                    className={`w-7 h-7 rounded-full border-2 ${formData.colorScheme === scheme.id ? 'border-slate-800 scale-110' : 'border-transparent'
                                        }`}
                                    style={{ backgroundColor: scheme.color }}
                                    title={scheme.name}
                                />
                            ))}
                        </div>
                        <textarea
                            value={formData.campaignMessage}
                            onChange={(e) => setFormData({ ...formData, campaignMessage: e.target.value })}
                            disabled={step > 1}
                            className="w-full px-3 py-2 border rounded-lg text-sm resize-none"
                            rows={2}
                            placeholder="Kampanya mesajı (Örn: Sadece bugün!)"
                        />
                    </div>

                    {/* Action Buttons */}
                    {step === 1 && (
                        <button
                            onClick={generatePromptOnly}
                            disabled={!formData.productName}
                            className="w-full py-4 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            <Sparkles className="w-5 h-5" />
                            Prompt Oluştur (Ücretsiz)
                        </button>
                    )}

                    {step === 2 && (
                        <div className="space-y-3">
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                                <div className="flex items-start gap-3">
                                    <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5" />
                                    <div>
                                        <p className="font-medium text-amber-800">Görsel Üretim Ücreti</p>
                                        <p className="text-sm text-amber-700">
                                            {credits.remaining_free > 0
                                                ? `Ücretsiz krediniz var (${credits.remaining_free} kalan)`
                                                : `Bu görsel ${credits.price_per_image}₺ aylık faturanıza eklenecektir`
                                            }
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={generateImageWithCredit}
                                disabled={generating}
                                className="w-full py-4 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {generating ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Oluşturuluyor...
                                    </>
                                ) : (
                                    <>
                                        <Wand2 className="w-5 h-5" />
                                        {credits.remaining_free > 0 ? 'Görseli Üret (Ücretsiz)' : `Görseli Üret (${credits.price_per_image}₺)`}
                                    </>
                                )}
                            </button>

                            <button
                                onClick={resetForm}
                                className="w-full py-2 text-slate-500 hover:text-slate-700"
                            >
                                ← Geri Dön
                            </button>
                        </div>
                    )}

                    {step === 3 && (
                        <button
                            onClick={resetForm}
                            className="w-full py-3 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 flex items-center justify-center gap-2"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Yeni Görsel Oluştur
                        </button>
                    )}
                </div>

                {/* Preview Section */}
                <div className="space-y-4">
                    {/* Generated Prompt */}
                    {generatedPrompt && (
                        <div className="bg-slate-900 rounded-xl p-4 text-white">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-yellow-400" />
                                    AI Prompt
                                </span>
                                <button onClick={copyPrompt} className="text-xs px-2 py-1 bg-white/10 rounded hover:bg-white/20">
                                    {copied ? '✓ Kopyalandı' : 'Kopyala'}
                                </button>
                            </div>
                            <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono bg-slate-800 p-3 rounded-lg max-h-40 overflow-y-auto">
                                {generatedPrompt}
                            </pre>
                        </div>
                    )}

                    {/* Image Preview */}
                    <div className="bg-white rounded-xl border p-4">
                        <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                            <Camera className="w-4 h-4 text-green-500" />
                            Önizleme
                        </h3>

                        <div className={`bg-gradient-to-br from-slate-100 to-slate-200 rounded-xl flex items-center justify-center ${formData.format === 'story' ? 'aspect-[9/16]' : 'aspect-square'
                            }`} style={{ maxHeight: '400px' }}>
                            {generatedImage ? (
                                <img src={generatedImage} alt="Generated" className="w-full h-full object-cover rounded-xl" />
                            ) : (
                                <div className="text-center p-6">
                                    <ImagePlus className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                                    <p className="text-sm text-slate-400">
                                        {step === 1 ? 'Önce prompt oluşturun' : 'Görseli üretmek için butona tıklayın'}
                                    </p>
                                </div>
                            )}
                        </div>

                        {generatedImage && (
                            <div className="flex gap-2 mt-3">
                                <button onClick={downloadImage} className="flex-1 py-2 bg-blue-500 text-white rounded-lg font-medium flex items-center justify-center gap-2">
                                    <Download className="w-4 h-4" /> İndir
                                </button>
                                <button className="py-2 px-4 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-lg font-medium flex items-center gap-2">
                                    <Instagram className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* API Settings Modal */}
            {
                showApiSettings && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl max-w-md w-full p-6">
                            <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <Key className="w-5 h-5 text-purple-500" />
                                API Ayarları
                            </h3>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1">Sağlayıcı</label>
                                    <select
                                        value={apiSettings.provider}
                                        onChange={(e) => setApiSettings({ ...apiSettings, provider: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-lg"
                                    >
                                        {providers.map(p => (
                                            <option key={p.id} value={p.id}>{p.name} - {p.quality}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1">API Anahtarı</label>
                                    <input
                                        type="password"
                                        value={apiSettings.apiKey}
                                        onChange={(e) => setApiSettings({ ...apiSettings, apiKey: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-lg"
                                        placeholder="sk-..."
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button onClick={() => setShowApiSettings(false)} className="flex-1 py-2 border rounded-lg">İptal</button>
                                <button onClick={saveApiKey} className="flex-1 py-2 bg-purple-500 text-white rounded-lg">Kaydet</button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default AICampaignVisualGenerator;
