/**
 * React Router configuration — all routes for Cast Studio v2.
 *
 * Route-level code splitting via React.lazy + Suspense ensures each page
 * is loaded only when visited, reducing initial bundle from ~821 KB to
 * ~150 KB for the shell + current page.
 */
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import AppShell from '@/components/AppShell';
import ProtectedRoute from '@/components/ProtectedRoute';
import { PageSkeleton } from '@/components/PageSkeleton';

// Eagerly loaded: login and dashboard are the most common entry points
import LoginPage from '@/pages/LoginPage';
import Dashboard from '@/pages/Dashboard';

// Lazy-loaded: feature pages
const ActorLibrary = lazy(() => import('@/pages/actors/ActorLibrary'));
const ActorDesigner = lazy(() => import('@/pages/actors/ActorDesigner'));
const ActorPage = lazy(() => import('@/pages/actors/ActorPage'));

const LookLibrary = lazy(() => import('@/pages/looks/LookLibrary'));
const LookDesigner = lazy(() => import('@/pages/looks/LookDesigner'));
const LookDetail = lazy(() => import('@/pages/looks/LookDetail'));

const FashionItemLibrary = lazy(() => import('@/pages/fashion-items/FashionItemLibrary'));
const FashionItemCreator = lazy(() => import('@/pages/fashion-items/FashionItemCreator'));
const FashionItemDetail = lazy(() => import('@/pages/fashion-items/FashionItemDetail'));

const MarketplacePage = lazy(() => import('@/pages/marketplace/MarketplacePage'));
const MarketplaceDetail = lazy(() => import('@/pages/marketplace/MarketplaceDetail'));
const MarketplaceManage = lazy(() => import('@/pages/marketplace/MarketplaceManage'));
const NewListing = lazy(() => import('@/pages/marketplace/NewListing'));

const CommissionsList = lazy(() => import('@/pages/commissions/CommissionsList'));
const NewCommission = lazy(() => import('@/pages/commissions/NewCommission'));
const CommissionDetail = lazy(() => import('@/pages/commissions/CommissionDetail'));

const AdminSubmissions = lazy(() => import('@/pages/admin/AdminSubmissions'));
const AdminListingsSettings = lazy(() => import('@/pages/admin/AdminListingsSettings'));

const SettingsPage = lazy(() => import('@/pages/settings/SettingsPage'));
const ApiKeysPage = lazy(() => import('@/pages/settings/ApiKeysPage'));
const WalletPage = lazy(() => import('@/pages/settings/WalletPage'));
const UsersPage = lazy(() => import('@/pages/settings/UsersPage'));
const ModelsPage = lazy(() => import('@/pages/settings/ModelsPage'));
const PromptsPage = lazy(() => import('@/pages/settings/PromptsPage'));
const TaxonomyPage = lazy(() => import('@/pages/settings/TaxonomyPage'));
const CommissionFormsPage = lazy(() => import('@/pages/settings/CommissionFormsPage'));
const CollectionsPage = lazy(() => import('@/pages/collections/CollectionsPage'));

function lazyRoute(element: React.ReactElement) {
  return <Suspense fallback={<PageSkeleton />}>{element}</Suspense>;
}

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
          { path: 'actors', element: lazyRoute(<ActorLibrary />) },
          { path: 'actors/new', element: lazyRoute(<ActorDesigner />) },
          { path: 'actors/:id', element: lazyRoute(<ActorPage />) },

          // Looks
          { path: 'looks', element: lazyRoute(<LookLibrary />) },
          { path: 'looks/new', element: lazyRoute(<LookDesigner />) },
          { path: 'looks/:id', element: lazyRoute(<LookDetail />) },

          // Fashion Items
          { path: 'fashion-items', element: lazyRoute(<FashionItemLibrary />) },
          { path: 'fashion-items/new', element: lazyRoute(<FashionItemCreator />) },
          { path: 'fashion-items/:id', element: lazyRoute(<FashionItemDetail />) },

          // Collections
          { path: 'collections', element: lazyRoute(<CollectionsPage />) },

          // Marketplace
          { path: 'marketplace', element: lazyRoute(<MarketplacePage />) },
          { path: 'marketplace/:id', element: lazyRoute(<MarketplaceDetail />) },
          { path: 'marketplace/manage', element: lazyRoute(<MarketplaceManage />) },
          { path: 'marketplace/manage/new', element: lazyRoute(<NewListing />) },

          // Commissions
          { path: 'commissions', element: lazyRoute(<CommissionsList />) },
          { path: 'commissions/new', element: lazyRoute(<NewCommission />) },
          { path: 'commissions/:id', element: lazyRoute(<CommissionDetail />) },

          // Admin
          { path: 'admin/marketplace/submissions', element: lazyRoute(<AdminSubmissions />) },
          { path: 'admin/marketplace/settings', element: lazyRoute(<AdminListingsSettings />) },

          // Settings
          { path: 'settings', element: lazyRoute(<SettingsPage />) },
          { path: 'settings/api-keys', element: lazyRoute(<ApiKeysPage />) },
          { path: 'settings/wallet', element: lazyRoute(<WalletPage />) },
          { path: 'settings/users', element: lazyRoute(<UsersPage />) },
          { path: 'settings/models', element: lazyRoute(<ModelsPage />) },
          { path: 'settings/prompts', element: lazyRoute(<PromptsPage />) },
          { path: 'settings/taxonomy/:cat', element: lazyRoute(<TaxonomyPage />) },
          { path: 'settings/commission-forms', element: lazyRoute(<CommissionFormsPage />) },

          // Fallback
          { path: '*', element: <Navigate to="/" replace /> },
        ],
      },
    ],
  },
]);
