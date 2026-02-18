"use client";

import { HttpLink, ApolloLink } from "@apollo/client";
import { CombinedGraphQLErrors } from "@apollo/client/errors";
import { ErrorLink } from "@apollo/client/link/error";
import {
  ApolloNextAppProvider,
  ApolloClient,
  InMemoryCache,
} from "@apollo/client-integration-nextjs";
import { getCustomerToken, clearCustomerToken } from "@/lib/auth/token";

function makeClient() {
  // Auth link: attach customer token if present
  const authLink = new ApolloLink((operation, forward) => {
    const token = getCustomerToken();
    if (token) {
      operation.setContext({
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    }
    return forward(operation);
  });

  // Error link: handle expired/invalid customer tokens
  // Only trigger on Magento's explicit auth category, not loose string matching
  // (cart merge and other operations can return "not authorized" without meaning the token is bad)
  const errorLink = new ErrorLink(({ error }) => {
    if (CombinedGraphQLErrors.is(error)) {
      const authError = error.errors.some(
        (err) => err.extensions?.category === "graphql-authorization",
      );
      if (authError && getCustomerToken()) {
        clearCustomerToken();
        window.location.href = "/customer/login";
      }
    }
  });

  const httpLink = new HttpLink({
    uri: process.env.NEXT_PUBLIC_MAGENTO_GRAPHQL_URL,
    fetchOptions: { cache: "no-store" },
  });

  return new ApolloClient({
    cache: new InMemoryCache({
      typePolicies: {
        Query: {
          fields: {
            products: {
              keyArgs: ["filter", "sort"],
              merge(_existing, incoming) {
                return incoming;
              },
            },
          },
        },
      },
    }),
    link: ApolloLink.from([errorLink, authLink, httpLink]),
  });
}

export function ApolloWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ApolloNextAppProvider makeClient={makeClient}>
      {children}
    </ApolloNextAppProvider>
  );
}
