# BigCommerce B2B Portal - Deployment Guide

This guide covers deploying your BigCommerce B2B Buyer Portal to various hosting platforms with production-ready configurations.

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Build Configuration](#build-configuration)
3. [Hosting Platforms](#hosting-platforms)
4. [Production Server Setup](#production-server-setup)
5. [BigCommerce Integration](#bigcommerce-integration)
6. [Monitoring & Maintenance](#monitoring--maintenance)

## Pre-Deployment Checklist

Before deploying your B2B portal, ensure you have completed these steps:

### ✅ Environment Configuration

- [ ] **Store Hash**: Set in `VITE_STORE_HASH`
- [ ] **B2B API URL**: Configured in `VITE_B2B_URL`
- [ ] **Channel ID**: Set in `VITE_CHANNEL_ID`
- [ ] **Assets Path**: Configured `VITE_ASSETS_ABSOLUTE_PATH`
- [ ] **Production Flag**: Set `VITE_IS_LOCAL_ENVIRONMENT=FALSE`

### ✅ BigCommerce Setup

- [ ] B2B Edition App installed and configured
- [ ] Custom buyer portal enabled in B2B settings
- [ ] Channel configured for B2B functionality
- [ ] CORS settings allow your domain

### ✅ Build Verification

- [ ] Application builds without errors
- [ ] All assets are generated correctly
- [ ] Environment variables are properly set
- [ ] Static files serve correctly

## Build Configuration

### Production Build Command

```bash
# Standard build
yarn build

# With production environment
NODE_ENV=production VITE_IS_LOCAL_ENVIRONMENT=FALSE yarn build

# Using the build script
chmod +x scripts/build-production.sh
./scripts/build-production.sh
