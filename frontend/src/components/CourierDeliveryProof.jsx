import React, { useState, useRef } from 'react';
import {
    Camera, Check, X, Loader2, MapPin, Clock,
    Upload, Edit3, RefreshCw, CheckCircle
} from 'lucide-react';
import { uploadDeliveryProof, updateDeliveryStatus } from '../lib/courierService';
import toast from 'react-hot-toast';

export const CourierDeliveryProof = ({
    delivery,
    onComplete,
    onCancel
}) => {
    const [step, setStep] = useState('photo'); // photo, signature, confirm
    const [photo, setPhoto] = useState(null);
    const [photoPreview, setPhotoPreview] = useState(null);
    const [signature, setSignature] = useState(null);
    const [loading, setLoading] = useState(false);
    const [location, setLocation] = useState(null);

    const fileInputRef = useRef(null);
    const canvasRef = useRef(null);
    const isDrawing = useRef(false);

    // Get current location
    React.useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => setLocation({
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                    accuracy: pos.coords.accuracy
                }),
                (err) => console.warn('Location error:', err)
            );
        }
    }, []);

    const handlePhotoCapture = (event) => {
        const file = event.target.files[0];
        if (file) {
            setPhoto(file);
            const reader = new FileReader();
            reader.onloadend = () => setPhotoPreview(reader.result);
            reader.readAsDataURL(file);
        }
    };

    const openCamera = () => {
        fileInputRef.current?.click();
    };

    const retakePhoto = () => {
        setPhoto(null);
        setPhotoPreview(null);
    };

    // Signature canvas handlers
    const initCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
    };

    React.useEffect(() => {
        if (step === 'signature') {
            initCanvas();
        }
    }, [step]);

    const getCanvasCoords = (e) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const touch = e.touches ? e.touches[0] : e;
        return {
            x: (touch.clientX - rect.left) * (canvas.width / rect.width),
            y: (touch.clientY - rect.top) * (canvas.height / rect.height)
        };
    };

    const startDrawing = (e) => {
        e.preventDefault();
        isDrawing.current = true;
        const { x, y } = getCanvasCoords(e);
        const ctx = canvasRef.current.getContext('2d');
        ctx.beginPath();
        ctx.moveTo(x, y);
    };

    const draw = (e) => {
        if (!isDrawing.current) return;
        e.preventDefault();
        const { x, y } = getCanvasCoords(e);
        const ctx = canvasRef.current.getContext('2d');
        ctx.lineTo(x, y);
        ctx.stroke();
    };

    const stopDrawing = () => {
        isDrawing.current = false;
    };

    const clearSignature = () => {
        initCanvas();
        setSignature(null);
    };

    const saveSignature = () => {
        const canvas = canvasRef.current;
        canvas.toBlob((blob) => {
            setSignature(blob);
            setStep('confirm');
        }, 'image/png');
    };

    const handleSubmit = async () => {
        setLoading(true);
        try {
            // Upload photo
            if (photo) {
                await uploadDeliveryProof(delivery.id, photo, 'photo');
            }

            // Upload signature
            if (signature) {
                await uploadDeliveryProof(delivery.id, signature, 'signature');
            }

            // Update delivery status to delivered
            await updateDeliveryStatus(delivery.id, 'delivered', {
                delivery_lat: location?.lat,
                delivery_lng: location?.lng
            });

            toast.success('Teslimat tamamlandı! 🎉');
            onComplete?.();
        } catch (error) {
            console.error('Error completing delivery:', error);
            toast.error('Teslimat kaydedilemedi');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/90 z-50 flex flex-col">
            {/* Header */}
            <div className="bg-slate-900 p-4 flex items-center justify-between">
                <button
                    onClick={onCancel}
                    className="text-white p-2"
                >
                    <X className="w-6 h-6" />
                </button>
                <h2 className="text-white font-semibold">Teslimat Kanıtı</h2>
                <div className="w-10" />
            </div>

            {/* Progress Steps */}
            <div className="bg-slate-800 px-4 py-3 flex items-center justify-center gap-2">
                {['photo', 'signature', 'confirm'].map((s, idx) => (
                    <React.Fragment key={s}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step === s ? 'bg-green-500 text-white' :
                                ['photo', 'signature', 'confirm'].indexOf(step) > idx
                                    ? 'bg-green-500/30 text-green-400'
                                    : 'bg-slate-700 text-slate-400'
                            }`}>
                            {['photo', 'signature', 'confirm'].indexOf(step) > idx ? (
                                <Check className="w-4 h-4" />
                            ) : (
                                idx + 1
                            )}
                        </div>
                        {idx < 2 && (
                            <div className={`w-12 h-0.5 ${['photo', 'signature', 'confirm'].indexOf(step) > idx
                                    ? 'bg-green-500/30'
                                    : 'bg-slate-700'
                                }`} />
                        )}
                    </React.Fragment>
                ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto">
                {/* Photo Step */}
                {step === 'photo' && (
                    <div className="p-4 flex flex-col items-center justify-center h-full">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={handlePhotoCapture}
                            className="hidden"
                        />

                        {photoPreview ? (
                            <div className="relative w-full max-w-sm">
                                <img
                                    src={photoPreview}
                                    alt="Teslimat"
                                    className="w-full rounded-xl shadow-lg"
                                />
                                <button
                                    onClick={retakePhoto}
                                    className="absolute top-2 right-2 bg-black/50 text-white p-2 rounded-full"
                                >
                                    <RefreshCw className="w-5 h-5" />
                                </button>

                                {location && (
                                    <div className="absolute bottom-2 left-2 bg-black/50 text-white px-3 py-1 rounded-full text-xs flex items-center gap-1">
                                        <MapPin className="w-3 h-3" />
                                        Konum kaydedildi
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-center">
                                <div
                                    onClick={openCamera}
                                    className="w-40 h-40 mx-auto mb-6 rounded-full bg-slate-800 border-4 border-dashed border-slate-600 
                                               flex items-center justify-center cursor-pointer hover:border-green-500 transition-colors"
                                >
                                    <Camera className="w-16 h-16 text-slate-400" />
                                </div>
                                <h3 className="text-white text-xl font-semibold mb-2">Teslimat Fotoğrafı</h3>
                                <p className="text-slate-400 text-sm">
                                    Kapıda veya teslim anının fotoğrafını çekin
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* Signature Step */}
                {step === 'signature' && (
                    <div className="p-4 flex flex-col items-center h-full">
                        <h3 className="text-white text-lg font-semibold mb-2">Müşteri İmzası</h3>
                        <p className="text-slate-400 text-sm mb-4">
                            Müşteriden aşağıya imza atmasını isteyin
                        </p>

                        <div className="relative w-full max-w-sm bg-white rounded-xl overflow-hidden shadow-lg">
                            <canvas
                                ref={canvasRef}
                                width={350}
                                height={200}
                                className="w-full touch-none"
                                onMouseDown={startDrawing}
                                onMouseMove={draw}
                                onMouseUp={stopDrawing}
                                onMouseLeave={stopDrawing}
                                onTouchStart={startDrawing}
                                onTouchMove={draw}
                                onTouchEnd={stopDrawing}
                            />
                            <div className="absolute bottom-2 left-2 flex items-center gap-1 text-slate-400 text-xs">
                                <Edit3 className="w-3 h-3" />
                                Parmağınızla imzalayın
                            </div>
                        </div>

                        <button
                            onClick={clearSignature}
                            className="mt-4 text-slate-400 text-sm hover:text-white flex items-center gap-1"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Temizle
                        </button>

                        <button
                            onClick={() => setStep('confirm')}
                            className="mt-4 text-slate-400 text-sm hover:text-white"
                        >
                            İmza olmadan devam et →
                        </button>
                    </div>
                )}

                {/* Confirm Step */}
                {step === 'confirm' && (
                    <div className="p-4">
                        <div className="bg-slate-800 rounded-xl p-4 mb-4">
                            <h3 className="text-white font-semibold mb-3">Teslimat Özeti</h3>

                            <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center">
                                        <MapPin className="w-5 h-5 text-slate-400" />
                                    </div>
                                    <div>
                                        <p className="text-slate-400 text-xs">Teslimat Adresi</p>
                                        <p className="text-white text-sm">
                                            {delivery.delivery_address || 'Adres bilgisi yok'}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center">
                                        <Clock className="w-5 h-5 text-slate-400" />
                                    </div>
                                    <div>
                                        <p className="text-slate-400 text-xs">Teslim Saati</p>
                                        <p className="text-white text-sm">
                                            {new Date().toLocaleTimeString('tr-TR', {
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </p>
                                    </div>
                                </div>

                                {photoPreview && (
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg overflow-hidden">
                                            <img src={photoPreview} alt="" className="w-full h-full object-cover" />
                                        </div>
                                        <div>
                                            <p className="text-slate-400 text-xs">Fotoğraf</p>
                                            <p className="text-green-400 text-sm flex items-center gap-1">
                                                <Check className="w-4 h-4" /> Eklendi
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {signature && (
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center">
                                            <Edit3 className="w-5 h-5 text-slate-600" />
                                        </div>
                                        <div>
                                            <p className="text-slate-400 text-xs">İmza</p>
                                            <p className="text-green-400 text-sm flex items-center gap-1">
                                                <Check className="w-4 h-4" /> Alındı
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {location && (
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center">
                                            <MapPin className="w-5 h-5 text-green-400" />
                                        </div>
                                        <div>
                                            <p className="text-slate-400 text-xs">Konum</p>
                                            <p className="text-green-400 text-sm flex items-center gap-1">
                                                <Check className="w-4 h-4" /> Kaydedildi
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Footer Actions */}
            <div className="p-4 bg-slate-900">
                {step === 'photo' && photoPreview && (
                    <button
                        onClick={() => setStep('signature')}
                        className="w-full py-4 bg-green-500 text-white rounded-xl font-semibold 
                                   hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
                    >
                        Devam Et
                        <Check className="w-5 h-5" />
                    </button>
                )}

                {step === 'signature' && (
                    <button
                        onClick={saveSignature}
                        className="w-full py-4 bg-green-500 text-white rounded-xl font-semibold 
                                   hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
                    >
                        İmzayı Kaydet
                        <Check className="w-5 h-5" />
                    </button>
                )}

                {step === 'confirm' && (
                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="w-full py-4 bg-green-500 text-white rounded-xl font-semibold 
                                   hover:bg-green-600 transition-colors flex items-center justify-center gap-2
                                   disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Kaydediliyor...
                            </>
                        ) : (
                            <>
                                <CheckCircle className="w-5 h-5" />
                                Teslimatı Tamamla
                            </>
                        )}
                    </button>
                )}
            </div>
        </div>
    );
};

export default CourierDeliveryProof;
