# BigCommerce B2B Portal - Complete Setup Guide

This guide provides comprehensive instructions for setting up your BigCommerce B2B Buyer Portal from scratch.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [BigCommerce Configuration](#bigcommerce-configuration)
3. [Local Development Setup](#local-development-setup)
4. [Environment Configuration](#environment-configuration)
5. [Testing Your Setup](#testing-your-setup)
6. [Troubleshooting](#troubleshooting)

## Prerequisites

### System Requirements

- **Node.js**: Version ≥22.16.0
  ```bash
  # Check your Node.js version
  node --version
  
  # Install via nvm (recommended)
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
  nvm install 22.16.0
  nvm use 22.16.0
  ```

- **Yarn Package Manager**: v1.22.17+
  ```bash
  # Install Yarn globally
  npm install -g yarn
  
  # Verify installation
  yarn --version
  ```

### BigCommerce Requirements

1. **B2B Edition App Access**: Ensure you have access to the BigCommerce B2B Edition app
2. **Store Information**: You'll need your store hash and channel ID
3. **Admin Permissions**: Admin access to configure the B2B app settings

## BigCommerce Configuration

### Step 1: Access B2B Edition App

1. Log in to your BigCommerce admin panel
2. Navigate to **Apps** → **My Apps**
3. Find and open **BigCommerce B2B Edition**

### Step 2: Configure Storefronts

1. In the B2B Edition dashboard, go to **Storefronts**
2. Select your desired channel
3. Navigate to **Buyer Portal** settings
4. Choose **"Custom (use for your self-hosted buyer portal)"**
5. Save your changes

### Step 3: Gather Required Information

You'll need these details for configuration:

- **Store Hash**: Found in your store's URL (`store-{hash}.mybigcommerce.com`)
- **Channel ID**: Available in the Storefronts section
- **B2B API URL**: `https://api-b2b.bigcommerce.com` (default)

## Local Development Setup

### Step 1: Clone Repository

```bash
# Clone the repository
git clone <your-repository-url>
cd b2b-buyer-portal

# Install dependencies
yarn install

# Prepare development environment
yarn prepare
