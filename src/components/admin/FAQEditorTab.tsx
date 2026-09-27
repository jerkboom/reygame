import React, { useState } from 'react';
import { FAQItem } from '../../types';
import { Plus, Edit2, Trash2, HelpCircle, Check, RefreshCw, AlertCircle, X, Power, PowerOff } from 'lucide-react';

interface FAQEditorTabProps {
  faqsList: FAQItem[];
  getAdminHeaders: () => Record<string, string>;
  onRefresh: () => Promise<void>;
}

export const FAQEditorTab: React.FC<FAQEditorTabProps> = ({
  faqsList,
  getAdminHeaders,
  onRefresh,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editingFaq, setEditingFaq] = useState<FAQItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Delete modal
  const [faqToDelete, setFaqToDelete] = useState<FAQItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Category filter
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const [form, setForm] = useState({
    question: '',
    answer: '',
    category: 'general' as FAQItem['category'],
    sortOrder: 1,
    isActive: true,
  });

  const handleStartAdd = () => {
    setEditingFaq(null);
    setForm({
      question: '',
      answer: '',
      category: 'general',
      sortOrder: faqsList.length + 1,
      isActive: true,
    });
    setErrorMessage('');
    setSuccessMessage('');
    setIsEditing(true);
  };

  const handleStartEdit = (faq: FAQItem) => {
    setEditingFaq(faq);
    setForm({
      question: faq.question,
      answer: faq.answer,
      category: faq.category,
      sortOrder: faq.sortOrder || 1,
      isActive: (faq as any).isActive !== false,
    });
    setErrorMessage('');
    setSuccessMessage('');
    setIsEditing(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!form.question.trim() || !form.answer.trim()) {
      setErrorMessage('Question and answer are required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const url = editingFaq ? `/api/admin/faqs/${editingFaq.id}` : '/api/admin/faqs';
      const method = editingFaq ? 'PUT' : 'POST';
      const body = editingFaq ? { updates: form } : { faq: form };

      const res = await fetch(url, {
        method,
        headers: getAdminHeaders(),
        credentials: 'include',
        body: JSON.stringify({ ...body, adminUser: 'Administrator' }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMessage(editingFaq ? 'FAQ updated successfully.' : 'FAQ created successfully.');
        setIsEditing(false);
        setEditingFaq(null);
        await onRefresh();
      } else {
        setErrorMessage(data.error || 'Failed to save FAQ item.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (faq: FAQItem) => {
    try {
      const currentActive = (faq as any).isActive !== false;
      const res = await fetch(`/api/admin/faqs/${faq.id}`, {
        method: 'PUT',
        headers: getAdminHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          updates: { isActive: !currentActive },
          adminUser: 'Administrator',
        }),
      });
      if (res.ok) {
        setSuccessMessage(`FAQ is now ${!currentActive ? 'Active' : 'Hidden'}.`);
        await onRefresh();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleConfirmDelete = async () => {
    if (!faqToDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/faqs/${faqToDelete.id}`, {
        method: 'DELETE',
        headers: getAdminHeaders(),
        credentials: 'include',
      });
      if (res.ok) {
        setSuccessMessage('FAQ item deleted.');
        setFaqToDelete(null);
        await onRefresh();
      } else {
        const err = await res.json();
        setErrorMessage(err.error || 'Failed to delete FAQ.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error.');
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredFaqs = faqsList.filter((f) => {
    if (selectedCategory === 'all') return true;
    return f.category === selectedCategory;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-blue-400" />
            Frequently Asked Questions Editor
          </h3>
          <p className="text-slate-400 text-xs">
            Create, edit, toggle visibility, and categorize customer FAQs displayed on the storefront.
          </p>
        </div>

        <button
          onClick={handleStartAdd}
          className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-2 cursor-pointer self-start sm:self-auto transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add New FAQ</span>
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

      {/* Category filter pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        {['all', 'general', 'accounts', 'activation', 'payment'].map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer capitalize ${
              selectedCategory === cat
                ? 'bg-blue-600 text-white font-bold'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            {cat === 'all' ? 'All Categories' : cat}
          </button>
        ))}
      </div>

      {/* Delete Confirmation Modal */}
      {faqToDelete && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-white text-sm">Delete FAQ Item</h4>
                <p className="text-xs text-slate-400">Are you sure you want to remove this question?</p>
              </div>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs text-slate-300">
              &quot;{faqToDelete.question}&quot;
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setFaqToDelete(null)}
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
                <span>Delete FAQ</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit / Create Form Modal */}
      {isEditing && (
        <form onSubmit={handleSave} className="bg-slate-950 p-5 rounded-2xl border-2 border-blue-500/40 space-y-3">
          <div className="font-bold text-white text-xs border-b border-slate-800 pb-2 flex items-center justify-between">
            <span className="text-sm">{editingFaq ? 'Edit FAQ Item' : 'Create New FAQ Item'}</span>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-2">
              <label className="text-slate-300 text-[11px] font-medium block mb-1">Question *</label>
              <input
                type="text"
                required
                value={form.question}
                onChange={(e) => setForm({ ...form, question: e.target.value })}
                placeholder="e.g. How do I activate Primary Account on PS5?"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-xs"
              />
            </div>

            <div>
              <label className="text-slate-300 text-[11px] font-medium block mb-1">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as any })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs"
              >
                <option value="general">General</option>
                <option value="accounts">Account Types</option>
                <option value="activation">Setup & Activation</option>
                <option value="payment">Payment & Delivery</option>
              </select>
            </div>

            <div>
              <label className="text-slate-300 text-[11px] font-medium block mb-1">Display Order</label>
              <input
                type="number"
                min="1"
                value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 1 })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-xs font-mono"
              />
            </div>
          </div>

          <div>
            <label className="text-slate-300 text-[11px] font-medium block mb-1">Answer *</label>
            <textarea
              rows={4}
              required
              value={form.answer}
              onChange={(e) => setForm({ ...form, answer: e.target.value })}
              placeholder="Provide a clear, detailed answer for customers..."
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-xs font-sans"
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-800">
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                className="rounded border-slate-700"
              />
              <span>Visible in Public Storefront</span>
            </label>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
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
                <span>{editingFaq ? 'Save Changes' : 'Create FAQ'}</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* FAQ Items List */}
      <div className="space-y-2">
        {filteredFaqs.map((f) => {
          const isActive = (f as any).isActive !== false;
          return (
            <div
              key={f.id}
              className={`bg-slate-950 p-4 rounded-xl border ${
                isActive ? 'border-slate-800' : 'border-amber-500/30 opacity-70'
              } space-y-2`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-white text-xs sm:text-sm">{f.question}</span>
                  <span className="px-2 py-0.5 rounded-full bg-blue-600/20 text-blue-400 text-[10px] font-mono uppercase">
                    {f.category}
                  </span>
                  {!isActive && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                      Hidden
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleToggleActive(f)}
                    className={`p-1.5 rounded-lg text-xs transition-colors ${
                      isActive
                        ? 'text-amber-400 hover:bg-amber-500/10'
                        : 'text-emerald-400 hover:bg-emerald-500/10'
                    }`}
                    title={isActive ? 'Hide FAQ' : 'Show FAQ'}
                  >
                    {isActive ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => handleStartEdit(f)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs cursor-pointer"
                    title="Edit FAQ"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setFaqToDelete(f)}
                    className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs cursor-pointer"
                    title="Delete FAQ"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <p className="text-slate-300 text-xs whitespace-pre-line leading-relaxed">{f.answer}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
