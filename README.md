# Godot Screenshot MCP Server

A TypeScript-based MCP (Model Context Protocol) server that captures screenshots from Windows applications running in WSL, specifically targeting Godot Engine windows. Designed for use with **Claude Code** (CLI) to provide AI-assisted game development with live visual feedback.

## 🎮 Perfect for Game Development with Claude Code

- **Capture Godot Debug Windows**: Screenshot the running game
- **Capture Godot Editor**: Screenshot the scene editor and inspector
- **Capture Any Window**: Screenshot any Windows application by title
- **Full Screen Capture**: Screenshot the entire Windows desktop
- **Window Enumeration**: List all available Godot windows
- **WSL-Windows Integration**: Seamlessly bridge WSL and Windows environments
- **Performance Optimized**: Window caching, request throttling, and image optimization

## 📋 System Requirements

- **Windows 10/11** with WSL2 enabled
- **Windows Subsystem for Linux (WSL)** with Ubuntu/Debian
- **Node.js 18+** installed in WSL
- **PowerShell** accessible from WSL (Windows interop enabled)
- **Godot Engine** running on Windows host
- **Claude Code** (Anthropic's CLI tool)

## 🚀 Quick Setup for Claude Code

### 1. Install the MCP Server

```bash
# Clone this repository in WSL
git clone <repository-url>
cd godot-screenshot-mcp

# Install dependencies and build
npm install
npm run build

# Test the installation
npm run test
```

### 2. Create MCP Configuration

Create a configuration file for your Godot projects:

```bash
# Create config file
cat > claude_mcp_config.json << 'EOF'
{
  "mcpServers": {
    "godot-screenshot": {
      "command": "node",
      "args": ["/home/yourusername/godot-screenshot-mcp/dist/index.js"],
      "env": {
        "SCREENSHOT_QUALITY": "85",
        "SCREENSHOT_FORMAT": "png",
        "TEMP_DIR": "/tmp/screenshots"
      }
    }
  }
}
EOF

# Update the path to match your actual installation
pwd  # Use this path in the config above
```

### 3. Setup Your Godot Project

```bash
# Copy the MCP config to your Godot project directory
cp claude_mcp_config.json /path/to/your/godot/project/

# Create screenshots directory
mkdir -p /tmp/screenshots
```

### 4. Start Godot (on Windows)

1. **Open Godot Engine** on Windows
2. **Load your project**
3. **Run your game** (press F6 or click Play) - this creates the debug window
4. **Keep both Editor and Debug windows visible**

### 5. Start Claude Code with Screenshot Support

```bash
# Navigate to your Godot project directory in WSL
cd /path/to/your/godot/project

# Start Claude Code with the MCP server
claude --mcp-config claude_mcp_config.json
```

## 🎯 Usage Examples

Once Claude Code is running with the MCP server, you can use these commands:

### List Available Godot Windows
```
List all Godot windows
```

### Capture Screenshots
```
Capture the Godot editor window
```

```
Capture the debug game window
```

```
Take a screenshot of the entire screen
```

### AI-Assisted Development
```
1. Capture the Godot editor showing my current scene
2. Now capture the running game
3. Compare these images and suggest improvements to my level design
```

```
Capture the debug window and help me identify why my character appears to be floating
```

```
Take a screenshot of my Godot editor and help me organize my scene tree better
```

## 🛠️ Development Workflow

### Typical Session:
1. **Start Godot** on Windows with your project
2. **Run your game** to create debug window
3. **Start Claude Code** with MCP config in WSL
4. **Ask for screenshots** and get AI assistance with visual feedback
5. **Iterate** on your game with live visual analysis

### Example Conversation:
```
You: List all Godot windows

Claude: I found these Godot windows:
=== Godot Debug Windows ===
- MyPlatformerGame (DEBUG)

=== Godot Editor Windows ===  
- MyPlatformerGame - Godot Engine

You: Capture both the editor and debug windows

Claude: [Shows both screenshots]

You: The player character looks too small in the game. What should I adjust?

Claude: Looking at your screenshots, I can see the character is indeed quite small relative to the environment. Here are some suggestions:
1. Increase the character sprite scale in the debug window
2. Adjust the camera zoom in your scene
3. Consider making the character 1.5-2x larger...
```

## 🔧 Available Screenshot Tools

### `capture_godot_debug`
Captures the Godot Debug Game Window (your running game).

**Usage in Claude Code:**
```
Capture the debug game window
```

**With project filtering:**
```
Capture the debug window for "MyPlatformerGame"
```

### `capture_godot_editor`
Captures the Godot Scene Editor window.

**Usage in Claude Code:**
```
Capture the Godot editor window
```

**With project filtering:**
```
Capture the editor window for "MyPlatformerGame"
```

### `capture_window_by_title`
Captures any Windows application by its title.

**Usage in Claude Code:**
```
Capture the window titled "My Custom Tool"
```

### `capture_fullscreen`
Captures the entire Windows desktop.

**Usage in Claude Code:**
```
Take a screenshot of the entire screen
```

### `list_godot_windows`
Lists all available Godot windows.

**Usage in Claude Code:**
```
List all Godot windows
Show me what Godot windows are open
```

## ⚙️ Configuration Options

You can customize the MCP server behavior by editing the environment variables in your `claude_mcp_config.json`:

```json
{
  "mcpServers": {
    "godot-screenshot": {
      "command": "node",
      "args": ["/home/yourusername/godot-screenshot-mcp/dist/index.js"],
      "env": {
        "SCREENSHOT_QUALITY": "95",          // Image quality (1-100, default: 85)
        "SCREENSHOT_FORMAT": "png",          // Format: png or jpg (default: png)
        "TEMP_DIR": "/tmp/screenshots",      // Temp directory (default: /tmp)
        "USE_NIRCMD": "false"               // Use NirCmd instead of PowerShell (default: false)
      }
    }
  }
}
```

## 🔍 How It Works

### WSL-Windows Integration
The server automatically detects that it's running in WSL and uses PowerShell interop to access Windows applications:

1. **WSL Detection**: Checks `/proc/version` for "microsoft"
2. **Path Translation**: Converts WSL paths (`/mnt/c/`) to Windows paths (`C:\`)
3. **PowerShell Bridge**: Uses `powershell.exe` to execute Windows commands from WSL
4. **Window Detection**: Identifies Godot windows by title patterns:
   - Debug windows: contain "(DEBUG)"
   - Editor windows: end with "- Godot Engine"

### Screenshot Process
1. **Window Enumeration**: Lists all visible Windows applications
2. **Window Filtering**: Finds Godot windows by title patterns
3. **Screen Capture**: Uses Windows .NET APIs to capture screenshots
4. **Image Processing**: Resizes large images (>1920x1080) and applies compression
5. **Base64 Encoding**: Converts images to base64 for Claude Code display

## 🐛 Troubleshooting

### WSL Setup Issues

**PowerShell not accessible:**
```bash
# Test PowerShell access
powershell.exe -Command "Write-Output 'Test'"

# If it fails, enable Windows interop:
echo 1 | sudo tee /proc/sys/fs/binfmt_misc/WSLInterop
```

**Path issues:**
```bash
# Verify Windows C: drive is mounted
ls /mnt/c/

# If not mounted, add to /etc/fstab:
echo "C: /mnt/c drvfs defaults 0 0" | sudo tee -a /etc/fstab
```

### Godot Detection Issues

**No Godot windows found:**
1. Ensure Godot is running on Windows (not in WSL)
2. Make sure your game is running (press F6 in Godot)
3. Keep both Editor and Debug windows visible (not minimized)
4. Check window titles match expected patterns

**Test window detection:**
```bash
# Manually test window enumeration
npm run test
```

### Claude Code Integration Issues

**MCP server not loading:**
1. Verify the path in `claude_mcp_config.json` is correct
2. Ensure the server builds successfully: `npm run build`
3. Test the server manually: `echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}' | node dist/index.js`

**Screenshot tools not appearing:**
1. Restart Claude Code after updating the MCP config
2. Check that you're starting Claude Code with: `claude --mcp-config claude_mcp_config.json`

### Performance Issues

**Slow screenshots:**
- Built-in throttling limits to 2 screenshots per second
- Lower the quality setting in the config
- Close unnecessary Windows applications

**Memory issues:**
- Images are automatically resized if larger than 1920x1080
- Temporary files are cleaned up automatically
- Screenshots are cached for 5 seconds to reduce redundant captures

## 🏗️ Development & Building

### Build the Project
```bash
npm run build
```

### Development Mode (Auto-rebuild)
```bash
npm run dev
```

### Run Tests
```bash
npm run test
```

### Project Structure
```
godot-screenshot-mcp/
├── src/
│   ├── index.ts          # Main MCP server with Claude Code integration
│   ├── screenshot.ts     # Screenshot capture logic with WSL-Windows bridge
│   ├── windows.ts        # Windows application enumeration
│   ├── powershell.ts     # PowerShell script templates
│   └── test.ts           # Test suite
├── dist/                 # Compiled JavaScript
├── claude_mcp_config.json # MCP configuration for Claude Code
├── package.json
├── tsconfig.json
└── README.md
```

## 🤝 Contributing

Feel free to submit issues and enhancement requests! This tool is designed specifically for the Claude Code + WSL + Godot workflow.

## 📝 License

MIT License

---

**Happy Game Development with AI! 🎮🤖**

Get visual feedback on your Godot projects instantly with Claude Code's AI assistance.