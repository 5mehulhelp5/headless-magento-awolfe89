"use client";

import { useState, useEffect, useCallback } from "react";
import { getCustomerToken } from "@/lib/auth/token";
import {
  fetchSavedAccounts,
  updateSavedAccounts,
} from "@/lib/shipping/carrierAccounts";
import {
  CARRIER_OPTIONS,
  type SavedCarrierAccount,
  type CarrierValue,
} from "@/lib/shipping/types";

type Mode =
  | { type: "list" }
  | { type: "add" }
  | { type: "edit"; id: string };

function carrierLabel(carrier: string): string {
  return CARRIER_OPTIONS.find((c) => c.value === carrier)?.label ?? carrier;
}

function maskAccount(num: string): string {
  if (num.length <= 4) return num;
  return "****" + num.slice(-4);
}

export default function ShippingAccountsPage() {
  const [mode, setMode] = useState<Mode>({ type: "list" });
  const [accounts, setAccounts] = useState<SavedCarrierAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Form fields
  const [nickname, setNickname] = useState("");
  const [carrier, setCarrier] = useState<CarrierValue>("ups");
  const [accountNumber, setAccountNumber] = useState("");

  const loadAccounts = useCallback(async () => {
    const token = getCustomerToken();
    if (!token) {
      setError("Your session has expired. Please log in again to manage shipping accounts.");
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchSavedAccounts(token);
      setAccounts(data);
    } catch {
      setError("Failed to load shipping accounts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  function resetForm() {
    setNickname("");
    setCarrier("ups");
    setAccountNumber("");
    setError(null);
  }

  function startEdit(acct: SavedCarrierAccount) {
    setNickname(acct.nickname);
    setCarrier(acct.carrier);
    setAccountNumber(acct.accountNumber);
    setError(null);
    setMode({ type: "edit", id: acct.id });
  }

  async function handleSave() {
    if (!nickname.trim() || !accountNumber.trim()) {
      setError("Nickname and account number are required");
      return;
    }

    const token = getCustomerToken();
    if (!token) return;

    setSaving(true);
    setError(null);

    let updated: SavedCarrierAccount[];
    if (mode.type === "add") {
      updated = [
        ...accounts,
        {
          id: crypto.randomUUID(),
          nickname: nickname.trim(),
          carrier,
          accountNumber: accountNumber.trim(),
        },
      ];
    } else if (mode.type === "edit") {
      updated = accounts.map((a) =>
        a.id === mode.id
          ? { ...a, nickname: nickname.trim(), carrier, accountNumber: accountNumber.trim() }
          : a,
      );
    } else {
      return;
    }

    const ok = await updateSavedAccounts(token, updated);
    if (ok) {
      setAccounts(updated);
      resetForm();
      setMode({ type: "list" });
    } else {
      setError("Failed to save. Please try again.");
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    const token = getCustomerToken();
    if (!token) return;

    setSaving(true);
    const updated = accounts.filter((a) => a.id !== id);
    const ok = await updateSavedAccounts(token, updated);
    if (ok) {
      setAccounts(updated);
      setDeleteConfirm(null);
    } else {
      setError("Failed to delete. Please try again.");
    }
    setSaving(false);
  }

  // Loading skeleton (show error if session expired before loading finishes)
  if (loading && !error) {
    return (
      <div className="space-y-6">
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 bg-gray-900 px-5 py-3">
            <span className="h-3.5 w-[3px] rounded-sm bg-red-600" />
            <h2 className="text-xs font-semibold uppercase tracking-[1px] text-gray-400">
              Shipping Accounts
            </h2>
          </div>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="animate-pulse overflow-hidden rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <div className="space-y-3">
                <div className="h-4 w-3/4 rounded bg-gray-200" />
                <div className="h-4 w-full rounded bg-gray-200" />
                <div className="h-4 w-2/3 rounded bg-gray-200" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Add / Edit form
  if (mode.type === "add" || mode.type === "edit") {
    return (
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 bg-gray-900 px-5 py-3">
          <span className="h-3.5 w-[3px] rounded-sm bg-red-600" />
          <h2 className="text-xs font-semibold uppercase tracking-[1px] text-gray-400">
            {mode.type === "add" ? "Add Shipping Account" : "Edit Shipping Account"}
          </h2>
        </div>
        <div className="space-y-4 p-6">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">
              Nickname <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder='e.g. "Main Warehouse UPS"'
              className="w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-red-300 focus:ring-2 focus:ring-red-100"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">
              Carrier <span className="text-red-500">*</span>
            </label>
            <select
              value={carrier}
              onChange={(e) => setCarrier(e.target.value as CarrierValue)}
              className="w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none transition focus:border-red-300 focus:ring-2 focus:ring-red-100"
            >
              {CARRIER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">
              Account Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder="e.g. X12345"
              className="w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-red-300 focus:ring-2 focus:ring-red-100"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={() => {
                resetForm();
                setMode({ type: "list" });
              }}
              className="rounded-lg border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 bg-gray-900 px-5 py-3">
          <span className="h-3.5 w-[3px] rounded-sm bg-red-600" />
          <h2 className="text-xs font-semibold uppercase tracking-[1px] text-gray-400">
            Shipping Accounts
          </h2>
          {accounts.length > 0 && (
            <span className="ml-auto text-xs text-gray-500">
              {accounts.length} account{accounts.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <div className="px-5 py-3">
          <button
            onClick={() => {
              resetForm();
              setMode({ type: "add" });
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4v16m8-8H4"
              />
            </svg>
            Add Shipping Account
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {accounts.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white px-5 py-12 text-center shadow-sm">
          <svg
            className="mx-auto mb-4 h-12 w-12 text-gray-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth="1"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 17l4 4 4-4m-4-5v9M20.88 18.09A5 5 0 0018 9h-1.26A8 8 0 103 16.29"
            />
          </svg>
          <p className="text-sm font-medium text-gray-900">
            No shipping accounts saved
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Add a carrier account (UPS, FedEx) to speed up checkout.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2">
          {accounts.map((acct) => (
            <div
              key={acct.id}
              className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
            >
              <div className="p-5">
                <div className="mb-2 flex items-center gap-2">
                  <span className="inline-block rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-600">
                    {carrierLabel(acct.carrier)}
                  </span>
                </div>
                <p className="text-sm font-medium text-gray-900">
                  {acct.nickname}
                </p>
                <p className="mt-1 font-mono text-sm text-gray-500">
                  {maskAccount(acct.accountNumber)}
                </p>
              </div>

              {/* Actions */}
              <div className="flex border-t border-gray-100">
                <button
                  onClick={() => startEdit(acct)}
                  className="flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50 hover:text-gray-900"
                >
                  <svg
                    className="h-3.5 w-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth="2"
                  >
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  Edit
                </button>
                <div className="w-px bg-gray-100" />
                {deleteConfirm === acct.id ? (
                  <div className="flex flex-1 items-center justify-center gap-2 py-2.5">
                    <button
                      onClick={() => handleDelete(acct.id)}
                      disabled={saving}
                      className="text-xs font-semibold text-red-600 hover:text-red-700"
                    >
                      {saving ? "..." : "Confirm"}
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(null)}
                      className="text-xs text-gray-400 hover:text-gray-600"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeleteConfirm(acct.id)}
                    className="flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-gray-400 transition hover:bg-red-50 hover:text-red-600"
                  >
                    <svg
                      className="h-3.5 w-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      strokeWidth="2"
                    >
                      <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14" />
                    </svg>
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
