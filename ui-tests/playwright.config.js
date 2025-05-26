/**
 * Configuration for Playwright using default from @jupyterlab/galata
 */

module.exports = {
  reporter: [
    [process.env.CI ? 'github' : 'list'],
    ['html', { open: process.env.CI ? 'never' : 'on-failure' }]
  ],
  reportSlowTests: null,
  timeout: 60000,
  use: {
    acceptDownloads: true,
    appPath: '',
    autoGoto: false,
    baseURL: 'http://localhost:8899',
    trace: 'retain-on-failure',
    video: 'retain-on-failure'
  },
  webServer: {
    command: 'jlpm start',
    port: 8899,
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI
  }
};
