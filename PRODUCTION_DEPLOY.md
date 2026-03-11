# Production Deployment Guide

This guide covers everything needed to take the B2B Buyer Portal from sandbox to production. It includes Azure Database for PostgreSQL setup, BigCommerce Dinsour theme configuration, storefront navigation changes, and a full environment variable reference.

For the Azure Container Apps deployment steps themselves, see [AZURE_DEPLOY.md](./AZURE_DEPLOY.md).

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Azure Database for PostgreSQL](#2-azure-database-for-postgresql)
3. [BigCommerce Dinsour Theme Setup](#3-bigcommerce-dinsour-theme-setup)
4. [Rename Account Link to B2B Portal](#4-rename-account-link-to-b2b-portal)
5. [Full Environment Variable Reference](#5-full-environment-variable-reference)
6. [Build and Deploy](#6-build-and-deploy)
7. [Go-Live Checklist](#7-go-live-checklist)
8. [Post Go-Live Verification](#8-post-go-live-verification)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Prerequisites

Before starting, ensure you have:

- An Azure subscription with permissions to create resources
- [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli) installed and authenticated (`az login`)
- Docker installed locally
- Access to the BigCommerce control panel for your production store
- The production store hash and channel ID
- BigCommerce API credentials (Store API token, B2B Edition management token)
- The Dinsour theme `.zip` file ready for upload

---

## 2. Azure Database for PostgreSQL

### 2a. Provision Azure Database for PostgreSQL Flexible Server

```bash
RESOURCE_GROUP="b2b-portal-rg"
LOCATION="uksouth"
DB_SERVER_NAME="b2b-portal-db"
DB_NAME="b2bportal"
DB_ADMIN_USER="b2badmin"
DB_ADMIN_PASSWORD="<generate-a-strong-password>"

az postgres flexible-server create \
  --resource-group $RESOURCE_GROUP \
  --name $DB_SERVER_NAME \
  --location $LOCATION \
  --admin-user $DB_ADMIN_USER \
  --admin-password "$DB_ADMIN_PASSWORD" \
  --sku-name Standard_B1ms \
  --tier Burstable \
  --storage-size 32 \
  --version 15 \
  --yes
```

### 2b. Create the database

```bash
az postgres flexible-server db create \
  --resource-group $RESOURCE_GROUP \
  --server-name $DB_SERVER_NAME \
  --database-name $DB_NAME
```

### 2c. Allow Azure services to connect

```bash
az postgres flexible-server firewall-rule create \
  --resource-group $RESOURCE_GROUP \
  --name $DB_SERVER_NAME \
  --rule-name AllowAzureServices \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0
```

If you need to connect from your local machine for debugging:

```bash
MY_IP=$(curl -s https://ifconfig.me)
az postgres flexible-server firewall-rule create \
  --resource-group $RESOURCE_GROUP \
  --name $DB_SERVER_NAME \
  --rule-name AllowMyIP \
  --start-ip-address $MY_IP \
  --end-ip-address $MY_IP
```

### 2d. Enable SSL (required)

SSL is enabled by default on Azure Database for PostgreSQL Flexible Server. The connection string must include `sslmode=require`.

### 2e. Connection string format

```
postgresql://<DB_ADMIN_USER>:<DB_ADMIN_PASSWORD>@<DB_SERVER_NAME>.postgres.database.azure.com:5432/<DB_NAME>?sslmode=require
```

Example:

```
postgresql://b2badmin:MyStr0ngP%40ss@b2b-portal-db.postgres.database.azure.com:5432/b2bportal?sslmode=require
```

> **Note:** Special characters in the password must be URL-encoded (e.g. `@` becomes `%40`, `#` becomes `%23`).

### 2f. Push the database schema

From the project root (with `DATABASE_URL` set to your Azure PostgreSQL connection string):

```bash
DATABASE_URL="postgresql://b2badmin:password@b2b-portal-db.postgres.database.azure.com:5432/b2bportal?sslmode=require" \
  npx drizzle-kit push
```

This creates all required tables (`users`, `companies`, `sessions`, `bigcommerce_orders_cache`, `bigcommerce_invoices_cache`, etc.) without needing manual SQL migrations.

### 2g. Verify the schema

```bash
DATABASE_URL="postgresql://..." psql "$DATABASE_URL" -c "\dt"
```

You should see the tables listed. The portal will start populating data (order cache, invoice cache, sessions) once it receives traffic.

---

## 3. BigCommerce Dinsour Theme Setup

The Dinsour theme is the production BigCommerce storefront theme. It must be configured to load the B2B Edition buyer portal script so that after login, users are redirected to the portal.

### 3a. Upload and activate the Dinsour theme

1. Go to **BigCommerce Admin** > **Storefront** > **Themes**
2. Click **Upload Theme** and select your Dinsour `.zip` file
3. Once uploaded, click the three-dot menu on the Dinsour theme and select **Apply**
4. Confirm to make it the active theme

### 3b. Add the B2B Edition portal script tag

The portal uses a script tag in the BigCommerce storefront to handle SSO login and redirect. This script must point to your production portal URL.

1. Go to **BigCommerce Admin** > **Storefront** > **Script Manager**
2. Click **Create a Script**
3. Configure the script:

| Field | Value |
|-------|-------|
| Name | B2B Edition Buyer Portal |
| Description | Loads the B2B buyer portal for logged-in customers |
| Placement | Footer |
| Location | All Pages |
| Script category | Essential |
| Script type | Script |

4. Paste the following script content (replace `YOUR_PORTAL_URL` with your actual production portal URL, e.g. `https://b2b-portal.azurecontainerapps.io`):

```html
<script>
  window.b3CheckoutConfig = {
    routes: {
      dashboard: 'YOUR_PORTAL_URL/dashboard',
      orderDetail: 'YOUR_PORTAL_URL/orders',
      shoppingList: 'YOUR_PORTAL_URL/shopping-lists',
      endMasquerade: 'YOUR_PORTAL_URL/dashboard',
    }
  };
  window.B3 = {
    setting: {
      store_hash: 'YOUR_PRODUCTION_STORE_HASH',
      channel_id: YOUR_PRODUCTION_CHANNEL_ID,
      b2b_url: 'https://cdn.bundleb2b.net',
      captcha_setkey: '',
    },
    before_login_goto_page: 'YOUR_PORTAL_URL/dashboard',
    after_logout_goto_page: '/',
  };
</script>
<script src="https://cdn.bundleb2b.net/b3.js"></script>
```

5. Click **Save**

### 3c. Verify SSO redirect

1. Visit your production BigCommerce store
2. Click "Log In" and sign in with a B2B customer account
3. After login, the browser should redirect to `YOUR_PORTAL_URL/dashboard`
4. The portal should load and display the dashboard with the logged-in user's data

---

## 4. Rename Account Link to B2B Portal

To change the "Account" navigation link in the BigCommerce storefront header to say "B2B Portal", you need to edit the active theme's template files.

### 4a. Download the theme for editing

1. Go to **BigCommerce Admin** > **Storefront** > **Themes**
2. Click the three-dot menu on the active Dinsour theme
3. Select **Advanced** > **Download Current Theme**
4. Extract the downloaded `.zip` file

### 4b. Edit the header template

Open the file `templates/components/common/header.html` (the exact path may vary slightly depending on the Dinsour theme version, but look for the navigation header component).

Find the account/sign-in link area. It typically looks like:

```html
<a class="navUser-action" href="{{urls.account}}">
  {{#if customer}}
    {{lang 'common.account'}}
  {{else}}
    {{lang 'common.login'}}
  {{/if}}
</a>
```

Change the account text to "B2B Portal":

```html
<a class="navUser-action" href="{{urls.account}}">
  {{#if customer}}
    B2B Portal
  {{else}}
    {{lang 'common.login'}}
  {{/if}}
</a>
```

> **Note:** Only the logged-in label changes. The "Sign In" / "Log In" label for non-authenticated visitors remains unchanged.

### 4c. Alternative: Use language file override

If you prefer not to edit the template directly, you can override the language string:

1. Open `lang/en.json` in the theme
2. Find the key `"common.account"` (it may say `"Account"` or `"My Account"`)
3. Change the value to `"B2B Portal"`

```json
{
  "common": {
    "account": "B2B Portal"
  }
}
```

> **Limitation:** This changes the string everywhere it is used. If other parts of the theme use `{{lang 'common.account'}}`, they will also say "B2B Portal". The template edit in 4b is more targeted.

### 4d. Re-upload the modified theme

1. Re-zip the theme folder (ensure the root contains `config.json`, `schema.json`, `templates/`, etc.)
2. Go to **BigCommerce Admin** > **Storefront** > **Themes**
3. Upload the modified theme
4. Apply it as the active theme

---

## 5. Full Environment Variable Reference

### Build-time variables (baked into the frontend at `docker build`)

These cannot be changed after the Docker image is built. A new image must be built to update them.

| Variable | Required | Production Value | Description |
|----------|----------|-----------------|-------------|
| `VITE_STORE_HASH` | Yes | Your production store hash | BigCommerce store identifier |
| `VITE_CHANNEL_ID` | No | `1` (or your production channel) | BigCommerce channel ID |
| `VITE_LOCAL_APP_CLIENT_ID` | No | Your B2B Edition app client ID | App client ID for B2B Edition SSO |
| `VITE_IS_LOCAL_ENVIRONMENT` | No | `FALSE` | Must be `FALSE` for production |
| `VITE_STORE_URL` | Yes | `https://your-store.mybigcommerce.com` | Storefront URL for SHOP links and logout redirect |
| `VITE_PORTAL_URL` | Yes | `https://your-portal.azurecontainerapps.io` | Portal URL for B2B Edition login redirect |
| `VITE_ASSETS_ABSOLUTE_PATH` | No | CDN URL (if using one) | Absolute path prefix for static assets |
| `VITE_DISABLE_BUILD_HASH` | No | `TRUE` (optional) | Remove content hashes from built filenames |

### Runtime variables (set as environment variables in Azure Container Apps)

These can be updated without rebuilding the Docker image.

| Variable | Required | Production Value | Description |
|----------|----------|-----------------|-------------|
| `NODE_ENV` | Yes | `production` | Must be `production` |
| `PORT` | No | `5000` (default) | Port the server listens on |
| `DATABASE_URL` | Yes | Azure PostgreSQL connection string | Full connection string with `?sslmode=require` |
| `JWT_SECRET` | Yes | 64+ character random string | Signs JWT authentication tokens |
| `JWT_REFRESH_SECRET` | Yes | 64+ character random string | Signs JWT refresh tokens. **Must be set in production** — the default is insecure |
| `JWT_EXPIRES_IN` | No | `15m` (default) | JWT access token lifetime (e.g. `15m`, `1h`). "Remember me" overrides to `30d` |
| `JWT_REFRESH_EXPIRES_IN` | No | `7d` (default) | JWT refresh token lifetime (e.g. `7d`, `30d`). "Remember me" overrides to `30d` |
| `SESSION_SECRET` | Yes | 64+ character random string | Encrypts session cookies |
| `SESSION_TIMEOUT` | No | `3600000` (default, 1 hour in ms) | Session inactivity timeout in milliseconds |
| `BIGCOMMERCE_STORE_HASH` | Yes | Your production store hash | Used by the backend for API calls |
| `BIGCOMMERCE_CLIENT_ID` | Yes | Production API client ID | BigCommerce Store API client ID |
| `BIGCOMMERCE_CLIENT_SECRET` | Yes | Production API client secret | BigCommerce Store API client secret |
| `BIGCOMMERCE_ACCESS_TOKEN` | Yes | Production Store API token | BigCommerce Store API access token |
| `BIGCOMMERCE_B2B_MANAGEMENT_TOKEN` | Yes | Production B2B management token | B2B Edition server-side management token |

### Generating secrets

```bash
openssl rand -hex 32
```

Run this three times to generate separate values for `JWT_SECRET`, `JWT_REFRESH_SECRET`, and `SESSION_SECRET`. Each must be unique.

---

## 6. Build and Deploy

### 6a. Build the production Docker image

```bash
docker build \
  --build-arg VITE_STORE_HASH=your_production_store_hash \
  --build-arg VITE_CHANNEL_ID=1 \
  --build-arg VITE_IS_LOCAL_ENVIRONMENT=FALSE \
  --build-arg VITE_STORE_URL=https://your-store.mybigcommerce.com \
  --build-arg VITE_PORTAL_URL=https://your-portal.azurecontainerapps.io \
  -t b2b-portal:latest .
```

### 6b. Test locally before deploying

```bash
docker compose up --build
```

Open http://localhost:5000 and verify the portal loads, login works, and pages render correctly.

### 6c. Push to Azure Container Registry and deploy

Follow the full step-by-step instructions in [AZURE_DEPLOY.md](./AZURE_DEPLOY.md) starting from Step 5.

---

## 7. Go-Live Checklist

### BigCommerce Admin

- [ ] Dinsour production theme uploaded and activated
- [ ] B2B Edition portal script tag created in Script Manager with production portal URL
- [ ] Account link renamed to "B2B Portal" in theme header template
- [ ] B2B Edition is enabled and configured for the production store
- [ ] Store API account created with required scopes (Orders, Customers, Products read/write)
- [ ] B2B Edition management token generated with required scopes

### Azure Infrastructure

- [ ] Resource group created in target region (e.g. `uksouth`)
- [ ] Azure Database for PostgreSQL Flexible Server provisioned
- [ ] Database created and schema pushed with `npx drizzle-kit push`
- [ ] Azure Container Registry created and image pushed
- [ ] Azure Container Apps environment created
- [ ] Container app deployed with all runtime environment variables set
- [ ] Minimum replicas set to 1 (ensures the app is always running)
- [ ] Ingress configured as external on port 5000

### Environment Variables

- [ ] All build-time variables set correctly in the Docker build command
- [ ] `VITE_STORE_URL` points to the production BigCommerce storefront (no trailing slash)
- [ ] `VITE_PORTAL_URL` points to the production portal URL (no trailing slash)
- [ ] `DATABASE_URL` points to Azure PostgreSQL with `?sslmode=require`
- [ ] `JWT_SECRET`, `JWT_REFRESH_SECRET`, and `SESSION_SECRET` are unique, strong, 64+ character random strings
- [ ] All BigCommerce API credentials are production values (not sandbox)
- [ ] `NODE_ENV` is set to `production`

### DNS and Access

- [ ] Portal is accessible at the Azure Container Apps FQDN
- [ ] (Optional) Custom domain configured with TLS certificate
- [ ] CORS and cookie settings work correctly from the BigCommerce storefront domain

---

## 8. Post Go-Live Verification

Run through these checks after deployment:

### Authentication

- [ ] Visit the production BigCommerce store and log in with a B2B customer account
- [ ] Confirm automatic redirect to the portal dashboard
- [ ] Verify the dashboard displays the correct company name and user details
- [ ] Verify "Log out" redirects back to the BigCommerce storefront

### Core Features

- [ ] **Dashboard:** Financial summary shows correct outstanding balance and overdue amounts in GBP
- [ ] **My Orders:** Order list loads with correct data, order detail pages work
- [ ] **Company Orders:** All company orders visible for admin users
- [ ] **Invoices:** Invoice list loads, statuses are correct (paid vs outstanding based on open balance)
- [ ] **Addresses:** Address list loads, add/edit/delete/set-default all work
- [ ] **User Management:** User list loads for admin users, invite/edit/deactivate work
- [ ] **Account Settings:** Form pre-populates with correct user details from B2B Edition

### Navigation

- [ ] "SHOP" link in header opens the production BigCommerce store
- [ ] "B2B Portal" link in BigCommerce storefront header navigates to the portal
- [ ] Mobile bottom tab bar works correctly (Home, Orders, Invoices, More)
- [ ] "More" sheet contains all expected navigation items

---

## 9. Troubleshooting

### Portal shows blank page after deploy

- Check the Azure Container Apps logs: `az containerapp logs show --name $APP_NAME --resource-group $RESOURCE_GROUP`
- Verify `NODE_ENV=production` is set
- Verify the built image includes the frontend bundle (`dist/public/` should contain `index.html`)

### Login redirects back to BigCommerce instead of the portal

- Verify the Script Manager script has the correct `VITE_PORTAL_URL` value
- Verify `window.B3.before_login_goto_page` points to `YOUR_PORTAL_URL/dashboard`
- Verify `window.b3CheckoutConfig.routes.dashboard` points to `YOUR_PORTAL_URL/dashboard`
- Ensure the B2B Edition app is installed and enabled on the production store

### Database connection fails

- Verify `DATABASE_URL` includes `?sslmode=require`
- Verify the Azure PostgreSQL firewall allows connections from Azure services (rule `0.0.0.0` to `0.0.0.0`)
- Check that the database user and password are correct (URL-encode special characters)
- Test the connection: `psql "postgresql://user:pass@host:5432/db?sslmode=require" -c "SELECT 1"`

### Orders or invoices show no data

- Verify `BIGCOMMERCE_STORE_HASH` matches the production store (not the sandbox)
- Verify `BIGCOMMERCE_ACCESS_TOKEN` and `BIGCOMMERCE_B2B_MANAGEMENT_TOKEN` are production tokens
- Check server logs for API errors: `az containerapp logs show --name $APP_NAME --resource-group $RESOURCE_GROUP --follow`

### Currency shows wrong symbol

- The portal derives currency from order/invoice data returned by the BigCommerce API
- If orders use GBP, the `£` symbol is shown. USD shows `$`, EUR shows `€`
- Default fallback is `£` (GBP) when no currency data is available from the API

### Session/cookie issues when portal is in an iframe

- The portal uses `sameSite: 'lax'` for refresh token cookies
- If the portal is embedded in an iframe from a different domain, cookies may be blocked by browser privacy settings
- Ensure the BigCommerce storefront and the portal share a compatible cookie policy
