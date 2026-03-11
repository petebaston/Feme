# Deploying to Azure Container Apps

This guide walks through building the Docker image and deploying it to Azure Container Apps.

## Prerequisites

- [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli) installed
- An Azure subscription
- Docker installed locally (for building the image)
- Your `.env` file populated with all required values (see `.env.example`)

## Environment Variables

### Build-time variables (baked into the frontend bundle)

These are passed as `--build-arg` during `docker build`. They cannot be changed after the image is built.

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_STORE_HASH` | Yes | BigCommerce store hash (e.g. `pyrenapwe2`) |
| `VITE_CHANNEL_ID` | No | BigCommerce channel ID (default: `1`) |
| `VITE_LOCAL_APP_CLIENT_ID` | No | App client ID for B2B Edition |
| `VITE_IS_LOCAL_ENVIRONMENT` | No | Set to `FALSE` for production (default) |
| `VITE_ASSETS_ABSOLUTE_PATH` | No | CDN URL for static assets |
| `VITE_DISABLE_BUILD_HASH` | No | Disable build hashes in filenames |

### Runtime variables (set in Azure Container Apps)

These are injected as environment variables when the container starts.

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Strong random string for signing JWT tokens |
| `SESSION_SECRET` | Yes | Strong random string for session encryption |
| `BIGCOMMERCE_STORE_HASH` | Yes | BigCommerce store hash |
| `BIGCOMMERCE_CLIENT_ID` | Yes | BigCommerce API client ID |
| `BIGCOMMERCE_CLIENT_SECRET` | Yes | BigCommerce API client secret |
| `BIGCOMMERCE_ACCESS_TOKEN` | Yes | BigCommerce Store API access token |
| `BIGCOMMERCE_B2B_MANAGEMENT_TOKEN` | Yes | B2B Edition management API token |
| `PGDATABASE` | No | Database name (if not using DATABASE_URL) |
| `PGHOST` | No | Database host (if not using DATABASE_URL) |
| `PGPORT` | No | Database port (default: 5432) |
| `PGUSER` | No | Database username (if not using DATABASE_URL) |
| `PGPASSWORD` | No | Database password (if not using DATABASE_URL) |
| `PORT` | No | Server port (default: 5000) |

## Step-by-step deployment

### 1. Log in to Azure

```bash
az login
```

### 2. Set variables

```bash
RESOURCE_GROUP="b2b-portal-rg"
LOCATION="uksouth"
ACR_NAME="b2bportalacr"
APP_ENV="b2b-portal-env"
APP_NAME="b2b-portal"
```

### 3. Create a resource group

```bash
az group create --name $RESOURCE_GROUP --location $LOCATION
```

### 4. Create an Azure Container Registry

```bash
az acr create \
  --resource-group $RESOURCE_GROUP \
  --name $ACR_NAME \
  --sku Basic \
  --admin-enabled true
```

Get the login server name:

```bash
ACR_LOGIN_SERVER=$(az acr show --name $ACR_NAME --query loginServer --output tsv)
```

### 5. Build and push the Docker image

Log in to the registry:

```bash
az acr login --name $ACR_NAME
```

Build the image with your store's build-time variables:

```bash
docker build \
  --build-arg VITE_STORE_HASH=pyrenapwe2 \
  --build-arg VITE_CHANNEL_ID=1 \
  --build-arg VITE_IS_LOCAL_ENVIRONMENT=FALSE \
  -t $ACR_LOGIN_SERVER/b2b-portal:latest .
```

Push to ACR:

```bash
docker push $ACR_LOGIN_SERVER/b2b-portal:latest
```

### 6. Create an Azure Container Apps environment

```bash
az containerapp env create \
  --name $APP_ENV \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION
```

### 7. Deploy the container app

```bash
az containerapp create \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --environment $APP_ENV \
  --image $ACR_LOGIN_SERVER/b2b-portal:latest \
  --registry-server $ACR_LOGIN_SERVER \
  --registry-username $(az acr credential show --name $ACR_NAME --query username --output tsv) \
  --registry-password $(az acr credential show --name $ACR_NAME --query "passwords[0].value" --output tsv) \
  --target-port 5000 \
  --ingress external \
  --min-replicas 1 \
  --max-replicas 3 \
  --cpu 0.5 \
  --memory 1Gi \
  --env-vars \
    NODE_ENV=production \
    PORT=5000 \
    DATABASE_URL="<your-neon-database-url>" \
    JWT_SECRET="<generate-a-strong-random-string>" \
    SESSION_SECRET="<generate-a-strong-random-string>" \
    BIGCOMMERCE_STORE_HASH="pyrenapwe2" \
    BIGCOMMERCE_CLIENT_ID="<your-client-id>" \
    BIGCOMMERCE_CLIENT_SECRET="<your-client-secret>" \
    BIGCOMMERCE_ACCESS_TOKEN="<your-access-token>" \
    BIGCOMMERCE_B2B_MANAGEMENT_TOKEN="<your-b2b-management-token>"
```

### 8. Get the app URL

```bash
az containerapp show \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --query "properties.configuration.ingress.fqdn" \
  --output tsv
```

Your app will be available at `https://<fqdn>`.

## Updating the app

To deploy a new version:

```bash
docker build \
  --build-arg VITE_STORE_HASH=pyrenapwe2 \
  --build-arg VITE_CHANNEL_ID=1 \
  --build-arg VITE_IS_LOCAL_ENVIRONMENT=FALSE \
  -t $ACR_LOGIN_SERVER/b2b-portal:latest .

docker push $ACR_LOGIN_SERVER/b2b-portal:latest

az containerapp update \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --image $ACR_LOGIN_SERVER/b2b-portal:latest
```

## Updating environment variables

```bash
az containerapp update \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --set-env-vars "JWT_SECRET=<new-value>"
```

## Local testing with Docker

Before pushing to Azure, test locally:

```bash
docker compose up --build
```

Then open http://localhost:5000 in your browser. Make sure your `.env` file has all the required variables (copy from `.env.example`).

## Database notes

The app uses Neon PostgreSQL. Your existing Neon database works from Azure without changes — just set the same `DATABASE_URL` in the container environment. If you later want to migrate to Azure Database for PostgreSQL Flexible Server, update `DATABASE_URL` to point to the new instance and run the schema push:

```bash
npx drizzle-kit push
```
