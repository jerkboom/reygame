import React, { useState } from 'react';
import { AccountTypeConfig } from '../../types';
import { Shield, Edit2, Check, RefreshCw, AlertCircle, Plus, Trash2, X, Power, PowerOff } from 'lucide-react';

interface AccountTypesTabProps {
  accountTypesList: AccountTypeConfig[];
  getAdminHeaders: () => Record<string, string>;
  onRefresh: () => Promise<void>;
  formatUSD: (val: number) => string;
}

export const AccountTypesTab: React.FC<AccountTypesTabProps> = ({
  accountTypesList,
  getAdminHeaders,
  onRefresh,
  formatUSD,
}) => {
  const [editingType, setEditingType] = useState<AccountTypeConfig | null>(null);
  const [isNewTier, setIsNewTier] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Delete confirmation modal
  const [tierToDelete, setTierToDelete] = useState<AccountTypeConfig | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [form, setForm] = useState({
    id: '',
    name: '',
    badge: '',
    description: '',
    defaultPriceUSD: 20,
    rulesText: '',
    setupInstructions: '',
    isActive: true,
    canChangeCredentials: false,
    sortOrder: 1,
  });

  const handleStartAdd = () => {
    setEditingType(null);
    setIsNewTier(true);
    setForm({
      id: `tier-${Date.now()}`,
      name: '',
      badge: 'PRO',
      description: '',
      defaultPriceUSD: 20,
      rulesText: 'Download the game to your console\nKeep account credentials secure\nDo not change email or password',
      setupInstructions: '1. Add new user on PlayStation.\n2. Enter provided credentials.\n3. Head to Game Library and install.',
      isActive: true,
      canChangeCredentials: false,
      sortOrder: accountTypesList.length + 1,
    });
    setErrorMessage('');
    setSuccessMessage('');
  };

  const handleStartEdit = (type: AccountTypeConfig) => {
    setIsNewTier(false);
    setEditingType(type);
    setForm({
      id: type.id,
      name: type.name,
      badge: type.badge,
      description: type.description,
      defaultPriceUSD: type.defaultPriceUSD,
      rulesText: Array.isArray(type.rules) ? type.rules.join('\n') : '',
      setupInstructions: type.setupInstructions || '',
      isActive: type.isActive !== false,
      canChangeCredentials: Boolean(type.canChangeCredentials),
      sortOrder: typeof type.sortOrder === 'number' ? type.sortOrder : 1,
    });
    setErrorMessage('');
    setSuccessMessage('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!form.name.trim()) {
      setErrorMessage('Tier name is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const rules = form.rulesText
        .split('\n')
        .map((r) => r.trim())
        .filter(Boolean);

      const payload = {
        name: form.name.trim(),
        badge: form.badge.trim(),
        description: form.description.trim(),
        defaultPriceUSD: Number(form.defaultPriceUSD),
        rules,
        setupInstructions: form.setupInstructions.trim(),
        isActive: form.isActive,
        canChangeCredentials: form.canChangeCredentials,
        sortOrder: Number(form.sortOrder),
      };

      if (isNewTier) {
        const res = await fetch('/api/account-types', {
          method: 'POST',
          headers: getAdminHeaders(),
          body: JSON.stringify({
            accountType: {
              ...payload,
              id: form.id || form.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
            },
            adminUser: 'Administrator',
          }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setSuccessMessage(`Account tier "${form.name}" created successfully.`);
          setIsNewTier(false);
          setEditingType(null);
          await onRefresh();
        } else {
          setErrorMessage(data.error || 'Failed to create account tier.');
        }
      } else if (editingType) {
        const res = await fetch(`/api/account-types/${editingType.id}`, {
          method: 'PUT',
          headers: getAdminHeaders(),
          body: JSON.stringify({
            updates: payload,
            adminUser: 'Administrator',
          }),
        });

        const data = await res.json();
        if (res.ok && data.success) {
          setSuccessMessage(`Account tier "${form.name}" updated successfully.`);
          setEditingType(null);
          await onRefresh();
        } else {
          setErrorMessage(data.error || 'Failed to update account tier.');
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (tier: AccountTypeConfig) => {
    try {
      const nextActive = tier.isActive === false;
      const res = await fetch(`/api/account-types/${tier.id}`, {
        method: 'PUT',
        headers: getAdminHeaders(),
        body: JSON.stringify({
          updates: { isActive: nextActive },
          adminUser: 'Administrator',
        }),
      });
      if (res.ok) {
        setSuccessMessage(`Tier "${tier.name}" is now ${nextActive ? 'Active' : 'Inactive'}.`);
        await onRefresh();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleConfirmDelete = async () => {
    if (!tierToDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/account-types/${tierToDelete.id}`, {
        method: 'DELETE',
        headers: getAdminHeaders(),
      });
      if (res.ok) {
        setSuccessMessage(`Tier "${tierToDelete.name}" deleted.`);
        setTierToDelete(null);
        await onRefresh();
      } else {
        const err = await res.json();
        setErrorMessage(err.error || 'Failed to delete account tier.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-400" />
            PlayStation Account Sharing Tiers
          </h3>
          <p className="text-slate-400 text-xs">
            Manage names, badges, catalog default pricing, setup guides, and rule configurations for customer tiers.
          </p>
        </div>

        <button
          onClick={handleStartAdd}
          className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-2 cursor-pointer self-start sm:self-auto transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Account Tier</span>
        </button>
      </div>

      {successMessage && (
        <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
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
      {tierToDelete && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-white text-sm">Delete Account Tier</h4>
                <p className="text-xs text-slate-400">Are you sure you want to remove this tier?</p>
              </div>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs space-y-1">
              <div className="font-semibold text-white">{tierToDelete.name}</div>
              <div className="text-slate-400 text-[11px]">{tierToDelete.description}</div>
              <div className="text-amber-400 text-[11px] font-mono">
                Existing orders will remain intact, but customers will no longer be able to select this tier for new purchases.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setTierToDelete(null)}
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
                <span>Delete Tier</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit / Create Modal Form */}
      {(editingType || isNewTier) && (
        <form onSubmit={handleSave} className="bg-slate-950 p-5 rounded-2xl border-2 border-blue-500/40 space-y-4">
          <div className="font-bold text-white text-xs border-b border-slate-800 pb-2 flex items-center justify-between">
            <span className="text-sm">{isNewTier ? 'Add New Account Tier' : `Edit Account Tier: ${editingType?.name}`}</span>
            <button
              type="button"
              onClick={() => {
                setEditingType(null);
                setIsNewTier(false);
              }}
              className="text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-slate-300 text-[11px] font-medium block mb-1">Tier Name *</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Primary Offline Shared"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-xs"
              />
            </div>

            <div>
              <label className="text-slate-300 text-[11px] font-medium block mb-1">Badge Label *</label>
              <input
                type="text"
                required
                value={form.badge}
                onChange={(e) => setForm({ ...form, badge: e.target.value })}
                placeholder="e.g. MOST POPULAR"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-xs"
              />
            </div>

            <div>
              <label className="text-slate-300 text-[11px] font-medium block mb-1">Default Base Price (USD) *</label>
              <input
                type="number"
                step="0.5"
                min="1"
                required
                value={form.defaultPriceUSD}
                onChange={(e) => setForm({ ...form, defaultPriceUSD: parseFloat(e.target.value) || 0 })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-xs font-mono"
              />
            </div>
          </div>

          <div>
            <label className="text-slate-300 text-[11px] font-medium block mb-1">Short Description</label>
            <input
              type="text"
              required
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Brief summary displayed under the tier option"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-xs"
            />
          </div>

          {/* Toggles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                className="rounded border-slate-700"
              />
              <span>Active in Storefront (Available for customer checkout)</span>
            </label>

            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={form.canChangeCredentials}
                onChange={(e) => setForm({ ...form, canChangeCredentials: e.target.checked })}
                className="rounded border-slate-700"
              />
              <span>Allow Customer to Change Credentials (Private accounts only)</span>
            </label>
          </div>

          <div>
            <label className="text-slate-300 text-[11px] font-medium block mb-1">
              Account Rules & Enforcement Guidelines (One per line)
            </label>
            <textarea
              rows={3}
              value={form.rulesText}
              onChange={(e) => setForm({ ...form, rulesText: e.target.value })}
              placeholder="Play on your personal profile&#10;Trophies save to your account&#10;Do not modify login details"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white font-mono text-xs"
            />
          </div>

          <div>
            <label className="text-slate-300 text-[11px] font-medium block mb-1">
              Customer Setup Instructions (Shown after fulfillment)
            </label>
            <textarea
              rows={3}
              value={form.setupInstructions}
              onChange={(e) => setForm({ ...form, setupInstructions: e.target.value })}
              placeholder="Step-by-step setup guide displayed on customer order status and delivery email"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white font-mono text-xs"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={() => {
                setEditingType(null);
                setIsNewTier(false);
              }}
              className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-xs cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold px-5 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer"
            >
              {isSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              <span>{isNewTier ? 'Create Account Tier' : 'Save Tier Settings'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Account Types Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {accountTypesList.map((acc) => {
          const isActive = acc.isActive !== false;
          return (
            <div
              key={acc.id}
              className={`bg-slate-950 p-4 rounded-xl border ${
                isActive ? 'border-slate-800' : 'border-amber-500/30 opacity-75'
              } space-y-3 flex flex-col justify-between`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm">{acc.name}</span>
                    {!isActive && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                        Inactive
                      </span>
                    )}
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-blue-600/20 text-blue-400 text-[10px] font-bold">
                    {acc.badge}
                  </span>
                </div>

                <p className="text-slate-300 text-xs">{acc.description}</p>
                <div className="font-mono text-emerald-400 text-xs font-bold">
                  Default Base Price: {formatUSD(acc.defaultPriceUSD)} USD
                </div>

                {acc.setupInstructions && (
                  <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-800/80">
                    <strong className="text-slate-300">Setup Instructions:</strong>
                    <p className="text-[10px] text-slate-400 line-clamp-2 mt-0.5 font-mono">{acc.setupInstructions}</p>
                  </div>
                )}

                <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-800/80 space-y-1">
                  <strong className="text-slate-300">Rules & Enforcement:</strong>
                  <ul className="list-disc pl-4 space-y-0.5 text-slate-400 text-[10px]">
                    {acc.rules.map((r, idx) => (
                      <li key={idx}>{r}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => handleToggleActive(acc)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                    isActive
                      ? 'text-amber-400 hover:bg-amber-500/10'
                      : 'text-emerald-400 hover:bg-emerald-500/10'
                  }`}
                  title={isActive ? 'Deactivate tier' : 'Activate tier'}
                >
                  {isActive ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                  <span>{isActive ? 'Deactivate' : 'Activate'}</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleStartEdit(acc)}
                    className="bg-slate-900 hover:bg-slate-800 text-blue-400 hover:text-blue-300 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>

                  <button
                    onClick={() => setTierToDelete(acc)}
                    className="bg-red-500/10 hover:bg-red-500/20 text-red-400 px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                    title="Delete tier"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
