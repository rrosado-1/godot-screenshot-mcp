#!/usr/bin/env node
import { checkPowerShellAccess, checkNirCmdAccess, isWSL } from './screenshot.js';
import { listWindows, findGodotDebugWindows, findGodotEditorWindows } from './windows.js';

async function runTests(): Promise<void> {
  console.log('🧪 Godot Screenshot MCP Server - Test Suite\n');
  
  // Environment checks
  console.log('📋 Environment Checks:');
  console.log(`  WSL Detected: ${isWSL() ? '✅' : '❌'}`);
  
  try {
    const powershellOk = await checkPowerShellAccess();
    console.log(`  PowerShell Access: ${powershellOk ? '✅' : '❌'}`);
  } catch (error) {
    console.log(`  PowerShell Access: ❌ (${error})`);
  }
  
  try {
    const nircmdOk = await checkNirCmdAccess();
    console.log(`  NirCmd Access: ${nircmdOk ? '✅' : '❌'}`);
  } catch (error) {
    console.log(`  NirCmd Access: ❌ (Optional)`);
  }
  
  console.log();
  
  // Window enumeration tests
  console.log('🪟 Window Enumeration Tests:');
  
  try {
    console.log('  Listing all windows...');
    const allWindows = await listWindows();
    console.log(`  Found ${allWindows.length} total windows ✅`);
    
    if (allWindows.length > 0) {
      console.log('  Sample windows:');
      allWindows.slice(0, 5).forEach(w => {
        console.log(`    - ${w.title}`);
      });
      if (allWindows.length > 5) {
        console.log(`    ... and ${allWindows.length - 5} more`);
      }
    }
  } catch (error) {
    console.log(`  Window enumeration: ❌ (${error})`);
  }
  
  console.log();
  
  // Godot-specific window tests
  console.log('🎮 Godot Window Detection:');
  
  try {
    const debugWindows = await findGodotDebugWindows();
    console.log(`  Debug Windows: ${debugWindows.length > 0 ? '✅' : '⚠️'} (${debugWindows.length} found)`);
    debugWindows.forEach(w => console.log(`    - ${w.title}`));
  } catch (error) {
    console.log(`  Debug Windows: ❌ (${error})`);
  }
  
  try {
    const editorWindows = await findGodotEditorWindows();
    console.log(`  Editor Windows: ${editorWindows.length > 0 ? '✅' : '⚠️'} (${editorWindows.length} found)`);
    editorWindows.forEach(w => console.log(`    - ${w.title}`));
  } catch (error) {
    console.log(`  Editor Windows: ❌ (${error})`);
  }
  
  console.log();
  
  // Configuration checks
  console.log('⚙️ Configuration:');
  console.log(`  SCREENSHOT_QUALITY: ${process.env.SCREENSHOT_QUALITY || '85 (default)'}`);
  console.log(`  SCREENSHOT_FORMAT: ${process.env.SCREENSHOT_FORMAT || 'png (default)'}`);
  console.log(`  TEMP_DIR: ${process.env.TEMP_DIR || '/tmp (default)'}`);
  console.log(`  USE_NIRCMD: ${process.env.USE_NIRCMD === 'true' ? 'true' : 'false (default)'}`);
  
  console.log();
  
  // Summary
  console.log('📋 Test Summary:');
  
  if (!isWSL()) {
    console.log('⚠️  Warning: Not running in WSL. Some features may not work correctly.');
  }
  
  const powershellOk = await checkPowerShellAccess().catch(() => false);
  if (!powershellOk) {
    console.log('❌ Critical: PowerShell not accessible. Enable Windows interop in WSL.');
    console.log('   Try: echo 1 | sudo tee /proc/sys/fs/binfmt_misc/WSLInterop');
    return;
  }
  
  const allWindows = await listWindows().catch(() => []);
  if (allWindows.length === 0) {
    console.log('⚠️  Warning: No windows found. Check PowerShell access.');
  }
  
  const [debugWindows, editorWindows] = await Promise.all([
    findGodotDebugWindows().catch(() => []),
    findGodotEditorWindows().catch(() => [])
  ]);
  
  if (debugWindows.length === 0 && editorWindows.length === 0) {
    console.log('⚠️  No Godot windows found. Start Godot Engine to test screenshot capture.');
  } else {
    console.log('✅ Ready for screenshot capture!');
  }
  
  console.log();
  console.log('To test screenshot capture, ensure Godot is running and use the MCP tools.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
  });
}