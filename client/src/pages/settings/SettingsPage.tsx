/**
 * SettingsPage — role-based settings page using SettingsLayout.
 * Shows different sections based on user role.
 */
import { useState } from 'react';
import { useCurrentUser } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

export default function SettingsPage() {
  const { data: user } = useCurrentUser();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('profile');

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
                <Input defaultValue={user?.name ?? ''} disabled />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input defaultValue={user?.email ?? ''} disabled />
              </div>
              <div className="flex items-center gap-2">
                <Label>Role:</Label>
                <Badge variant={isAdmin ? 'default' : 'secondary'}>{user?.role}</Badge>
              </div>
            </CardContent>
          </Card>
        );

      case 'api-keys':
        return (
          <Card
            className="cursor-pointer border-border transition-colors hover:border-border-medium"
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
            className="cursor-pointer border-border transition-colors hover:border-border-medium"
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
            className="cursor-pointer border-border transition-colors hover:border-border-medium"
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
            className="cursor-pointer border-border transition-colors hover:border-border-medium"
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
            className="cursor-pointer border-border transition-colors hover:border-border-medium"
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
            className="cursor-pointer border-border transition-colors hover:border-border-medium"
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
            className="cursor-pointer border-border transition-colors hover:border-border-medium"
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
            className="cursor-pointer border-border transition-colors hover:border-border-medium"
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
            className="cursor-pointer border-border transition-colors hover:border-border-medium"
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
