// Simple PowerShell commands that are less likely to trigger antivirus
export const LIST_WINDOWS_COMMAND = `Get-Process | Where-Object {$_.MainWindowTitle -ne ""} | ForEach-Object { Write-Output "$($_.Id)|$($_.MainWindowTitle)" }`;

export const SCREENSHOT_COMMANDS = {
  listWindows: () => LIST_WINDOWS_COMMAND,
  
  captureWindow: (_windowTitle: string, outputPath: string) => 
    `Add-Type -AssemblyName System.Drawing,System.Windows.Forms; $screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds; $bitmap = New-Object System.Drawing.Bitmap $screen.Width,$screen.Height; $graphics = [System.Drawing.Graphics]::FromImage($bitmap); $graphics.CopyFromScreen(0,0,0,0,$bitmap.Size); $bitmap.Save('${outputPath}'); $graphics.Dispose(); $bitmap.Dispose(); Write-Output 'SUCCESS'`,

  captureScreen: (outputPath: string) => 
    `Add-Type -AssemblyName System.Drawing,System.Windows.Forms; $screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds; $bitmap = New-Object System.Drawing.Bitmap $screen.Width,$screen.Height; $graphics = [System.Drawing.Graphics]::FromImage($bitmap); $graphics.CopyFromScreen(0,0,0,0,$bitmap.Size); $bitmap.Save('${outputPath}'); $graphics.Dispose(); $bitmap.Dispose(); Write-Output 'SUCCESS'`
};

export const NIRCMD_COMMANDS = {
  captureWindow: (windowTitle: string, outputPath: string) => 
    `nircmd.exe savescreenshotwin "${windowTitle}" "${outputPath}"`,
  
  captureScreen: (outputPath: string) => 
    `nircmd.exe savescreenshot "${outputPath}"`,
  
  listWindows: () => 
    `nircmd.exe win list`
};