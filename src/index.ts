#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

import { 
  captureWindow, 
  captureScreen, 
  checkPowerShellAccess,
  isWSL 
} from './screenshot.js';
import { 
  findGodotDebugWindows, 
  findGodotEditorWindows,
  findWindowByTitle 
} from './windows.js';

const server = new Server(
  {
    name: 'godot-screenshot-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {
        listChanged: true,
      },
    },
  }
);

// Input validation schemas
const CaptureGodotDebugSchema = z.object({
  projectName: z.string().min(1).max(200).optional().describe('Project name to filter specific debug window'),
});

const CaptureGodotEditorSchema = z.object({
  projectName: z.string().min(1).max(200).optional().describe('Project name to filter specific editor window'),
});

const CaptureWindowByTitleSchema = z.object({
  title: z.string().min(1).max(500).describe('Exact window title to capture'),
  exact: z.boolean().optional().default(false).describe('Whether to match title exactly'),
});

// Input validation helper
function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters: ${issues}`);
    }
    throw new McpError(ErrorCode.InvalidParams, 'Invalid parameters');
  }
}


// Register tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'capture_godot_debug',
        description: 'Capture a screenshot of the Godot Debug Game Window',
        inputSchema: {
          type: 'object',
          properties: {
            projectName: {
              type: 'string',
              description: 'Project name to filter specific debug window'
            }
          }
        },
      },
      {
        name: 'capture_godot_editor',
        description: 'Capture a screenshot of the Godot Scene Editor',
        inputSchema: {
          type: 'object',
          properties: {
            projectName: {
              type: 'string',
              description: 'Project name to filter specific editor window'
            }
          }
        },
      },
      {
        name: 'capture_window_by_title',
        description: 'Capture a screenshot of any window by its title',
        inputSchema: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: 'Exact window title to capture'
            },
            exact: {
              type: 'boolean',
              description: 'Whether to match title exactly',
              default: false
            }
          },
          required: ['title']
        },
      },
      {
        name: 'capture_fullscreen',
        description: 'Capture a screenshot of the entire screen',
        inputSchema: {
          type: 'object',
          properties: {}
        },
      },
      {
        name: 'list_godot_windows',
        description: 'List all available Godot windows (both editor and debug)',
        inputSchema: {
          type: 'object',
          properties: {}
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    // Check environment on first use
    if (!await checkPowerShellAccess()) {
      throw new McpError(
        ErrorCode.InternalError,
        'PowerShell is not accessible from WSL. Please ensure Windows interop is enabled.'
      );
    }

    switch (name) {
      case 'capture_godot_debug': {
        const { projectName } = validateInput(CaptureGodotDebugSchema, args);
        const debugWindows = await findGodotDebugWindows();
        
        if (debugWindows.length === 0) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            'No Godot debug windows found. Please ensure the game is running in debug mode.'
          );
        }
        
        let targetWindow = debugWindows[0];
        
        if (projectName && debugWindows.length > 1) {
          const filtered = debugWindows.find(w => w.title.includes(projectName));
          if (filtered) {
            targetWindow = filtered;
          }
        }
        
        const result = await captureWindow(targetWindow.title);
        
        return {
          content: [
            {
              type: 'image',
              data: result.base64,
              mimeType: `image/${result.format}`,
            },
          ],
        };
      }

      case 'capture_godot_editor': {
        const { projectName } = validateInput(CaptureGodotEditorSchema, args);
        const editorWindows = await findGodotEditorWindows();
        
        if (editorWindows.length === 0) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            'No Godot editor windows found. Please ensure Godot Engine is running.'
          );
        }
        
        let targetWindow = editorWindows[0];
        
        if (projectName && editorWindows.length > 1) {
          const filtered = editorWindows.find(w => w.title.includes(projectName));
          if (filtered) {
            targetWindow = filtered;
          }
        }
        
        const result = await captureWindow(targetWindow.title);
        
        return {
          content: [
            {
              type: 'image',
              data: result.base64,
              mimeType: `image/${result.format}`,
            },
          ],
        };
      }

      case 'capture_window_by_title': {
        const { title, exact } = validateInput(CaptureWindowByTitleSchema, args);
        
        const window = await findWindowByTitle(title, exact);
        
        if (!window) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            `No window found with title${exact ? ' exactly matching' : ' containing'}: "${title}"`
          );
        }
        
        const result = await captureWindow(window.title);
        
        return {
          content: [
            {
              type: 'image',
              data: result.base64,
              mimeType: `image/${result.format}`,
            },
          ],
        };
      }

      case 'capture_fullscreen': {
        const result = await captureScreen();
        
        return {
          content: [
            {
              type: 'image',
              data: result.base64,
              mimeType: `image/${result.format}`,
            },
          ],
        };
      }

      case 'list_godot_windows': {
        const [debugWindows, editorWindows] = await Promise.all([
          findGodotDebugWindows(),
          findGodotEditorWindows(),
        ]);
        
        const windowList = [
          '=== Godot Debug Windows ===',
          ...debugWindows.map(w => `- ${w.title}`),
          '',
          '=== Godot Editor Windows ===',
          ...editorWindows.map(w => `- ${w.title}`),
        ];
        
        if (debugWindows.length === 0 && editorWindows.length === 0) {
          windowList.push('', 'No Godot windows found.');
        }
        
        return {
          content: [
            {
              type: 'text',
              text: windowList.join('\n'),
            },
          ],
        };
      }

      default:
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${name}`
        );
    }
  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }
    
    console.error(`Error in tool ${name}:`, error);
    
    throw new McpError(
      ErrorCode.InternalError,
      `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
});

async function main() {
  // Check if running in WSL
  if (!isWSL()) {
    console.warn('Warning: This server is designed to run in WSL. Some features may not work correctly.');
  }
  
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.error('Godot Screenshot MCP Server running on stdio transport');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});