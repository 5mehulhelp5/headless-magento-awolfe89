"use client";

import { useCallback } from "react";

/* ─── Card type detection ─── */

export type CardType = "visa" | "mastercard" | "amex" | "discover" | "jcb" | "unknown";

const CARD_PATTERNS: [CardType, RegExp][] = [
  ["amex", /^3[47]/],
  ["visa", /^4/],
  ["mastercard", /^(5[1-5]|2[2-7])/],
  ["discover", /^(6011|65|644|645|646|647|648|649)/],
  ["jcb", /^35(2[89]|[3-8])/],
];

export function detectCardType(number: string): CardType {
  const digits = number.replace(/\D/g, "");
  for (const [type, pattern] of CARD_PATTERNS) {
    if (pattern.test(digits)) return type;
  }
  return "unknown";
}

/* ─── Luhn check ─── */

export function luhnCheck(number: string): boolean {
  const digits = number.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let alternate = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i], 10);
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

/* ─── Format card number with spaces ─── */

function formatCardNumber(value: string, cardType: CardType): string {
  const digits = value.replace(/\D/g, "");
  const maxLen = cardType === "amex" ? 15 : 16;
  const trimmed = digits.slice(0, maxLen);

  if (cardType === "amex") {
    // Amex: 4-6-5
    return trimmed
      .replace(/(\d{4})(\d)/, "$1 $2")
      .replace(/(\d{4} \d{6})(\d)/, "$1 $2");
  }
  // Others: 4-4-4-4
  return trimmed.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}

/* ─── Card type label + Magento code mapping ─── */

const CARD_LABELS: Record<CardType, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "Amex",
  discover: "Discover",
  jcb: "JCB",
  unknown: "",
};

/** Magento standard CC type codes (used by Sage module: VI, MC, AE, DI, JCB) */
export const MAGENTO_CC_TYPES: Record<CardType, string> = {
  visa: "VI",
  mastercard: "MC",
  amex: "AE",
  discover: "DI",
  jcb: "JCB",
  unknown: "",
};

/* ─── Types ─── */

export interface CreditCardData {
  ccNumber: string;
  ccExpMonth: string;
  ccExpYear: string;
  ccCvv: string;
  ccType: CardType;
}

interface CreditCardFormProps {
  data: CreditCardData;
  onChange: (data: CreditCardData) => void;
}

/* ─── Validation ─── */

export function validateCreditCard(data: CreditCardData): string | null {
  const digits = data.ccNumber.replace(/\D/g, "");

  if (!digits) return "Card number is required";
  if (!luhnCheck(digits)) return "Invalid card number";

  if (!data.ccExpMonth || !data.ccExpYear) return "Expiration date is required";

  const now = new Date();
  const expMonth = parseInt(data.ccExpMonth, 10);
  const expYear = parseInt(data.ccExpYear, 10);
  if (
    expYear < now.getFullYear() ||
    (expYear === now.getFullYear() && expMonth < now.getMonth() + 1)
  ) {
    return "Card has expired";
  }

  const cvvLen = data.ccType === "amex" ? 4 : 3;
  if (!data.ccCvv || data.ccCvv.length !== cvvLen) {
    return `CVV must be ${cvvLen} digits`;
  }

  return null;
}

/* ─── Component ─── */

export default function CreditCardForm({ data, onChange }: CreditCardFormProps) {
  const handleNumberChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      const cardType = detectCardType(raw);
      const formatted = formatCardNumber(raw, cardType);
      onChange({ ...data, ccNumber: formatted, ccType: cardType });
    },
    [data, onChange],
  );

  const handleCvvChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value.replace(/\D/g, "");
      const maxLen = data.ccType === "amex" ? 4 : 3;
      onChange({ ...data, ccCvv: val.slice(0, maxLen) });
    },
    [data, onChange],
  );

  const currentYear = new Date().getFullYear();
  const months = Array.from({ length: 12 }, (_, i) =>
    String(i + 1).padStart(2, "0"),
  );
  const years = Array.from({ length: 12 }, (_, i) => String(currentYear + i));

  const inputClass =
    "w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-red-300 focus:ring-2 focus:ring-red-100";

  return (
    <div className="mt-4 space-y-4 border-t border-gray-100 pt-4">
      {/* Card number */}
      <div>
        <label className="mb-1 flex items-center gap-2 text-xs font-medium text-gray-500">
          Card Number <span className="text-red-500">*</span>
          {data.ccType !== "unknown" && (
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-600">
              {CARD_LABELS[data.ccType]}
            </span>
          )}
        </label>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="cc-number"
          value={data.ccNumber}
          onChange={handleNumberChange}
          placeholder="4111 1111 1111 1111"
          className={inputClass}
        />
      </div>

      {/* Expiry + CVV row */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">
            Month <span className="text-red-500">*</span>
          </label>
          <select
            value={data.ccExpMonth}
            onChange={(e) => onChange({ ...data, ccExpMonth: e.target.value })}
            autoComplete="cc-exp-month"
            className={inputClass}
          >
            <option value="">MM</option>
            {months.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">
            Year <span className="text-red-500">*</span>
          </label>
          <select
            value={data.ccExpYear}
            onChange={(e) => onChange({ ...data, ccExpYear: e.target.value })}
            autoComplete="cc-exp-year"
            className={inputClass}
          >
            <option value="">YYYY</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">
            CVV <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="cc-csc"
            value={data.ccCvv}
            onChange={handleCvvChange}
            placeholder={data.ccType === "amex" ? "1234" : "123"}
            maxLength={data.ccType === "amex" ? 4 : 3}
            className={inputClass}
          />
        </div>
      </div>
    </div>
  );
}
