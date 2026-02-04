import { Router } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { google } from 'googleapis';

const router = Router();
const execAsync = promisify(exec);

// Run Claude Code CLI
router.post('/run-claude', async (req, res) => {
  try {
    const { plan, theme } = req.body;

    if (!plan) {
      return res.status(400).json({ error: 'Plan is required' });
    }

    // Save plan to temporary file
    const tempDir = path.join(process.cwd(), 'temp');
    await fs.mkdir(tempDir, { recursive: true });
    const planFile = path.join(tempDir, 'current_plan.md');
    await fs.writeFile(planFile, plan, 'utf-8');

    // Check if claude CLI is available
    try {
      await execAsync('claude --version');
    } catch (error) {
      return res.status(500).json({
        error: 'Claude CLI not found',
        message: 'Please install Claude Code CLI first: https://claude.ai/download'
      });
    }

    // Prepare prompt for Claude
    const prompt = `以下の計画書に基づいて、実装を行ってください：\n\n${plan}`;

    // Note: Actual Claude CLI execution would be:
    // const { stdout, stderr } = await execAsync(`claude "${prompt}"`);

    // For now, return success with instructions
    res.json({
      success: true,
      message: 'Claude CLI command prepared',
      instruction: 'Please run the following command in your terminal:',
      command: `claude "${prompt.substring(0, 100)}..."`,
      planFile,
      note: 'The full plan has been saved to: ' + planFile
    });
  } catch (error: any) {
    console.error('Error running Claude:', error);
    res.status(500).json({ error: error.message });
  }
});

// Export documentation
router.post('/export', async (req, res) => {
  try {
    const { plan, theme, format = 'md' } = req.body;

    if (!plan) {
      return res.status(400).json({ error: 'Plan is required' });
    }

    // Create exports directory
    const exportsDir = path.join(process.cwd(), 'exports');
    await fs.mkdir(exportsDir, { recursive: true });

    // Generate filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeName = theme.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
    const filename = `${safeName}_${timestamp}.${format}`;
    const filepath = path.join(exportsDir, filename);

    // Write file
    await fs.writeFile(filepath, plan, 'utf-8');

    res.json({
      success: true,
      message: 'Document exported successfully',
      filename,
      filepath,
      size: plan.length
    });
  } catch (error: any) {
    console.error('Error exporting document:', error);
    res.status(500).json({ error: error.message });
  }
});

// Export memo
router.post('/export-memo', async (req, res) => {
  try {
    const { memo, theme, format = 'md' } = req.body;

    if (!memo) {
      return res.status(400).json({ error: 'Memo is required' });
    }

    // Create exports directory
    const exportsDir = path.join(process.cwd(), 'exports');
    await fs.mkdir(exportsDir, { recursive: true });

    // Generate filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeName = theme.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
    const filename = `${safeName}_MEMO_${timestamp}.${format}`;
    const filepath = path.join(exportsDir, filename);

    // Write file
    await fs.writeFile(filepath, memo, 'utf-8');

    res.json({
      success: true,
      message: 'Memo exported successfully',
      filename,
      filepath,
      size: memo.length
    });
  } catch (error: any) {
    console.error('Error exporting memo:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get list of exported documents
router.get('/exports', async (req, res) => {
  try {
    const exportsDir = path.join(process.cwd(), 'exports');

    try {
      const files = await fs.readdir(exportsDir);
      const fileStats = await Promise.all(
        files.map(async (file) => {
          const filepath = path.join(exportsDir, file);
          const stats = await fs.stat(filepath);
          return {
            filename: file,
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime
          };
        })
      );

      res.json({
        success: true,
        files: fileStats.sort((a, b) => b.modified.getTime() - a.modified.getTime())
      });
    } catch (error) {
      // Directory doesn't exist yet
      res.json({ success: true, files: [] });
    }
  } catch (error: any) {
    console.error('Error listing exports:', error);
    res.status(500).json({ error: error.message });
  }
});

// Export to Google Docs
router.post('/export-to-google-docs', async (req, res) => {
  try {
    const { content, title } = req.body;

    if (!content || !title) {
      return res.status(400).json({ error: 'Content and title are required' });
    }

    // Check if Google service account credentials are configured
    const credentialsEnv = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if (!credentialsEnv) {
      return res.status(500).json({
        error: 'Google Docs not configured',
        message: 'GOOGLE_SERVICE_ACCOUNT_KEY environment variable not set',
        setupInstructions: {
          step1: 'Go to Google Cloud Console: https://console.cloud.google.com',
          step2: 'Create or select a project',
          step3: 'Enable Google Docs API and Google Drive API',
          step4: 'Create a Service Account and download the JSON key file',
          step5: 'Local: Set GOOGLE_SERVICE_ACCOUNT_KEY to file path (e.g., ./google-credentials.json)',
          step6_render_a: 'Render: Create Secret File with filename: google-credentials.json',
          step6_render_b: 'Render: Set GOOGLE_SERVICE_ACCOUNT_KEY=google-credentials.json (file path)'
        }
      });
    }

    // Read service account credentials
    // Support both file path and direct JSON string (fallback)
    let credentials: any;

    if (credentialsEnv.startsWith('{')) {
      // Direct JSON string (legacy fallback - not recommended)
      try {
        credentials = JSON.parse(credentialsEnv);
      } catch (error) {
        return res.status(500).json({
          error: 'Invalid JSON in GOOGLE_SERVICE_ACCOUNT_KEY',
          message: 'The environment variable contains invalid JSON'
        });
      }
    } else {
      // File path (recommended for both local and Render)
      // Try multiple possible paths
      const possiblePaths = [
        credentialsEnv, // User-specified path
        path.resolve(credentialsEnv), // Absolute path from cwd
        path.join(process.cwd(), credentialsEnv), // Relative to cwd
        path.join('/etc/secrets', path.basename(credentialsEnv)) // Render secret files location
      ];

      let credentialsContent: string | null = null;
      let successPath: string | null = null;
      const triedPaths: string[] = [];

      for (const testPath of possiblePaths) {
        triedPaths.push(testPath);
        try {
          await fs.access(testPath);
          credentialsContent = await fs.readFile(testPath, 'utf-8');
          successPath = testPath;
          console.log(`✓ Found credentials at: ${testPath}`);
          break;
        } catch (error) {
          // Try next path
          continue;
        }
      }

      if (!credentialsContent || !successPath) {
        return res.status(500).json({
          error: 'Credentials file not found',
          message: `Could not find credentials file`,
          envValue: credentialsEnv,
          cwd: process.cwd(),
          triedPaths,
          hint: 'For Render: Make sure you created a Secret File with filename: google-credentials.json'
        });
      }

      try {
        credentials = JSON.parse(credentialsContent);
      } catch (parseError) {
        return res.status(500).json({
          error: 'Invalid JSON in credentials file',
          message: 'The credentials file contains invalid JSON',
          filePath: successPath
        });
      }
    }

    // Initialize Google Auth
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: [
        'https://www.googleapis.com/auth/documents',
        'https://www.googleapis.com/auth/drive.file'
      ]
    });

    const authClient = await auth.getClient();
    const docs = google.docs({ version: 'v1', auth: authClient as any });
    const drive = google.drive({ version: 'v3', auth: authClient as any });

    // Create a new Google Doc
    const createResponse = await docs.documents.create({
      requestBody: {
        title: title
      }
    });

    const documentId = createResponse.data.documentId;

    if (!documentId) {
      throw new Error('Failed to create document');
    }

    // Move document to specified folder if GOOGLE_DRIVE_FOLDER_ID is set
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    if (folderId) {
      try {
        // Get current parents
        const file = await drive.files.get({
          fileId: documentId,
          fields: 'parents'
        });

        const previousParents = file.data.parents?.join(',');

        // Move to new folder
        await drive.files.update({
          fileId: documentId,
          addParents: folderId,
          removeParents: previousParents,
          fields: 'id, parents'
        });

        console.log(`Document moved to folder: ${folderId}`);
      } catch (moveError: any) {
        console.warn('Could not move document to folder:', moveError.message);
        // Continue anyway - document is created but in root
      }
    }

    // Convert markdown-like content to simple formatted text
    // Split content into lines and create paragraph requests
    const lines = content.split('\n');
    const requests: any[] = [];
    let currentIndex = 1; // Start after the default paragraph

    for (const line of lines) {
      if (line.trim() === '') {
        // Empty line - add a paragraph break
        requests.push({
          insertText: {
            location: { index: currentIndex },
            text: '\n'
          }
        });
        currentIndex += 1;
      } else if (line.startsWith('# ')) {
        // H1 heading
        const text = line.substring(2) + '\n';
        requests.push({
          insertText: {
            location: { index: currentIndex },
            text: text
          }
        });
        const endIndex = currentIndex + text.length - 1;
        requests.push({
          updateParagraphStyle: {
            range: {
              startIndex: currentIndex,
              endIndex: endIndex
            },
            paragraphStyle: {
              namedStyleType: 'HEADING_1'
            },
            fields: 'namedStyleType'
          }
        });
        currentIndex += text.length;
      } else if (line.startsWith('## ')) {
        // H2 heading
        const text = line.substring(3) + '\n';
        requests.push({
          insertText: {
            location: { index: currentIndex },
            text: text
          }
        });
        const endIndex = currentIndex + text.length - 1;
        requests.push({
          updateParagraphStyle: {
            range: {
              startIndex: currentIndex,
              endIndex: endIndex
            },
            paragraphStyle: {
              namedStyleType: 'HEADING_2'
            },
            fields: 'namedStyleType'
          }
        });
        currentIndex += text.length;
      } else if (line.startsWith('### ')) {
        // H3 heading
        const text = line.substring(4) + '\n';
        requests.push({
          insertText: {
            location: { index: currentIndex },
            text: text
          }
        });
        const endIndex = currentIndex + text.length - 1;
        requests.push({
          updateParagraphStyle: {
            range: {
              startIndex: currentIndex,
              endIndex: endIndex
            },
            paragraphStyle: {
              namedStyleType: 'HEADING_3'
            },
            fields: 'namedStyleType'
          }
        });
        currentIndex += text.length;
      } else {
        // Normal text
        const text = line + '\n';
        requests.push({
          insertText: {
            location: { index: currentIndex },
            text: text
          }
        });
        currentIndex += text.length;
      }
    }

    // Apply all text insertions and formatting
    if (requests.length > 0) {
      await docs.documents.batchUpdate({
        documentId,
        requestBody: {
          requests
        }
      });
    }

    // Try to make the document publicly readable (anyone with the link can view)
    // This might fail due to organization policies, but the document is still created
    let isPublic = false;
    try {
      await drive.permissions.create({
        fileId: documentId,
        requestBody: {
          role: 'reader',
          type: 'anyone'
        }
      });
      isPublic = true;
    } catch (permError: any) {
      console.warn('Could not set public permissions:', permError.message);
      // Continue anyway - document is created but not public
    }

    const docUrl = `https://docs.google.com/document/d/${documentId}/edit`;

    res.json({
      success: true,
      message: isPublic
        ? 'Document created successfully (public)'
        : 'Document created successfully (private - you may need to share it manually)',
      documentId,
      url: docUrl,
      title,
      isPublic,
      note: !isPublic ? 'The document was created but could not be made public. You can share it manually from Google Drive.' : undefined
    });
  } catch (error: any) {
    console.error('Error exporting to Google Docs:', error);
    res.status(500).json({
      error: error.message,
      details: error.response?.data || error.stack
    });
  }
});

// Debug endpoint to check file system (temporary - remove in production)
router.get('/debug-credentials', async (req, res) => {
  try {
    const cwd = process.cwd();
    const envValue = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || 'NOT_SET';

    const checkPaths = [
      envValue,
      path.resolve(envValue),
      path.join(cwd, envValue),
      '/etc/secrets/google-credentials.json',
      path.join(cwd, 'google-credentials.json'),
      path.join(cwd, 'server/google-credentials.json')
    ];

    const pathChecks = await Promise.all(
      checkPaths.map(async (p) => {
        try {
          await fs.access(p);
          const stats = await fs.stat(p);
          return { path: p, exists: true, size: stats.size, isFile: stats.isFile() };
        } catch (error) {
          return { path: p, exists: false };
        }
      })
    );

    // Try to list /etc/secrets directory
    let secretsDir: string[] = [];
    try {
      secretsDir = await fs.readdir('/etc/secrets');
    } catch (error) {
      secretsDir = ['Directory not accessible'];
    }

    // Try to list current working directory
    let cwdFiles: string[] = [];
    try {
      cwdFiles = await fs.readdir(cwd);
    } catch (error) {
      cwdFiles = ['Directory not accessible'];
    }

    res.json({
      cwd,
      envValue,
      pathChecks,
      secretsDir,
      cwdFiles: cwdFiles.slice(0, 20) // First 20 files only
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

export default router;
