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
Add-Type -AssemblyName System.Runtime.InteropServices

$signature = @'
[DllImport("user32.dll")]
public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);
[DllImport("user32.dll")]
public static extern bool GetWindowRect(IntPtr hwnd, out RECT lpRect);
[DllImport("user32.dll")]
public static extern bool PrintWindow(IntPtr hwnd, IntPtr hdcBlt, int nFlags);
public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
'@

$User32 = Add-Type -MemberDefinition $signature -Name "User32" -Namespace Win32Functions -PassThru

$hwnd = $User32::FindWindow($null, '${safeTitle}')
if ($hwnd -eq [IntPtr]::Zero) { 
    # Try partial match if exact match fails
    $processes = Get-Process | Where-Object {$_.MainWindowTitle -like "*${safeTitle}*"}
    if ($processes.Count -gt 0) {
        $hwnd = $processes[0].MainWindowHandle
    }
    if ($hwnd -eq [IntPtr]::Zero) { 
        throw "Window not found: ${safeTitle}" 
    }
}

$rect = New-Object Win32Functions.User32+RECT
$User32::GetWindowRect($hwnd, [ref]$rect)
$width = $rect.Right - $rect.Left
$height = $rect.Bottom - $rect.Top

if ($width -le 0 -or $height -le 0) {
    throw "Invalid window dimensions: $width x $height"
}

$bitmap = New-Object System.Drawing.Bitmap $width, $height
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$hdc = $graphics.GetHdc()
$User32::PrintWindow($hwnd, $hdc, 0)
$graphics.ReleaseHdc($hdc)
$bitmap.Save('${safePath}')
$graphics.Dispose()
$bitmap.Dispose()
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