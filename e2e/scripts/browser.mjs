import { existsSync } from 'node:fs';
import { chromium } from 'playwright';

export const chromePath = process.env.CHROME_PATH ?? '/usr/bin/google-chrome';

export const webglArguments = [
  '--no-sandbox',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist',
];

export const gpuArguments = ['--no-sandbox', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'];

const WSL_LIBRARY_DIRECTORY = '/usr/lib/wsl/lib';

export const wslGpuArguments = [...gpuArguments, '--use-gl=angle', '--use-angle=gl-egl'];

export const wslGpuEnvironment = {
  GALLIUM_DRIVER: 'd3d12',
  MESA_LOADER_DRIVER_OVERRIDE: 'd3d12',
  LD_LIBRARY_PATH: [WSL_LIBRARY_DIRECTORY, process.env.LD_LIBRARY_PATH].filter(Boolean).join(':'),
};

export function runsOnWsl() {
  return existsSync('/dev/dxg');
}

export function launchChrome(extraArguments = webglArguments, environment = {}) {
  return chromium.launch({
    executablePath: chromePath,
    args: extraArguments,
    env: { ...process.env, ...environment },
  });
}

export function launchGpuChrome() {
  return runsOnWsl() ? launchChrome(wslGpuArguments, wslGpuEnvironment) : launchChrome(gpuArguments);
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
