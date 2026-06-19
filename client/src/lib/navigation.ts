/**
 * Navigation configuration — defines sidebar items per role.
 */
import type { Account } from '@/hooks/useAuth';
import {
  LayoutDashboard,
  Wrench,
  User,
  Shirt,
  Image,
  ShoppingBag,
  MessageSquare,
  Settings,
  Users,
  Cpu,
  FileText,
  ListTree,
  Folder,
} from 'lucide-react';

export interface NavItem {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: NavItem[];
}

export function getNavItems(role: Account['role']): NavItem[] {
  const tools: NavItem = {
    label: 'Tools',
    path: '#tools',
    icon: Wrench,
    children: [
      { label: 'Actor Designer', path: '/actors/new', icon: User },
      { label: 'Look Designer', path: '/looks/new', icon: Shirt },
      { label: 'Fashion Item Creator', path: '/fashion-items/new', icon: Image },
    ],
  };

  const library: NavItem = {
    label: 'Library',
    path: '#library',
    icon: User,
    children: [
      { label: 'Actors', path: '/actors', icon: User },
      { label: 'Looks', path: '/looks', icon: Shirt },
      { label: 'Fashion Items', path: '/fashion-items', icon: Image },
    ],
  };

  const baseItems: NavItem[] = [
    { label: 'Dashboard', path: '/', icon: LayoutDashboard },
    tools,
    library,
  ];

  if (role === 'ADMIN') {
    const marketplace: NavItem = {
      label: 'Marketplace',
      path: '#marketplace',
      icon: ShoppingBag,
      children: [
        { label: 'Store', path: '/marketplace', icon: ShoppingBag },
        { label: 'Submissions', path: '/admin/marketplace/submissions', icon: FileText },
        { label: 'Listings Settings', path: '/admin/marketplace/settings', icon: Settings },
      ],
    };

    const settings: NavItem = {
      label: 'Settings',
      path: '#settings',
      icon: Settings,
      children: [
        { label: 'Users & Roles', path: '/settings/users', icon: Users },
        { label: 'Models', path: '/settings/models', icon: Cpu },
        { label: 'System Prompts', path: '/settings/prompts', icon: FileText },
        { label: 'Actor Properties', path: '/settings/taxonomy/actor', icon: ListTree },
        { label: 'Look Taxonomy', path: '/settings/taxonomy/look', icon: ListTree },
        { label: 'Fashion Item Taxonomy', path: '/settings/taxonomy/fashion-item', icon: ListTree },
        { label: 'Commission Forms', path: '/settings/commission-forms', icon: FileText },
      ],
    };

    return [
      ...baseItems,
      marketplace,
      { label: 'Commissions', path: '/commissions', icon: MessageSquare },
      settings,
    ];
  }

  if (role === 'CLIENT') {
    return [
      ...baseItems,
      { label: 'Collections', path: '/collections', icon: Folder },
      { label: 'Marketplace', path: '/marketplace', icon: ShoppingBag },
      { label: 'Commissions', path: '/commissions', icon: MessageSquare },
      {
        label: 'Settings',
        path: '#settings',
        icon: Settings,
        children: [
          { label: 'Profile', path: '/settings', icon: Settings },
          { label: 'Wallet', path: '/settings/wallet', icon: ShoppingBag },
        ],
      },
    ];
  }

  // Artist
  return [
    ...baseItems,
    { label: 'Collections', path: '/collections', icon: Folder },
    { label: 'Marketplace', path: '/marketplace/manage', icon: ShoppingBag },
    { label: 'Commissions', path: '/commissions', icon: MessageSquare },
    {
      label: 'Settings',
      path: '#settings',
      icon: Settings,
      children: [
        { label: 'Profile', path: '/settings', icon: Settings },
        { label: 'API Keys', path: '/settings/api-keys', icon: FileText },
      ],
    },
  ];
}
