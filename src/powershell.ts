// Simple PowerShell commands that are less likely to trigger antivirus
export const LIST_WINDOWS_COMMAND = `Get-Process | Where-Object {$_.MainWindowTitle -ne ""} | ForEach-Object { Write-Output "$($_.Id)|$($_.MainWindowTitle)" }`;

// Sanitize paths to prevent command injection
function sanitizePath(path: string): string {
  // Remove dangerous characters and validate path format
  return path.replace(/[;&|`$]/g, '').replace(/'/g, "''");
}

// Sanitize window titles to prevent injection
function sanitizeWindowTitle(title: string): string {
  return title.replace(/'/g, "''").replace(/[;&|`$]/g, '');
}

export const SCREENSHOT_COMMANDS = {
  listWindows: () => LIST_WINDOWS_COMMAND,
  
  captureWindow: (windowTitle: string, outputPath: string) => {
    const safePath = sanitizePath(outputPath);
    const safeTitle = sanitizeWindowTitle(windowTitle);
    return `
Add-Type -AssemblyName System.Drawing,System.Windows.Forms

# Find the target window process
$targetProcess = Get-Process | Where-Object {$_.MainWindowTitle -eq '${safeTitle}'}
if (-not $targetProcess) {
    # Try partial match if exact match fails
    $targetProcess = Get-Process | Where-Object {$_.MainWindowTitle -like "*${safeTitle}*"} | Select-Object -First 1
}

if (-not $targetProcess -or $targetProcess.MainWindowHandle -eq [IntPtr]::Zero) {
    throw "Window not found: ${safeTitle}"
}

$hwnd = $targetProcess.MainWindowHandle

# Get window bounds using Windows API
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32 {
    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hwnd, out RECT lpRect);
    [DllImport("user32.dll")]
    public static extern bool GetClientRect(IntPtr hwnd, out RECT lpRect);
    [DllImport("user32.dll")]
    public static extern bool ClientToScreen(IntPtr hwnd, ref POINT lpPoint);
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hwnd);
    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hwnd, int nCmdShow);
}
public struct RECT {
    public int Left; public int Top; public int Right; public int Bottom;
}
public struct POINT {
    public int X; public int Y;
}
"@

# Bring window to foreground and ensure it's visible
[Win32]::ShowWindow($hwnd, 9) # SW_RESTORE
[Win32]::SetForegroundWindow($hwnd)
Start-Sleep -Milliseconds 200  # Give time for window to come to front

$rect = New-Object RECT
[Win32]::GetWindowRect($hwnd, [ref]$rect)
$width = $rect.Right - $rect.Left
$height = $rect.Bottom - $rect.Top

if ($width -le 0 -or $height -le 0) {
    throw "Invalid window dimensions: $width x $height"
}

# Use screen capture from window position instead of PrintWindow for GPU content
$screenWidth = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Width
$screenHeight = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Height
$screenBitmap = New-Object System.Drawing.Bitmap($screenWidth, $screenHeight)
$screenGraphics = [System.Drawing.Graphics]::FromImage($screenBitmap)
$screenGraphics.CopyFromScreen(0, 0, 0, 0, $screenBitmap.Size)

# Crop to window area
$windowBitmap = New-Object System.Drawing.Bitmap($width, $height)
$windowGraphics = [System.Drawing.Graphics]::FromImage($windowBitmap)
$sourceRect = New-Object System.Drawing.Rectangle($rect.Left, $rect.Top, $width, $height)
$destRect = New-Object System.Drawing.Rectangle(0, 0, $width, $height)
$windowGraphics.DrawImage($screenBitmap, $destRect, $sourceRect, [System.Drawing.GraphicsUnit]::Pixel)

$windowBitmap.Save('${safePath}')
$windowGraphics.Dispose()
$windowBitmap.Dispose()
$screenGraphics.Dispose()
$screenBitmap.Dispose()
Write-Output 'SUCCESS'
`;
  },

  captureScreen: (outputPath: string) => {
    const safePath = sanitizePath(outputPath);
    return `Add-Type -AssemblyName System.Drawing,System.Windows.Forms; $screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds; $bitmap = New-Object System.Drawing.Bitmap $screen.Width,$screen.Height; $graphics = [System.Drawing.Graphics]::FromImage($bitmap); $graphics.CopyFromScreen(0,0,0,0,$bitmap.Size); $bitmap.Save('${safePath}'); $graphics.Dispose(); $bitmap.Dispose(); Write-Output 'SUCCESS'`;
  }
};

export const NIRCMD_COMMANDS = {
  captureWindow: (windowTitle: string, outputPath: string) => {
    const safePath = sanitizePath(outputPath);
    const safeTitle = sanitizeWindowTitle(windowTitle);
    return `nircmd.exe savescreenshotwin "${safeTitle}" "${safePath}"`;
  },
  
  captureScreen: (outputPath: string) => {
    const safePath = sanitizePath(outputPath);
    return `nircmd.exe savescreenshot "${safePath}"`;
  },
  
  listWindows: () => 
    `nircmd.exe win list`
};