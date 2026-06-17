/**
 * React Router configuration — all routes for Cast Studio v2.
 */
import { createBrowserRouter, Navigate } from 'react-router-dom';
import AppShell from '@/components/AppShell';
import ProtectedRoute from '@/components/ProtectedRoute';
import LoginPage from '@/pages/LoginPage';
import Dashboard from '@/pages/Dashboard';

// Actors
import ActorLibrary from '@/pages/actors/ActorLibrary';
import ActorDesigner from '@/pages/actors/ActorDesigner';
import ActorPage from '@/pages/actors/ActorPage';

// Looks
import LookLibrary from '@/pages/looks/LookLibrary';
import LookDesigner from '@/pages/looks/LookDesigner';
import LookDetail from '@/pages/looks/LookDetail';

// Fashion Items
import FashionItemLibrary from '@/pages/fashion-items/FashionItemLibrary';
import FashionItemCreator from '@/pages/fashion-items/FashionItemCreator';
import FashionItemDetail from '@/pages/fashion-items/FashionItemDetail';

// Marketplace
import MarketplacePage from '@/pages/marketplace/MarketplacePage';
import MarketplaceDetail from '@/pages/marketplace/MarketplaceDetail';
import MarketplaceManage from '@/pages/marketplace/MarketplaceManage';
import NewListing from '@/pages/marketplace/NewListing';

// Commissions
import CommissionsList from '@/pages/commissions/CommissionsList';
import NewCommission from '@/pages/commissions/NewCommission';
import CommissionDetail from '@/pages/commissions/CommissionDetail';

// Admin
import AdminSubmissions from '@/pages/admin/AdminSubmissions';
import AdminListingsSettings from '@/pages/admin/AdminListingsSettings';

// Settings
import SettingsPage from '@/pages/settings/SettingsPage';
import ApiKeysPage from '@/pages/settings/ApiKeysPage';
import WalletPage from '@/pages/settings/WalletPage';
import UsersPage from '@/pages/settings/UsersPage';
import ModelsPage from '@/pages/settings/ModelsPage';
import PromptsPage from '@/pages/settings/PromptsPage';
import TaxonomyPage from '@/pages/settings/TaxonomyPage';
import CommissionFormsPage from '@/pages/settings/CommissionFormsPage';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <Dashboard /> },

          // Actors
          { path: 'actors', element: <ActorLibrary /> },
          { path: 'actors/new', element: <ActorDesigner /> },
          { path: 'actors/:id', element: <ActorPage /> },

          // Looks
          { path: 'looks', element: <LookLibrary /> },
          { path: 'looks/new', element: <LookDesigner /> },
          { path: 'looks/:id', element: <LookDetail /> },

          // Fashion Items
          { path: 'fashion-items', element: <FashionItemLibrary /> },
          { path: 'fashion-items/new', element: <FashionItemCreator /> },
          { path: 'fashion-items/:id', element: <FashionItemDetail /> },

          // Marketplace
          { path: 'marketplace', element: <MarketplacePage /> },
          { path: 'marketplace/:id', element: <MarketplaceDetail /> },
          { path: 'marketplace/manage', element: <MarketplaceManage /> },
          { path: 'marketplace/manage/new', element: <NewListing /> },

          // Commissions
          { path: 'commissions', element: <CommissionsList /> },
          { path: 'commissions/new', element: <NewCommission /> },
          { path: 'commissions/:id', element: <CommissionDetail /> },

          // Admin
          { path: 'admin/marketplace/submissions', element: <AdminSubmissions /> },
          { path: 'admin/marketplace/settings', element: <AdminListingsSettings /> },

          // Settings
          { path: 'settings', element: <SettingsPage /> },
          { path: 'settings/api-keys', element: <ApiKeysPage /> },
          { path: 'settings/wallet', element: <WalletPage /> },
          { path: 'settings/users', element: <UsersPage /> },
          { path: 'settings/models', element: <ModelsPage /> },
          { path: 'settings/prompts', element: <PromptsPage /> },
          { path: 'settings/taxonomy/:cat', element: <TaxonomyPage /> },
          { path: 'settings/commission-forms', element: <CommissionFormsPage /> },

          // Fallback
          { path: '*', element: <Navigate to="/" replace /> },
        ],
      },
    ],
  },
]);
