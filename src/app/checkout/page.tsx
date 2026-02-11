"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { proxyMagentoImage } from "@/lib/magento/mediaUrl";
import { useMutation, useQuery } from "@apollo/client/react";
import { getCartToken, clearCartToken } from "@/lib/cart/cartToken";
import { isLoggedIn, getCustomerToken } from "@/lib/auth/token";
import { CHECKOUT_CART_QUERY } from "@/lib/graphql/queries/checkout";
import { CUSTOMER_QUERY } from "@/lib/graphql/queries/customer";
import {
  COUNTRY_REGIONS_QUERY,
  type Region,
} from "@/lib/graphql/queries/regions";
import { formatPrice } from "@/lib/formatPrice";
import {
  SET_GUEST_EMAIL,
  SET_SHIPPING_ADDRESS,
  SET_SHIPPING_METHOD,
  SET_BILLING_ADDRESS,
  SET_PAYMENT_METHOD,
  PLACE_ORDER,
} from "@/lib/graphql/mutations/checkout";
import {
  formatPhone,
  formatZip,
  validatePhoneRequired,
  validateZip,
  validateEmail,
} from "@/lib/validation";
import CreditCardForm, {
  type CreditCardData,
  validateCreditCard,
  MAGENTO_CC_TYPES,
} from "@/components/checkout/CreditCardForm";
import CarrierAccountForm, {
  type CarrierFormData,
} from "@/components/checkout/CarrierAccountForm";
import type { SavedCarrierAccount, CarrierValue } from "@/lib/shipping/types";
import {
  fetchSavedAccounts,
  updateSavedAccounts,
  getLocalAccounts,
  saveLocalAccounts,
} from "@/lib/shipping/carrierAccounts";
import Link from "next/link";

/* ─── reCAPTCHA config (from Sage payment module) ─── */
const RECAPTCHA_SITE_KEY = "6LdnJmgsAAAAABxtxQ6aJrNsJLe9MAAm7MmTNJvy";

/* ─── Types ─── */

interface ShippingMethod {
  carrier_code: string;
  carrier_title: string;
  method_code: string;
  method_title: string;
  amount: { value: number; currency: string };
  price_excl_tax: { value: number; currency: string };
  available: boolean;
}

/* ─── Input component ─── */

function Field({
  label,
  name,
  value,
  onChange,
  type = "text",
  required = true,
  placeholder,
  colSpan,
  autoComplete,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (name: string, value: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  colSpan?: string;
  autoComplete?: string;
}) {
  return (
    <div className={colSpan || ""}>
      <label className="mb-1 block text-xs font-medium text-gray-500">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={(e) => onChange(name, e.target.value)}
        required={required}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-red-300 focus:ring-2 focus:ring-red-100"
      />
    </div>
  );
}

/* ─── Main checkout ─── */

export default function CheckoutPage() {
  const router = useRouter();
  const [cartId, setCartId] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sameAsBilling, setSameAsBilling] = useState(true);

  // Form data
  const [form, setForm] = useState({
    email: "",
    firstname: "",
    lastname: "",
    street0: "",
    street1: "",
    city: "",
    region: "",
    postcode: "",
    country: "US",
    telephone: "",
  });

  const [billingForm, setBillingForm] = useState({ ...form });
  const [selectedShipping, setSelectedShipping] = useState("");
  const [selectedPayment, setSelectedPayment] = useState("");
  const [shippingMethods, setShippingMethods] = useState<ShippingMethod[]>([]);
  const [addressSaved, setAddressSaved] = useState(false);

  // Credit card state
  const [ccData, setCcData] = useState<CreditCardData>({
    ccNumber: "",
    ccExpMonth: "",
    ccExpYear: "",
    ccCvv: "",
    ccType: "unknown",
  });

  // reCAPTCHA state (required by Sage payment module)
  const recaptchaRef = useRef<HTMLDivElement>(null);
  const recaptchaWidgetId = useRef<number | null>(null);
  const [recaptchaToken, setRecaptchaToken] = useState("");
  const [recaptchaReady, setRecaptchaReady] = useState(false);

  const [customerLoggedIn, setCustomerLoggedIn] = useState(false);

  // PO Number & Carrier account state
  const [poNumber, setPoNumber] = useState("");
  const [carrierData, setCarrierData] = useState<CarrierFormData>({
    carrier: "ups" as CarrierValue,
    accountNumber: "",
    savedAccountId: "",
  });
  const [savedAccounts, setSavedAccounts] = useState<SavedCarrierAccount[]>([]);
  const [saveNewAccount, setSaveNewAccount] = useState(false);

  useEffect(() => {
    setCartId(getCartToken());
    setCustomerLoggedIn(isLoggedIn());
  }, []);

  // Load reCAPTCHA script
  useEffect(() => {
    if (typeof window === "undefined") return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).grecaptcha?.render) {
      setRecaptchaReady(true);
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).onRecaptchaLoad = () => setRecaptchaReady(true);
    const script = document.createElement("script");
    script.src = "https://www.google.com/recaptcha/api.js?onload=onRecaptchaLoad&render=explicit";
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  }, []);

  // Render reCAPTCHA widget when ready and CC method selected
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const grecaptcha = (window as any).grecaptcha;
    if (!recaptchaReady || !grecaptcha?.render || !recaptchaRef.current) return;
    if (recaptchaWidgetId.current !== null) return;
    recaptchaWidgetId.current = grecaptcha.render(recaptchaRef.current, {
      sitekey: RECAPTCHA_SITE_KEY,
      callback: (token: string) => setRecaptchaToken(token),
      "expired-callback": () => setRecaptchaToken(""),
    });
  }, [recaptchaReady, addressSaved, selectedPayment]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, loading: cartLoading } = useQuery<any>(CHECKOUT_CART_QUERY, {
    variables: { cartId: cartId || "" },
    skip: !cartId,
    fetchPolicy: "network-only",
  });

  // Fetch US regions for state dropdowns
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: countryData } = useQuery<any>(COUNTRY_REGIONS_QUERY, {
    variables: { countryId: "US" },
    fetchPolicy: "cache-first",
  });
  const usRegions: Region[] = countryData?.country?.available_regions || [];

  // Fetch customer data for address prefill
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: customerData } = useQuery<any>(CUSTOMER_QUERY, {
    skip: !customerLoggedIn,
    fetchPolicy: "cache-first",
  });

  // Prefill form with customer's default shipping address
  useEffect(() => {
    if (!customerData?.customer) return;
    const customer = customerData.customer;
    const defaultAddr =
      customer.addresses?.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (a: any) => a.default_shipping,
      ) || customer.addresses?.[0];

    setForm((prev) => {
      // Only prefill if form is still empty (user hasn't typed anything)
      if (prev.email || prev.firstname) return prev;
      return {
        email: customer.email || "",
        firstname: defaultAddr?.firstname || customer.firstname || "",
        lastname: defaultAddr?.lastname || customer.lastname || "",
        street0: defaultAddr?.street?.[0] || "",
        street1: defaultAddr?.street?.[1] || "",
        city: defaultAddr?.city || "",
        region: defaultAddr?.region?.region_code || defaultAddr?.region?.region || "",
        postcode: defaultAddr?.postcode || "",
        country: defaultAddr?.country_code || "US",
        telephone: defaultAddr?.telephone || "",
      };
    });
  }, [customerData]);

  // Load saved carrier accounts (API for logged-in, localStorage for guests)
  useEffect(() => {
    if (customerLoggedIn) {
      const token = getCustomerToken();
      if (token) {
        fetchSavedAccounts(token).then(setSavedAccounts).catch(() => {});
      }
    } else {
      setSavedAccounts(getLocalAccounts());
    }
  }, [customerLoggedIn]);

  // Mutations
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [setGuestEmail] = useMutation<any>(SET_GUEST_EMAIL);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [setShippingAddress, { loading: savingAddress }] = useMutation<any>(SET_SHIPPING_ADDRESS);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [setShippingMethod, { loading: savingShipping }] = useMutation<any>(SET_SHIPPING_METHOD);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [setBillingAddress] = useMutation<any>(SET_BILLING_ADDRESS);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [setPaymentMethod] = useMutation<any>(SET_PAYMENT_METHOD);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [placeOrder] = useMutation<any>(PLACE_ORDER);

  const updateForm = useCallback(
    (name: string, value: string) => {
      if (name === "telephone") {
        setForm((f) => ({ ...f, telephone: formatPhone(value) }));
      } else if (name === "postcode") {
        setForm((f) => ({ ...f, postcode: formatZip(value) }));
      } else {
        setForm((f) => ({ ...f, [name]: value }));
      }
    },
    [],
  );
  const updateBillingForm = useCallback(
    (name: string, value: string) => {
      if (name === "telephone") {
        setBillingForm((f) => ({ ...f, telephone: formatPhone(value) }));
      } else if (name === "postcode") {
        setBillingForm((f) => ({ ...f, postcode: formatZip(value) }));
      } else {
        setBillingForm((f) => ({ ...f, [name]: value }));
      }
    },
    [],
  );

  // Save address & get shipping methods
  async function handleSaveAddress() {
    setError(null);

    // Client-side validation
    const emailErr = validateEmail(form.email);
    if (emailErr) { setError(emailErr); return; }
    const phoneErr = validatePhoneRequired(form.telephone);
    if (phoneErr) { setError(phoneErr); return; }
    const zipErr = validateZip(form.postcode);
    if (zipErr) { setError(zipErr); return; }
    if (!form.region) { setError("Please select a state"); return; }

    try {
      // Guest carts need email set explicitly; logged-in customers already have it
      if (!customerLoggedIn) {
        await setGuestEmail({
          variables: { cartId, email: form.email },
        });
      }

      const addr = {
        firstname: form.firstname,
        lastname: form.lastname,
        street: [form.street0, form.street1].filter(Boolean),
        city: form.city,
        region: form.region,
        postcode: form.postcode,
        country_code: form.country,
        telephone: form.telephone,
      };

      const { data: shippingData } = await setShippingAddress({
        variables: { cartId, address: addr },
      });

      const methods: ShippingMethod[] =
        shippingData?.setShippingAddressesOnCart?.cart?.shipping_addresses?.[0]
          ?.available_shipping_methods || [];
      console.log("[Checkout] Available shipping methods:", methods.map((m) => `${m.carrier_code}|${m.method_code} (${m.carrier_title})`));
      setShippingMethods(methods.filter((m: ShippingMethod) => m.available));
      setAddressSaved(true);

      // Auto-select: prefer freeshipping (TBD) if available, else first available
      const available = methods.filter((m: ShippingMethod) => m.available);
      if (available.length > 0) {
        const preferred = available.find((m) => m.carrier_code === "freeshipping") || available[0];
        setSelectedShipping(`${preferred.carrier_code}|${preferred.method_code}`);
        await setShippingMethod({
          variables: {
            cartId,
            carrierCode: preferred.carrier_code,
            methodCode: preferred.method_code,
          },
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save address");
    }
  }

  // When user changes shipping method
  async function handleShippingMethodChange(key: string) {
    setSelectedShipping(key);
    const [carrierCode, methodCode] = key.split("|");
    try {
      await setShippingMethod({
        variables: { cartId, carrierCode, methodCode },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set shipping method");
    }
  }

  // Derived: is "Ship on My Account" selected?
  const isShipOnMyAccount =
    selectedShipping.startsWith("ups|") || selectedShipping.startsWith("flatrate|");

  // The underlying Magento carrier_code to use for "Ship on My Account"
  // We pick whichever is available (ups preferred, flatrate fallback)
  const shipOnMyAccountMethod = shippingMethods.find(
    (m) => m.carrier_code === "ups" || m.carrier_code === "flatrate",
  );

  // Determine if the selected payment method requires credit card fields
  const effectivePayment =
    selectedPayment || data?.cart?.available_payment_methods?.[0]?.code || "";
  const isCcMethod = effectivePayment === "cps_sagepayments";

  // Save a new carrier account (called after order placement)
  async function saveCarrierAccount() {
    const newAcct: SavedCarrierAccount = {
      id: crypto.randomUUID(),
      carrier: carrierData.carrier,
      accountNumber: carrierData.accountNumber,
      nickname: `${carrierData.carrier.toUpperCase()} ${carrierData.accountNumber}`,
    };
    const updated = [...savedAccounts, newAcct];
    if (customerLoggedIn) {
      const token = getCustomerToken();
      if (token) await updateSavedAccounts(token, updated).catch(() => {});
    } else {
      saveLocalAccounts(updated);
    }
  }

  // Place the order
  async function handlePlaceOrder() {
    setError(null);

    const paymentCode = effectivePayment;

    // Validate CC data if paying by credit card
    if (isCcMethod) {
      const ccError = validateCreditCard(ccData);
      if (ccError) {
        setError(ccError);
        return;
      }
      if (!recaptchaToken) {
        setError("Please complete the reCAPTCHA verification");
        return;
      }
    }

    setPlacing(true);

    const billingAddr = sameAsBilling ? form : billingForm;
    const billingRegion = usRegions.find(
      (r) => r.code === billingAddr.region,
    );

    try {
      if (isCcMethod) {
        // ── CC payment via REST API (Sage/Paya module) ──
        const ccDigits = ccData.ccNumber.replace(/\D/g, "");
        const customerToken = getCustomerToken();

        const res = await fetch("/api/checkout/place-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cartId,
            customerToken: customerToken || undefined,
            email: form.email,
            paymentMethod: {
              code: paymentCode,
              additional_data: {
                cc_number: ccDigits,
                cc_exp_month: ccData.ccExpMonth,
                cc_exp_year: ccData.ccExpYear,
                cc_cid: ccData.ccCvv,
                cc_type: MAGENTO_CC_TYPES[ccData.ccType],
                cc_owner: `${billingAddr.firstname} ${billingAddr.lastname}`,
                sage_pmnt_meth_option: "",
                new_use_bill_addr: "1",
                grecaptcha_response: recaptchaToken,
              },
            },
            billingAddress: {
              firstname: billingAddr.firstname,
              lastname: billingAddr.lastname,
              street: [billingAddr.street0, billingAddr.street1].filter(Boolean),
              city: billingAddr.city,
              region_code: billingAddr.region,
              region_id: billingRegion?.id,
              postcode: billingAddr.postcode,
              country_id: billingAddr.country,
              telephone: billingAddr.telephone,
            },
            poNumber: poNumber || undefined,
            carrierInfo: isShipOnMyAccount
              ? { carrier: carrierData.carrier, accountNumber: carrierData.accountNumber }
              : undefined,
          }),
        });

        const result = await res.json();
        if (!res.ok) {
          throw new Error(result.error || "Failed to place order");
        }

        // Save new carrier account if requested
        if (isShipOnMyAccount && saveNewAccount && !carrierData.savedAccountId) {
          await saveCarrierAccount();
        }

        clearCartToken();
        window.dispatchEvent(new Event("cart-change"));
        router.push(`/checkout/success?order=${result.orderNumber || ""}`);
      } else {
        // ── Non-CC payment (Bill Me / other) via GraphQL ──
        await setBillingAddress({
          variables: {
            cartId,
            address: {
              firstname: billingAddr.firstname,
              lastname: billingAddr.lastname,
              street: [billingAddr.street0, billingAddr.street1].filter(Boolean),
              city: billingAddr.city,
              region: billingAddr.region,
              postcode: billingAddr.postcode,
              country_code: billingAddr.country,
              telephone: billingAddr.telephone,
            },
          },
        });

        await setPaymentMethod({
          variables: { cartId, paymentCode },
        });

        const { data: orderData } = await placeOrder({
          variables: { cartId },
        });

        const orderNumber = orderData?.placeOrder?.order?.order_number;

        // Post PO + carrier info as order comment (best-effort)
        const commentLines: string[] = [];
        if (poNumber) commentLines.push(`PO Number: ${poNumber}`);
        if (isShipOnMyAccount && carrierData.accountNumber) {
          const label = carrierData.carrier?.toUpperCase() || "OTHER";
          commentLines.push(`Ship on Customer Account: ${label} #${carrierData.accountNumber}`);
        }
        if (orderNumber && commentLines.length > 0) {
          fetch("/api/checkout/order-comment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderNumber, comment: commentLines.join("\n") }),
          }).catch(() => {});
        }

        // Save new carrier account if requested
        if (isShipOnMyAccount && saveNewAccount && !carrierData.savedAccountId) {
          await saveCarrierAccount();
        }

        clearCartToken();
        window.dispatchEvent(new Event("cart-change"));
        router.push(`/checkout/success?order=${orderNumber || ""}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to place order");
      setPlacing(false);
      // Reset reCAPTCHA so user can retry
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (recaptchaWidgetId.current !== null && (window as any).grecaptcha) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).grecaptcha.reset(recaptchaWidgetId.current);
        setRecaptchaToken("");
      }
    }
  }

  // Validate form is complete enough to place order
  const billingValid =
    sameAsBilling ||
    (billingForm.firstname &&
      billingForm.lastname &&
      billingForm.street0 &&
      billingForm.city &&
      billingForm.region &&
      billingForm.postcode &&
      billingForm.telephone);

  const ccValid =
    !isCcMethod ||
    (ccData.ccNumber.replace(/\D/g, "").length >= 13 &&
      ccData.ccExpMonth &&
      ccData.ccExpYear &&
      ccData.ccCvv.length >= 3 &&
      recaptchaToken);

  const carrierValid =
    !isShipOnMyAccount || !!carrierData.accountNumber;

  const canPlaceOrder =
    addressSaved &&
    selectedShipping &&
    form.email &&
    form.firstname &&
    form.lastname &&
    form.street0 &&
    form.city &&
    form.region &&
    form.postcode &&
    form.telephone &&
    billingValid &&
    ccValid &&
    carrierValid;

  // Debug: log what's blocking Place Order
  if (addressSaved && !canPlaceOrder) {
    console.log("[Checkout] Place Order blocked:", {
      selectedShipping: !!selectedShipping,
      formComplete: !!(form.email && form.firstname && form.lastname && form.street0 && form.city && form.region && form.postcode && form.telephone),
      billingValid: !!billingValid,
      ccValid: !!ccValid,
      carrierValid: !!carrierValid,
      isCcMethod,
      effectivePayment,
      recaptchaToken: !!recaptchaToken,
    });
  }

  // ─── Render ───

  if (!cartId || (!cartLoading && !data?.cart?.items?.length)) {
    return (
      <div className="bg-gray-50 pb-16">
        <div className="bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800">
          <div className="mx-auto max-w-7xl px-4 py-10">
            <h1 className="text-3xl font-bold text-white">Checkout</h1>
          </div>
        </div>
        <div className="mx-auto max-w-xl px-4 pt-12 text-center">
          <p className="mb-6 text-gray-600">Your cart is empty.</p>
          <Link
            href="/"
            className="inline-block rounded-lg bg-red-600 px-6 py-3 text-sm font-semibold text-white hover:bg-red-700"
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    );
  }

  if (cartLoading) {
    return (
      <div className="bg-gray-50 pb-16">
        <div className="bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800">
          <div className="mx-auto max-w-7xl px-4 py-10">
            <h1 className="text-3xl font-bold text-white">Checkout</h1>
          </div>
        </div>
        <div className="mx-auto max-w-7xl px-4 pt-12">
          <div className="animate-pulse space-y-6">
            <div className="h-48 rounded-xl bg-gray-200" />
            <div className="h-64 rounded-xl bg-gray-200" />
          </div>
        </div>
      </div>
    );
  }

  const cart = data.cart;
  const subtotal = cart.prices?.subtotal_excluding_tax?.value || 0;
  const grandTotal = cart.prices?.grand_total?.value || 0;
  const selectedShippingAmount =
    cart.shipping_addresses?.[0]?.selected_shipping_method?.amount?.value || 0;

  return (
    <div className="bg-gray-50 pb-16">
      {/* Hero */}
      <div className="bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800">
        <div className="relative mx-auto max-w-7xl px-4 py-8">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_50%,rgba(200,16,46,0.06)_0%,transparent_60%)]" />
          <div className="relative flex items-center justify-between">
            <h1 className="text-2xl font-bold text-white">Checkout</h1>
            <Link
              href="/cart"
              className="text-sm text-gray-400 transition hover:text-white"
            >
              &larr; Back to cart
            </Link>
          </div>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-auto max-w-7xl px-4 pt-4">
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        </div>
      )}

      <div className="mx-auto max-w-7xl px-4 pt-6">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* ─── LEFT: Checkout form ─── */}
          <div className="space-y-6 lg:col-span-2">
            {/* Contact & Shipping Address */}
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="flex items-center gap-2 bg-gray-900 px-5 py-3">
                <span className="h-3.5 w-[3px] rounded-sm bg-red-600" />
                <h2 className="text-xs font-semibold uppercase tracking-[1px] text-gray-400">
                  Contact & Shipping
                </h2>
                {addressSaved && (
                  <svg className="ml-auto h-4 w-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <div className="p-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field
                    label="Email"
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={updateForm}
                    placeholder="your@email.com"
                    colSpan="sm:col-span-2"
                    autoComplete="email"
                  />
                  <Field
                    label="First Name"
                    name="firstname"
                    value={form.firstname}
                    onChange={updateForm}
                    autoComplete="given-name"
                  />
                  <Field
                    label="Last Name"
                    name="lastname"
                    value={form.lastname}
                    onChange={updateForm}
                    autoComplete="family-name"
                  />
                  <Field
                    label="Address"
                    name="street0"
                    value={form.street0}
                    onChange={updateForm}
                    colSpan="sm:col-span-2"
                    autoComplete="address-line1"
                  />
                  <Field
                    label="Apt / Suite / Unit"
                    name="street1"
                    value={form.street1}
                    onChange={updateForm}
                    required={false}
                    colSpan="sm:col-span-2"
                    autoComplete="address-line2"
                  />
                  <Field
                    label="City"
                    name="city"
                    value={form.city}
                    onChange={updateForm}
                    autoComplete="address-level2"
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-500">
                        State <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={form.region}
                        onChange={(e) => updateForm("region", e.target.value)}
                        required
                        autoComplete="address-level1"
                        className="w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none transition focus:border-red-300 focus:ring-2 focus:ring-red-100"
                      >
                        <option value="">Select...</option>
                        {usRegions.map((r) => (
                          <option key={r.id} value={r.code}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <Field
                      label="ZIP Code"
                      name="postcode"
                      value={form.postcode}
                      onChange={updateForm}
                      autoComplete="postal-code"
                    />
                  </div>
                  <Field
                    label="Phone"
                    name="telephone"
                    type="tel"
                    value={form.telephone}
                    onChange={updateForm}
                    placeholder="(555) 555-5555"
                    colSpan="sm:col-span-2"
                    autoComplete="tel"
                  />
                </div>

                <button
                  onClick={handleSaveAddress}
                  disabled={savingAddress || !form.email || !form.firstname || !form.street0 || !form.city || !form.region || !form.postcode || !form.telephone}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-gray-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:opacity-50"
                >
                  {savingAddress ? (
                    "Saving..."
                  ) : addressSaved ? (
                    <>
                      <svg className="h-4 w-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      Update Address
                    </>
                  ) : (
                    "Continue to Shipping"
                  )}
                </button>
              </div>
            </div>

            {/* Shipping Method */}
            {addressSaved && shippingMethods.length > 0 && (
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="flex items-center gap-2 bg-gray-900 px-5 py-3">
                  <span className="h-3.5 w-[3px] rounded-sm bg-red-600" />
                  <h2 className="text-xs font-semibold uppercase tracking-[1px] text-gray-400">
                    Shipping Method
                  </h2>
                </div>
                <div className="divide-y divide-gray-100 p-2">
                  {/* TBD / freeshipping option */}
                  {shippingMethods.some((m) => m.carrier_code === "freeshipping") && (() => {
                    const freeMethod = shippingMethods.find((m) => m.carrier_code === "freeshipping")!;
                    const key = `${freeMethod.carrier_code}|${freeMethod.method_code}`;
                    const isSelected = selectedShipping === key;
                    return (
                      <label
                        key={key}
                        className={`flex cursor-pointer items-center gap-4 rounded-lg px-4 py-3 transition ${
                          isSelected
                            ? "bg-red-50/50 ring-1 ring-red-200"
                            : "hover:bg-gray-50"
                        }`}
                      >
                        <input
                          type="radio"
                          name="shipping"
                          value={key}
                          checked={isSelected}
                          onChange={() => handleShippingMethodChange(key)}
                          className="h-4 w-4 accent-red-600"
                        />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">
                            Shipping Billed on Invoice
                          </p>
                          <p className="text-xs text-gray-500">
                            Shipping cost determined and billed upon invoice
                          </p>
                        </div>
                      </label>
                    );
                  })()}

                  {/* Ship on My Account (consolidated ups + flatrate) */}
                  {shipOnMyAccountMethod && (() => {
                    const key = `${shipOnMyAccountMethod.carrier_code}|${shipOnMyAccountMethod.method_code}`;
                    return (
                      <div>
                        <label
                          className={`flex cursor-pointer items-center gap-4 rounded-lg px-4 py-3 transition ${
                            isShipOnMyAccount
                              ? "bg-red-50/50 ring-1 ring-red-200"
                              : "hover:bg-gray-50"
                          }`}
                        >
                          <input
                            type="radio"
                            name="shipping"
                            value={key}
                            checked={isShipOnMyAccount}
                            onChange={() => handleShippingMethodChange(key)}
                            className="h-4 w-4 accent-red-600"
                          />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">
                              Ship on My Account
                            </p>
                            <p className="text-xs text-gray-500">
                              Use your own UPS, FedEx, or other carrier account
                            </p>
                          </div>
                        </label>

                        {isShipOnMyAccount && (
                          <div className="px-4 pb-3">
                            <CarrierAccountForm
                              data={carrierData}
                              onChange={setCarrierData}
                              savedAccounts={savedAccounts}
                              isLoggedIn={customerLoggedIn}
                              saveForFuture={saveNewAccount}
                              onSaveForFutureChange={setSaveNewAccount}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Fallback: any other methods not covered above */}
                  {shippingMethods
                    .filter((m) => !["freeshipping", "ups", "flatrate"].includes(m.carrier_code))
                    .map((method) => {
                      const key = `${method.carrier_code}|${method.method_code}`;
                      const isSelected = selectedShipping === key;
                      return (
                        <label
                          key={key}
                          className={`flex cursor-pointer items-center gap-4 rounded-lg px-4 py-3 transition ${
                            isSelected
                              ? "bg-red-50/50 ring-1 ring-red-200"
                              : "hover:bg-gray-50"
                          }`}
                        >
                          <input
                            type="radio"
                            name="shipping"
                            value={key}
                            checked={isSelected}
                            onChange={() => handleShippingMethodChange(key)}
                            className="h-4 w-4 accent-red-600"
                          />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">
                              {method.carrier_title} — {method.method_title}
                            </p>
                          </div>
                          <span className="shrink-0 text-sm font-semibold text-gray-900">
                            {method.amount.value === 0
                              ? "FREE"
                              : `$${formatPrice(method.amount.value)}`}
                          </span>
                        </label>
                      );
                    })}
                </div>
              </div>
            )}

            {/* PO Number */}
            {addressSaved && (
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="flex items-center gap-2 bg-gray-900 px-5 py-3">
                  <span className="h-3.5 w-[3px] rounded-sm bg-red-600" />
                  <h2 className="text-xs font-semibold uppercase tracking-[1px] text-gray-400">
                    PO Number
                  </h2>
                </div>
                <div className="p-5">
                  <label className="mb-1 block text-xs font-medium text-gray-500">
                    Purchase Order Number
                  </label>
                  <input
                    type="text"
                    value={poNumber}
                    onChange={(e) => setPoNumber(e.target.value)}
                    placeholder="e.g. PO-2024-001 (optional)"
                    className="w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-red-300 focus:ring-2 focus:ring-red-100"
                  />
                </div>
              </div>
            )}

            {/* Payment & Billing */}
            {addressSaved && (
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="flex items-center gap-2 bg-gray-900 px-5 py-3">
                  <span className="h-3.5 w-[3px] rounded-sm bg-red-600" />
                  <h2 className="text-xs font-semibold uppercase tracking-[1px] text-gray-400">
                    Payment & Billing
                  </h2>
                </div>
                <div className="p-5">
                  {/* Payment methods */}
                  {cart.available_payment_methods?.length > 0 && (
                    <div className="mb-5">
                      <p className="mb-2 text-xs font-medium text-gray-500">
                        Payment Method
                      </p>
                      <div className="space-y-2">
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {cart.available_payment_methods.map((pm: any) => {
                          const isSelected =
                            selectedPayment === pm.code ||
                            (!selectedPayment &&
                              pm.code === cart.available_payment_methods[0].code);
                          return (
                            <label
                              key={pm.code}
                              className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition ${
                                isSelected
                                  ? "border-red-200 bg-red-50/50"
                                  : "border-gray-200 hover:border-gray-300"
                              }`}
                            >
                              <input
                                type="radio"
                                name="payment"
                                value={pm.code}
                                checked={isSelected}
                                onChange={() => setSelectedPayment(pm.code)}
                                className="h-4 w-4 accent-red-600"
                              />
                              <span className="text-sm font-medium text-gray-900">
                                {pm.title}
                              </span>
                            </label>
                          );
                        })}
                      </div>

                      {/* Credit card form — shown when CC method is selected */}
                      {isCcMethod && (
                        <>
                          <CreditCardForm data={ccData} onChange={setCcData} />
                          <div className="mt-4">
                            <div ref={recaptchaRef} />
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Billing address toggle */}
                  <label className="flex cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={sameAsBilling}
                      onChange={() => setSameAsBilling(!sameAsBilling)}
                      className="h-4 w-4 rounded accent-red-600"
                    />
                    <span className="text-sm text-gray-700">
                      Billing address is the same as shipping
                    </span>
                  </label>

                  {/* Billing address form (if different) */}
                  {!sameAsBilling && (
                    <div className="mt-4 grid grid-cols-1 gap-4 border-t border-gray-100 pt-4 sm:grid-cols-2">
                      <Field label="First Name" name="firstname" value={billingForm.firstname} onChange={updateBillingForm} />
                      <Field label="Last Name" name="lastname" value={billingForm.lastname} onChange={updateBillingForm} />
                      <Field label="Address" name="street0" value={billingForm.street0} onChange={updateBillingForm} colSpan="sm:col-span-2" />
                      <Field label="City" name="city" value={billingForm.city} onChange={updateBillingForm} />
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-gray-500">
                            State <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={billingForm.region}
                            onChange={(e) => updateBillingForm("region", e.target.value)}
                            required
                            className="w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none transition focus:border-red-300 focus:ring-2 focus:ring-red-100"
                          >
                            <option value="">Select...</option>
                            {usRegions.map((r) => (
                              <option key={r.id} value={r.code}>
                                {r.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <Field label="ZIP Code" name="postcode" value={billingForm.postcode} onChange={updateBillingForm} />
                      </div>
                      <Field label="Phone" name="telephone" type="tel" value={billingForm.telephone} onChange={updateBillingForm} placeholder="(555) 555-5555" colSpan="sm:col-span-2" />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Place Order button (desktop — also shown in sidebar on mobile) */}
            {addressSaved && (
              <button
                onClick={handlePlaceOrder}
                disabled={!canPlaceOrder || placing}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-6 py-4 text-base font-bold text-white shadow-sm transition hover:bg-red-700 hover:shadow-md active:scale-[0.99] disabled:opacity-50 lg:hidden"
              >
                {placing ? (
                  "Placing Order..."
                ) : (
                  <>
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0110 0v4" />
                    </svg>
                    Place Order — ${formatPrice(grandTotal)}
                  </>
                )}
              </button>
            )}
          </div>

          {/* ─── RIGHT: Order Summary sidebar ─── */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-4">
              {/* Items */}
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="flex items-center gap-2 bg-gray-900 px-5 py-3">
                  <span className="h-3.5 w-[3px] rounded-sm bg-red-600" />
                  <h2 className="text-xs font-semibold uppercase tracking-[1px] text-gray-400">
                    Order Summary
                  </h2>
                  <span className="ml-auto text-xs text-gray-500">
                    {cart.total_quantity} item{cart.total_quantity !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="max-h-64 divide-y divide-gray-100 overflow-y-auto">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {cart.items.map((item: any) => (
                    <div key={item.uid} className="flex gap-3 px-4 py-3">
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-gray-100 bg-gray-50">
                        <Image
                          src={proxyMagentoImage(item.product.small_image.url)}
                          alt={item.product.small_image.label || item.product.name}
                          fill
                          className="object-contain p-0.5"
                          sizes="48px"
                        />
                        <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-gray-900 text-[10px] font-bold text-white">
                          {item.quantity}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-gray-900">
                          {item.product.name}
                        </p>
                        <p className="text-[11px] text-gray-400">
                          {item.product.sku}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs font-semibold text-gray-900">
                        ${formatPrice(item.prices.row_total.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals */}
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="space-y-2 p-5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Subtotal</span>
                    <span className="font-medium text-gray-900">
                      ${formatPrice(subtotal)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Shipping</span>
                    <span className="font-medium text-gray-900">
                      {selectedShippingAmount > 0
                        ? `$${formatPrice(selectedShippingAmount)}`
                        : addressSaved
                          ? "FREE"
                          : "—"}
                    </span>
                  </div>
                  {cart.prices?.applied_taxes?.map(
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (tax: any) => (
                      <div key={tax.label} className="flex justify-between">
                        <span className="text-gray-500">Tax</span>
                        <span className="font-medium text-gray-900">
                          ${formatPrice(tax.amount.value)}
                        </span>
                      </div>
                    ),
                  )}
                  {cart.prices?.discounts?.map(
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (d: any) => (
                      <div key={d.label} className="flex justify-between">
                        <span className="text-green-600">{d.label}</span>
                        <span className="font-medium text-green-600">
                          -${formatPrice(d.amount.value)}
                        </span>
                      </div>
                    ),
                  )}
                  <div className="flex justify-between border-t border-gray-200 pt-3">
                    <span className="text-base font-bold text-gray-900">
                      Total
                    </span>
                    <span className="text-lg font-bold text-gray-900">
                      ${formatPrice(grandTotal)}
                    </span>
                  </div>
                </div>

                {/* Place Order (desktop sidebar) */}
                {addressSaved && (
                  <div className="hidden border-t border-gray-100 p-4 lg:block">
                    <button
                      onClick={handlePlaceOrder}
                      disabled={!canPlaceOrder || placing}
                      className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-6 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-red-700 hover:shadow-md active:scale-[0.99] disabled:opacity-50"
                    >
                      {placing ? (
                        "Placing Order..."
                      ) : (
                        <>
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0110 0v4" />
                          </svg>
                          Place Order
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* Trust */}
              <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Secure 256-bit SSL checkout
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
