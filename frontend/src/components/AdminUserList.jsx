import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Users, Shield, Save, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

export const AdminUserList = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setUsers(data || []);
        } catch (error) {
            console.error('Error fetching users:', error);
            toast.error('Kullanıcılar yüklenemedi');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const updateUserRole = async (userId, newRole) => {
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ role: newRole })
                .eq('id', userId);

            if (error) throw error;
            toast.success('Rol güncellendi');
            setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
        } catch (error) {
            toast.error('Rol güncellenemedi: ' + error.message);
        }
    };

    const roles = [
        { value: 'admin', label: 'Yönetici' },
        { value: 'cashier', label: 'Kasiyer' },
        { value: 'waiter', label: 'Garson' },
        { value: 'kitchen', label: 'Mutfak' },
        { value: 'courier', label: 'Kurye' },
    ];

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border mt-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <Users className="w-6 h-6 text-blue-600" />
                    Kullanıcı Yönetimi
                </h2>
                <button onClick={fetchUsers} className="p-2 hover:bg-gray-100 rounded-lg">
                    <RefreshCw className="w-5 h-5 text-gray-500" />
                </button>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-gray-50 text-gray-500 text-sm uppercase">
                            <th className="p-3">Kullanıcı (Email/Ad)</th>
                            <th className="p-3">Mevcut Rol</th>
                            <th className="p-3">Rol Değiştir</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {users.map(user => (
                            <tr key={user.id} className="hover:bg-gray-50">
                                <td className="p-3">
                                    <div className="font-medium text-gray-900">{user.full_name || 'İsimsiz'}</div>
                                    <div className="text-sm text-gray-500">{user.email || user.username}</div>
                                </td>
                                <td className="p-3">
                                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase
                                        ${user.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                                            user.role === 'waiter' ? 'bg-blue-100 text-blue-700' :
                                                user.role === 'kitchen' ? 'bg-orange-100 text-orange-700' :
                                                    'bg-gray-100 text-gray-700'}
                                    `}>
                                        {user.role}
                                    </span>
                                </td>
                                <td className="p-3">
                                    <select
                                        className="border rounded p-1 text-sm bg-white"
                                        value={user.role}
                                        onChange={(e) => updateUserRole(user.id, e.target.value)}
                                    >
                                        {roles.map(r => (
                                            <option key={r.value} value={r.value}>{r.label}</option>
                                        ))}
                                    </select>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {users.length === 0 && !loading && (
                <div className="text-center py-8 text-gray-500">Kullanıcı bulunamadı.</div>
            )}
        </div>
    );
};
