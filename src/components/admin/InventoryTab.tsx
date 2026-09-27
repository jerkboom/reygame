import React, { useState } from 'react';
import { InventoryItem, Game, AccountTypeConfig, Order, ConsoleType, AccountTypeId, AccountUsageMode } from '../../types';
import { Plus, Search, KeyRound, Eye, EyeOff, Trash2, CheckCircle2, AlertCircle, Ban, RefreshCw, Edit2, X, Users, UserCheck } from 'lucide-react';

interface InventoryTabProps {
  inventoryList: InventoryItem[];
  gamesList: Game[];
  accountTypesList: AccountTypeConfig[];
  orders: Order[];
  getAdminHeaders: () => Record<string, string>;
  onRefresh: () => Promise<void>;
  onSelectOrder?: (order: Order) => void;
}

export const InventoryTab: React.FC<InventoryTabProps> = ({
  inventoryList,
  gamesList,
  accountTypesList,
  orders,
  getAdminHeaders,
  onRefresh,
  onSelectOrder,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isAdding, setIsAdding] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Delete confirmation modal
  const [itemToDelete, setItemToDelete] = useState<InventoryItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Add form
  const [form, setForm] = useState({
    gameId: gamesList[0]?.id || '',
    console: 'PS5' as ConsoleType,
    accountTypeId: (accountTypesList[0]?.id || 'primary-shared') as AccountTypeId,
    usageMode: 'shared' as AccountUsageMode,
    maxAssignments: 2,
    accountEmail: '',
    accountPassword: '',
    backupCodes: '',
    additionalNotes: '',
    status: 'available' as 'available' | 'disabled',
  });

  // Edit form
  const [editForm, setEditForm] = useState({
    accountEmail: '',
    accountPassword: '',
    backupCodes: '',
    usageMode: 'shared' as AccountUsageMode,
    maxAssignments: 2,
    additionalNotes: '',
    status: 'available' as 'available' | 'disabled',
  });

  const availableCount = inventoryList.filter((i) => i.status === 'available').length;
  const reservedCount = inventoryList.filter((i) => i.status === 'reserved').length;
  const deliveredCount = inventoryList.filter((i) => i.status === 'delivered').length;
  const disabledCount = inventoryList.filter((i) => i.status === 'disabled').length;

  const handleAccountTypeChange = (typeId: AccountTypeId) => {
    const isExclusive = typeId === 'full-private' || typeId === 'primary-non-sharing';
    setForm((prev) => ({
      ...prev,
      accountTypeId: typeId,
      usageMode: isExclusive ? 'exclusive' : 'shared',
      maxAssignments: isExclusive ? 1 : 2,
    }));
  };

  const handleCreateInventory = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!form.gameId) {
      setErrorMessage('Please select a game.');
      return;
    }
    if (!form.accountEmail.trim() || !form.accountPassword.trim()) {
      setErrorMessage('Account email/username and password are required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({
          item: {
            gameId: form.gameId,
            console: form.console,
            accountTypeId: form.accountTypeId,
            usageMode: form.usageMode,
            maxAssignments: Number(form.maxAssignments) || (form.usageMode === 'exclusive' ? 1 : 2),
            accountEmail: form.accountEmail.trim(),
            accountPassword: form.accountPassword.trim(),
            backupCodes: form.backupCodes.trim(),
            additionalNotes: form.additionalNotes.trim(),
            status: form.status,
          },
          adminUser: 'Administrator',
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMessage(`Account for ${data.item.accountEmail} added to inventory pool.`);
        setForm({
          gameId: gamesList[0]?.id || '',
          console: 'PS5',
          accountTypeId: (accountTypesList[0]?.id || 'primary-shared') as AccountTypeId,
          usageMode: 'shared',
          maxAssignments: 2,
          accountEmail: '',
          accountPassword: '',
          backupCodes: '',
          additionalNotes: '',
          status: 'available',
        });
        setIsAdding(false);
        await onRefresh();
      } else {
        setErrorMessage(data.error || 'Failed to add inventory item.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartEdit = (item: InventoryItem) => {
    setEditingItem(item);
    const isExclusive = item.usageMode === 'exclusive' || item.accountTypeId === 'full-private' || item.accountTypeId === 'primary-non-sharing';
    setEditForm({
      accountEmail: item.accountEmail,
      accountPassword: item.accountPassword || '',
      backupCodes: (item as any).backupCodes || '',
      usageMode: item.usageMode || (isExclusive ? 'exclusive' : 'shared'),
      maxAssignments: item.maxAssignments ?? (isExclusive ? 1 : 2),
      additionalNotes: item.additionalNotes || '',
      status: item.status === 'disabled' ? 'disabled' : 'available',
    });
    setErrorMessage('');
    setSuccessMessage('');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    setErrorMessage('');
    setSuccessMessage('');

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/inventory/${editingItem.id}`, {
        method: 'PUT',
        headers: getAdminHeaders(),
        body: JSON.stringify({
          updates: {
            accountEmail: editForm.accountEmail.trim(),
            accountPassword: editForm.accountPassword.trim(),
            backupCodes: editForm.backupCodes.trim(),
            usageMode: editForm.usageMode,
            maxAssignments: Number(editForm.maxAssignments) || 1,
            additionalNotes: editForm.additionalNotes.trim(),
            status: editForm.status,
          },
          adminUser: 'Administrator',
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMessage(`Credentials for ${editForm.accountEmail} updated.`);
        setEditingItem(null);
        await onRefresh();
      } else {
        setErrorMessage(data.error || 'Failed to update credentials.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (item: InventoryItem) => {
    if (item.status === 'reserved' || item.status === 'delivered') {
      setErrorMessage(`Cannot toggle status of an item that is currently "${item.status}".`);
      return;
    }
    const nextStatus = item.status === 'available' ? 'disabled' : 'available';
    try {
      const res = await fetch(`/api/inventory/${item.id}`, {
        method: 'PUT',
        headers: getAdminHeaders(),
        body: JSON.stringify({
          updates: { status: nextStatus },
          adminUser: 'Administrator',
        }),
      });
      if (res.ok) {
        setSuccessMessage(`Item status updated to "${nextStatus}".`);
        await onRefresh();
      } else {
        const err = await res.json();
        setErrorMessage(err.error || 'Failed to update item status');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error.');
    }
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/inventory/${itemToDelete.id}`, {
        method: 'DELETE',
        headers: getAdminHeaders(),
      });
      if (res.ok) {
        setSuccessMessage(`Credential deleted from stock.`);
        setItemToDelete(null);
        await onRefresh();
      } else {
        const err = await res.json();
        setErrorMessage(err.error || 'Failed to delete credential.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error.');
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredInventory = inventoryList.filter((item) => {
    if (statusFilter !== 'ALL' && item.status !== statusFilter.toLowerCase()) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const game = gamesList.find((g) => g.id === item.gameId);
      return (
        item.accountEmail.toLowerCase().includes(q) ||
        (game && game.title.toLowerCase().includes(q)) ||
        (item.assignedOrderId && item.assignedOrderId.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Header & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-blue-400" />
            PlayStation Account Inventory Pool
          </h3>
          <p className="text-slate-400 text-xs">
            Stock pre-configured PSN credentials to expedite customer order fulfillment.
          </p>
        </div>

        <button
          onClick={() => setIsAdding(!isAdding)}
          className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-2 cursor-pointer self-start sm:self-auto transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>{isAdding ? 'Close Form' : 'Add Account to Stock'}</span>
        </button>
      </div>

      {/* Metric Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
          <div className="text-slate-400 text-[11px]">Available Stock</div>
          <div className="text-emerald-400 font-bold text-lg font-mono">{availableCount}</div>
        </div>
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
          <div className="text-slate-400 text-[11px]">Reserved (In Progress)</div>
          <div className="text-amber-400 font-bold text-lg font-mono">{reservedCount}</div>
        </div>
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
          <div className="text-slate-400 text-[11px]">Delivered to Orders</div>
          <div className="text-blue-400 font-bold text-lg font-mono">{deliveredCount}</div>
        </div>
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
          <div className="text-slate-400 text-[11px]">Disabled / Inactive</div>
          <div className="text-slate-400 font-bold text-lg font-mono">{disabledCount}</div>
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 bg-red-500/15 border border-red-500/30 rounded-xl text-red-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-white text-sm">Delete Account Credential</h4>
                <p className="text-xs text-slate-400">Are you sure you want to remove this account from stock?</p>
              </div>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs font-mono text-slate-300">
              {itemToDelete.accountEmail}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer"
              >
                {isDeleting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>Delete Credential</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Credential Modal */}
      {editingItem && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSaveEdit} className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h4 className="font-bold text-white text-sm">Edit Inventory Credential</h4>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-slate-300 text-[11px] font-medium block mb-1">PSN Email / Username *</label>
                <input
                  type="text"
                  required
                  value={editForm.accountEmail}
                  onChange={(e) => setEditForm({ ...editForm, accountEmail: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white font-mono text-xs"
                />
              </div>

              <div>
                <label className="text-slate-300 text-[11px] font-medium block mb-1">Account Password *</label>
                <div className="relative">
                  <input
                    type={showEditPassword ? 'text' : 'password'}
                    required
                    value={editForm.accountPassword}
                    onChange={(e) => setEditForm({ ...editForm, accountPassword: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white font-mono text-xs pr-8"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPassword(!showEditPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showEditPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-slate-300 text-[11px] font-medium block mb-1">Backup Codes (Optional)</label>
                <input
                  type="text"
                  value={editForm.backupCodes}
                  onChange={(e) => setEditForm({ ...editForm, backupCodes: e.target.value })}
                  placeholder="e.g. 12345678, 87654321"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white font-mono text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 text-[11px] font-medium block mb-1">Account Sharing Mode</label>
                  <select
                    value={editForm.usageMode}
                    onChange={(e) => {
                      const mode = e.target.value as AccountUsageMode;
                      setEditForm({
                        ...editForm,
                        usageMode: mode,
                        maxAssignments: mode === 'exclusive' ? 1 : Math.max(2, editForm.maxAssignments),
                      });
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs"
                  >
                    <option value="shared">Shared (Multiple Customers Allowed)</option>
                    <option value="exclusive">Exclusive (Single Customer Only)</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 text-[11px] font-medium block mb-1">Max Customer Slots (Capacity)</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={editForm.maxAssignments}
                    onChange={(e) => setEditForm({ ...editForm, maxAssignments: Number(e.target.value) || 1 })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white font-mono text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 text-[11px] font-medium block mb-1">Status</label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs"
                  >
                    <option value="available">Available (In Stock)</option>
                    <option value="disabled">Disabled</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 text-[11px] font-medium block mb-1">Internal Notes</label>
                  <input
                    type="text"
                    value={editForm.additionalNotes}
                    onChange={(e) => setEditForm({ ...editForm, additionalNotes: e.target.value })}
                    placeholder="e.g. Purchased from US PSN Store"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold px-5 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer"
              >
                {isSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                <span>Save Credentials</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add Item Form */}
      {isAdding && (
        <form onSubmit={handleCreateInventory} className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
          <div className="font-bold text-white text-xs border-b border-slate-800 pb-2">
            Add New PSN Account to Inventory Pool
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-slate-300 text-[11px] font-medium block mb-1">Game Title</label>
              <select
                value={form.gameId}
                onChange={(e) => setForm({ ...form, gameId: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs"
              >
                {gamesList.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-slate-300 text-[11px] font-medium block mb-1">Console Platform</label>
              <select
                value={form.console}
                onChange={(e) => setForm({ ...form, console: e.target.value as ConsoleType })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs"
              >
                <option value="PS5">PlayStation 5</option>
                <option value="PS4">PlayStation 4</option>
              </select>
            </div>

            <div>
              <label className="text-slate-300 text-[11px] font-medium block mb-1">Account Sharing Tier</label>
              <select
                value={form.accountTypeId}
                onChange={(e) => handleAccountTypeChange(e.target.value as AccountTypeId)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs"
              >
                {accountTypesList.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({acc.badge})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-slate-300 text-[11px] font-medium block mb-1">Sharing Mode</label>
              <select
                value={form.usageMode}
                onChange={(e) => {
                  const mode = e.target.value as AccountUsageMode;
                  setForm({
                    ...form,
                    usageMode: mode,
                    maxAssignments: mode === 'exclusive' ? 1 : Math.max(2, form.maxAssignments),
                  });
                }}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs"
              >
                <option value="shared">Shared (Multiple Customers Allowed)</option>
                <option value="exclusive">Exclusive (Solo Customer Only)</option>
              </select>
            </div>

            <div>
              <label className="text-slate-300 text-[11px] font-medium block mb-1">Capacity (Max Customer Slots)</label>
              <input
                type="number"
                min={1}
                max={10}
                value={form.maxAssignments}
                onChange={(e) => setForm({ ...form, maxAssignments: Number(e.target.value) || 1 })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white font-mono text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-slate-300 text-[11px] font-medium block mb-1">
                PSN Email / Username <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={form.accountEmail}
                onChange={(e) => setForm({ ...form, accountEmail: e.target.value })}
                placeholder="e.g. psn.vault.ea26@gmail.com"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white font-mono text-xs"
              />
            </div>

            <div>
              <label className="text-slate-300 text-[11px] font-medium block mb-1">
                Account Password <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={form.accountPassword}
                  onChange={(e) => setForm({ ...form, accountPassword: e.target.value })}
                  placeholder="PSN password"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white font-mono text-xs pr-8"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-slate-300 text-[11px] font-medium block mb-1">
                Backup Codes (Optional)
              </label>
              <input
                type="text"
                value={form.backupCodes}
                onChange={(e) => setForm({ ...form, backupCodes: e.target.value })}
                placeholder="e.g. 2FA backup codes"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white font-mono text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-slate-300 text-[11px] font-medium block mb-1">Initial Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as any })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs"
              >
                <option value="available">Available (Active in Stock)</option>
                <option value="disabled">Disabled (Do not assign)</option>
              </select>
            </div>

            <div>
              <label className="text-slate-300 text-[11px] font-medium block mb-1">Internal Notes (Optional)</label>
              <input
                type="text"
                value={form.additionalNotes}
                onChange={(e) => setForm({ ...form, additionalNotes: e.target.value })}
                placeholder="e.g. Purchased from US PSN Store with EA Play"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-xs"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white text-xs cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold px-4 py-1.5 rounded-lg text-xs flex items-center gap-1.5 cursor-pointer"
            >
              {isSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              <span>Save Account to Pool</span>
            </button>
          </div>
        </form>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by PSN email, game title, or order #..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-white text-xs focus:border-blue-500"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs"
        >
          <option value="ALL">All Statuses ({inventoryList.length})</option>
          <option value="AVAILABLE">Available ({availableCount})</option>
          <option value="RESERVED">Reserved ({reservedCount})</option>
          <option value="DELIVERED">Delivered ({deliveredCount})</option>
          <option value="DISABLED">Disabled ({disabledCount})</option>
        </select>
      </div>

      {/* Inventory Items Table */}
      <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/60 text-slate-400 uppercase text-[10px] font-semibold border-b border-slate-800">
              <tr>
                <th className="p-3">Game & Console</th>
                <th className="p-3">Account Tier</th>
                <th className="p-3">PSN Username</th>
                <th className="p-3">Mode & Capacity</th>
                <th className="p-3">Status</th>
                <th className="p-3">Customer Assignments</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredInventory.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    No account inventory found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredInventory.map((item) => {
                  const game = gamesList.find((g) => g.id === item.gameId);
                  const accType = accountTypesList.find((a) => a.id === item.accountTypeId);
                  const isShared = item.usageMode === 'shared';
                  const maxCap = item.maxAssignments || (isShared ? 2 : 1);
                  const activeAssignments = item.assignments || [];
                  const activeCount = activeAssignments.length > 0 ? activeAssignments.length : (item.assignedOrderId ? 1 : 0);

                  return (
                    <tr key={item.id} className="hover:bg-slate-900/50">
                      <td className="p-3">
                        <div className="font-bold text-white">{game ? game.title : item.gameId}</div>
                        <div className="text-[10px] text-slate-400">{item.console}</div>
                      </td>

                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-full bg-blue-600/20 text-blue-300 text-[10px] font-semibold">
                          {accType?.name || item.accountTypeId}
                        </span>
                      </td>

                      <td className="p-3 font-mono text-slate-300">
                        <div>{item.accountEmail}</div>
                        {item.additionalNotes && (
                          <div className="text-[10px] text-slate-500 italic">{item.additionalNotes}</div>
                        )}
                      </td>

                      <td className="p-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          {isShared ? (
                            <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[10px] font-medium flex items-center gap-1">
                              <Users className="w-3 h-3" /> Shared
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-medium flex items-center gap-1">
                              <UserCheck className="w-3 h-3" /> Exclusive
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {activeCount} / {maxCap} slots used
                        </div>
                      </td>

                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            item.status === 'available'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : item.status === 'reserved'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : item.status === 'delivered'
                              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>

                      <td className="p-3 font-mono text-[11px]">
                        {activeAssignments.length > 0 ? (
                          <div className="space-y-1">
                            {activeAssignments.map((a, idx) => {
                              const ord = orders.find((o) => o.id === a.orderId);
                              return (
                                <div key={idx} className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => ord && onSelectOrder && onSelectOrder(ord)}
                                    className="text-blue-400 hover:underline cursor-pointer font-bold"
                                    title={`Assigned to ${a.customerEmail || 'Customer'}`}
                                  >
                                    #{a.orderNumber || ord?.orderNumber || a.orderId.slice(0, 8)}
                                  </button>
                                  <span className={`text-[9px] px-1 py-0.2 rounded ${
                                    a.status === 'delivered' ? 'bg-blue-500/20 text-blue-300' : 'bg-amber-500/20 text-amber-300'
                                  }`}>
                                    {a.status}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        ) : item.assignedOrderId ? (
                          (() => {
                            const assignedOrd = orders.find((o) => o.id === item.assignedOrderId);
                            return assignedOrd ? (
                              <button
                                onClick={() => onSelectOrder && onSelectOrder(assignedOrd)}
                                className="text-blue-400 hover:underline cursor-pointer font-bold"
                              >
                                #{assignedOrd.orderNumber}
                              </button>
                            ) : (
                              <span className="text-slate-400">#{item.assignedOrderId}</span>
                            );
                          })()
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>

                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleStartEdit(item)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                            title="Edit credential and capacity"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleToggleStatus(item)}
                            className={`p-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                              item.status === 'available'
                                ? 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                                : 'bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30'
                            }`}
                            title={item.status === 'available' ? 'Disable credential' : 'Make Available'}
                          >
                            {item.status === 'available' ? <Ban className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                          </button>

                          <button
                            onClick={() => setItemToDelete(item)}
                            className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 cursor-pointer"
                            title="Delete from stock"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
