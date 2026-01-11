/**
 * Schema Sync Utility
 * 
 * Syncs JSON-LD schemas to Shopify product metafields.
 * This bridges Feature B (Hashing Engine) with Feature C (Schema Injector).
 * 
 * The Theme App Extension reads from these metafields to inject JSON-LD.
 */

// GraphQL mutation to set product metafield
const SET_METAFIELD_MUTATION = `#graphql
  mutation SetProductSchema($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields {
        id
        namespace
        key
        value
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export interface SyncSchemaInput {
  productId: string; // Shopify GID (e.g., "gid://shopify/Product/123")
  schema: object;    // JSON-LD schema object
}

export interface SyncSchemaResult {
  success: boolean;
  metafieldId?: string;
  error?: string;
}

/**
 * Syncs a JSON-LD schema to a product's metafield.
 * 
 * The Theme App Extension will read this metafield and inject it
 * as a <script type="application/ld+json"> tag.
 * 
 * @param admin - Shopify Admin GraphQL client
 * @param input - Product ID and schema to sync
 * @returns Result indicating success or failure
 */
export async function syncSchemaToMetafield(
  admin: { graphql: (query: string, options?: { variables: Record<string, unknown> }) => Promise<Response> },
  input: SyncSchemaInput
): Promise<SyncSchemaResult> {
  try {
    const response = await admin.graphql(SET_METAFIELD_MUTATION, {
      variables: {
        metafields: [
          {
            ownerId: input.productId,
            namespace: 'ai_geo',
            key: 'product_schema',
            type: 'json',
            value: JSON.stringify(input.schema),
          },
        ],
      },
    });

    const result = await response.json();
    const data = result.data?.metafieldsSet;

    if (data?.userErrors?.length > 0) {
      return {
        success: false,
        error: data.userErrors.map((e: { message: string }) => e.message).join(', '),
      };
    }

    return {
      success: true,
      metafieldId: data?.metafields?.[0]?.id,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Removes the JSON-LD schema from a product's metafield.
 * Use this when a product is deleted or should no longer have schema.
 */
export async function removeSchemaFromMetafield(
  admin: { graphql: (query: string, options?: { variables: Record<string, unknown> }) => Promise<Response> },
  productId: string
): Promise<SyncSchemaResult> {
  // Setting value to empty removes the metafield
  return syncSchemaToMetafield(admin, {
    productId,
    schema: {},
  });
}
