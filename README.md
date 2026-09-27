# ReyGames

PlayStation digital game storefront optimized for Ghana, featuring USD catalog pricing with live GHS currency conversion, Paystack checkout (Mobile Money & Cards), instant customer digital fulfillment tracking, customer Google authentication, and a secure administrator portal.

---

## Project Overview

ReyGames provides an end-to-end digital gaming experience:
- **Public Storefront**: Modern PlayStation game library with responsive UI, real-time search, console filtering (PS5 & PS4), and genre exploration.
- **Mobile Experience**: Horizontal swipe carousel card layouts inspired by modern mobile UX, with full-width real-time search directly above console/genre filters.
- **Transparent Pricing**: Game catalog priced in USD with live conversion to Ghana Cedis (GH₵) based on configurable exchange rates.
- **Paystack Checkout**: Seamless Ghana payment integration supporting Mobile Money (MTN, Telecel, AT) and debit/credit cards.
- **Order Tracking & Fulfillment**: Dedicated order lookup with unique tokens, revealing delivered PSN account credentials and step-by-step setup guides upon verified payment.
- **My Games**: Customer library accessible via Google sign-in to review all previous purchases and credentials.
- **Administration Portal (`/admin`)**:
  - Secure `HttpOnly`, `SameSite` server-managed session cookies (no tokens in `localStorage`).
  - Brute force protection with IP rate limiting.
  - CSRF header and Origin validation on mutating endpoints.
  - Complete order management, manual/automatic Paystack reconciliation, conflict resolution, and automated delivery email dispatch.
  - Catalog management: add/edit games, toggle active/archived state, Cloudinary cover uploads.
  - Account tiers, exchange rates, email notification diagnostic test suites, and audit logging.

---

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS, Lucide React icons, Vite
- **Backend**: Node.js, Express, TypeScript (`tsx` runner), Firebase Firestore / local disk fallback
- **Authentication**:
  - Storefront Customers: Firebase Authentication (Google Sign-In)
  - Administrator Portal: Server-side cryptographic HMAC session, issued via `HttpOnly` cookie
- **Payments**: Paystack API (transaction initialize, verify, webhook signature verification)
- **Email Delivery**: Multi-provider support (Gmail SMTP via Google App Passwords, Resend API, SendGrid API, Custom SMTP)
- **Media Storage**: Cloudinary API for high-resolution game cover uploads

---

## Local Development

### Prerequisites
- Node.js (v18 or higher recommended)
- npm or bun

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/jerkboom/reygames.git
   cd reygames
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and fill in your Paystack, Admin, and Email provider credentials.

---

## Required Environment Variables

Refer to `.env.example` for the complete list of variables. The core variables include:

| Variable | Description | Example / Note |
|---|---|---|
| `PORT` | Server listening port | `3000` |
| `APP_URL` | Public application URL | `http://localhost:3000` |
| `VITE_PAYSTACK_PUBLIC_KEY` | Paystack public key for frontend | `pk_test_...` or `pk_live_...` |
| `PAYSTACK_SECRET_KEY` | Paystack secret key (server-side only) | `sk_test_...` or `sk_live_...` |
| `ADMIN_EMAIL` | Authorized administrator login email | `admin@example.com` |
| `ADMIN_PASSWORD` | Administrator password | Secure password |
| `ADMIN_SESSION_SECRET` | Cryptographic secret for signing admin cookies | High-entropy random string |
| `GMAIL_USER` | Gmail account for SMTP notifications | `yourstore@gmail.com` |
| `GMAIL_APP_PASSWORD` | 16-character Google App Password | `xxxx xxxx xxxx xxxx` |
| `EMAIL_FROM` | Sender display name and address | `"ReyGames <orders@yourdomain.com>"` |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name for game covers | `your-cloud-name` |
| `CLOUDINARY_API_KEY` | Cloudinary API key | `your-api-key` |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret | `your-api-secret` |

---

## Running Frontend & Backend

The project uses a unified full-stack architecture where Express mounts Vite middlewares during development:

```bash
# Start development server (port 3000)
npm run dev

# Run TypeScript type check / linting
npm run lint

# Build production bundle
npm run build

# Start production server
npm start
```

---

## Production Deployment Notes

1. **Environment Security**: Never commit `.env` files or hardcode API keys into version control. Configure environment variables directly in your hosting platform (e.g., Google Cloud Run, Railway, Render, Fly.io, Heroku, or VPS).
2. **HTTPS & Cookies**: Admin authentication uses `HttpOnly` and `SameSite` cookies. In production environments behind reverse proxies, ensure `X-Forwarded-Proto: https` is enabled so `Secure` cookie attributes function properly.
3. **Paystack Webhook**: Configure your Paystack Dashboard webhook URL to:
   ```
   https://yourdomain.com/api/payment/webhook
   ```
4. **Email Notifications**: Ensure your chosen email provider (Gmail SMTP, Resend, or SendGrid) is verified so purchase and fulfillment notifications reach customer inboxes reliably.
