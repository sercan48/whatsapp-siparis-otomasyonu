import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Printer, CreditCard, Trash2, Plus, CheckCircle, XCircle, Settings as SettingsIcon } from 'lucide-react';
import { testPrinter } from '../lib/escposService';
import { checkTerminalStatus } from '../lib/posTerminalService';
import toast from 'react-hot-toast';

export const HardwareSettings = ({ tenantId, devices, onChange }) => {
    const [testingDevice, setTestingDevice] = useState(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newDevice, setNewDevice] = useState({
        name: '',
        type: 'printer',
        connection_type: 'network',
        ip_address: '',
        port: 9100,
        settings: { demo_mode: true }
    });

    const handleAddDevice = async () => {
        if (!newDevice.name) {
            toast.error('Cihaz adı gerekli');
            return;
        }

        try {
            const { data, error } = await supabase
                .from('devices')
                .insert([{
                    tenant_id: tenantId,
                    ...newDevice
                }])
                .select()
                .single();

            if (error) throw error;

            onChange([...devices, data]);
            setShowAddModal(false);
            setNewDevice({ name: '', type: 'printer', connection_type: 'network', ip_address: '', port: 9100, settings: { demo_mode: true } });
            toast.success('Cihaz eklendi');
        } catch (error) {
            toast.error('Hata: ' + error.message);
        }
    };

    const handleDeleteDevice = async (id) => {
        if (!window.confirm('Bu cihazı silmek istediğinizden emin misiniz?')) return;

        try {
            await supabase.from('devices').delete().eq('id', id);
            onChange(devices.filter(d => d.id !== id));
            toast.success('Cihaz silindi');
        } catch (error) {
            toast.error('Silinemedi');
        }
    };

    const testDevice = async (device) => {
        setTestingDevice(device.id);
        try {
            if (device.type === 'printer') {
                const result = await testPrinter(device.settings);
                toast.success(result.message || 'Test başarılı');
            } else if (device.type === 'pos_terminal') {
                const status = await checkTerminalStatus(device.settings);
                if (status.online) {
                    toast.success('Terminal çevrimiçi');
                } else {
                    toast.error('Terminal çevrimdışı');
                }
            }
        } catch (error) {
            toast.error('Test başarısız: ' + error.message);
        } finally {
            setTestingDevice(null);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <SettingsIcon className="w-6 h-6 text-purple-600" />
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">Donanım Yönetimi</h2>
                        <p className="text-sm text-gray-500">Yazıcılar ve POS Cihazları</p>
                    </div>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                    <Plus className="w-4 h-4" /> Cihaz Ekle
                </button>
            </div>

            {/* Devices List */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {devices.length === 0 ? (
                    <div className="col-span-2 p-12 text-center bg-gray-50 rounded-xl border-2 border-dashed">
                        <Printer className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                        <p className="text-gray-400">Henüz cihaz eklenmedi</p>
                    </div>
                ) : devices.map(device => (
                    <div key={device.id} className="bg-white p-4 rounded-lg border shadow-sm">
                        <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                                {device.type === 'printer' ? (
                                    <div className="p-2 bg-blue-100 rounded-lg">
                                        <Printer className="w-5 h-5 text-blue-600" />
                                    </div>
                                ) : (
                                    <div className="p-2 bg-green-100 rounded-lg">
                                        <CreditCard className="w-5 h-5 text-green-600" />
                                    </div>
                                )}
                                <div>
                                    <p className="font-bold text-gray-800">{device.name}</p>
                                    <p className="text-xs text-gray-500">
                                        {device.type === 'printer' ? 'Yazıcı' : 'POS Terminali'}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => handleDeleteDevice(device.id)}
                                className="p-1 text-red-500 hover:bg-red-50 rounded"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="space-y-2 text-sm text-gray-600 mb-3">
                            <p>📍 {device.connection_type === 'network' ? 'Ağ' : 'USB'}</p>
                            {device.ip_address && <p>🌐 {device.ip_address}:{device.port}</p>}
                            <p className="flex items-center gap-1">
                                {device.settings?.demo_mode ? (
                                    <>
                                        <span className="inline-block w-2 h-2 bg-yellow-500 rounded-full"></span>
                                        Demo Modu
                                    </>
                                ) : (
                                    <>
                                        <span className="inline-block w-2 h-2 bg-green-500 rounded-full"></span>
                                        Gerçek Mod
                                    </>
                                )}
                            </p>
                        </div>

                        <button
                            onClick={() => testDevice(device)}
                            disabled={testingDevice === device.id}
                            className="w-full py-2 bg-gray-100 hover:bg-gray-200 rounded font-medium text-sm"
                        >
                            {testingDevice === device.id ? 'Test ediliyor...' : 'Test Et'}
                        </button>
                    </div>
                ))}
            </div>

            {/* Add Device Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6">
                        <h3 className="text-xl font-bold text-gray-800 mb-4">Yeni Cihaz Ekle</h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-600 mb-1">Cihaz Adı</label>
                                <input
                                    value={newDevice.name}
                                    onChange={(e) => setNewDevice({ ...newDevice, name: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-lg"
                                    placeholder="Örn: Mutfak Yazıcısı"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-600 mb-1">Cihaz Tipi</label>
                                <select
                                    value={newDevice.type}
                                    onChange={(e) => setNewDevice({ ...newDevice, type: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-lg"
                                >
                                    <option value="printer">Yazıcı (Termal)</option>
                                    <option value="pos_terminal">POS Terminali (Kart Okuyucu)</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-600 mb-1">Bağlantı</label>
                                <select
                                    value={newDevice.connection_type}
                                    onChange={(e) => setNewDevice({ ...newDevice, connection_type: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-lg"
                                >
                                    <option value="network">Ağ (IP)</option>
                                    <option value="usb">USB</option>
                                </select>
                            </div>

                            {newDevice.connection_type === 'network' && (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-600 mb-1">IP Adresi</label>
                                        <input
                                            value={newDevice.ip_address}
                                            onChange={(e) => setNewDevice({ ...newDevice, ip_address: e.target.value })}
                                            className="w-full px-3 py-2 border rounded-lg"
                                            placeholder="192.168.1.100"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-600 mb-1">Port</label>
                                        <input
                                            type="number"
                                            value={newDevice.port}
                                            onChange={(e) => setNewDevice({ ...newDevice, port: parseInt(e.target.value) })}
                                            className="w-full px-3 py-2 border rounded-lg"
                                            placeholder="9100"
                                        />
                                    </div>
                                </>
                            )}

                            <div className="flex items-center gap-2 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                                <input
                                    type="checkbox"
                                    checked={newDevice.settings?.demo_mode}
                                    onChange={(e) => setNewDevice({
                                        ...newDevice,
                                        settings: { ...newDevice.settings, demo_mode: e.target.checked }
                                    })}
                                    className="w-4 h-4"
                                />
                                <label className="text-sm text-gray-700">Demo Modu (Fiziksel cihaz olmadan test)</label>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="flex-1 py-2 border rounded-lg font-medium"
                            >
                                İptal
                            </button>
                            <button
                                onClick={handleAddDevice}
                                className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-medium"
                            >
                                Ekle
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HardwareSettings;
