import { query, createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { parseArgs } from 'util';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    prompt: { type: 'string', short: 'p' },
    model: { type: 'string' },
    cwd: { type: 'string' },
    'permission-mode': { type: 'string' },
    'session-id': { type: 'string' },
  },
});

async function main() {
  console.error('[Opcode] Starting Agent Script (v6.1 Linter Fix)...');
  
  if (!values.prompt) {
    console.error('Error: --prompt is required');
    process.exit(1);
  }

  try {
    const opcodeServer = createSdkMcpServer({
      name: 'opcode-native-tools',
      version: '0.1.0',
      tools: [
        tool(
            'get_system_info', 
            'Returns basic system information including OS, architecture, and memory.',
            {}, // Pass raw shape, not z.object()
            async () => {
              console.error('[Opcode] Executing get_system_info tool...');
              return {
                platform: os.platform(),
                arch: os.arch(),
                release: os.release(),
                node_version: process.version,
                total_mem_gb: Math.round(os.totalmem() / 1024 / 1024 / 1024),
                cwd: process.cwd()
              };
            }
        ),
        tool(
            'get_project_context',
            'Analyzes the current project structure. Returns list of files and summarizes key config files (package.json, Cargo.toml). Use this to orient yourself.',
            {}, // Pass raw shape
            async () => {
                 console.error('[Opcode] Executing get_project_context tool...');
                 const root = process.cwd();
                 try {
                     const entries = await fs.promises.readdir(root, { withFileTypes: true });
                     const summary: any = {
                         path: root,
                         structure: [],
                         metadata: {}
                     };
                     
                     for (const entry of entries) {
                         if (entry.name.startsWith('.') && entry.name !== '.env') continue;
                         if (['node_modules', 'target', 'dist', 'build'].includes(entry.name)) {
                              summary.structure.push(entry.name + '/ (ignored)');
                              continue;
                         }
                         
                         summary.structure.push(entry.name + (entry.isDirectory() ? '/' : ''));

                         if (entry.name === 'package.json') {
                             try {
                                 const pkg = JSON.parse(await fs.promises.readFile(path.join(root, 'package.json'), 'utf-8'));
                                 summary.metadata.npm = { 
                                     name: pkg.name, 
                                     scripts: Object.keys(pkg.scripts || {}),
                                     dependencies: Object.keys(pkg.dependencies || {}).length
                                 };
                             } catch {}
                         }
                         if (entry.name === 'Cargo.toml') {
                             summary.metadata.cargo = "Rust project detected";
                         }
                     }
                     return summary;
                 } catch (err: any) {
                     return { error: "Failed to read directory: " + err.message };
                 }
            }
        ),
        tool(
            'submit_completion',
            'Call this when you have completed the user\'s request. Provide a structured summary of your work.',
            { // Pass raw shape
                summary: z.string().describe('Markdown summary of the task completion'),
                files_changed: z.array(z.string()).optional().describe('List of files modified (if any)'),
                next_steps: z.array(z.string()).optional().describe('Suggested next steps for the user')
            },
            async (input) => {
                 console.error('[Opcode] Task Completion Submitted:', input.summary);
                 return { status: "success", received: true };
            }
        )
      ]
    });
    
    console.error('[Opcode] Custom MCP Server created.');

    const q = query({
      prompt: values.prompt,
      options: {
        cwd: values.cwd || process.cwd(),
        model: values.model,
        // DANGER: Bypass permissions to avoid blocking the UI
        permissionMode: (values['permission-mode'] as any) || 'bypassPermissions',
        // Enable loading skills from .claude/skills and configuration
        settingSources: ['project', 'user'],
        includePartialMessages: true,
        resume: values['session-id'],
        mcpServers: {
            'opcode-native': opcodeServer
        }
      }
    });

    for await (const message of q) {
      console.log(JSON.stringify(message));
    }
  } catch (error: any) {
    console.error('Runtime Error:', error);
    console.log(JSON.stringify({
      type: 'error',
      error: {
        type: 'runtime_error',
        message: error.message || String(error)
      }
    }));
    process.exit(1);
  }
}

main();
