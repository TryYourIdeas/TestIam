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
      // The app URL IAM redirects back to with ?code=&state=
      authenticatedPath: '/',
    },
    public: {
      auth: {
        loginPath: '/login',
      },
    },
  },
  app: {
    head: {
      title: 'testiam',
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    },
  },
})
