import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        this.setState({ error, errorInfo });

        // Log error to console (in production, send to error tracking service)
        console.error('ErrorBoundary caught an error:', error, errorInfo);

        // TODO: Send to error tracking service like Sentry
        // if (process.env.NODE_ENV === 'production') {
        //     Sentry.captureException(error);
        // }
    }

    handleReload = () => {
        window.location.reload();
    };

    handleGoHome = () => {
        window.location.href = '/restore';
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-8 text-center">
                        {/* Error Icon */}
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <AlertTriangle className="w-8 h-8 text-red-600" />
                        </div>

                        {/* Title */}
                        <h1 className="text-2xl font-bold text-gray-800 mb-2">
                            Bir Hata Oluştu
                        </h1>
                        <p className="text-gray-500 mb-6">
                            Üzgünüz, beklenmeyen bir hata oluştu. Lütfen sayfayı yenileyin veya ana sayfaya dönün.
                        </p>

                        {/* Error Details (Development Only) */}
                        {process.env.NODE_ENV !== 'production' && this.state.error && (
                            <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left overflow-auto max-h-40">
                                <p className="text-xs font-mono text-red-600 mb-2">
                                    {this.state.error.toString()}
                                </p>
                                <pre className="text-[10px] text-gray-500 whitespace-pre-wrap">
                                    {this.state.errorInfo?.componentStack}
                                </pre>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex gap-3 justify-center">
                            <button
                                onClick={this.handleGoHome}
                                className="flex items-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                            >
                                <Home className="w-4 h-4" />
                                Ana Sayfa
                            </button>
                            <button
                                onClick={this.handleReload}
                                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
                            >
                                <RefreshCw className="w-4 h-4" />
                                Sayfayı Yenile
                            </button>
                        </div>

                        {/* Support Link */}
                        <p className="mt-6 text-xs text-gray-400">
                            Sorun devam ederse{' '}
                            <a href="mailto:destek@sistem.com" className="text-blue-500 hover:underline">
                                destek@sistem.com
                            </a>
                            {' '}adresine ulaşın.
                        </p>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
