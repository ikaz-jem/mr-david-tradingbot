# Enrivea Signal mobile

Expo SDK 58 app for customer accounts on Android and iOS. The web app in the repository root owns the backend, admin controls, billing integrations, and scheduled workers.

## Local development

1. Run `npm install` in this folder.
2. Set `EXPO_PUBLIC_API_URL=http://localhost:3000` in `.env.local` for Expo Web on this computer. For a physical phone, use your computer's LAN IP and run Next.js on an address reachable from the phone. For deployed builds, use the HTTPS backend origin. Without a local setting, the app defaults to `https://enriveasignal.com`.
3. Run `npx expo start`. Use an Android emulator or iOS simulator for the UI. Remote notifications require a development or production build on a physical device.
4. Run `npx tsc --noEmit`, `npx expo lint`, and `npx expo export --platform android --platform ios` before publishing.

The mobile API lives at `/api/mobile` in the root Next.js project. Deploy the backend changes before pointing a native build at the production domain. The app stores only its revocable session token in SecureStore; exchange credentials are submitted over HTTPS and remain server-side.

## Native builds and push

1. Sign in to the Enrivea Expo account and run `npx eas-cli@latest init` here. This writes the EAS project ID required by `getExpoPushTokenAsync`.
2. Configure Android FCM V1 and Apple APNs credentials in EAS. Use `npx eas-cli@latest build --profile development --platform android` or the iOS equivalent for device testing.
3. Deploy the root app with `CRON_SECRET`, and ensure `/api/internal/push-delivery` runs every minute. The existing n8n recovery pattern can also call `POST /api/internal/scheduler-recovery/push-delivery` with `Authorization: Bearer <CRON_SECRET>` if Vercel misses a run. Test permission consent, background receipt, tap-through, logout, and token invalidation on physical devices.
4. Build release candidates with `npx eas-cli@latest build --profile production --platform all`. Apple and Google developer accounts, signing, and store review remain required.

Push payloads are intentionally generic. The app loads the actual notification from its authenticated API when opened, so account and trade details are not sent to the push provider.

## Billing limitation

Native activation and credit purchases are withheld until App Store and Google Play digital-goods billing is implemented with products, receipt verification, and server-side credit grants. Existing web purchases and credit usage are visible in the app. The store account, product identifiers, and merchant configuration are needed before native checkout can be completed. See [PARITY.md](./PARITY.md).
