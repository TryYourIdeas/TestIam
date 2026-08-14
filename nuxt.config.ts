export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    // Server-only secrets (never exposed to the client)
    iam: {
      url: '',
      appId: '',
      clientSecret: '',
    },
    auth: {
      // The path IAM redirects back to with ?code=&state= — must exactly
      // match this app's registered authenticated_url on iam.
      authenticatedPath: '/authenticated',
    },
  },
  app: {
    head: {
      title: 'testiam',
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    },
  },
})
