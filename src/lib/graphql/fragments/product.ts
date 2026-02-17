import { gql } from "@apollo/client";

export const PRODUCT_FIELDS = gql`
  fragment ProductFields on ProductInterface {
    id
    uid
    name
    sku
    url_key
    stock_status
    manufacturer
    price_range {
      minimum_price {
        regular_price {
          value
          currency
        }
        final_price {
          value
          currency
        }
        discount {
          amount_off
          percent_off
        }
      }
    }
    small_image {
      url
      label
    }
    short_description {
      html
    }
  }
`;

export const PRODUCT_DETAIL_FIELDS = gql`
  fragment ProductDetailFields on ProductInterface {
    ...ProductFields
    weight
    description {
      html
    }
    price_tiers {
      quantity
      final_price {
        value
        currency
      }
      discount {
        percent_off
        amount_off
      }
    }
    media_gallery {
      url
      label
      position
      disabled
    }
    categories {
      uid
      name
      url_path
      breadcrumbs {
        category_uid
        category_name
        category_url_path
      }
    }
    review_count
    rating_summary
    reviews(pageSize: 10, currentPage: 1) {
      items {
        nickname
        summary
        text
        average_rating
        created_at
        ratings_breakdown {
          name
          value
        }
      }
      page_info {
        current_page
        page_size
        total_pages
      }
    }
    related_products {
      ...ProductFields
    }
    ... on ConfigurableProduct {
      configurable_options {
        uid
        label
        attribute_code
        values {
          uid
          label
          swatch_data {
            value
          }
        }
      }
      variants {
        product {
          uid
          sku
          stock_status
          price_range {
            minimum_price {
              regular_price {
                value
                currency
              }
              final_price {
                value
                currency
              }
            }
          }
        }
        attributes {
          uid
          label
          code
        }
      }
    }
  }
  ${PRODUCT_FIELDS}
`;
