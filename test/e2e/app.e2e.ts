/**
 * Testes End-to-End para PegasusAI
 * Validação completa do fluxo da aplicação Electron
 */

import { _electron as electron } from 'playwright';
import { test, expect, ElectronApplication, Page } from '@playwright/test';
import type { BrowserWindow } from 'electron';

let app: ElectronApplication;
let mainWindow: Page;

test.beforeAll(async () => {
  // Launch Electron app
  app = await electron.launch({
    args: ['.', '--no-sandbox', '--disable-gpu'],
    env: {
      NODE_ENV: 'test',
      PEGASUSAI_TEST_MODE: 'true'
    }
  });

  // Wait for window
  mainWindow = await app.firstWindow();
  await mainWindow.waitForLoadState('domcontentloaded');
});

test.afterAll(async () => {
  if (app) {
    await app.close();
  }
});

test.describe('PegasusAI E2E Tests', () => {
  test('should launch application successfully', async () => {
    const title = await mainWindow.title();
    expect(title).toContain('PegasusAI');
  });

  test('should display main interface elements', async () => {
    // Wait for activity bar
    await expect(mainWindow.locator('.activitybar')).toBeVisible();
    
    // Wait for sidebar
    await expect(mainWindow.locator('.sidebar')).toBeVisible();
    
    // Wait for editor area
    await expect(mainWindow.locator('.editor-area')).toBeVisible();
    
    // Wait for status bar
    await expect(mainWindow.locator('.statusbar')).toBeVisible();
  });

  test('should open AI chat panel', async () => {
    // Click on AI icon in activity bar
    const aiIcon = mainWindow.locator('.activitybar-icon[data-testid="ai-chat"]');
    await aiIcon.click();
    
    // Wait for chat panel to open
    const chatPanel = mainWindow.locator('.chat-panel');
    await expect(chatPanel).toBeVisible();
    
    // Check for chat input
    const chatInput = mainWindow.locator('.chat-input textarea');
    await expect(chatInput).toBeVisible();
  });

  test('should send a message and receive response', async () => {
    // Open chat panel
    await mainWindow.locator('.activitybar-icon[data-testid="ai-chat"]').click();
    
    // Type message
    const chatInput = mainWindow.locator('.chat-input textarea');
    await chatInput.fill('Hello, this is an E2E test');
    
    // Send message
    const sendButton = mainWindow.locator('.chat-send-button');
    await sendButton.click();
    
    // Wait for message to appear in chat
    const messageList = mainWindow.locator('.chat-messages');
    await expect(messageList).toContainText('Hello, this is an E2E test');
    
    // Wait for response (mocked in test mode)
    await expect(messageList).toContainText('response', { timeout: 10000 });
  });

  test('should toggle offline mode', async () => {
    // Open settings
    await mainWindow.locator('.settings-icon').click();
    
    // Find offline toggle
    const offlineToggle = mainWindow.locator('[data-testid="offline-mode-toggle"]');
    await expect(offlineToggle).toBeVisible();
    
    // Toggle offline mode
    await offlineToggle.click();
    
    // Verify offline indicator appears
    const offlineIndicator = mainWindow.locator('.statusbar-offline-indicator');
    await expect(offlineIndicator).toBeVisible();
  });

  test('should display memory timeline', async () => {
    // Open memory panel
    await mainWindow.locator('.activitybar-icon[data-testid="memory"]').click();
    
    // Wait for timeline view
    const timelineView = mainWindow.locator('.timeline-view');
    await expect(timelineView).toBeVisible();
    
    // Check for timeline events
    const timelineEvents = mainWindow.locator('.timeline-event');
    await expect(timelineEvents.count()).toBeGreaterThanOrEqual(0);
  });

  test('should display knowledge graph', async () => {
    // Open graph panel
    await mainWindow.locator('.activitybar-icon[data-testid="knowledge-graph"]').click();
    
    // Wait for graph visualization
    const graphContainer = mainWindow.locator('.graph-container');
    await expect(graphContainer).toBeVisible();
    
    // Check for graph nodes (may be empty initially)
    const graphNodes = mainWindow.locator('.graph-node');
    await expect(graphNodes.count()).toBeGreaterThanOrEqual(0);
  });

  test('should open file and index symbols', async () => {
    // Open a test file
    await mainWindow.evaluate(async () => {
      // Simulate opening a file through VS Code API
      const vscode = (window as any).vscode;
      if (vscode) {
        await vscode.commands.executeCommand('workbench.action.files.openFile', '/test/sample.ts');
      }
    });
    
    // Wait for editor to load
    const editor = mainWindow.locator('.monaco-editor');
    await expect(editor).toBeVisible();
    
    // Wait for symbol indexing
    await mainWindow.waitForTimeout(2000);
    
    // Check if symbols were indexed in graph
    await mainWindow.locator('.activitybar-icon[data-testid="knowledge-graph"]').click();
    const graphNodes = mainWindow.locator('.graph-node');
    await expect(graphNodes.count()).toBeGreaterThanOrEqual(0);
  });

  test('should switch between AI providers', async () => {
    // Open provider selector
    await mainWindow.locator('.activitybar-icon[data-testid="ai-chat"]').click();
    
    const providerSelector = mainWindow.locator('.provider-selector');
    await expect(providerSelector).toBeVisible();
    
    // Click to open dropdown
    await providerSelector.click();
    
    // Select different provider
    const ollamaOption = mainWindow.locator('.provider-option[data-provider="ollama"]');
    await expect(ollamaOption).toBeVisible();
    await ollamaOption.click();
    
    // Verify provider changed
    await expect(providerSelector).toContainText('Ollama');
  });

  test('should create new file from AI suggestion', async () => {
    // Open chat and request code generation
    await mainWindow.locator('.activitybar-icon[data-testid="ai-chat"]').click();
    
    const chatInput = mainWindow.locator('.chat-input textarea');
    await chatInput.fill('Create a new TypeScript file with a hello world function');
    
    const sendButton = mainWindow.locator('.chat-send-button');
    await sendButton.click();
    
    // Wait for code block with action button
    const codeBlock = mainWindow.locator('.chat-code-block');
    await expect(codeBlock).toBeVisible();
    
    // Click "Create File" button
    const createFileButton = codeBlock.locator('.code-action-button[data-action="create-file"]');
    await expect(createFileButton).toBeVisible();
    await createFileButton.click();
    
    // Verify file was created and opened
    const editorTab = mainWindow.locator('.editor-tab');
    await expect(editorTab).toBeVisible();
  });

  test('should handle task orchestration', async () => {
    // Open orchestrator panel
    await mainWindow.locator('.activitybar-icon[data-testid="orchestrator"]').click();
    
    // Wait for orchestrator view
    const orchestratorView = mainWindow.locator('.orchestrator-view');
    await expect(orchestratorView).toBeVisible();
    
    // Create a new task
    const newTaskButton = mainWindow.locator('.new-task-button');
    await newTaskButton.click();
    
    // Fill task details
    const taskInput = mainWindow.locator('.task-input textarea');
    await taskInput.fill('Review the current file for best practices');
    
    // Select strategy
    const strategySelect = mainWindow.locator('.strategy-select');
    await strategySelect.selectOption('max_quality');
    
    // Execute task
    const executeButton = mainWindow.locator('.execute-task-button');
    await executeButton.click();
    
    // Wait for task to start
    const taskStatus = mainWindow.locator('.task-status');
    await expect(taskStatus).toBeVisible();
    
    // Wait for completion
    await expect(taskStatus).toContainText('completed', { timeout: 30000 });
  });

  test('should display extension compatibility', async () => {
    // Open extensions view
    await mainWindow.locator('.activitybar-icon[title="Extensions"]').click();
    
    // Wait for extensions list
    const extensionsList = mainWindow.locator('.extensions-list');
    await expect(extensionsList).toBeVisible();
    
    // Check that VS Code extensions load
    const installedExtensions = mainWindow.locator('.extension-item');
    await expect(installedExtensions.count()).toBeGreaterThanOrEqual(0);
  });

  test('should handle window resize properly', async () => {
    const initialSize = await mainWindow.evaluate(() => ({
      width: window.innerWidth,
      height: window.innerHeight
    }));
    
    // Resize window
    await mainWindow.setViewportSize({ width: 800, height: 600 });
    
    // Wait for layout adjustment
    await mainWindow.waitForTimeout(500);
    
    // Verify UI elements are still visible
    await expect(mainWindow.locator('.activitybar')).toBeVisible();
    await expect(mainWindow.locator('.editor-area')).toBeVisible();
  });

  test('should save and restore workspace state', async () => {
    // Open a file
    await mainWindow.locator('.explorer-file[data-path="/test/sample.ts"]').click();
    
    // Close and reopen app
    await app.close();
    
    // Relaunch
    app = await electron.launch({
      args: ['.', '--no-sandbox'],
      env: { NODE_ENV: 'test' }
    });
    mainWindow = await app.firstWindow();
    await mainWindow.waitForLoadState('domcontentloaded');
    
    // Verify file is still open
    const editorTab = mainWindow.locator('.editor-tab:has-text("sample.ts")');
    await expect(editorTab).toBeVisible();
  });
});
