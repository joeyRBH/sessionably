/**
 * Client-side AI Note Generation Handler
 *
 * This file handles the UI for AI note generation and makes calls
 * to the serverless API endpoint
 */

// AI Note Generation functionality
const AINoteTaker = {
  /**
   * Initialize the AI note generation UI and event listeners
   */
  init() {
    console.log('[AINoteTaker] Initializing AI Note Generation...');

    // Find the generate button
    const generateButton = document.getElementById('generate-ai-note-btn') ||
                          document.querySelector('[data-action="generate-ai-note"]') ||
                          document.querySelector('.generate-ai-note');

    if (!generateButton) {
      console.warn('[AINoteTaker] Generate button not found');
      return;
    }

    // Add click event listener
    generateButton.addEventListener('click', (e) => {
      e.preventDefault();
      this.generateNote();
    });

    console.log('[AINoteTaker] Initialization complete');
  },

  /**
   * Main function to generate an AI note
   */
  async generateNote() {
    console.log('[AINoteTaker] Starting note generation...');

    try {
      // Show loading state
      this.showLoadingState();

      // Get transcript data from the UI
      const transcriptData = this.getTranscriptData();

      if (!transcriptData.transcript) {
        throw new Error('No transcript available. Please record or enter a session transcript first.');
      }

      // Call the API to generate the note
      const result = await this.callGenerateNoteAPI(transcriptData);

      // Display the generated note
      this.displayGeneratedNote(result.note, result.metadata);

      // Show success message
      this.showSuccess('AI note generated successfully!');

    } catch (error) {
      console.error('[AINoteTaker] Error:', error);
      this.showError(error.message);
    } finally {
      this.hideLoadingState();
    }
  },

  /**
   * Get transcript data from the UI
   */
  getTranscriptData() {
    // Try multiple possible selectors for the transcript input
    const transcriptInput = document.getElementById('session-transcript') ||
                           document.getElementById('transcript') ||
                           document.querySelector('[name="transcript"]') ||
                           document.querySelector('textarea[data-transcript]') ||
                           document.querySelector('.transcript-input') ||
                           document.querySelector('textarea.form-control');

    if (!transcriptInput) {
      console.error('[AINoteTaker] Transcript input not found');
      throw new Error('Transcript input field not found');
    }

    const transcript = transcriptInput.value.trim();

    // Get additional session data if available
    const clientNameInput = document.getElementById('client-name') ||
                           document.querySelector('[name="client-name"]');
    const sessionDateInput = document.getElementById('session-date') ||
                            document.querySelector('[name="session-date"]');
    const sessionTypeInput = document.getElementById('session-type') ||
                            document.querySelector('[name="session-type"]');
    const diagnosisInput = document.getElementById('diagnosis') ||
                          document.querySelector('[name="diagnosis"]');

    return {
      transcript: transcript,
      clientName: clientNameInput ? clientNameInput.value : null,
      sessionDate: sessionDateInput ? sessionDateInput.value : null,
      sessionType: sessionTypeInput ? sessionTypeInput.value : null,
      diagnosis: diagnosisInput ? diagnosisInput.value : null
    };
  },

  /**
   * Call the generate note API
   */
  async callGenerateNoteAPI(data) {
    console.log('[AINoteTaker] Calling API...');

    const response = await fetch('/api/generate-note', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || 'Failed to generate note');
    }

    console.log('[AINoteTaker] Note generated successfully');
    return result;
  },

  /**
   * Display the generated note in the UI
   */
  displayGeneratedNote(noteContent, metadata) {
    // Find the note display area
    const noteDisplay = document.getElementById('generated-note') ||
                       document.getElementById('ai-note-output') ||
                       document.querySelector('.ai-note-display') ||
                       document.querySelector('[data-note-output]');

    if (!noteDisplay) {
      // Create a new display area if it doesn't exist
      this.createNoteDisplayArea(noteContent, metadata);
      return;
    }

    // Format the note content with proper line breaks
    const formattedNote = this.formatNoteForDisplay(noteContent);

    // Display the note
    noteDisplay.innerHTML = `
      <div class="ai-note-container">
        <div class="note-header">
          <h3>Generated Clinical Note</h3>
          <div class="note-metadata">
            <small>Generated: ${new Date(metadata.generatedAt).toLocaleString()}</small>
            ${metadata.clientName ? `<small>Client: ${metadata.clientName}</small>` : ''}
            ${metadata.sessionDate ? `<small>Session: ${metadata.sessionDate}</small>` : ''}
          </div>
        </div>
        <div class="note-content">
          ${formattedNote}
        </div>
        <div class="note-actions">
          <button class="btn btn-primary" onclick="AINoteTaker.copyNote()">
            Copy to Clipboard
          </button>
          <button class="btn btn-secondary" onclick="AINoteTaker.editNote()">
            Edit Note
          </button>
          <button class="btn btn-success" onclick="AINoteTaker.saveNote()">
            Save Note
          </button>
        </div>
      </div>
    `;

    // Scroll to the note
    noteDisplay.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  },

  /**
   * Format note content for display
   */
  formatNoteForDisplay(noteContent) {
    // Convert markdown-style headers to HTML
    let formatted = noteContent
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');

    return `<p>${formatted}</p>`;
  },

  /**
   * Create a new note display area if one doesn't exist
   */
  createNoteDisplayArea(noteContent, metadata) {
    const container = document.querySelector('.note-form') ||
                     document.querySelector('.notes-section') ||
                     document.querySelector('main') ||
                     document.body;

    const noteDisplay = document.createElement('div');
    noteDisplay.id = 'generated-note';
    noteDisplay.className = 'generated-note-section';

    container.appendChild(noteDisplay);
    this.displayGeneratedNote(noteContent, metadata);
  },

  /**
   * Copy note to clipboard
   */
  async copyNote() {
    const noteContent = document.querySelector('.note-content');
    if (!noteContent) return;

    try {
      // Get plain text content
      const text = noteContent.innerText;
      await navigator.clipboard.writeText(text);
      this.showSuccess('Note copied to clipboard!');
    } catch (error) {
      console.error('[AINoteTaker] Copy failed:', error);
      this.showError('Failed to copy note');
    }
  },

  /**
   * Edit note functionality
   */
  editNote() {
    const noteContent = document.querySelector('.note-content');
    if (!noteContent) return;

    const currentContent = noteContent.innerText;

    noteContent.innerHTML = `
      <textarea class="note-editor" style="width: 100%; min-height: 400px; padding: 1rem; border: 1px solid #ccc; border-radius: 8px; font-family: inherit; font-size: inherit;">
${currentContent}</textarea>
      <div style="margin-top: 1rem;">
        <button class="btn btn-primary" onclick="AINoteTaker.saveEditedNote()">
          Save Changes
        </button>
        <button class="btn btn-secondary" onclick="AINoteTaker.cancelEdit('${currentContent.replace(/'/g, "\\'")}')">
          Cancel
        </button>
      </div>
    `;
  },

  /**
   * Save edited note
   */
  saveEditedNote() {
    const editor = document.querySelector('.note-editor');
    if (!editor) return;

    const editedContent = editor.value;
    const noteContent = document.querySelector('.note-content');

    noteContent.innerHTML = this.formatNoteForDisplay(editedContent);
    this.showSuccess('Note updated successfully!');
  },

  /**
   * Cancel edit
   */
  cancelEdit(originalContent) {
    const noteContent = document.querySelector('.note-content');
    if (!noteContent) return;

    noteContent.innerHTML = this.formatNoteForDisplay(originalContent);
  },

  /**
   * Save note to database/storage
   */
  async saveNote() {
    const noteContent = document.querySelector('.note-content');
    if (!noteContent) return;

    try {
      const text = noteContent.innerText;

      // Get current client/session context
      const clientId = this.getCurrentClientId();
      const sessionId = this.getCurrentSessionId();

      // Save to your storage (localStorage for demo, should be API in production)
      const noteData = {
        id: 'note_' + Date.now(),
        clientId: clientId,
        sessionId: sessionId,
        content: text,
        createdAt: new Date().toISOString(),
        type: 'AI Generated',
        format: 'DAP'
      };

      // Save to localStorage (replace with your actual save logic)
      const existingNotes = JSON.parse(localStorage.getItem('clinical_notes') || '[]');
      existingNotes.push(noteData);
      localStorage.setItem('clinical_notes', JSON.stringify(existingNotes));

      this.showSuccess('Note saved successfully!');

      // Optional: redirect to notes view
      // window.location.href = '/app#notes';

    } catch (error) {
      console.error('[AINoteTaker] Save failed:', error);
      this.showError('Failed to save note');
    }
  },

  /**
   * Get current client ID from context
   */
  getCurrentClientId() {
    // Try to get from URL, form, or session storage
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('clientId') ||
           document.getElementById('client-id')?.value ||
           sessionStorage.getItem('currentClientId') ||
           null;
  },

  /**
   * Get current session ID from context
   */
  getCurrentSessionId() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('sessionId') ||
           document.getElementById('session-id')?.value ||
           'session_' + Date.now();
  },

  /**
   * Show loading state
   */
  showLoadingState() {
    const button = document.getElementById('generate-ai-note-btn') ||
                  document.querySelector('[data-action="generate-ai-note"]');

    if (button) {
      button.disabled = true;
      button.dataset.originalText = button.textContent;
      button.innerHTML = '<span class="spinner"></span> Generating...';
    }

    // Show loading overlay if it exists
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
      overlay.style.display = 'flex';
    }
  },

  /**
   * Hide loading state
   */
  hideLoadingState() {
    const button = document.getElementById('generate-ai-note-btn') ||
                  document.querySelector('[data-action="generate-ai-note"]');

    if (button) {
      button.disabled = false;
      button.textContent = button.dataset.originalText || 'Generate AI Note';
    }

    // Hide loading overlay
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
      overlay.style.display = 'none';
    }
  },

  /**
   * Show success message
   */
  showSuccess(message) {
    this.showNotification(message, 'success');
  },

  /**
   * Show error message
   */
  showError(message) {
    this.showNotification(message, 'error');
  },

  /**
   * Show notification
   */
  showNotification(message, type = 'info') {
    // Try to use existing notification system
    if (window.showNotification) {
      window.showNotification(message, type);
      return;
    }

    // Fallback: create simple notification
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 1rem 1.5rem;
      background: ${type === 'error' ? '#EF4444' : type === 'success' ? '#10B981' : '#00B4A6'};
      color: white;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      font-weight: 500;
      max-width: 400px;
      animation: slideIn 0.3s ease-out;
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease-in';
      setTimeout(() => notification.remove(), 300);
    }, 5000);
  }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => AINoteTaker.init());
} else {
  AINoteTaker.init();
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AINoteTaker;
}
