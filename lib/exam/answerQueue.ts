export type SaveStatus = 'IDLE' | 'SAVING' | 'SAVED' | 'PENDING_RETRY' | 'ERROR';

export interface AnswerItem {
  attemptId: string;
  questionId: string;
  selectedOption: string;
  clientTimestamp: number;
  attemptsCount: number;
}

export interface StatusListenerPayload {
  questionId: string;
  status: SaveStatus;
  selectedOption: string;
  lastSavedAt?: string;
  errorMessage?: string;
}

type StatusListener = (payload: StatusListenerPayload) => void;

class AnswerQueueEngine {
  private queue: AnswerItem[] = [];
  private latestSelections = new Map<string, AnswerItem>(); // questionId -> AnswerItem
  private statusMap = new Map<string, SaveStatus>(); // questionId -> SaveStatus
  private listeners: Set<StatusListener> = new Set();
  private isProcessing = false;

  public subscribe(listener: StatusListener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(payload: StatusListenerPayload) {
    this.statusMap.set(payload.questionId, payload.status);
    this.listeners.forEach((listener) => listener(payload));
  }

  public getStatus(questionId: string): SaveStatus {
    return this.statusMap.get(questionId) || 'IDLE';
  }

  public enqueueAnswer(attemptId: string, questionId: string, selectedOption: string) {
    const timestamp = Date.now();
    const item: AnswerItem = {
      attemptId,
      questionId,
      selectedOption,
      clientTimestamp: timestamp,
      attemptsCount: 0,
    };

    // Store newest selection (cancels out stale pending updates for the same question)
    this.latestSelections.set(questionId, item);

    // Notify UI immediately (Optimistic UI update)
    this.notify({
      questionId,
      status: 'SAVING',
      selectedOption,
    });

    // Remove old queued items for this question and push latest
    this.queue = this.queue.filter((q) => q.questionId !== questionId);
    this.queue.push(item);

    this.processQueue();
  }

  private async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;

    while (this.queue.length > 0) {
      const currentItem = this.queue[0];
      const latest = this.latestSelections.get(currentItem.questionId);

      // If a newer click occurred for this question, drop this stale item
      if (latest && latest.clientTimestamp > currentItem.clientTimestamp) {
        this.queue.shift();
        continue;
      }

      currentItem.attemptsCount++;

      try {
        const response = await fetch('/api/exam/answers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(currentItem),
        });

        const data = await response.json();

        if (response.ok && data.success) {
          // Verify we didn't get superseded while request was in-flight
          const currentLatest = this.latestSelections.get(currentItem.questionId);
          if (!currentLatest || currentLatest.clientTimestamp <= currentItem.clientTimestamp) {
            this.notify({
              questionId: currentItem.questionId,
              status: 'SAVED',
              selectedOption: currentItem.selectedOption,
              lastSavedAt: new Date().toLocaleTimeString(),
            });
          }
          this.queue.shift();
        } else {
          throw new Error(data.error || 'Failed to persist answer');
        }
      } catch (err: any) {
        console.warn(`[AnswerQueue] Request failed (attempt ${currentItem.attemptsCount}):`, err);

        this.notify({
          questionId: currentItem.questionId,
          status: 'PENDING_RETRY',
          selectedOption: currentItem.selectedOption,
          errorMessage: err.message || 'Network error, retrying...',
        });

        // Exponential backoff if network failed
        if (currentItem.attemptsCount < 5) {
          const delay = Math.min(1000 * Math.pow(2, currentItem.attemptsCount - 1), 8000);
          await new Promise((res) => setTimeout(res, delay));
        } else {
          // Max retries reached
          this.notify({
            questionId: currentItem.questionId,
            status: 'ERROR',
            selectedOption: currentItem.selectedOption,
            errorMessage: 'Sync failed. Please check network.',
          });
          this.queue.shift(); // remove to unblock queue
        }
      }
    }

    this.isProcessing = false;
  }
}

export const answerQueueEngine = new AnswerQueueEngine();
