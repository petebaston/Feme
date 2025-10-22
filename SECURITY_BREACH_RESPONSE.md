# SECURITY BREACH - CREDENTIAL ROTATION REQUIRED

## Incident Summary
Date: October 22, 2025
Severity: **CRITICAL**

The `.env` file containing sensitive credentials was committed to the GitHub repository and exposed in the public git history. This file has now been completely removed from the repository history, but all exposed credentials must be rotated immediately.

## Exposed Credentials (ROTATE IMMEDIATELY)

### 1. PostgreSQL Database (Neon) - **CRITICAL**
- **Service**: Neon PostgreSQL Database
- **Host**: `ep-morning-sea-aelkovr0.c-2.us-east-2.aws.neon.tech`
- **Database**: `neondb`
- **User**: `neondb_owner`
- **Password**: `npg_wDBsxnXM6h1b` (EXPOSED)
- **Action Required**:
  - Immediately rotate database password in Neon dashboard
  - Update DATABASE_URL in new .env file (never commit)
  - Review database access logs for unauthorized access
  - Consider creating a new database if breach occurred

### 2. BigCommerce API Credentials - **CRITICAL**
- **Store Hash**: `pyrenapwe2`
- **Client ID**: `kfhh6npk8xdojk392kdlozd397mqba5` (EXPOSED)
- **Client Secret**: `a930204ec480d751dc102ca0f060c72fa0c9e41e61635eb93adbe5e0b5e552d6` (EXPOSED)
- **Access Token**: `2pd8bmjy2c0vcjsjjevko2xrjl1tu3x` (EXPOSED)
- **Action Required**:
  - Log into BigCommerce admin panel immediately
  - Revoke the exposed access token
  - Delete the exposed API account/app
  - Create new API credentials
  - Update all .env files with new credentials

### 3. BigCommerce B2B Management Token - **HIGH**
- **Token Type**: JWT (JSON Web Token)
- **Token**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (EXPOSED)
- **Email**: `pete@cliencywebdesign.co.uk`
- **Action Required**:
  - Regenerate B2B management token
  - Update BIGCOMMERCE_B2B_MANAGEMENT_TOKEN in .env

### 4. Session Secret - **HIGH**
- **Value**: `hBHfwVv8xx4OHS4el6WnD/HoYimhaAolBUJnhEhU2rvQL29qPH0V/hjCFqh1F9kJ9i+JeQWr0Rr/ylwJyV79sA==` (EXPOSED)
- **Action Required**:
  - Generate new session secret: `node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"`
  - Update SESSION_SECRET in .env
  - All existing user sessions will be invalidated

## Remediation Steps Completed ✅

1. ✅ Removed .env from git tracking
2. ✅ Created comprehensive .gitignore file to prevent future exposure
3. ✅ Removed .env from entire git history (86 commits rewritten)
4. ✅ Cleaned up filter-branch backup refs
5. ✅ Force pushed to remote repository to clean GitHub history
6. ✅ Verified .env no longer exists in git history

## Next Steps (IMMEDIATE ACTION REQUIRED)

### Step 1: Rotate Database Credentials (within 1 hour)
```bash
# 1. Log into Neon dashboard: https://console.neon.tech/
# 2. Navigate to your project
# 3. Reset the database password
# 4. Update your local .env with new credentials
```

### Step 2: Rotate BigCommerce Credentials (within 1 hour)
```bash
# 1. Log into BigCommerce: https://login.bigcommerce.com/
# 2. Go to Advanced Settings > API Accounts
# 3. Delete the compromised API account
# 4. Create a new API account with required scopes
# 5. Update your local .env with new credentials
```

### Step 3: Rotate Session Secret (within 1 hour)
```bash
# Generate new session secret
node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"
# Update SESSION_SECRET in your local .env
```

### Step 4: Monitor for Unauthorized Access
- Check Neon database logs for suspicious queries
- Review BigCommerce API access logs
- Monitor application logs for unusual activity
- Check for unauthorized orders or data access

### Step 5: Create New .env File
```bash
# Copy from example
cp .env.example .env

# Fill in with NEW rotated credentials
# NEVER commit this file
```

## GitGuardian Alerts
The following GitGuardian alerts were triggered and should be marked as resolved after credential rotation:

- Alert #21794859: JSON Web Token (High) - .env
- Alert #21794860: Generic High Entropy Secret (High) - .env
- Alert #21794862: PostgreSQL Credentials (Critical) - .env
- Alert #21794863: PostgreSQL Credentials (Critical) - .env
- Alert #21794864: Generic High Entropy Secret (High) - .env
- Alert #21794865: Generic High Entropy Secret (High) - .env
- Alert #21794861: Generic Password (High) - client/src/pages/login.tsx

## Prevention Measures Implemented

1. **Enhanced .gitignore**: Added comprehensive patterns for sensitive files
2. **Git History Cleaned**: All traces of .env removed from repository
3. **Documentation**: This incident report for future reference

## Recommended Additional Security Measures

1. **Enable GitHub Secret Scanning**: Ensure it's active on your repository
2. **Pre-commit Hooks**: Install git-secrets or similar to prevent future commits
3. **Environment Variable Management**: Consider using a secrets manager (AWS Secrets Manager, HashiCorp Vault)
4. **Team Training**: Educate team on secure credential handling
5. **Regular Audits**: Schedule periodic security reviews
6. **2FA**: Enable two-factor authentication on all services

## Timeline

- **October 21, 2025**: GitGuardian detected exposed credentials in repository
- **October 22, 2025**: Security breach addressed, git history cleaned, credentials documented for rotation

## Contact

For questions about this incident or security concerns:
- Email: pete@cliencywebdesign.co.uk
- Repository: https://github.com/petebaston/Feme

---

**Status**: Repository cleaned ✅ | Credentials awaiting rotation ⚠️
