/**
 * SettingsPage — role-based settings landing page.
 * Shows different tabs/sections based on user role.
 */
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

export default function SettingsPage() {
  const { data: user } = useCurrentUser();
  const navigate = useNavigate();

  const isAdmin = user?.role === 'ADMIN';
  const isArtist = user?.role === 'ARTIST' || isAdmin;
  const isClient = user?.role === 'CLIENT';

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>

      {/* Profile section */}
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

      {/* Role-specific settings */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Artist: API Keys */}
        {isArtist && (
          <Card
            className="cursor-pointer transition-shadow hover:shadow-md"
            onClick={() => navigate('/settings/api-keys')}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="size-5" />
                API Keys
              </CardTitle>
              <CardDescription>Manage API keys for programmatic access</CardDescription>
            </CardHeader>
          </Card>
        )}

        {/* Client: Wallet */}
        {isClient && (
          <Card
            className="cursor-pointer transition-shadow hover:shadow-md"
            onClick={() => navigate('/settings/wallet')}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="size-5" />
                Wallet
              </CardTitle>
              <CardDescription>Balance, top-up, and transaction history</CardDescription>
            </CardHeader>
          </Card>
        )}

        {/* Admin: Users & Roles */}
        {isAdmin && (
          <>
            <Card
              className="cursor-pointer transition-shadow hover:shadow-md"
              onClick={() => navigate('/settings/users')}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="size-5" />
                  Users & Roles
                </CardTitle>
                <CardDescription>Manage accounts and permissions</CardDescription>
              </CardHeader>
            </Card>

            <Card
              className="cursor-pointer transition-shadow hover:shadow-md"
              onClick={() => navigate('/settings/models')}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wand2 className="size-5" />
                  Models
                </CardTitle>
                <CardDescription>Configure AI models</CardDescription>
              </CardHeader>
            </Card>

            <Card
              className="cursor-pointer transition-shadow hover:shadow-md"
              onClick={() => navigate('/settings/prompts')}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="size-5" />
                  System Prompts
                </CardTitle>
                <CardDescription>Edit prompt templates</CardDescription>
              </CardHeader>
            </Card>

            <Card
              className="cursor-pointer transition-shadow hover:shadow-md"
              onClick={() => navigate('/settings/taxonomy/ACTOR_PROPERTY')}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Tag className="size-5" />
                  Actor Properties
                </CardTitle>
                <CardDescription>Manage actor taxonomy</CardDescription>
              </CardHeader>
            </Card>

            <Card
              className="cursor-pointer transition-shadow hover:shadow-md"
              onClick={() => navigate('/settings/taxonomy/LOOK_TAXONOMY')}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="size-5" />
                  Look Taxonomy
                </CardTitle>
                <CardDescription>Manage look taxonomy</CardDescription>
              </CardHeader>
            </Card>

            <Card
              className="cursor-pointer transition-shadow hover:shadow-md"
              onClick={() => navigate('/settings/taxonomy/FASHION_ITEM_TAXONOMY')}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingBag className="size-5" />
                  Fashion Item Taxonomy
                </CardTitle>
                <CardDescription>Manage fashion item taxonomy</CardDescription>
              </CardHeader>
            </Card>

            <Card
              className="cursor-pointer transition-shadow hover:shadow-md"
              onClick={() => navigate('/settings/commission-forms')}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings2 className="size-5" />
                  Commission Forms
                </CardTitle>
                <CardDescription>Manage commission form templates</CardDescription>
              </CardHeader>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
