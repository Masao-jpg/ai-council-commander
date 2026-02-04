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
          step6: 'Render: Set GOOGLE_SERVICE_ACCOUNT_KEY to the entire JSON content as a string'
        }
      });
    }

    // Read service account credentials
    // Support both file path and direct JSON string
    let credentials: any;

    if (credentialsEnv.startsWith('{')) {
      // Direct JSON string (for Render/production)
      try {
        credentials = JSON.parse(credentialsEnv);
      } catch (error) {
        return res.status(500).json({
          error: 'Invalid JSON in GOOGLE_SERVICE_ACCOUNT_KEY',
          message: 'The environment variable contains invalid JSON'
        });
      }
    } else {
      // File path (for local development)
      try {
        await fs.access(credentialsEnv);
        const credentialsContent = await fs.readFile(credentialsEnv, 'utf-8');
        credentials = JSON.parse(credentialsContent);
      } catch (error) {
        return res.status(500).json({
          error: 'Credentials file not found',
          message: `File not found at: ${credentialsEnv}`
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

    // Make the document publicly readable (anyone with the link can view)
    await drive.permissions.create({
      fileId: documentId,
      requestBody: {
        role: 'reader',
        type: 'anyone'
      }
    });

    const docUrl = `https://docs.google.com/document/d/${documentId}/edit`;

    res.json({
      success: true,
      message: 'Document created successfully',
      documentId,
      url: docUrl,
      title
    });
  } catch (error: any) {
    console.error('Error exporting to Google Docs:', error);
    res.status(500).json({
      error: error.message,
      details: error.response?.data || error.stack
    });
  }
});

export default router;
