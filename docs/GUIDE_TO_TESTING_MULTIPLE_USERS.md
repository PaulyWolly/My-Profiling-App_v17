# Guide to Testing Multiple Users in a Chat App

When developing and testing a chat application that uses cookie-based refresh tokens (for security), you may encounter issues when trying to log in as multiple users in different tabs of the same browser. This guide explains why this happens and how to properly test multi-user chat scenarios.

---

## Why Does This Happen?
- **Cookies are shared** between all tabs and windows of the same browser for the same domain.
- **sessionStorage is isolated per tab**, but cannot be used for secure refresh tokens (which must be httpOnly cookies for security).
- If you log in as a different user in a new tab, the refresh token cookie is overwritten for all tabs, causing "session takeover" or "creep."

**This is a browser security feature and cannot be worked around in frontend code.**

---

## Best Practices for Testing Multiple Users

### 1. **Use Different Browsers**
- Open Chrome, Firefox, Edge, Safari, etc.
- Log in as a different user in each browser.

### 2. **Use Incognito/Private Windows**
- Open a new incognito (Chrome) or private (Firefox/Edge) window for each user.
- Each incognito/private window has its own isolated cookie/session storage.

### 3. **Use Browser Profiles**
- Chrome and Edge support multiple user profiles, each with its own cookies and storage.
- Set up a profile for each test user.

### 4. **Do Not Use Multiple Tabs in the Same Browser Session**
- Logging in as a different user in a new tab will overwrite the refresh token for all tabs.
- This will cause session takeover and is not supported by browser security.

---

## Quick Reference Table
| Method                | Isolated Sessions? | Recommended For Testing? |
|-----------------------|--------------------|-------------------------|
| Multiple Tabs         | ❌                | No                      |
| Multiple Browsers     | ✅                | Yes                     |
| Incognito/Private     | ✅                | Yes                     |
| Browser Profiles      | ✅                | Yes                     |

---

## Summary
- **For real users:** This is not a problem—users don't log in as two people in the same browser.
- **For testing:** Use different browsers, incognito/private windows, or browser profiles for each user.
- **Do not use multiple tabs in the same browser session for different users.**

---

Happy testing! 