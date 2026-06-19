/**
 * SettingsPage — role-based settings page using SettingsLayout.
 * Shows different sections based on user role.
 */
import { useState } from 'react';
import { useCurrentUser } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
} from 'lucide-react';
import SettingsLayout from '@/components/layout/SettingsLayout';
import type { SettingsSection } from '@/components/layout/SettingsLayout';
import apiClient from '@/lib/api-client';

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

  const renderSectionContent = () => {
    switch (activeSection) {
      case 'profile':
        return (
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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
            </CardContent>
          </Card>
        );

      case 'api-keys':
        return (
          <Card
            className="cursor-pointer border-border transition-colors hover:border-border"
            onClick={() => navigate('/settings/api-keys')}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="size-5" />
                API Keys
              </CardTitle>
              <CardDescription>Manage API keys for programmatic access</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" size="sm">
                Manage Keys
              </Button>
            </CardContent>
          </Card>
        );

      case 'wallet':
        return (
          <Card
            className="cursor-pointer border-border transition-colors hover:border-border"
            onClick={() => navigate('/settings/wallet')}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="size-5" />
                Wallet
              </CardTitle>
              <CardDescription>Balance, top-up, and transaction history</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" size="sm">
                View Wallet
              </Button>
            </CardContent>
          </Card>
        );

      case 'users':
        return (
          <Card
            className="cursor-pointer border-border transition-colors hover:border-border"
            onClick={() => navigate('/settings/users')}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="size-5" />
                Users & Roles
              </CardTitle>
              <CardDescription>Manage accounts and permissions</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" size="sm">
                Manage Users
              </Button>
            </CardContent>
          </Card>
        );

      case 'models':
        return (
          <Card
            className="cursor-pointer border-border transition-colors hover:border-border"
            onClick={() => navigate('/settings/models')}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wand2 className="size-5" />
                Models
              </CardTitle>
              <CardDescription>Configure AI models</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" size="sm">
                Configure Models
              </Button>
            </CardContent>
          </Card>
        );

      case 'prompts':
        return (
          <Card
            className="cursor-pointer border-border transition-colors hover:border-border"
            onClick={() => navigate('/settings/prompts')}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="size-5" />
                System Prompts
              </CardTitle>
              <CardDescription>Edit prompt templates</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" size="sm">
                Edit Prompts
              </Button>
            </CardContent>
          </Card>
        );

      case 'taxonomy-actor':
        return (
          <Card
            className="cursor-pointer border-border transition-colors hover:border-border"
            onClick={() => navigate('/settings/taxonomy/ACTOR_PROPERTY')}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Tag className="size-5" />
                Actor Properties
              </CardTitle>
              <CardDescription>Manage actor taxonomy</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" size="sm">
                Manage Taxonomy
              </Button>
            </CardContent>
          </Card>
        );

      case 'taxonomy-look':
        return (
          <Card
            className="cursor-pointer border-border transition-colors hover:border-border"
            onClick={() => navigate('/settings/taxonomy/LOOK_TAXONOMY')}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="size-5" />
                Look Taxonomy
              </CardTitle>
              <CardDescription>Manage look taxonomy</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" size="sm">
                Manage Taxonomy
              </Button>
            </CardContent>
          </Card>
        );

      case 'taxonomy-fashion':
        return (
          <Card
            className="cursor-pointer border-border transition-colors hover:border-border"
            onClick={() => navigate('/settings/taxonomy/FASHION_ITEM_TAXONOMY')}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingBag className="size-5" />
                Fashion Item Taxonomy
              </CardTitle>
              <CardDescription>Manage fashion item taxonomy</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" size="sm">
                Manage Taxonomy
              </Button>
            </CardContent>
          </Card>
        );

      case 'commission-forms':
        return (
          <Card
            className="cursor-pointer border-border transition-colors hover:border-border"
            onClick={() => navigate('/settings/commission-forms')}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="size-5" />
                Commission Forms
              </CardTitle>
              <CardDescription>Manage commission form templates</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" size="sm">
                Manage Forms
              </Button>
            </CardContent>
          </Card>
        );

      default:
        return null;
    }
  };

  return (
    <SettingsLayout
      sections={sections}
      activeSection={activeSection}
      onSectionChange={setActiveSection}
    >
      {renderSectionContent()}
    </SettingsLayout>
  );
}
