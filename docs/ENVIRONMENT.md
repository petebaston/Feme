# Environment Configuration Guide

This guide explains all environment variables used in the BigCommerce B2B Buyer Portal and how to configure them for different environments.

## Table of Contents

1. [Environment Variables Overview](#environment-variables-overview)
2. [Development Configuration](#development-configuration)
3. [Production Configuration](#production-configuration)
4. [Platform-Specific Settings](#platform-specific-settings)
5. [Security Considerations](#security-considerations)
6. [Validation & Testing](#validation--testing)

## Environment Variables Overview

### Required Variables

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `VITE_STORE_HASH` | BigCommerce store identifier | `abc123def456` | ✅ |
| `VITE_B2B_URL` | B2B Edition API endpoint | `https://api-b2b.bigcommerce.com` | ✅ |
| `VITE_CHANNEL_ID` | Store channel ID for B2B | `1` | ✅ |

### Optional Variables

| Variable | Description | Default | Environment |
|----------|-------------|---------|-------------|
| `VITE_IS_LOCAL_ENVIRONMENT` | Enable local development mode | `TRUE` | Development |
| `VITE_ASSETS_ABSOLUTE_PATH` | CDN URL for assets | `''` | Production |
| `VITE_DISABLE_BUILD_HASH` | Disable file hash in builds | `FALSE` | Production |
| `VITE_LOCAL_APP_CLIENT_ID` | B2B Edition app client ID | `dl7c39mdpul6hyc489yk0vzxl6jesyx` | Development |

### Server Variables

| Variable | Description | Default | Usage |
|----------|-------------|---------|-------|
| `NODE_ENV` | Node environment | `development` | Server |
| `PORT` | Server port | `5000` | Server |
| `SESSION_SECRET` | Session encryption key | Auto-generated | Server |

## Development Configuration

### Local Development Setup

Create a `.env` file in your project root:

```bash
# BigCommerce B2B Configuration
VITE_B2B_URL=https://api-b2b.bigcommerce.com
VITE_STORE_HASH=your_store_hash_here
VITE_CHANNEL_ID=1

# Development Settings
VITE_IS_LOCAL_ENVIRONMENT=TRUE
VITE_LOCAL_APP_CLIENT_ID=dl7c39mdpul6hyc489yk0vzxl6jesyx

# Assets (empty for local dev)
VITE_ASSETS_ABSOLUTE_PATH=

# Server Configuration
NODE_ENV=development
PORT=3001
SESSION_SECRET=your_local_session_secret
