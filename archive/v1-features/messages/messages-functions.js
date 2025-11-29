// ================================
// MESSAGES FEATURE - JAVASCRIPT FUNCTIONS
// Archived from app.html
// Lines: 14412-14720
// ================================

// Global variables for messaging
let currentConversations = [];
let currentMessages = [];
let selectedConversationClient = null;

async function loadConversations() {
    try {
        // Get all clients with unread message counts
        const allClients = loadFromStorage('clients', []);
        const allMessages = loadFromStorage('client_messages', []);

        // Group messages by client and get unread counts
        const conversationsMap = new Map();

        allClients.forEach(client => {
            const clientMessages = allMessages.filter(m => m.client_id === client.id);
            const unreadCount = clientMessages.filter(m => !m.is_read && m.sender_type === 'client').length;
            const lastMessage = clientMessages.sort((a, b) =>
                new Date(b.created_at) - new Date(a.created_at)
            )[0];

            conversationsMap.set(client.id, {
                client: client,
                messageCount: clientMessages.length,
                unreadCount: unreadCount,
                lastMessage: lastMessage,
                lastMessageTime: lastMessage ? new Date(lastMessage.created_at) : new Date(0)
            });
        });

        // Convert to array and sort by last message time
        currentConversations = Array.from(conversationsMap.values())
            .filter(conv => conv.messageCount > 0) // Only show clients with messages
            .sort((a, b) => b.lastMessageTime - a.lastMessageTime);

        renderConversations();
        updateMessagesBadge();
    } catch (error) {
        console.error('Error loading conversations:', error);
        showToast('Failed to load conversations', 'error');
    }
}

function renderConversations() {
    const container = document.getElementById('conversationsList');
    if (!container) return;

    if (currentConversations.length === 0) {
        container.innerHTML = `
            <div style="padding: 40px 20px; text-align: center; color: var(--text-secondary);">
                <p>No conversations yet</p>
                <p style="font-size: 13px; margin-top: 10px;">Messages from clients will appear here</p>
            </div>
        `;
        return;
    }

    let html = '';
    currentConversations.forEach(conv => {
        const isSelected = selectedConversationClient && selectedConversationClient.id === conv.client.id;
        const unreadBadge = conv.unreadCount > 0
            ? `<span class="notification-badge" style="display: inline-flex;">${conv.unreadCount}</span>`
            : '';

        const lastMessagePreview = conv.lastMessage
            ? (conv.lastMessage.message.substring(0, 50) + (conv.lastMessage.message.length > 50 ? '...' : ''))
            : 'No messages';

        const timeAgo = conv.lastMessage ? formatTimeAgo(new Date(conv.lastMessage.created_at)) : '';

        html += `
            <div class="conversation-item ${isSelected ? 'active' : ''}" onclick="selectConversation('${conv.client.id}')" style="padding: 15px; border-bottom: 1px solid var(--border-color); cursor: pointer; transition: background 0.2s; ${isSelected ? 'background: var(--surface-hover);' : ''}">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 5px;">
                    <div style="font-weight: 600; color: var(--primary-color);">${conv.client.name}</div>
                    ${unreadBadge}
                </div>
                <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 3px;">${lastMessagePreview}</div>
                <div style="font-size: 12px; color: var(--text-secondary);">${timeAgo}</div>
            </div>
        `;
    });

    container.innerHTML = html;
}

function selectConversation(clientId) {
    const conversation = currentConversations.find(c => c.client.id === clientId);
    if (!conversation) return;

    selectedConversationClient = conversation.client;

    // Update UI
    document.getElementById('selectedClientInfo').style.display = 'block';
    document.getElementById('noConversationSelected').style.display = 'none';
    document.getElementById('messageComposer').style.display = 'block';
    document.getElementById('selectedClientName').textContent = conversation.client.name;
    document.getElementById('selectedClientEmail').textContent = conversation.client.email || '';

    // Load messages
    loadMessagesForClient(clientId);

    // Highlight selected conversation
    renderConversations();

    // Mark messages as read
    markConversationAsRead(clientId);
}

function loadMessagesForClient(clientId) {
    try {
        const allMessages = loadFromStorage('client_messages', []);
        currentMessages = allMessages
            .filter(m => m.client_id === clientId)
            .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

        renderMessages();
    } catch (error) {
        console.error('Error loading messages:', error);
        showToast('Failed to load messages', 'error');
    }
}

function renderMessages() {
    const container = document.getElementById('messagesArea');
    if (!container) return;

    if (currentMessages.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
                <p>No messages yet</p>
                <p style="font-size: 13px; margin-top: 10px;">Start the conversation by sending a message below</p>
            </div>
        `;
        return;
    }

    let html = '';
    currentMessages.forEach(msg => {
        const isProvider = msg.sender_type === 'provider';
        const messageTime = new Date(msg.created_at);
        const timeStr = messageTime.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });

        html += `
            <div style="margin-bottom: 15px; display: flex; ${isProvider ? 'justify-content: flex-end;' : 'justify-content: flex-start;'}">
                <div style="max-width: 70%; ${isProvider ? 'text-align: right;' : 'text-align: left;'}">
                    <div style="background: ${isProvider ? 'var(--primary-color)' : 'white'}; color: ${isProvider ? 'white' : 'var(--text-primary)'}; padding: 12px 16px; border-radius: 12px; box-shadow: var(--shadow-sm); margin-bottom: 5px;">
                        ${escapeHtml(msg.message)}
                    </div>
                    <div style="font-size: 11px; color: var(--text-secondary); padding: 0 8px;">
                        ${msg.sender_name || (isProvider ? 'You' : 'Client')} • ${timeStr}
                    </div>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;

    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
}

async function sendProviderMessage() {
    const input = document.getElementById('messageInput');
    const message = input.value.trim();

    if (!message) {
        showToast('Please enter a message', 'error');
        return;
    }

    if (!selectedConversationClient) {
        showToast('No conversation selected', 'error');
        return;
    }

    try {
        // Create message object
        const newMessage = {
            id: Date.now(),
            client_id: selectedConversationClient.id,
            subject: 'Message',
            message: message,
            message_type: 'chat',
            priority: 'normal',
            is_read: false,
            sender_type: 'provider',
            sender_id: currentUser.id,
            sender_name: currentUser.name || currentUser.username,
            created_at: new Date().toISOString()
        };

        // Save to storage
        const allMessages = loadFromStorage('client_messages', []);
        allMessages.push(newMessage);
        saveToStorage('client_messages', allMessages);

        // Add to current messages
        currentMessages.push(newMessage);

        // Clear input
        input.value = '';

        // Re-render
        renderMessages();
        loadConversations(); // Refresh conversations list

        // Log audit
        logLocalAudit('message_sent', {
            clientId: selectedConversationClient.id,
            clientName: selectedConversationClient.name
        });

        showToast('Message sent', 'success');
    } catch (error) {
        console.error('Error sending message:', error);
        showToast('Failed to send message', 'error');
    }
}

function handleMessageKeydown(event) {
    // Send message on Ctrl+Enter or Cmd+Enter
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        sendProviderMessage();
    }
}

function refreshMessages() {
    if (selectedConversationClient) {
        loadMessagesForClient(selectedConversationClient.id);
    }
    loadConversations();
    showToast('Messages refreshed', 'success');
}

function markConversationAsRead(clientId) {
    try {
        const allMessages = loadFromStorage('client_messages', []);
        let updated = false;

        allMessages.forEach(msg => {
            if (msg.client_id === clientId && !msg.is_read && msg.sender_type === 'client') {
                msg.is_read = true;
                msg.read_at = new Date().toISOString();
                updated = true;
            }
        });

        if (updated) {
            saveToStorage('client_messages', allMessages);
            loadConversations(); // Refresh to update unread counts
        }
    } catch (error) {
        console.error('Error marking messages as read:', error);
    }
}

function updateMessagesBadge() {
    const badge = document.getElementById('messagesBadge');
    if (!badge) return;

    const totalUnread = currentConversations.reduce((sum, conv) => sum + conv.unreadCount, 0);

    if (totalUnread > 0) {
        badge.textContent = totalUnread;
        badge.style.display = 'inline-flex';
    } else {
        badge.style.display = 'none';
    }
}

function filterConversations() {
    const searchInput = document.getElementById('conversationSearch');
    const searchTerm = searchInput.value.toLowerCase();

    const filteredConversations = currentConversations.filter(conv =>
        conv.client.name.toLowerCase().includes(searchTerm) ||
        (conv.client.email && conv.client.email.toLowerCase().includes(searchTerm)) ||
        (conv.lastMessage && conv.lastMessage.message.toLowerCase().includes(searchTerm))
    );

    // Temporarily replace currentConversations for rendering
    const originalConversations = currentConversations;
    currentConversations = filteredConversations;
    renderConversations();
    currentConversations = originalConversations;
}

function formatTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
