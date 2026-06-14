/**
 * Timeline Tracker - Automatic tracking of user actions in PegasusAI
 * Monitors file operations, editor events, and AI interactions
 */

import { EventEmitter } from 'events';
import { TimelineEvent, TimelineQuery } from '../../common/types/memory';
import { MemoryService } from './MemoryService';

export interface TimelineTrackerConfig {
  autoRecordFileEvents: boolean;
  autoRecordEditorEvents: boolean;
  autoRecordAIEvents: boolean;
  maxEventsPerFile: number;
  cleanupIntervalMs: number;
  retentionDays: number;
}

const DEFAULT_CONFIG: TimelineTrackerConfig = {
  autoRecordFileEvents: true,
  autoRecordEditorEvents: true,
  autoRecordAIEvents: true,
  maxEventsPerFile: 1000,
  cleanupIntervalMs: 3600000, // 1 hour
  retentionDays: 30,
};

export class TimelineTracker extends EventEmitter {
  private memoryService: MemoryService;
  private config: TimelineTrackerConfig;
  private cleanupTimer?: NodeJS.Timeout;
  private eventBuffer: Omit<TimelineEvent, 'id'>[] = [];
  private flushTimeout?: NodeJS.Timeout;

  constructor(memoryService: MemoryService, config?: Partial<TimelineTrackerConfig>) {
    super();
    this.memoryService = memoryService;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start automatic tracking
   */
  async start(): Promise<void> {
    console.log('[TimelineTracker] Starting automatic tracking...');
    
    // Iniciar limpeza periódica
    this.cleanupTimer = setInterval(
      () => this.cleanupOldEvents(),
      this.config.cleanupIntervalMs
    );

    this.emit('started');
  }

  /**
   * Stop automatic tracking
   */
  async stop(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }

    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      await this.flushBuffer();
    }

    this.emit('stopped');
  }

  /**
   * Record a file-related event
   */
  async recordFileEvent(
    eventType: 'file_open' | 'file_save',
    filePath: string,
    metadata?: Record<string, any>
  ): Promise<TimelineEvent> {
    if (!this.config.autoRecordFileEvents) {
      return {} as TimelineEvent;
    }

    const event = await this.memoryService.recordEvent(eventType, `File ${eventType.replace('_', ' ')}: ${filePath}`, {
      relatedFile: filePath,
      data: metadata,
    });

    this.emit('fileEvent', event);
    return event;
  }

  /**
   * Record a code edit event
   */
  async recordCodeEdit(
    filePath: string,
    changes: {
      lineStart: number;
      lineEnd: number;
      newContent: string;
      reason?: string;
    }
  ): Promise<TimelineEvent> {
    if (!this.config.autoRecordEditorEvents) {
      return {} as TimelineEvent;
    }

    const description = `Code edited in ${filePath} (lines ${changes.lineStart}-${changes.lineEnd})`;
    
    const event = await this.memoryService.recordEvent('code_edit', description, {
      relatedFile: filePath,
      data: {
        lineStart: changes.lineStart,
        lineEnd: changes.lineEnd,
        characterCount: changes.newContent.length,
        reason: changes.reason || 'manual',
      },
    });

    this.emit('codeEdit', event);
    return event;
  }

  /**
   * Record an AI chat message
   */
  async recordChatMessage(
    conversationId: string,
    role: 'user' | 'assistant',
    messagePreview: string,
    metadata?: {
      model?: string;
      tokens?: number;
      duration?: number;
    }
  ): Promise<TimelineEvent> {
    if (!this.config.autoRecordAIEvents) {
      return {} as TimelineEvent;
    }

    const description = `${role === 'user' ? 'User' : 'AI'} message in conversation ${conversationId}`;
    
    const event = await this.memoryService.recordEvent('chat_message', description, {
      relatedConversation: conversationId,
      data: {
        role,
        preview: messagePreview.substring(0, 200),
        ...metadata,
      },
    });

    this.emit('chatMessage', event);
    return event;
  }

  /**
   * Record a build event
   */
  async recordBuildEvent(
    eventType: 'build_start' | 'build_end',
    buildType: string,
    metadata?: {
      success?: boolean;
      duration?: number;
      errors?: string[];
      warnings?: string[];
    }
  ): Promise<TimelineEvent> {
    const description = `${buildType} ${eventType.replace('_', ' ')}${metadata?.success !== undefined ? (metadata.success ? ' (success)' : ' (failed)') : ''}`;
    
    const event = await this.memoryService.recordEvent(eventType, description, {
      data: metadata,
    });

    this.emit('buildEvent', event);
    return event;
  }

  /**
   * Record a debug session event
   */
  async recordDebugEvent(
    eventType: 'debug_start' | 'debug_end',
    config: {
      type: string;
      name: string;
      request: string;
    },
    metadata?: {
      duration?: number;
      breakpoints?: number;
    }
  ): Promise<TimelineEvent> {
    const description = `Debug session ${eventType.replace('_', ' ')}: ${config.name}`;
    
    const event = await this.memoryService.recordEvent(eventType, description, {
      data: {
        config,
        ...metadata,
      },
    });

    this.emit('debugEvent', event);
    return event;
  }

  /**
   * Get timeline for a specific file
   */
  async getFileTimeline(filePath: string, limit?: number): Promise<TimelineEvent[]> {
    return this.memoryService.getFileTimeline(filePath, limit);
  }

  /**
   * Get recent events across all files
   */
  async getRecentEvents(limit: number = 50): Promise<TimelineEvent[]> {
    const now = Date.now();
    const oneHourAgo = now - 3600000;

    return this.memoryService.getTimelineEvents({
      timeRange: { start: oneHourAgo, end: now },
      limit,
    });
  }

  /**
   * Query events with custom filters
   */
  async queryEvents(query: TimelineQuery): Promise<TimelineEvent[]> {
    return this.memoryService.getTimelineEvents(query);
  }

  /**
   * Buffer event for batch processing (performance optimization)
   */
  bufferEvent(event: Omit<TimelineEvent, 'id'>): void {
    this.eventBuffer.push(event);

    // Flush after 100ms of inactivity or 50 events
    if (this.eventBuffer.length >= 50) {
      this.flushBufferImmediate();
    } else if (!this.flushTimeout) {
      this.flushTimeout = setTimeout(() => this.flushBuffer(), 100);
    }
  }

  /**
   * Flush buffered events to storage
   */
  private async flushBuffer(): Promise<void> {
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = undefined;
    }

    await this.flushBufferImmediate();
  }

  private async flushBufferImmediate(): Promise<void> {
    if (this.eventBuffer.length === 0) return;

    const eventsToFlush = [...this.eventBuffer];
    this.eventBuffer = [];

    try {
      for (const event of eventsToFlush) {
        await this.memoryService.recordEvent(
          event.eventType,
          event.description,
          {
            relatedFile: event.relatedFile,
            relatedConversation: event.relatedConversation,
            data: event.data,
          }
        );
      }
      console.log(`[TimelineTracker] Flushed ${eventsToFlush.length} buffered events`);
    } catch (error) {
      console.error('[TimelineTracker] Error flushing buffer:', error);
      // Re-add failed events to buffer
      this.eventBuffer.unshift(...eventsToFlush);
    }
  }

  /**
   * Clean up old events based on retention policy
   */
  private async cleanupOldEvents(): Promise<void> {
    const cutoffDate = Date.now() - (this.config.retentionDays * 24 * 60 * 60 * 1000);
    const deleted = await this.memoryService.cleanupOldEvents(cutoffDate);
    
    if (deleted > 0) {
      console.log(`[TimelineTracker] Cleaned up ${deleted} old events`);
      this.emit('cleanup', { deleted, cutoffDate });
    }
  }

  /**
   * Get statistics about tracked events
   */
  async getStatistics(): Promise<{
    totalEvents: number;
    eventsByType: Record<string, number>;
    eventsByFile: Record<string, number>;
    averageEventsPerDay: number;
  }> {
    const now = Date.now();
    const last24Hours = now - 24 * 60 * 60 * 1000;
    const last7Days = now - 7 * 24 * 60 * 60 * 1000;

    const [recentEvents, weekEvents] = await Promise.all([
      this.memoryService.getTimelineEvents({ timeRange: { start: last24Hours, end: now }, limit: 10000 }),
      this.memoryService.getTimelineEvents({ timeRange: { start: last7Days, end: now }, limit: 10000 }),
    ]);

    const eventsByType: Record<string, number> = {};
    const eventsByFile: Record<string, number> = {};

    for (const event of recentEvents) {
      eventsByType[event.eventType] = (eventsByType[event.eventType] || 0) + 1;
      
      if (event.relatedFile) {
        eventsByFile[event.relatedFile] = (eventsByFile[event.relatedFile] || 0) + 1;
      }
    }

    return {
      totalEvents: recentEvents.length,
      eventsByType,
      eventsByFile,
      averageEventsPerDay: weekEvents.length / 7,
    };
  }
}
