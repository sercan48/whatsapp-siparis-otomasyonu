import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { X, User, Truck, Check, ExternalLink, Users, Building2 } from 'lucide-react';
import toast from 'react-hot-toast';

export const AssignCourierModal = ({ isOpen, onClose, orderId, tenantId, orderDetails, orderSource = 'pos' }) => {
    const [couriers, setCouriers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [step, setStep] = useState('select'); // 'select' | 'internal' | 'external'
    const [hasInternalCouriers, setHasInternalCouriers] = useState(false);
    const [externalProviders, setExternalProviders] = useState([
        { id: 'maxijet', name: 'MaxiJet', icon: '🚀', url: 'https://kokpit.maxijett.com', configured: false },
        { id: 'getir', name: 'Getir Kurye', icon: '💜', url: null, configured: false },
        // Add more providers as needed
    ]);

    const checkCourierOptions = React.useCallback(async () => {
        setLoading(true);
        try {
            // 1. Check if tenant has internal couriers configured
            const { data: tenantData } = await supabase
                .from('tenants')
                .select('has_internal_couriers, external_courier_configs')
                .eq('id', tenantId)
                .single();

            const hasInternal = tenantData?.has_internal_couriers || false;
            setHasInternalCouriers(hasInternal);

            // 2. Update external providers with tenant config
            if (tenantData?.external_courier_configs) {
                setExternalProviders(prev => prev.map(p => ({
                    ...p,
                    configured: tenantData.external_courier_configs[p.id]?.enabled || false,
                    url: tenantData.external_courier_configs[p.id]?.url || p.url
                })));
            }

            // 3. If has internal couriers, fetch available ones
            if (hasInternal) {
                const { data: courierData, error: courierError } = await supabase
                    .from('courier_profiles')
                    .select('*, profile:profiles(full_name)')
                    .eq('tenant_id', tenantId)
                    .order('status', { ascending: true });

                if (courierError) {
                    console.error('Courier fetch error:', courierError);
                    toast.error('Kurye listesi yüklenemedi: ' + courierError.message);
                }

                console.log('Couriers fetched:', courierData, 'Tenant:', tenantId);
                setCouriers(courierData || []);
            }

            // 4. If NO internal couriers and only one external provider configured, go directly
            if (!hasInternal) {
                const configuredProviders = externalProviders.filter(p => p.configured || p.id === 'maxijet');
                if (configuredProviders.length === 1) {
                    // Auto-redirect to the single provider
                    setStep('external');
                }
            }
        } catch (error) {
            console.error('Check courier options error:', error);
        } finally {
            setLoading(false);
        }
    }, [tenantId]); // Removed externalProviders - causes infinite loop

    useEffect(() => {
        if (isOpen) {
            checkCourierOptions();
        }
    }, [isOpen, checkCourierOptions]);

    const handleAssignInternal = async (courierId) => {
        try {
            const { error } = await supabase
                .from('deliveries')
                .insert([{
                    tenant_id: tenantId,
                    order_id: orderId,
                    courier_id: courierId,
                    status: 'assigned',
                    source: orderSource,
                    courier_type: 'internal'
                }]);

            if (error) throw error;

            // Update order status based on source
            if (orderSource === 'external') {
                await supabase
                    .from('external_platform_orders')
                    .update({ status: 'preparing', confirmed_at: new Date().toISOString() })
                    .eq('id', orderId);
            } else {
                await supabase
                    .from('pos_order_items')
                    .update({ status: 'delivering' })
                    .eq('pos_order_id', orderId);
            }

            toast.success('Dahili kurye atandı! 🛵');
            onClose();
        } catch (error) {
            console.error(error);
            toast.error('Atama başarısız.');
        }
    };

    const handleAssignExternal = async (provider) => {
        try {
            // 1. Record the external assignment
            await supabase
                .from('deliveries')
                .insert([{
                    tenant_id: tenantId,
                    order_id: orderId,
                    courier_id: null,
                    status: 'pending_external',
                    source: provider.id,
                    courier_type: 'external',
                    external_provider: provider.id
                }]);

            // 2. Update order status
            if (orderSource === 'external') {
                await supabase
                    .from('external_platform_orders')
                    .update({ status: 'awaiting_courier' })
                    .eq('id', orderId);
            } else {
                await supabase
                    .from('pos_order_items')
                    .update({ status: 'awaiting_courier' })
                    .eq('pos_order_id', orderId);
            }

            // 3. Open external provider panel (reuse same window)
            if (provider.url) {
                // Copy order details to clipboard for easy paste
                const orderText = `Sipariş: ${orderDetails?.display_id || orderId}\nAdres: ${orderDetails?.delivery_address || 'Belirtilmemiş'}\nTelefon: ${orderDetails?.customer_phone || 'Belirtilmemiş'}`;

                try {
                    await navigator.clipboard.writeText(orderText);
                    toast.success('Sipariş bilgileri kopyalandı! ' + provider.name + ' paneli açılıyor...');
                } catch {
                    toast.success(provider.name + ' açılıyor...');
                }

                // Use named window to reuse same tab instead of opening new ones
                window.open(provider.url, 'external_courier_panel');
            } else {
                toast.success(provider.name + ' siparişi kaydedildi.');
            }

            onClose();
        } catch (error) {
            console.error(error);
            toast.error('İşlem başarısız.');
        }
    };

    const renderCourierTypeSelection = () => (
        <div className="p-6 space-y-4">
            <p className="text-center text-gray-600 mb-6">Kurye tipini seçin</p>

            {hasInternalCouriers && (
                <button
                    onClick={() => setStep('internal')}
                    className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-all"
                >
                    <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                        <Users className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="text-left flex-1">
                        <div className="font-bold text-gray-800">Dahili Kurye</div>
                        <div className="text-sm text-gray-500">Kendi kuryelerinizden birini atayın</div>
                    </div>
                    <div className="text-gray-400">→</div>
                </button>
            )}

            <button
                onClick={() => setStep('external')}
                className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-gray-200 hover:border-orange-500 hover:bg-orange-50 transition-all"
            >
                <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-orange-600" />
                </div>
                <div className="text-left flex-1">
                    <div className="font-bold text-gray-800">Harici Kurye</div>
                    <div className="text-sm text-gray-500">MaxiJet, Getir gibi hizmetleri kullanın</div>
                </div>
                <div className="text-gray-400">→</div>
            </button>
        </div>
    );

    const renderInternalCouriers = () => (
        <div className="p-4 max-h-[60vh] overflow-y-auto space-y-2">
            <button
                onClick={() => setStep('select')}
                className="text-sm text-blue-600 hover:underline mb-2"
            >
                ← Geri
            </button>

            {couriers.length === 0 ? (
                <div className="text-center py-8 text-gray-400">Müsait kurye bulunamadı.</div>
            ) : (
                couriers.map(courier => (
                    <button
                        key={courier.id}
                        onClick={() => handleAssignInternal(courier.id)}
                        className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all
                            ${courier.status === 'available'
                                ? 'border-gray-200 hover:border-blue-500 hover:bg-blue-50'
                                : 'border-gray-100 opacity-60 bg-gray-50'}`}
                        disabled={courier.status === 'offline'}
                    >
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center
                                ${courier.status === 'available' ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-500'}
                            `}>
                                <User className="w-5 h-5" />
                            </div>
                            <div className="text-left">
                                <div className="font-bold text-gray-800">{courier.profile?.full_name || 'Kurye'}</div>
                                <div className="text-xs text-gray-500 flex items-center gap-1">
                                    <Truck className="w-3 h-3" />
                                    {courier.vehicle_type === 'moto' ? 'Motosiklet' :
                                        courier.vehicle_type === 'car' ? 'Araba' :
                                            courier.vehicle_type === 'bike' ? 'Bisiklet' :
                                                courier.vehicle_type === 'walker' ? 'Yaya' :
                                                    courier.vehicle_type}
                                    {courier.plate_number ? ` (${courier.plate_number})` : ''} • {courier.status === 'available' ? 'Müsait' : 'Meşgul/Offline'}
                                </div>
                            </div>
                        </div>
                        {courier.status === 'available' && (
                            <div className="bg-blue-600 text-white p-2 rounded-full">
                                <Check className="w-4 h-4" />
                            </div>
                        )}
                    </button>
                ))
            )}
        </div>
    );

    const renderExternalProviders = () => (
        <div className="p-4 space-y-3">
            {hasInternalCouriers && (
                <button
                    onClick={() => setStep('select')}
                    className="text-sm text-blue-600 hover:underline mb-2"
                >
                    ← Geri
                </button>
            )}

            <p className="text-sm text-gray-500 mb-4">Harici kurye servisi seçin:</p>

            {externalProviders.map(provider => (
                <button
                    key={provider.id}
                    onClick={() => handleAssignExternal(provider)}
                    className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-gray-200 hover:border-orange-500 hover:bg-orange-50 transition-all"
                >
                    <div className="text-3xl">{provider.icon}</div>
                    <div className="text-left flex-1">
                        <div className="font-bold text-gray-800">{provider.name}</div>
                        <div className="text-xs text-gray-500">
                            {provider.url ? 'Tıklayınca panel açılacak' : 'Yakında'}
                        </div>
                    </div>
                    <ExternalLink className="w-5 h-5 text-gray-400" />
                </button>
            ))}

            <div className="mt-4 p-3 bg-yellow-50 rounded-lg text-sm text-yellow-700">
                💡 Panel açıldığında sipariş bilgileri otomatik kopyalanır.
            </div>
        </div>
    );

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-gray-800">
                        {step === 'select' && 'Kurye Tipi Seç'}
                        {step === 'internal' && 'Dahili Kurye Seç'}
                        {step === 'external' && 'Harici Kurye Servisi'}
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {loading ? (
                    <div className="text-center py-8 text-gray-400">Yükleniyor...</div>
                ) : (
                    <>
                        {step === 'select' && renderCourierTypeSelection()}
                        {step === 'internal' && renderInternalCouriers()}
                        {step === 'external' && renderExternalProviders()}
                    </>
                )}
            </div>
        </div>
    );
};
