import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import { RestaurantLayout } from './components/RestaurantLayout';
import { MaintenancePage } from './components/MaintenancePage';
import { PastOrders } from './components/PastOrders';
import { Customers } from './components/Customers';
import { Settings } from './components/Settings';
import { SuperAdminDashboard } from './components/SuperAdminDashboard';
import { RestaurantDashboard } from './components/RestaurantDashboard';
import { KitchenBoard } from './components/KitchenBoard';
import { MenuManagement } from './components/MenuManagement';
import { CampaignsManagement } from './components/CampaignsManagement';
import { AuthGuard } from './components/AuthGuard';

import { LandingPage } from './components/LandingPage';
import { LoginPage } from './components/LoginPage';
import { AdminLogin } from './components/AdminLogin';
import { ResellerDashboard } from './components/ResellerDashboard';
import { Billing } from './components/Billing';
import { LegalDocuments } from './components/LegalDocuments';
import { ComplaintManagement } from './components/ComplaintManagement';
import { DashboardGrid } from './components/DashboardGrid';
import { POSManagement } from './components/POSManagement';
import { RegisterPage } from './components/RegisterPage';
import { PublicMenuPage } from './components/PublicMenuPage';
import { ReportsPage } from './components/ReportsPage';
import { CourierLayout } from './components/CourierLayout';
import { UnifiedCourierDashboard } from './components/UnifiedCourierDashboard';
import { CourierMapOperations } from './components/CourierMapOperations';
import { CourierMap } from './components/CourierMap';
import { CourierProfile } from './components/CourierProfile';
import { CourierEarnings } from './components/CourierEarnings';
import { CourierManager } from './components/CourierManager';
import { CourierPaymentConfig } from './components/CourierPaymentConfig';
import { ExternalCourierPanel } from './components/ExternalCourierPanel';
import { UnifiedOrderPanel } from './components/UnifiedOrderPanel';
import { AccountingDashboard } from './components/AccountingDashboard';
import { CourierSettlement } from './components/CourierSettlement';
import { Reservations } from './components/Reservations';
import { InventoryManagement } from './components/InventoryManagement';
import { InvoiceManagement } from './components/InvoiceManagement';
import { PaymentSettings } from './components/PaymentSettings';
import { AIReportsPanel } from './components/AIReportsPanel';
import { QRCodeManager } from './components/QRCodeManager';
import { AICampaignVisualGenerator } from './components/AICampaignVisualGenerator';
import { AccountingLedger } from './components/AccountingLedger';
import { BrandingSettings } from './components/BrandingSettings';
import { VATReport } from './components/VATReport';
import { CashRegister } from './components/CashRegister';
import { QuickMenuBuilder } from './components/QuickMenuBuilder';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { SlugMenuPage } from './components/SlugMenuPage';
import { CheckoutPage } from './components/CheckoutPage';
import { OrderSuccessPage } from './components/OrderSuccessPage';
import { ConversionSettings } from './components/ConversionSettings';
import { TableGridView } from './components/TableGridView';
import { ModernTouchPOS } from './components/ModernTouchPOS';
import { SMSSettings } from './components/SMSSettings';
import { CallerIDSettings } from './components/CallerIDSettings';
import { IncomingCallPopup } from './components/IncomingCallPopup';
import ErrorBoundary from './components/ErrorBoundary';
import { Toaster } from 'react-hot-toast';
import { LockScreen } from './components/LockScreen'; // NEW
import { useState, useEffect } from 'react'; // NEW
import { supabase } from './lib/supabaseClient'; // eslint-disable-line no-unused-vars
import { syncManager } from './lib/SyncManager'; // NEW

function App() {
  const [isLocked, setIsLocked] = useState(false);
  const isMaintenanceMode = import.meta.env.VITE_MAINTENANCE_MODE === 'true';



  useEffect(() => {
    // Listen for lock events
    const handleLock = () => setIsLocked(true);
    window.addEventListener('app-lock', handleLock);

    // Initialize Offline Sync Manager
    syncManager.init();

    return () => window.removeEventListener('app-lock', handleLock);
  }, []);

  if (isMaintenanceMode) {
    return <MaintenancePage />;
  }

  return (
    <ErrorBoundary>
      <Router>
        <LockScreen isLocked={isLocked} onUnlock={() => setIsLocked(false)} />
        <Toaster position="top-right" toastOptions={{ duration: 3000, style: { background: '#363636', color: '#fff' } }} />
        <Routes>
          <Route path="/admin" element={<AuthGuard role="admin" redirectTo="/secure-admin-login"><SuperAdminDashboard /></AuthGuard>} />
          <Route path="/partner" element={<AuthGuard role="reseller"><ResellerDashboard /></AuthGuard>} />
          <Route path="/reseller" element={<Navigate to="/login" replace />} />
          <Route path="/reseller/dashboard" element={<ResellerDashboard />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Restaurant Routes Wrapped in Layout */}
          {/* Restaurant Routes Wrapped in Layout */}
          <Route path="/restore" element={<AuthGuard role="tenant"><RestaurantLayout /></AuthGuard>}>
            <Route index element={<DashboardGrid />} />
            <Route path="kds" element={<KitchenBoard />} />
            <Route path="menu" element={<MenuManagement />} />
            <Route path="campaigns" element={<CampaignsManagement />} />
            <Route path="history" element={<PastOrders />} />
            <Route path="customers" element={<Customers />} />
            <Route path="complaints" element={<ComplaintManagement />} />
            <Route path="billing" element={<Billing />} />
            <Route path="settings" element={<Settings />} />
            {/* New V2 Routes */}
            <Route path="pos" element={<POSManagement />} />
            <Route path="courier-manager" element={<CourierManager />} />
            <Route path="courier-payment-config" element={<CourierPaymentConfig />} />
            <Route path="external-couriers" element={<ExternalCourierPanel />} />
            <Route path="platform-orders" element={<UnifiedOrderPanel />} />
            <Route path="reports" element={<ReportsPage />} />
            {/* Accounting Routes */}
            <Route path="accounting" element={<AccountingDashboard />} />
            <Route path="courier-settlement" element={<CourierSettlement />} />
            <Route path="reservations" element={<Reservations />} />
            <Route path="inventory" element={<InventoryManagement />} />
            <Route path="invoices" element={<InvoiceManagement />} />
            <Route path="payments" element={<PaymentSettings />} />
            {/* New Feature Routes */}
            <Route path="ai-reports" element={<AIReportsPanel />} />
            <Route path="qr-codes" element={<QRCodeManager />} />
            <Route path="campaign-generator" element={<AICampaignVisualGenerator />} />
            <Route path="ledger" element={<AccountingLedger />} />
            <Route path="vat-report" element={<VATReport />} />
            <Route path="cash-register" element={<CashRegister />} />
            <Route path="branding" element={<BrandingSettings />} />
            {/* New WhatsApp Bot Features */}
            <Route path="menu-builder" element={<QuickMenuBuilder />} />
            <Route path="analytics" element={<AnalyticsDashboard />} />
            <Route path="conversion" element={<ConversionSettings />} />
            {/* SMS & Caller ID Integration Routes */}
            <Route path="sms-settings" element={<SMSSettings />} />
            <Route path="caller-id" element={<CallerIDSettings />} />
          </Route>

          {/* Touch POS Full Screen Mode - Outside Layout for Kiosk Mode */}
          <Route path="/restore/touch-pos" element={<AuthGuard role="tenant"><ModernTouchPOS /></AuthGuard>} />

          {/* Landing Page */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/secure-admin-login" element={<AdminLogin />} />

          {/* Public Menu (QR) - Legacy */}
          <Route path="/menu/:tableId" element={<PublicMenuPage />} />

          {/* NEW: Clean URL Menu - domain.com/m/restaurant-slug */}
          <Route path="/m/:slug" element={<SlugMenuPage />} />
          <Route path="/m/:slug/checkout" element={<CheckoutPage />} />
          <Route path="/m/:slug/order-success" element={<OrderSuccessPage />} />

          {/* Courier App Routes (Mobile) */}
          <Route path="/courier" element={<AuthGuard role="courier"><CourierLayout /></AuthGuard>}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<UnifiedCourierDashboard />} />
            <Route path="map" element={<CourierMapOperations />} />
            <Route path="earnings" element={<CourierEarnings />} />
            <Route path="profile" element={<CourierProfile />} />
          </Route>

          {/* Legal Pages */}
          <Route path="/legal/:type" element={<LegalDocuments />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
