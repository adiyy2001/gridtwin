import { chromium } from 'playwright';

export const chromePath = process.env.CHROME_PATH ?? '/usr/bin/google-chrome';

export const webglArguments = [
  '--no-sandbox',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist',
];

export const gpuArguments = ['--no-sandbox', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'];

export function launchChrome(extraArguments = webglArguments) {
  return chromium.launch({ executablePath: chromePath, args: extraArguments });
}

export async function describeBrowser(browser, page) {
  const info = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    const extension = gl?.getExtension('WEBGL_debug_renderer_info');
    return {
      userAgent: navigator.userAgent,
      renderer: gl && extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : 'no WebGL',
      logicalCores: navigator.hardwareConcurrency,
      deviceMemoryGigabytes: navigator.deviceMemory ?? null,
    };
  });
  return { browser: 'chromium', version: browser.version(), ...info };
}
