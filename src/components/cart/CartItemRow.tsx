"use client";

import Image from "next/image";
import Link from "next/link";
import { formatPrice } from "@/lib/formatPrice";
import { proxyMagentoImage } from "@/lib/magento/mediaUrl";
import { useMutation } from "@apollo/client/react";
import {
  UPDATE_CART_ITEMS,
  REMOVE_ITEM_FROM_CART,
} from "@/lib/graphql/mutations/cart";
import { CART_QUERY } from "@/lib/graphql/queries/cart";

interface CartItemRowProps {
  item: {
    uid: string;
    quantity: number;
    product: {
      uid: string;
      name: string;
      sku: string;
      url_key: string;
      small_image: { url: string; label: string | null };
      price_range: {
        minimum_price: {
          final_price: { value: number; currency: string };
        };
      };
    };
    prices: {
      row_total: { value: number; currency: string };
    };
    configurable_options?: Array<{
      option_label: string;
      value_label: string;
    }>;
  };
  cartId: string;
}

export function CartItemRow({ item, cartId }: CartItemRowProps) {
  const [updateCart, { loading: updating }] = useMutation(UPDATE_CART_ITEMS, {
    refetchQueries: [{ query: CART_QUERY, variables: { cartId } }],
  });
  const [removeItem, { loading: removing }] = useMutation(
    REMOVE_ITEM_FROM_CART,
    {
      refetchQueries: [{ query: CART_QUERY, variables: { cartId } }],
    },
  );

  function handleQuantityChange(newQty: number) {
    if (newQty < 1) return;
    updateCart({
      variables: {
        cartId,
        cartItems: [{ cart_item_uid: item.uid, quantity: newQty }],
      },
    });
  }

  function handleRemove() {
    removeItem({
      variables: { cartId, cartItemUid: item.uid },
    });
  }

  const isLoading = updating || removing;
  const unitPrice = item.product.price_range.minimum_price.final_price.value;

  return (
    <div
      className={`grid grid-cols-12 items-center gap-4 px-5 py-4 transition ${isLoading ? "opacity-50" : ""}`}
    >
      {/* Product info — 6 cols */}
      <div className="col-span-6 flex gap-4">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-gray-100 bg-gray-50">
          <Image
            src={proxyMagentoImage(item.product.small_image.url)}
            alt={item.product.small_image.label || item.product.name}
            fill
            className="object-contain p-1"
            sizes="80px"
          />
        </div>
        <div className="min-w-0 flex-1">
          <Link
            href={`/product/${item.product.url_key}`}
            className="block truncate text-sm font-semibold text-gray-900 hover:text-red-600"
          >
            {item.product.name}
          </Link>
          <p className="mt-0.5 font-mono text-xs text-gray-400">
            SKU: {item.product.sku}
          </p>
          {item.configurable_options?.map((opt) => (
            <p
              key={opt.option_label}
              className="mt-0.5 text-xs text-gray-500"
            >
              {opt.option_label}: {opt.value_label}
            </p>
          ))}
          <button
            onClick={handleRemove}
            disabled={isLoading}
            className="mt-1.5 text-xs text-red-500 transition hover:text-red-700"
          >
            Remove
          </button>
        </div>
      </div>

      {/* Quantity — 2 cols */}
      <div className="col-span-2 flex items-center justify-center">
        <div className="flex items-center overflow-hidden rounded-lg border border-gray-200">
          <button
            onClick={() => handleQuantityChange(item.quantity - 1)}
            disabled={isLoading || item.quantity <= 1}
            aria-label={`Decrease quantity of ${item.product.name}`}
            className="px-2.5 py-1.5 text-sm text-gray-500 transition hover:bg-gray-50 hover:text-gray-900 disabled:opacity-40"
          >
            -
          </button>
          <span className="w-8 border-x border-gray-100 bg-transparent py-1.5 text-center font-mono text-sm font-medium text-gray-900">
            {item.quantity}
          </span>
          <button
            onClick={() => handleQuantityChange(item.quantity + 1)}
            disabled={isLoading}
            aria-label={`Increase quantity of ${item.product.name}`}
            className="px-2.5 py-1.5 text-sm text-gray-500 transition hover:bg-gray-50 hover:text-gray-900 disabled:opacity-40"
          >
            +
          </button>
        </div>
      </div>

      {/* Unit price — 2 cols */}
      <div className="col-span-2 text-right text-sm text-gray-500">
        ${formatPrice(unitPrice)}
      </div>

      {/* Row total — 2 cols */}
      <div className="col-span-2 text-right text-sm font-semibold text-gray-900">
        ${formatPrice(item.prices.row_total.value)}
      </div>
    </div>
  );
}
