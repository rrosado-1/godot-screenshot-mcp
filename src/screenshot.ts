import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile, writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { existsSync, readFileSync } from 'fs';
import { SCREENSHOT_COMMANDS, NIRCMD_COMMANDS } from './powershell.js';

const execAsync = promisify(exec);

export interface ScreenshotOptions {
  quality?: number;
  format?: 'png' | 'jpg';
  useNirCmd?: boolean;
}

export interface ScreenshotResult {
  base64: string;
  width?: number;
  height?: number;
  format: string;
}

// Throttling mechanism
let lastScreenshotTime = 0;
const SCREENSHOT_THROTTLE_MS = 500; // Max 2 per second

// Get Windows temp directory for WSL compatibility
async function getWindowsTempDir(): Promise<string> {
  if (isWSL()) {
    try {
      const { stdout } = await execAsync('powershell.exe -Command "Write-Output $env:TEMP"');
      const winTempDir = stdout.trim();
      
      // Check if we got a valid path (not just ":TEMP")
      if (winTempDir && winTempDir !== ':TEMP' && winTempDir.includes('\\')) {
        // Convert Windows path to WSL path
        const wslPath = winTempDir.replace(/\\/g, '/').replace(/^([A-Z]):/, (_, drive) => `/mnt/${drive.toLowerCase()}`);
        return wslPath;
      } else {
        // Fallback to common Windows temp directory
        return '/mnt/c/Windows/Temp';
      }
    } catch {
      return '/mnt/c/Windows/Temp';
    }
  }
  return tmpdir();
}

// Environment configuration
const CONFIG = {
  quality: parseInt(process.env.SCREENSHOT_QUALITY || '85'),
  format: (process.env.SCREENSHOT_FORMAT || 'png') as 'png' | 'jpg',
  tempDir: process.env.TEMP_DIR || tmpdir(),
  useNirCmd: process.env.USE_NIRCMD === 'true'
};

let windowsTempDir: string | null = null;
let powerShellAccessCache: boolean | null = null;
let powerShellAccessCheckTime = 0;
const POWERSHELL_CACHE_TTL = 30000; // 30 seconds

// WSL detection
export function isWSL(): boolean {
  try {
    return existsSync('/proc/version') && 
           readFileSync('/proc/version', 'utf8').toLowerCase().includes('microsoft');
  } catch {
    return false;
  }
}

// Path translation utilities
export function wslToWindowsPath(wslPath: string): string {
  return wslPath
    .replace(/^\/mnt\/([a-z])/, (_, drive) => `${drive.toUpperCase()}:`)
    .replace(/\//g, '\\');
}

export function windowsToWslPath(winPath: string): string {
  return winPath
    .replace(/^([A-Z]):/, (_, drive) => `/mnt/${drive.toLowerCase()}`)
    .replace(/\\/g, '/');
}

async function throttleScreenshot(): Promise<void> {
  const now = Date.now();
  const timeSinceLastScreenshot = now - lastScreenshotTime;
  
  if (timeSinceLastScreenshot < SCREENSHOT_THROTTLE_MS) {
    const delay = SCREENSHOT_THROTTLE_MS - timeSinceLastScreenshot;
    lastScreenshotTime = now + delay; // Reserve the slot to prevent race conditions
    await new Promise(resolve => setTimeout(resolve, delay));
  } else {
    lastScreenshotTime = now;
  }
}

export async function captureWindow(
  windowTitle: string, 
  options: ScreenshotOptions = {}
): Promise<ScreenshotResult> {
  await throttleScreenshot();
  
  // const quality = options.quality || CONFIG.quality;
  const format = options.format || CONFIG.format;
  const useNirCmd = options.useNirCmd !== undefined ? options.useNirCmd : CONFIG.useNirCmd;
  
  // Initialize Windows temp directory if needed
  if (!windowsTempDir) {
    windowsTempDir = await getWindowsTempDir();
  }
  
  const timestamp = Date.now();
  const filename = `screenshot-${timestamp}.${format}`;
  const tempPath = join(windowsTempDir, filename);
  const windowsPath = isWSL() ? wslToWindowsPath(tempPath) : tempPath;
  
  try {
    if (useNirCmd) {
      const command = NIRCMD_COMMANDS.captureWindow(windowTitle, windowsPath);
      await execAsync(command, { timeout: 5000 });
    } else {
      const script = SCREENSHOT_COMMANDS.captureWindow(windowTitle, windowsPath);
      const scriptPath = join(windowsTempDir, `capture-${timestamp}.ps1`);
      await writeFile(scriptPath, script);
      
      const command = `powershell.exe -ExecutionPolicy Bypass -File "${wslToWindowsPath(scriptPath)}"`;
      const { stdout, stderr } = await execAsync(command, { timeout: 5000 });
      
      if (stderr || !stdout.includes('SUCCESS')) {
        throw new Error(`PowerShell error: ${stderr || 'Unknown error'}`);
      }
      
      await unlink(scriptPath).catch(() => {});
    }
    
    // Read the captured image
    const imageBuffer = await readFile(tempPath);
    const base64 = imageBuffer.toString('base64');
    
    // Clean up
    await unlink(tempPath).catch(() => {});
    
    return {
      base64,
      format
    };
  } catch (error) {
    // Clean up on error
    try {
      await unlink(tempPath);
    } catch {}
    
    throw new Error(`Failed to capture window "${windowTitle}": ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function captureScreen(options: ScreenshotOptions = {}): Promise<ScreenshotResult> {
  await throttleScreenshot();
  
  // const quality = options.quality || CONFIG.quality;
  const format = options.format || CONFIG.format;
  const useNirCmd = options.useNirCmd !== undefined ? options.useNirCmd : CONFIG.useNirCmd;
  
  // Initialize Windows temp directory if needed
  if (!windowsTempDir) {
    windowsTempDir = await getWindowsTempDir();
  }
  
  const timestamp = Date.now();
  const filename = `fullscreen-${timestamp}.${format}`;
  const tempPath = join(windowsTempDir, filename);
  const windowsPath = isWSL() ? wslToWindowsPath(tempPath) : tempPath;
  
  try {
    if (useNirCmd) {
      const command = NIRCMD_COMMANDS.captureScreen(windowsPath);
      await execAsync(command, { timeout: 5000 });
    } else {
      const script = SCREENSHOT_COMMANDS.captureScreen(windowsPath);
      const scriptPath = join(windowsTempDir, `capture-${timestamp}.ps1`);
      await writeFile(scriptPath, script);
      
      const command = `powershell.exe -ExecutionPolicy Bypass -File "${wslToWindowsPath(scriptPath)}"`;
      const { stdout, stderr } = await execAsync(command, { timeout: 5000 });
      
      if (stderr || !stdout.includes('SUCCESS')) {
        throw new Error(`PowerShell error: ${stderr || 'Unknown error'}`);
      }
      
      await unlink(scriptPath).catch(() => {});
    }
    
    // Read the captured image
    const imageBuffer = await readFile(tempPath);
    const base64 = imageBuffer.toString('base64');
    
    // Clean up
    await unlink(tempPath).catch(() => {});
    
    return {
      base64,
      format
    };
  } catch (error) {
    // Clean up on error
    try {
      await unlink(tempPath);
    } catch {}
    
    throw new Error(`Failed to capture screen: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function checkPowerShellAccess(): Promise<boolean> {
  const now = Date.now();
  
  // Return cached result if still valid
  if (powerShellAccessCache !== null && (now - powerShellAccessCheckTime) < POWERSHELL_CACHE_TTL) {
    return powerShellAccessCache;
  }
  
  try {
    const { stdout } = await execAsync('powershell.exe -Command "Write-Output \'OK\'"', { timeout: 2000 });
    powerShellAccessCache = stdout.trim() === 'OK';
    powerShellAccessCheckTime = now;
    return powerShellAccessCache;
  } catch {
    powerShellAccessCache = false;
    powerShellAccessCheckTime = now;
    return false;
  }
}

export async function checkNirCmdAccess(): Promise<boolean> {
  try {
    await execAsync('nircmd.exe help', { timeout: 2000 });
    return true;
  } catch {
    return false;
  }
}