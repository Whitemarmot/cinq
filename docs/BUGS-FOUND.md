# 🐛 BUGS FOUND — QA Report

> **QA Lead:** Automated E2E Testing  
> **Date:** 2026-01-31  
> **Status:** Pre-Deployment Review

---

## Summary

| Severity | Count |
|----------|-------|
| 🔴 Critical | 0 |
| 🟠 High | 2 |
| 🟡 Medium | 5 |
| 🔵 Low | 4 |

---

## 🔴 Critical Issues

### BUG-001: ~~Email Service Import Missing~~ ✅ RESOLVED
**Status:** FALSE POSITIVE - `email-send.js` exists.

---

## 🟠 High Issues

### BUG-002: Waitlist Uses Wrong Service Key Variable Name
**File:** `netlify/functions/waitlist.js:4`  
**Severity:** High  

```javascript
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY  // Different from other functions
);
```

**Problem:** Uses `SUPABASE_SERVICE_KEY` while other functions use `SUPABASE_SERVICE_ROLE_KEY`. Inconsistent naming could lead to deployment issues.

**Fix:** Standardize to `SUPABASE_SERVICE_ROLE_KEY || SUPABASE_SERVICE_KEY`

---

### BUG-003: ~~Delete Contact Returns Wrong Remaining Count~~ ✅ RESOLVED
**Status:** FALSE POSITIVE - Code is correct.

---

### BUG-004: No CORS DELETE Method in Headers
**File:** `netlify/functions/gift-utils.js:110`  
**Severity:** High  

```javascript
const headers = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',  // Missing DELETE!
```

**Problem:** DELETE method is not in CORS allowed methods. Browser DELETE requests will fail with CORS error.

**Fix:** Change to `'GET, POST, DELETE, OPTIONS'`

---

### BUG-005: Auth Register Uses listUsers() - Performance Issue
**File:** `netlify/functions/auth-register.js:113`  
**Severity:** High (Performance)  

```javascript
const { data: existingUsers } = await supabase.auth.admin.listUsers();
const emailExists = existingUsers?.users?.some(
    u => u.email?.toLowerCase() === email.toLowerCase()
);
```

**Problem:** Fetches ALL users to check if one email exists. This will become extremely slow and expensive as user base grows (N users = N fetched).

**Fix:** Use a direct query or let the createUser fail with duplicate error:
```javascript
// Better approach
const { data, error } = await supabase.auth.admin.getUserByEmail(email);
if (data) return error('Email already exists', 409);
```

---

## 🟡 Medium Issues

### BUG-006: Rate Limit Check Ignores Errors
**File:** `netlify/functions/auth-register.js:84-87`  
**Severity:** Medium  

```javascript
if (rateError) {
    console.error('Rate limit check error:', rateError);
    // Continue anyway - don't block on rate limit errors
}
```

**Problem:** If the rate limit RPC function doesn't exist (e.g., not deployed), registration silently continues without rate limiting. This is a security concern.

**Fix:** At minimum, log a warning that rate limiting is disabled.

---

### BUG-007: Login Attempts Table Errors Silently Swallowed
**File:** `netlify/functions/auth-login.js:102`  
**Severity:** Medium  

```javascript
.catch(() => {
    // Table might not exist yet, ignore
});
```

**Problem:** Logging failed login attempts silently fails if table doesn't exist. This means rate limiting won't work until table is created, and there's no visible indication.

**Fix:** Log a warning message.

---

### BUG-008: Message Query Uses Raw String Interpolation
**File:** `netlify/functions/messages.js:142`  
**Severity:** Medium (Security)  

```javascript
.or(`and(sender_id.eq.${user.id},receiver_id.eq.${contactId}),and(sender_id.eq.${contactId},receiver_id.eq.${user.id})`)
```

**Problem:** While user.id comes from auth and contactId is validated as UUID, this pattern of string interpolation in queries is fragile and could lead to injection if validation is bypassed.

**Fix:** Use parameterized queries or verify UUIDs more strictly.

---

### BUG-009: Inconsistent Error Response Format
**File:** Multiple files  
**Severity:** Medium  

`waitlist.js` returns:
```json
{"error": "already_registered"}
```

`contacts.js` returns:
```json
{"success": false, "error": "message", "details": {"code": "ALREADY_CONTACT"}}
```

**Problem:** Inconsistent error response format makes frontend error handling difficult.

**Fix:** Standardize all responses to use `gift-utils.error()` function.

---

### BUG-010: Contacts API Missing Rate Limiting
**File:** `netlify/functions/contacts.js`  
**Severity:** Medium  

**Problem:** No rate limiting on contact addition. A malicious user could spam the API trying to find valid emails (user enumeration via different error messages for "not on Cinq" vs other errors).

**Fix:** Add rate limiting similar to auth endpoints.

---

## 🔵 Low Issues

### BUG-011: Hardcoded Contact Limit
**File:** `netlify/functions/contacts.js:147, 176`  
**Severity:** Low  

```javascript
if (currentCount >= 5) {
```

**Problem:** Contact limit is hardcoded as `5` in multiple places. If limit ever changes, need to update in multiple locations.

**Fix:** Use a constant: `const CONTACT_LIMIT = 5;`

---

### BUG-012: Missing Input Sanitization for Gift Message
**File:** `netlify/functions/gift-create.js` (if exists)  
**Severity:** Low  

The API documentation mentions `gift_message` field (max 500 chars) but there's no visible sanitization in the code reviewed.

**Fix:** Ensure HTML/script sanitization on gift messages.

---

### BUG-013: No Pagination for Waitlist Count
**File:** `netlify/functions/waitlist.js`  
**Severity:** Low  

```javascript
const { count } = await supabase
    .from('waitlist')
    .select('*', { count: 'exact', head: true });
```

**Problem:** Count query should be efficient (head: true), but if waitlist grows very large, consider caching this value.

**Fix:** Consider caching or approximate counts for very large tables.

---

### BUG-014: Console.log in Production
**File:** Multiple files  
**Severity:** Low  

Many `console.log` and `console.error` statements remain. These work in Netlify but add overhead and may leak info.

**Fix:** Use structured logging or remove debug statements.

---

## 📋 Recommendations

1. **Create email-send.js** - Critical blocker for registration
2. **Fix CORS headers** - Add DELETE to allowed methods
3. **Optimize email check** - Replace listUsers() with targeted query
4. **Standardize error responses** - Use gift-utils everywhere
5. **Add rate limiting to contacts API**
6. **Run database migrations** - Ensure all tables (login_attempts, etc.) exist

---

## ✅ What's Working Well

- Gift code generation with 128-bit entropy ✅
- Password validation (8+ chars, letter, number) ✅
- Contact limit enforcement (both API and DB trigger) ✅
- JWT authentication flow ✅
- Message relationship validation ✅
- Ping functionality design ✅

---

*Report generated by automated QA testing*
