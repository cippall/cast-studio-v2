/**
 * SettingsPage — role-based settings page using SettingsLayout.
 * Shows different sections based on user role.
 * Navigable sections are shown as a dense list with inline data previews.
 * The active section's content renders in the content area.
 */
import { useState } from 'react';
import { useCurrentUser } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiKeys } from '@/hooks/useApiKeys';
import {
  useAdminModels,
  useAdminUsers,
  useAdminPrompts,
  useAdminTaxonomy,
  useAdminCommissionForms,
} from '@/hooks/useAdmin';
import { useWalletBalance } from '@/hooks/useWallet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  Key,
  Palette,
  Settings2,
  Users,
  Wand2,
  FileText,
  Tag,
  ShoppingBag,
  Wallet,
  User,
  ChevronRight,
} from 'lucide-react';
import SettingsLayout from '@/components/layout/SettingsLayout';
import type { SettingsSection } from '@/components/layout/SettingsLayout';
import apiClient from '@/lib/api-client';

/* -- Data preview hooks (lightweight counts for list items) -- */

function useModelCount() {
  const { data, isLoading } = useAdminModels();
  return { count: data?.length ?? 0, isLoading };
}

function useUserCount() {
  const { data, isLoading } = useAdminUsers({ pageSize: 1 });
  return { count: data?.total ?? data?.data?.length ?? 0, isLoading };
}

function usePromptCount() {
  const { data, isLoading } = useAdminPrompts();
  return { count: data?.length ?? 0, isLoading };
}

function useTaxonomyCount(category: string) {
  const { data, isLoading } = useAdminTaxonomy(category);
  return { count: data?.length ?? 0, isLoading };
}

function useCommissionFormCount() {
  const { data, isLoading } = useAdminCommissionForms();
  return { count: data?.length ?? 0, isLoading };
}

function useApiKeyCount() {
  const { data, isLoading } = useApiKeys();
  const keys = data?.data ?? [];
  return { count: keys.filter((k) => k.is_active).length, isLoading };
}

function useWalletPreview() {
  const { data, isLoading } = useWalletBalance();
  return { balance: data?.balance_credits ?? 0, isLoading };
}

/* -- Main component -- */

export default function SettingsPage() {
  const { data: user } = useCurrentUser();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState('profile');
  const [profileName, setProfileName] = useState(user?.name ?? '');
  const [profileEmail, setProfileEmail] = useState(user?.email ?? '');

  const updateProfileMutation = useMutation({
    mutationFn: async (input: { name: string; email: string }) => {
      await apiClient.patch(`/accounts/${user?.id}`, { name: input.name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      toast.success('Profile updated');
    },
    onError: (error: Error) => {
      toast.error(error.message ?? 'Failed to update profile');
    },
  });

  const isProfileModified =
    profileName !== (user?.name ?? '') || profileEmail !== (user?.email ?? '');

  const handleSaveProfile = () => {
    if (!isProfileModified) return;
    updateProfileMutation.mutate({ name: profileName, email: profileEmail });
  };

  const isAdmin = user?.role === 'ADMIN';
  const isArtist = user?.role === 'ARTIST' || isAdmin;
  const isClient = user?.role === 'CLIENT';

  // Data previews for list items
  const modelCount = useModelCount();
  const userCount = useUserCount();
  const promptCount = usePromptCount();
  const actorTaxonomyCount = useTaxonomyCount('ACTOR_PROPERTY');
  const lookTaxonomyCount = useTaxonomyCount('LOOK_TAXONOMY');
  const fashionTaxonomyCount = useTaxonomyCount('FASHION_ITEM_TAXONOMY');
  const commissionFormCount = useCommissionFormCount();
  const apiKeyCount = useApiKeyCount();
  const walletPreview = useWalletPreview();

  /** Build the preview string for a section */
  const getPreview = (sectionId: string): string | null => {
    switch (sectionId) {
      case 'api-keys':
        if (apiKeyCount.isLoading) return null;
        return `${apiKeyCount.count} active key${apiKeyCount.count !== 1 ? 's' : ''}`;
      case 'wallet':
        if (walletPreview.isLoading) return null;
        return `${walletPreview.balance.toFixed(2)} credits`;
      case 'users':
        if (userCount.isLoading) return null;
        return `${userCount.count} user${userCount.count !== 1 ? 's' : ''}`;
      case 'models':
        if (modelCount.isLoading) return null;
        return `${modelCount.count} active model${modelCount.count !== 1 ? 's' : ''}`;
      case 'prompts':
        if (promptCount.isLoading) return null;
        return `${promptCount.count} prompt${promptCount.count !== 1 ? 's' : ''}`;
      case 'taxonomy-actor':
        if (actorTaxonomyCount.isLoading) return null;
        return `${actorTaxonomyCount.count} propert${actorTaxonomyCount.count !== 1 ? 'ies' : 'y'}`;
      case 'taxonomy-look':
        if (lookTaxonomyCount.isLoading) return null;
        return `${lookTaxonomyCount.count} entr${lookTaxonomyCount.count !== 1 ? 'ies' : 'y'}`;
      case 'taxonomy-fashion':
        if (fashionTaxonomyCount.isLoading) return null;
        return `${fashionTaxonomyCount.count} entr${fashionTaxonomyCount.count !== 1 ? 'ies' : 'y'}`;
      case 'commission-forms':
        if (commissionFormCount.isLoading) return null;
        return `${commissionFormCount.count} form${commissionFormCount.count !== 1 ? 's' : ''}`;
      default:
        return null;
    }
  };

  /** Build the description for a section */
  const getDescription = (sectionId: string): string => {
    switch (sectionId) {
      case 'profile':
        return 'Your account information and preferences';
      case 'api-keys':
        return 'Manage API keys for programmatic access';
      case 'wallet':
        return 'Balance, top-up, and transaction history';
      case 'users':
        return 'Manage accounts and permissions';
      case 'models':
        return 'Configure AI models';
      case 'prompts':
        return 'Edit prompt templates';
      case 'taxonomy-actor':
        return 'Manage actor taxonomy';
      case 'taxonomy-look':
        return 'Manage look taxonomy';
      case 'taxonomy-fashion':
        return 'Manage fashion item taxonomy';
      case 'commission-forms':
        return 'Manage commission form templates';
      default:
        return '';
    }
  };

  /** Build the icon for a section */
  const getIcon = (sectionId: string) => {
    switch (sectionId) {
      case 'profile':
        return <User className="size-4 text-primary" />;
      case 'api-keys':
        return <Key className="size-4 text-primary" />;
      case 'wallet':
        return <Wallet className="size-4 text-primary" />;
      case 'users':
        return <Users className="size-4 text-primary" />;
      case 'models':
        return <Wand2 className="size-4 text-primary" />;
      case 'prompts':
        return <FileText className="size-4 text-primary" />;
      case 'taxonomy-actor':
        return <Tag className="size-4 text-primary" />;
      case 'taxonomy-look':
        return <Palette className="size-4 text-primary" />;
      case 'taxonomy-fashion':
        return <ShoppingBag className="size-4 text-primary" />;
      case 'commission-forms':
        return <Settings2 className="size-4 text-primary" />;
      default:
        return null;
    }
  };

  // Build sections based on role
  const sections: SettingsSection[] = [
    { id: 'profile', label: 'Profile' },
    ...(isArtist ? [{ id: 'api-keys', label: 'API Keys', icon: <Key className="size-4" /> }] : []),
    ...(isClient ? [{ id: 'wallet', label: 'Wallet', icon: <Wallet className="size-4" /> }] : []),
    ...(isAdmin
      ? [
          { id: 'users', label: 'Users & Roles', icon: <Users className="size-4" /> },
          { id: 'models', label: 'Models', icon: <Wand2 className="size-4" /> },
          { id: 'prompts', label: 'System Prompts', icon: <FileText className="size-4" /> },
          { id: 'taxonomy-actor', label: 'Actor Properties', icon: <Tag className="size-4" /> },
          { id: 'taxonomy-look', label: 'Look Taxonomy', icon: <Palette className="size-4" /> },
          {
            id: 'taxonomy-fashion',
            label: 'Fashion Item Taxonomy',
            icon: <ShoppingBag className="size-4" />,
          },
          {
            id: 'commission-forms',
            label: 'Commission Forms',
            icon: <Settings2 className="size-4" />,
          },
        ]
      : []),
  ];

  /** Check if a section is navigable (has a sub-page) */
  const isNavigable = (sectionId: string): boolean => {
    return sectionId !== 'profile';
  };

  /** Get the route for a navigable section */
  const getRoute = (sectionId: string): string => {
    switch (sectionId) {
      case 'api-keys':
        return '/settings/api-keys';
      case 'wallet':
        return '/settings/wallet';
      case 'users':
        return '/settings/users';
      case 'models':
        return '/settings/models';
      case 'prompts':
        return '/settings/prompts';
      case 'taxonomy-actor':
        return '/settings/taxonomy/ACTOR_PROPERTY';
      case 'taxonomy-look':
        return '/settings/taxonomy/LOOK_TAXONOMY';
      case 'taxonomy-fashion':
        return '/settings/taxonomy/FASHION_ITEM_TAXONOMY';
      case 'commission-forms':
        return '/settings/commission-forms';
      default:
        return '#';
    }
  };

  const renderSectionContent = () => {
    switch (activeSection) {
      case 'profile':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="font-heading text-lg font-semibold text-foreground">Profile</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Your account information and preferences
              </p>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={profileName} onChange={(e) => setProfileName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  value={profileEmail}
                  onChange={(e) => setProfileEmail(e.target.value)}
                  disabled
                />
              </div>
              <div className="flex items-center gap-2">
                <Label>Role:</Label>
                <Badge variant={isAdmin ? 'default' : 'secondary'}>{user?.role}</Badge>
              </div>
              <Button
                size="sm"
                onClick={handleSaveProfile}
                disabled={!isProfileModified || updateProfileMutation.isPending}
              >
                {updateProfileMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // Separate profile from navigable sections
  const profileSection = sections.find((s) => s.id === 'profile');
  const navigableSections = sections.filter((s) => s.id !== 'profile');

  return (
    <SettingsLayout
      sections={sections}
      activeSection={activeSection}
      onSectionChange={setActiveSection}
    >
      {/* Profile section: always inline */}
      {profileSection && (
        <div className="mb-6">
          <button
            type="button"
            onClick={() => setActiveSection('profile')}
            className="flex w-full items-center gap-3 border-b border-border px-0 py-3 text-left transition-colors hover:bg-surface"
          >
            <div className="flex size-8 items-center justify-center">{getIcon('profile')}</div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-foreground">Profile</div>
              <div className="text-xs text-muted-foreground">
                Your account information and preferences
              </div>
            </div>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </button>
        </div>
      )}

      {/* Active section content (profile form) */}
      {activeSection === 'profile' && <div className="max-w-[680px]">{renderSectionContent()}</div>}

      {/* Navigable sections: dense list with previews */}
      {activeSection !== 'profile' && navigableSections.length > 0 && (
        <div className="max-w-[680px]">
          <div className="mb-4">
            <h2 className="font-heading text-lg font-semibold text-foreground">Settings</h2>
            <p className="mt-1 text-sm text-muted-foreground">Select a section to manage</p>
          </div>
          <div className="divide-y divide-border">
            {navigableSections.map((section) => {
              const preview = getPreview(section.id);
              const description = getDescription(section.id);
              const route = getRoute(section.id);

              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => navigate(route)}
                  className="flex w-full items-center gap-3 px-0 py-3 text-left transition-colors hover:bg-surface"
                >
                  <div className="flex size-8 items-center justify-center">
                    {getIcon(section.id)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-foreground">{section.label}</div>
                    <div className="text-xs text-muted-foreground">{description}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {preview ? (
                      <span className="text-xs font-medium text-muted-foreground">{preview}</span>
                    ) : (
                      <Skeleton className="h-3 w-12" />
                    )}
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </SettingsLayout>
  );
}
