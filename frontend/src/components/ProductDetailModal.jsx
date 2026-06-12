import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Minus, Check, MessageSquare, AlertCircle, Sparkles, ChevronDown } from 'lucide-react';

/**
 * ProductDetailModal - Yemeksepeti-style Product Customization
 * Features:
 * - Scroll-aware header (large image → thin banner)
 * - Elegant thin borders
 * - Quantity-based extras
 * - Required options validation
 * - Smooth animations
 */
export const ProductDetailModal = ({ product, isOpen, onClose, onAddToCart, branding = {}, activeCampaigns = [] }) => {
    const primaryColor = branding.primary_color || '#FF6B00';
    const accentColor = branding.accent_color || '#10B981';
    const primaryGradient = `linear-gradient(135deg, ${primaryColor}, ${accentColor})`;

    const scrollContainerRef = useRef(null);
    const [isScrolled, setIsScrolled] = useState(false);
    const [scrollProgress, setScrollProgress] = useState(0);

    // Default ingredients
    const defaultIngredients = product?.ingredients || [
        { name: 'Marul', included: true },
        { name: 'Domates', included: true },
        { name: 'Soğan', included: true },
        { name: 'Turşu', included: true },
        { name: 'Sos', included: true },
    ];

    // Default extras (quantity-based)
    const defaultExtras = product?.extras || [
        { name: 'Ekstra Peynir', price: 15, quantity: 0, maxQty: 5 },
        { name: 'Bacon', price: 20, quantity: 0, maxQty: 3 },
        { name: 'Halka Soğan', price: 10, quantity: 0, maxQty: 5 },
        { name: 'Ekstra Köfte', price: 25, quantity: 0, maxQty: 3 },
    ];

    // Required options
    const defaultRequiredOptions = product?.requiredOptions || [];

    // Recommendations
    const defaultRecommendations = product?.recommendations || [];

    const [ingredients, setIngredients] = useState(defaultIngredients);
    const [extras, setExtras] = useState(defaultExtras);
    const [requiredOptions, setRequiredOptions] = useState(defaultRequiredOptions);
    const [quantity, setQuantity] = useState(1);
    const [note, setNote] = useState('');
    const [hoveredItem, setHoveredItem] = useState(null);
    const [validationError, setValidationError] = useState(null);

    // Handle scroll for header animation
    const handleScroll = (e) => {
        const scrollTop = e.target.scrollTop;
        const threshold = 100;
        setIsScrolled(scrollTop > threshold);
        setScrollProgress(Math.min(1, scrollTop / threshold));
    };

    // Reset state when product changes
    useEffect(() => {
        if (product) {
            // Load ingredients from product or use defaults
            const productIngredients = Array.isArray(product.ingredients) && product.ingredients.length > 0
                ? product.ingredients.map(ing => ({ ...ing, included: ing.included !== false }))
                : [];
            setIngredients(productIngredients);

            // Load extras from product or use empty array
            const productExtras = Array.isArray(product.extras) && product.extras.length > 0
                ? product.extras.map(e => ({ ...e, quantity: 0, maxQty: e.maxQty || 5 }))
                : [];
            setExtras(productExtras);

            // Convert modifiers to required options format
            // modifiers format: [{ name, required, multiple, options: [{name, price}] }]
            const modifiers = Array.isArray(product.modifiers) ? product.modifiers : [];
            const requiredOpts = modifiers
                .filter(mod => mod.required) // Only show required modifiers
                .map(mod => ({
                    name: mod.name,
                    required: mod.required,
                    multiple: mod.multiple,
                    options: mod.options?.map(opt => opt.name) || [],
                    selected: null
                }));
            setRequiredOptions(requiredOpts);

            setQuantity(1);
            setNote('');
            setValidationError(null);
            setIsScrolled(false);
            setScrollProgress(0);
        }
    }, [product]);

    // Reset scroll when modal opens
    useEffect(() => {
        if (isOpen && scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = 0;
        }
    }, [isOpen]);

    if (!isOpen || !product) return null;

    // Toggle ingredient
    const toggleIngredient = (index) => {
        setIngredients(prev => prev.map((ing, i) =>
            i === index ? { ...ing, included: !ing.included } : ing
        ));
    };

    // Update extra quantity
    const updateExtraQuantity = (index, delta) => {
        setExtras(prev => prev.map((ext, i) => {
            if (i === index) {
                const newQty = Math.max(0, Math.min(ext.maxQty || 10, ext.quantity + delta));
                return { ...ext, quantity: newQty };
            }
            return ext;
        }));
    };

    // Select required option
    const selectRequiredOption = (optionIndex, choice) => {
        setRequiredOptions(prev => prev.map((opt, i) =>
            i === optionIndex ? { ...opt, selected: choice } : opt
        ));
        setValidationError(null);
    };

    // Calculate discounted base price
    const getDiscountedPrice = () => {
        if (!product || !activeCampaigns.length) return product?.price || 0;

        const campaign = activeCampaigns.find(c =>
            c.type === 'product_discount' &&
            c.rules.target_product_id == product.id
        );

        if (campaign) {
            return parseFloat(campaign.rules.value);
        }
        return product.price;
    };

    const currentBasePrice = getDiscountedPrice();
    const hasDiscount = currentBasePrice < product.price;

    // Calculate total price
    const extrasTotal = extras.reduce((sum, e) => sum + (e.price * e.quantity), 0);
    const itemTotal = (currentBasePrice + extrasTotal) * quantity;

    // Validate and add
    const validateAndAdd = () => {
        const unselectedRequired = requiredOptions.filter(opt => opt.required && !opt.selected);
        if (unselectedRequired.length > 0) {
            setValidationError(`Lütfen ${unselectedRequired[0].name} seçiniz.`);
            return;
        }
        handleAddToCart();
    };

    // Handle add to cart
    const handleAddToCart = () => {
        const cartItem = {
            id: product.id,
            name: product.name,
            basePrice: currentBasePrice,
            originalPrice: product.price,
            quantity,
            removedIngredients: ingredients.filter(i => !i.included).map(i => i.name),
            addedExtras: extras.filter(e => e.quantity > 0).map(e => ({
                name: e.name,
                price: e.price,
                quantity: e.quantity
            })),
            requiredSelections: requiredOptions.filter(o => o.selected).map(o => ({
                name: o.name,
                selected: o.selected
            })),
            note: note.trim(),
            totalPrice: itemTotal,
            customizationSummary: buildCustomizationSummary(),
        };
        onAddToCart(cartItem);
        onClose();
    };

    // Build customization summary
    const buildCustomizationSummary = () => {
        const parts = [];
        const removed = ingredients.filter(i => !i.included).map(i => i.name);
        const added = extras.filter(e => e.quantity > 0).map(e =>
            e.quantity > 1 ? `${e.quantity}x ${e.name}` : e.name
        );
        const required = requiredOptions.filter(o => o.selected).map(o => o.selected);

        if (removed.length > 0) parts.push(`${removed.join(', ')} yok`);
        if (added.length > 0) parts.push(`+ ${added.join(', ')}`);
        if (required.length > 0) parts.push(required.join(', '));
        if (note.trim()) parts.push(`Not: ${note.trim()}`);

        return parts.join(' | ') || null;
    };

    // Header height based on scroll
    const headerHeight = isScrolled ? 56 : 200;
    const imageOpacity = 1 - scrollProgress;
    const bannerOpacity = scrollProgress;

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal Container */}
            <div className="relative bg-white w-full sm:w-[440px] h-[90vh] sm:h-[85vh] rounded-t-[28px] sm:rounded-[28px] overflow-hidden animate-slideUp flex flex-col shadow-2xl">

                {/* Scroll-Aware Header */}
                <div
                    className="relative flex-shrink-0 transition-all duration-300 ease-out overflow-hidden"
                    style={{
                        height: `${headerHeight}px`,
                        background: primaryGradient
                    }}
                >
                    {/* Full Image View (when not scrolled) */}
                    <div
                        className="absolute inset-0 transition-opacity duration-300"
                        style={{ opacity: imageOpacity }}
                    >
                        {product.image_url ? (
                            <img
                                src={product.image_url}
                                alt={product.name}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-7xl">
                                🍔
                            </div>
                        )}

                        {/* Gradient overlay for text readability */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />

                        {/* Product info on image */}
                        <div className="absolute bottom-0 left-0 right-0 p-4">
                            <h2 className="text-2xl font-bold text-white drop-shadow-lg">{product.name}</h2>
                            <p className="text-white/80 text-sm mt-1 line-clamp-2">{product.description}</p>
                        </div>
                    </div>

                    {/* Compact Banner (when scrolled) */}
                    <div
                        className="absolute inset-0 flex items-center px-4 transition-opacity duration-300"
                        style={{ opacity: bannerOpacity }}
                    >
                        <h2 className="text-lg font-bold text-white truncate flex-1">{product.name}</h2>
                        <div className="flex flex-col items-end">
                            {hasDiscount && (
                                <span className="text-white/60 text-xs line-through">₺{product.price}</span>
                            )}
                            <span className="text-white font-semibold">₺{currentBasePrice}</span>
                        </div>
                    </div>

                    {/* Close button */}
                    <button
                        onClick={onClose}
                        className="absolute top-3 right-3 w-9 h-9 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg hover:bg-white transition-all hover:scale-105 z-10"
                    >
                        <X className="w-5 h-5 text-gray-700" />
                    </button>

                    {/* Scroll indicator */}
                    {!isScrolled && (
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 animate-bounce opacity-60">
                            <ChevronDown className="w-5 h-5 text-white" />
                        </div>
                    )}
                </div>

                {/* Scrollable Content */}
                <div
                    ref={scrollContainerRef}
                    onScroll={handleScroll}
                    className="flex-1 overflow-y-auto"
                >
                    <div className="p-4 space-y-5">

                        {/* Ingredients Section - Only if product has ingredients */}
                        {ingredients.length > 0 && (
                            <div>
                                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                                    Malzemeler
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    {ingredients.map((ing, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => toggleIngredient(idx)}
                                            onMouseEnter={() => setHoveredItem(`ing-${idx}`)}
                                            onMouseLeave={() => setHoveredItem(null)}
                                            className={`inline-flex items-center gap-2 px-3 py-2 rounded-full border transition-all duration-200
                                                ${ing.included
                                                    ? hoveredItem === `ing-${idx}`
                                                        ? 'border-green-400 bg-green-50 scale-105'
                                                        : 'border-green-400 bg-green-50/50'
                                                    : hoveredItem === `ing-${idx}`
                                                        ? 'border-gray-300 bg-gray-100 scale-105'
                                                        : 'border-gray-200 bg-gray-50 opacity-50'
                                                }`}
                                        >
                                            <div className={`w-4 h-4 rounded-full flex items-center justify-center text-white text-xs
                                                ${ing.included ? 'bg-green-500' : 'bg-gray-300'}`}>
                                                {ing.included && <Check className="w-3 h-3" />}
                                            </div>
                                            <span className={`text-sm font-medium ${!ing.included && 'line-through text-gray-400'}`}>
                                                {ing.name}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Extras Section - Only if product has extras */}
                        {extras.length > 0 && (
                            <>
                                <div className="h-px bg-gray-100" />
                                <div>
                                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                                        Ekstralar
                                    </h3>
                                    <div className="space-y-2">
                                        {extras.map((ext, idx) => (
                                            <div
                                                key={idx}
                                                onMouseEnter={() => setHoveredItem(`ext-${idx}`)}
                                                onMouseLeave={() => setHoveredItem(null)}
                                                className={`flex items-center justify-between p-3 rounded-2xl border transition-all duration-200
                                                    ${ext.quantity > 0
                                                        ? 'border-purple-300 bg-purple-50/50'
                                                        : hoveredItem === `ext-${idx}`
                                                            ? 'border-gray-300 bg-gray-50 scale-[1.01]'
                                                            : 'border-gray-100 bg-white'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <span className="font-medium text-gray-800">{ext.name}</span>
                                                    <span className="text-purple-600 text-sm font-semibold">+₺{ext.price}</span>
                                                </div>

                                                {/* Quantity Controls - Compact */}
                                                <div className="flex items-center gap-0.5 bg-gray-100 rounded-full p-0.5">
                                                    <button
                                                        onClick={() => updateExtraQuantity(idx, -1)}
                                                        disabled={ext.quantity === 0}
                                                        className="w-8 h-8 rounded-full bg-white flex items-center justify-center hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition shadow-sm"
                                                    >
                                                        <Minus className="w-3.5 h-3.5 text-gray-600" />
                                                    </button>
                                                    <span className={`w-7 text-center font-bold text-sm ${ext.quantity > 0 ? 'text-purple-600' : 'text-gray-400'}`}>
                                                        {ext.quantity}
                                                    </span>
                                                    <button
                                                        onClick={() => updateExtraQuantity(idx, 1)}
                                                        disabled={ext.quantity >= (ext.maxQty || 10)}
                                                        className="w-8 h-8 rounded-full bg-white flex items-center justify-center hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition shadow-sm"
                                                    >
                                                        <Plus className="w-3.5 h-3.5 text-gray-600" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Required Options - this is the zorunlu seçenekler section */}
                        {requiredOptions.length > 0 && (
                            <>
                                <div className="h-px bg-gray-100" />
                                {requiredOptions.map((opt, optIdx) => (
                                    <div key={optIdx}>
                                        <div className="flex items-center gap-2 mb-3">
                                            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                                                {opt.name}
                                            </h3>
                                            {opt.required && (
                                                <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold uppercase">
                                                    Zorunlu
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {opt.options?.map((choice, choiceIdx) => (
                                                <button
                                                    key={choiceIdx}
                                                    onClick={() => selectRequiredOption(optIdx, choice)}
                                                    className={`px-4 py-2.5 rounded-full border text-sm font-medium transition-all
                                                        ${opt.selected === choice
                                                            ? 'border-orange-400 bg-orange-50 text-orange-700'
                                                            : 'border-gray-200 bg-white hover:border-orange-200 hover:bg-orange-50/30 text-gray-700'
                                                        }`}
                                                >
                                                    {choice}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </>
                        )}

                        {/* Divider */}
                        <div className="h-px bg-gray-100" />

                        {/* Note Section */}
                        <div>
                            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                                <MessageSquare className="w-4 h-4" />
                                Sipariş Notu
                            </h3>
                            <textarea
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                placeholder="Özel isteklerinizi yazın..."
                                className="w-full p-3 border border-gray-200 rounded-2xl resize-none h-20 focus:border-orange-300 focus:ring-2 focus:ring-orange-100 focus:outline-none transition text-sm placeholder-gray-400"
                                maxLength={200}
                            />
                        </div>

                        {/* Recommendations */}
                        {defaultRecommendations.length > 0 && (
                            <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl p-4 border border-amber-100">
                                <h3 className="text-sm font-semibold text-amber-700 mb-3 flex items-center gap-2">
                                    <Sparkles className="w-4 h-4" />
                                    Yanında İyi Gider
                                </h3>
                                <div className="flex gap-3 overflow-x-auto pb-2">
                                    {defaultRecommendations.map((rec, idx) => (
                                        <div
                                            key={idx}
                                            className="flex-shrink-0 w-20 text-center cursor-pointer hover:scale-105 transition"
                                        >
                                            <div className="w-16 h-16 bg-white rounded-xl mx-auto mb-1.5 flex items-center justify-center text-2xl shadow-sm">
                                                {rec.image || '🍟'}
                                            </div>
                                            <p className="text-xs font-medium text-gray-700 line-clamp-2">{rec.name}</p>
                                            <p className="text-xs text-amber-600 font-bold">₺{rec.price}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Bottom spacing for footer */}
                        <div className="h-4" />
                    </div>
                </div>

                {/* Fixed Footer */}
                <div className="flex-shrink-0 border-t border-gray-100 p-4 bg-white/95 backdrop-blur-sm">
                    {/* Validation Error */}
                    {validationError && (
                        <div className="flex items-center gap-2 text-red-600 text-sm mb-3 p-2.5 bg-red-50 rounded-xl border border-red-100">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            <span>{validationError}</span>
                        </div>
                    )}

                    <div className="flex items-center justify-between gap-4">
                        {/* Quantity Selector - Compact */}
                        <div className="flex items-center gap-0.5 bg-gray-100 rounded-full p-1">
                            <button
                                onClick={() => setQuantity(q => Math.max(1, q - 1))}
                                className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center hover:bg-gray-50 transition"
                            >
                                <Minus className="w-4 h-4" />
                            </button>
                            <span className="w-10 text-center font-bold text-lg">{quantity}</span>
                            <button
                                onClick={() => setQuantity(q => Math.min(10, q + 1))}
                                className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center hover:bg-gray-50 transition"
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Add to Cart Button */}
                        {(() => {
                            const hasUnselectedRequired = requiredOptions.some(opt => opt.required && !opt.selected);
                            const isValid = !hasUnselectedRequired;
                            return (
                                <button
                                    onClick={validateAndAdd}
                                    disabled={!isValid}
                                    className={`flex-1 py-3.5 rounded-full font-bold text-white shadow-lg transition-all flex items-center justify-center gap-3 ${isValid
                                        ? 'hover:shadow-xl active:scale-[0.98]'
                                        : 'opacity-40 cursor-not-allowed'
                                        }`}
                                    style={{ background: isValid ? primaryGradient : '#9CA3AF' }}
                                >
                                    <span>{isValid ? 'Sepete Ekle' : 'Seçim Yapın'}</span>
                                    <span className={`px-3 py-1 rounded-full text-sm ${isValid ? 'bg-white/20' : 'bg-black/10'}`}>
                                        ₺{itemTotal.toFixed(2)}
                                    </span>
                                </button>
                            );
                        })()}
                    </div>
                </div>
            </div>

            {/* Animations */}
            <style>{`
                @keyframes slideUp {
                    from { transform: translateY(100%); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                .animate-slideUp {
                    animation: slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
            `}</style>
        </div>
    );
};

export default ProductDetailModal;
