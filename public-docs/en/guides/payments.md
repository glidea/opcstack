---
title: Payments
description: Configure Dodo and Creem payments
group: Operations
group_order: 4
order: 3
---

# Payments

Open **Admin > Configuration > Payment** to manage payment providers and products. Payment configuration is stored in D1 and takes effect for new requests immediately after saving.

Create products before enabling payment. One-time products grant credits once. Subscription products require a plan, upgrade rank, and credits granted for each paid period. Provider dashboards own product names, prices, currencies, and billing modes.

For each enabled provider, add its API key and webhook signing secret. Copy the displayed webhook URL into the provider dashboard. Test and live credentials must match the selected mode.

Product edits use optimistic versions. A stale update or deletion of a product referenced by an effective subscription is rejected instead of overwriting current state.

Payment secrets are never displayed after saving. Replacing a webhook secret affects the next webhook request.
