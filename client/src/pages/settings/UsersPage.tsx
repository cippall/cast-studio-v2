/**
 * UsersPage — admin user management table using DataTable.
 * Wrapped in PageContainer for responsive padding.
 */
import { useState } from 'react';
import { useAdminUsers, useUpdateUser, type AdminUser } from '@/hooks/useAdminUsers';
import { Badge } from '@/components/ui/badge';
import { DataTable, type Column } from '@/components/DataTable';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const ROLE_OPTIONS = [
  { value: 'ADMIN', label: 'Admin' },
  { value: 'ARTIST', label: 'Artist' },
  { value: 'CLIENT', label: 'Client' },
];

export default function UsersPage() {
  const [roleFilter, setRoleFilter] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<string | null>(null);
  const [editApi, setEditApi] = useState(false);

  const { data, isLoading, isError, error } = useAdminUsers(
    roleFilter ? { role: roleFilter, pageSize: 50 } : { pageSize: 50 },
  );
  const updateUser = useUpdateUser();

  const users = data?.data ?? [];
  const editUser = users.find((u: AdminUser) => u.id === editId);

  const handleOpenEdit = (userId: string) => {
    const user = users.find((u: AdminUser) => u.id === userId);
    if (!user) return;
    setEditId(userId);
    setEditRole(user.role);
    setEditApi(user.is_api_able);
  };

  const handleSaveEdit = async () => {
    if (!editId) return;
    try {
      await updateUser.mutateAsync({
        id: editId,
        role: editRole,
        isApiAble: editApi,
      });
      toast.success('User updated');
      setEditId(null);
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error.message ?? 'Failed to update user');
    }
  };

  const columns: Column<AdminUser>[] = [
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      render: (row) => row.name,
    },
    {
      key: 'email',
      header: 'Email',
      sortable: true,
      render: (row) => row.email,
    },
    {
      key: 'role',
      header: 'Role',
      sortable: true,
      sortValue: (row) => row.role,
      render: (row) => (
        <Badge variant={row.role === 'ADMIN' ? 'default' : 'secondary'}>{row.role}</Badge>
      ),
    },
    {
      key: 'is_api_able',
      header: 'API Enabled',
      sortable: true,
      sortValue: (row) => (row.is_api_able ? 1 : 0),
      render: (row) => (
        <Badge variant={row.is_api_able ? 'default' : 'outline'}>
          {row.is_api_able ? 'Yes' : 'No'}
        </Badge>
      ),
    },
  ];

  return (
    <PageContainer>
      <div className="flex flex-col gap-6">
        <PageHeader title="Users & Roles" description="Manage accounts and permissions">
          <Select value={roleFilter ?? ''} onValueChange={(v) => setRoleFilter(v || null)}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="All roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All</SelectItem>
              {ROLE_OPTIONS.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </PageHeader>

        <DataTable<AdminUser>
          columns={columns}
          data={users}
          isLoading={isLoading}
          isError={isError}
          error={error instanceof Error ? error : null}
          emptyTitle="No users"
          emptyDescription="No users found."
          cardTitleKey="name"
          rowActions={(row) => [
            <button
              key="edit"
              className="flex w-full cursor-pointer items-center px-2 py-1.5 text-sm"
              onClick={() => handleOpenEdit(row.id)}
            >
              Edit
            </button>,
          ]}
        />

        {/* Edit dialog */}
        <Dialog open={!!editId} onOpenChange={() => setEditId(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
            </DialogHeader>
            {editUser && (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium">{editUser.name}</p>
                  <p className="text-sm text-muted-foreground">{editUser.email}</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Role</label>
                  <Select value={editRole} onValueChange={setEditRole}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="editApi"
                    checked={editApi}
                    onChange={(e) => setEditApi(e.target.checked)}
                    className="size-4"
                  />
                  <label htmlFor="editApi" className="text-sm">
                    API Access
                  </label>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditId(null)}>
                Cancel
              </Button>
              <Button onClick={handleSaveEdit} disabled={updateUser.isPending}>
                {updateUser.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : 'Save'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PageContainer>
  );
}
