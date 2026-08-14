---
title: Payments
description: Configure Dodo and Creem payments
group: Operations
group_order: 4
order: 3
---

# Payments

Open **Admin > System settings > Payment** to connect payment providers. Open **Admin > Payment products** to link remote products to customer entitlements. Payment configuration is stored in D1 and takes effect for new requests immediately after saving.

Create products in the provider dashboard first. In Payment products, choose a connected platform and select its remote product from the catalog. The system reads the name, price, currency, billing mode, environment, and remote ID. You only define the local credit or subscription entitlement.

For each enabled provider, add its API key and webhook signing secret. Copy the displayed webhook URL into the provider dashboard. The system detects test or live mode from the API key; switching credentials does not expose products linked to the other environment.

Product edits use optimistic versions. A stale update or deletion of a product referenced by an effective subscription is rejected instead of overwriting current state.

Payment secrets are never displayed after saving. Replacing a webhook secret affects the next webhook request.

Provider settings and Products save independently. A successful Product operation updates only that Product in the current page. Deletion requires confirmation. When another browser has already changed the same Product, refresh the current data before editing again.
