import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { PinPad } from './PinPad';
import { Lock } from 'lucide-react';
import toast from 'react-hot-toast';

export const LockScreen = ({ isLocked, onUnlock }) => {
    const [verifying, setVerifying] = useState(false);

    if (!isLocked) return null;

    const handlePinSubmit = async (pin) => {
        setVerifying(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Verify PIN against profile
            // Note: For real security, PIN verification should happen on server-side RPC 
            // or match a hash. For this level, exact match on profile column logic is assumed.
            // CAUTION: Ideally we don't select pin_code to client unless necessary. 
            // Better approach: RPC 'verify_pin(pin)'.
            // For now, let's fetch profile pin and compare (Least Secure but fastest for prototype).

            const { data: profile } = await supabase
                .from('profiles')
                .select('pin_code')
                .eq('id', user.id)
                .single();

            if (profile?.pin_code === pin) {
                toast.success('Giriş başarılı');
                onUnlock();
            } else {
                toast.error('Hatalı PIN');
            }
        } catch (error) {
            console.error('PIN verify error', error);
            toast.error('Hata oluştu');
        } finally {
            setVerifying(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-gray-900/95 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-300">
            <div className="w-full max-w-md">
                <PinPad onComplete={handlePinSubmit} title="Ekran Kilitli" />
                <div className="mt-8 text-center">
                    <button
                        onClick={() => window.location.reload()}
                        className="text-white/50 hover:text-white text-sm underline transition"
                    >
                        Sayfayı Yenile / Çıkış
                    </button>
                    {verifying && <p className="text-blue-400 mt-2 animate-pulse">Doğrulanıyor...</p>}
                </div>
            </div>
        </div>
    );
};
