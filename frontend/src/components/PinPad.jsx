import React, { useState } from 'react';
import { Delete, Check, Lock } from 'lucide-react';

export const PinPad = ({ onComplete, length = 4, title = "PIN Giriniz" }) => {
    const [pin, setPin] = useState('');

    const handlePress = (num) => {
        if (pin.length < length) {
            const newPin = pin + num;
            setPin(newPin);
            if (newPin.length === length) {
                // Auto submit on length reach? Maybe wait for enter.
                // Let's auto submit for better UX if desired, or wait.
                // Standard POS often auto-submits.
                onComplete(newPin);
            }
        }
    };

    const handleBackspace = () => {
        setPin(pin.slice(0, -1));
    };

    const handleClear = () => {
        setPin('');
    };

    return (
        <div className="flex flex-col items-center justify-center p-6 bg-white rounded-2xl shadow-2xl max-w-sm mx-auto">
            <div className="mb-6 text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600">
                    <Lock className="w-8 h-8" />
                </div>
                <h2 className="text-xl font-bold text-gray-800">{title}</h2>
                <div className="flex justify-center gap-2 mt-4 h-4">
                    {[...Array(length)].map((_, i) => (
                        <div
                            key={i}
                            className={`w-3 h-3 rounded-full border border-gray-400 ${i < pin.length ? 'bg-gray-800 border-gray-800' : 'bg-transparent'}`}
                        />
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-3 gap-4 w-full">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                    <button
                        key={num}
                        onClick={() => handlePress(num.toString())}
                        className="h-16 rounded-xl bg-gray-50 hover:bg-gray-100 active:bg-gray-200 text-2xl font-bold text-gray-700 transition"
                    >
                        {num}
                    </button>
                ))}

                <button
                    onClick={handleClear}
                    className="h-16 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 font-bold transition flex items-center justify-center"
                >
                    C
                </button>

                <button
                    onClick={() => handlePress('0')}
                    className="h-16 rounded-xl bg-gray-50 hover:bg-gray-100 text-2xl font-bold text-gray-700 transition"
                >
                    0
                </button>

                <button
                    onClick={handleBackspace}
                    className="h-16 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-600 transition flex items-center justify-center"
                >
                    <Delete className="w-6 h-6" />
                </button>
            </div>
        </div>
    );
};
