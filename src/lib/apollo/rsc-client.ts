import { HttpLink } from "@apollo/client";
import {
  registerApolloClient,
  ApolloClient,
  InMemoryCache,
} from "@apollo/client-integration-nextjs";
import { getMagentoHttpAuthHeaders } from "@/lib/magento/httpAuth";

export const { getClient, query, PreloadQuery } = registerApolloClient(() => {
  return new ApolloClient({
    cache: new InMemoryCache(),
    link: new HttpLink({
      uri: process.env.MAGENTO_GRAPHQL_URL,
      headers: getMagentoHttpAuthHeaders(),
    }),
  });
});
