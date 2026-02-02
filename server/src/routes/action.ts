import { Router } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

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

export default router;
