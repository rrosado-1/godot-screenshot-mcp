import { exec } from 'child_process';
import { promisify } from 'util';
import { LIST_WINDOWS_COMMAND } from './powershell.js';
import { writeFile, unlink, appendFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { wslToWindowsPath, isWSL } from './screenshot.js';

const execAsync = promisify(exec);

export interface WindowInfo {
  handle: string;
  title: string;
}

interface WindowCache {
  timestamp: number;
  windows: WindowInfo[];
}

const CACHE_DURATION = 5000; // 5 seconds
let windowCache: Map<string, WindowCache> = new Map();

export async function listWindows(pattern?: string): Promise<WindowInfo[]> {
  const cacheKey = pattern || 'all';
  const cached = windowCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.windows;
  }
  
  // Use Windows temp directory if in WSL
  let tempDir = tmpdir();
  if (isWSL()) {
    try {
      const { stdout } = await execAsync('powershell.exe -Command "Write-Output $env:TEMP"');
      const winTempDir = stdout.trim();
      if (winTempDir && winTempDir !== ':TEMP' && winTempDir.includes('\\')) {
        tempDir = winTempDir.replace(/\\/g, '/').replace(/^([A-Z]):/, (_, drive) => `/mnt/${drive.toLowerCase()}`);
      } else {
        tempDir = '/mnt/c/Windows/Temp';
      }
    } catch {
      tempDir = '/mnt/c/Windows/Temp';
    }
  }
  const scriptPath = join(tempDir, `list-windows-${Date.now()}.ps1`);
  
  try {
    await writeFile(scriptPath, LIST_WINDOWS_COMMAND);
    const windowsScriptPath = isWSL() ? wslToWindowsPath(scriptPath) : scriptPath;
    const command = `powershell.exe -ExecutionPolicy Bypass -File "${windowsScriptPath}"`;
    const debugLog = `[${new Date().toISOString()}] CWD: ${process.cwd()}, ScriptPath: ${scriptPath}, WindowsPath: ${windowsScriptPath}, Command: ${command}\n`;
    await appendFile('/tmp/mcp-debug.log', debugLog).catch(() => {});
    const { stdout, stderr } = await execAsync(command, { timeout: 5000 });
    
    if (stderr) {
      await appendFile('/tmp/mcp-debug.log', `[${new Date().toISOString()}] PowerShell stderr: ${stderr}\n`).catch(() => {});
    }
    await appendFile('/tmp/mcp-debug.log', `[${new Date().toISOString()}] PowerShell stdout: ${stdout}\n`).catch(() => {});
    
    const windows: WindowInfo[] = [];
    const lines = stdout.trim().split('\n');
    
    for (const line of lines) {
      const [handle, title] = line.split('|');
      if (handle && title) {
        const windowTitle = title.trim();
        if (!pattern || windowTitle.toLowerCase().includes(pattern.toLowerCase())) {
          windows.push({ handle, title: windowTitle });
        }
      }
    }
    
    windowCache.set(cacheKey, { timestamp: Date.now(), windows });
    return windows;
  } catch (error) {
    throw new Error(`Failed to list windows: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    try {
      await unlink(scriptPath);
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

export async function findGodotDebugWindows(): Promise<WindowInfo[]> {
  const allWindows = await listWindows();
  return allWindows.filter(w => w.title.includes('(DEBUG)'));
}

export async function findGodotEditorWindows(): Promise<WindowInfo[]> {
  const allWindows = await listWindows();
  return allWindows.filter(w => w.title.endsWith('- Godot Engine'));
}

export async function findWindowByTitle(title: string, exact: boolean = false): Promise<WindowInfo | null> {
  const allWindows = await listWindows();
  
  if (exact) {
    return allWindows.find(w => w.title === title) || null;
  } else {
    return allWindows.find(w => w.title.includes(title)) || null;
  }
}

export function clearWindowCache(): void {
  windowCache.clear();
}