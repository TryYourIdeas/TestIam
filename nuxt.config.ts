export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  css: ['~/assets/css/main.css'],
  modules: ['nuxt-iam-client'],
  iamClient: {
    // Server-only secrets (never exposed to the client)
    iam: {
      url: '',
      appId: '',
      clientSecret: '',
    },
    // authenticatedPath/afterLoginPath/notAuthenticatedPath/afterLogoutPath
    // all match this app's defaults already, so left unset here.
  },
  app: {
    head: {
      title: 'testiam',
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    },
  },
})
