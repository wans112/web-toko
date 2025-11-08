'use client';
import React, { useState, useEffect, useRef } from 'react';
import { 
  Card, 
  Avatar, 
  List, 
  Input, 
  Button, 
  message, 
  notification,
  Typography, 
  Spin, 
  Empty,
  Row,
  Col,
  Space,
  Divider,
  Badge
} from 'antd';
import { 
  SendOutlined, 
  ArrowLeftOutlined, 
  UserOutlined,
  MessageOutlined 
} from '@ant-design/icons';
import dayjs from 'dayjs';
import 'dayjs/locale/id';

const { Text, Title } = Typography;
const { TextArea } = Input;

dayjs.locale('id');

const Chating = () => {
  const [conversations, setConversations] = useState([]);
  const [currentChat, setCurrentChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const lastSeenChatIdRef = useRef(null);
  const [notifyApi, notifyContext] = notification.useNotification();

  // Check if mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Handle viewport height changes (for mobile keyboard)
  useEffect(() => {
    const handleViewportChange = () => {
      if (isMobile && currentChat) {
        setTimeout(() => {
          scrollToBottom();
        }, 100);
      }
    };

    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('orientationchange', handleViewportChange);
    
    return () => {
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('orientationchange', handleViewportChange);
    };
  }, [isMobile, currentChat]);

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch conversations list
  const fetchConversations = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/chat');
      const data = await response.json();
      
      if (data.success) {
        setConversations(data.data);
      } else {
        message.error(data.error || 'Gagal memuat daftar percakapan');
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
      message.error('Gagal memuat daftar percakapan');
    } finally {
      setLoading(false);
    }
  };

  // Fetch messages for specific conversation
  const fetchMessages = async (withUserId) => {
    try {
      setMessagesLoading(true);
      const response = await fetch(`/api/chat?with_user_id=${withUserId}`);
      const data = await response.json();
      
      if (data.success) {
        setMessages(data.data);
      } else {
        message.error(data.error || 'Gagal memuat pesan');
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
      message.error('Gagal memuat pesan');
    } finally {
      setMessagesLoading(false);
    }
  };

  // Send new message
  const sendMessage = async () => {
    if (!newMessage.trim() || !currentChat) return;

    try {
      setSending(true);
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to_user_id: currentChat.other_user_id,
          message: newMessage.trim()
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setMessages(prev => [...prev, data.data]);
        setNewMessage('');
        // Update conversation list to show latest message
        fetchConversations();
      } else {
        message.error(data.error || 'Gagal mengirim pesan');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      message.error('Gagal mengirim pesan');
    } finally {
      setSending(false);
    }
  };

  // Handle conversation click
  const handleConversationClick = (conversation) => {
    setCurrentChat(conversation);
    fetchMessages(conversation.other_user_id);
  };

  // Handle back to conversations list
  const handleBackToList = () => {
    setCurrentChat(null);
    setMessages([]);
  };

  // Handle Enter key press
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Handle input focus on mobile
  const handleInputFocus = () => {
    if (isMobile) {
      setTimeout(() => {
        if (chatContainerRef.current) {
          chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
        scrollToBottom();
      }, 300);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, []);

  // Poll for new messages and show notification
  useEffect(() => {
    let timer;
    const poll = async () => {
      try {
        // Get latest conversation/message
        const resp = await fetch('/api/chat?limit=1');
        const data = await resp.json();
        if (!data?.success || !Array.isArray(data.data) || data.data.length === 0) return;
        const latest = data.data[0];
        // Only notify if this latest message is from the other user
        const isFromOther = latest && latest.from_user_id === latest.other_user_id;
        if (!latest?.id) return;

        if (lastSeenChatIdRef.current == null) {
          lastSeenChatIdRef.current = latest.id;
          return;
        }

        if (latest.id !== lastSeenChatIdRef.current && isFromOther) {
          lastSeenChatIdRef.current = latest.id;
          notifyApi.open({
            message: 'Pesan baru',
            description: `${latest.other_user_name || 'Pengguna'}: ${latest.message}`,
            placement: 'topRight',
          });
          // Refresh conversation list to reflect latest preview
          fetchConversations();
          // If currently viewing this chat, refresh messages
          if (currentChat && currentChat.other_user_id === latest.other_user_id) {
            fetchMessages(latest.other_user_id);
          }
        }
      } catch (e) {
        // silent
      }
    };
    // Start interval
    timer = setInterval(poll, 8000);
    // Prime first check after mount
    poll();
    return () => clearInterval(timer);
  }, [currentChat]);

  // Render conversations list
  const renderConversationsList = () => (
    <div style={{ 
      height: isMobile ? 'calc(100vh - 8px)' : 'calc(100vh - 60px)', 
      minHeight: '400px',
      overflow: 'auto',
      paddingBottom: '20px'
    }}>
      <Title level={3} style={{ 
        textAlign: 'center', 
        marginBottom: 24,
        fontSize: isMobile ? '18px' : '24px'
      }}>
        <MessageOutlined /> Pesan
      </Title>
      
      {loading ? (
        <div style={{ textAlign: 'center', padding: '50px 0' }}>
          <Spin size="large" />
        </div>
      ) : conversations.length === 0 ? (
        <Empty 
          description="Belum ada percakapan"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      ) : isMobile ? (
        // Mobile: Grid layout dengan cards
        <Row gutter={[12, 12]}>
          {conversations.map((conversation) => (
            <Col xs={24} sm={12} key={conversation.id}>
              <Card
                hoverable
                onClick={() => handleConversationClick(conversation)}
                style={{ cursor: 'pointer', height: '100%' }}
                styles={{ body: { padding: 12 } }}
              >
                <Card.Meta
                  avatar={
                    <Badge dot={false}>
                      <Avatar 
                        size={44}
                        src={conversation.other_user_avatar ? 
                          `/api/avatar?filename=${conversation.other_user_avatar}` : 
                          null
                        }
                        icon={!conversation.other_user_avatar && <UserOutlined />}
                      />
                    </Badge>
                  }
                  title={
                    <Text strong ellipsis className="w-full" style={{ fontSize: '14px' }}>
                      {conversation.other_user_name}
                    </Text>
                  }
                  description={
                    <div>
                      <Text 
                        type="secondary" 
                        ellipsis 
                        className="w-full"
                        style={{ 
                          display: 'block',
                          marginBottom: 4,
                          fontSize: '12px'
                        }}
                      >
                        {conversation.message}
                      </Text>
                      <Text type="secondary" style={{ fontSize: '10px' }}>
                        {dayjs(conversation.created_at).format('DD/MM HH:mm')}
                      </Text>
                    </div>
                  }
                />
              </Card>
            </Col>
          ))}
        </Row>
      ) : (
        // Desktop: List layout dengan detail lengkap
        <div 
          className="conversation-list w-full"
          style={{ 
            maxWidth: '800px', 
            margin: '0 auto',
            height: 'calc(100% - 80px)',
            overflow: 'auto',
            paddingRight: '8px'
          }}
        >
          <List
            itemLayout="horizontal"
            dataSource={conversations}
            renderItem={(conversation) => (
              <List.Item
                className="conversation-list-item"
                style={{
                  cursor: 'pointer',
                  padding: '16px 20px',
                  borderRadius: '12px',
                  marginBottom: '12px',
                  border: '1px solid #f0f0f0',
                  transition: 'all 0.3s ease',
                  backgroundColor: '#fff'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#fafafa';
                  e.currentTarget.style.borderColor = '#1890ff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#fff';
                  e.currentTarget.style.borderColor = '#f0f0f0';
                }}
                onClick={() => handleConversationClick(conversation)}
              >
                <List.Item.Meta
                  avatar={
                    <Badge dot={false}>
                      <Avatar 
                        size={60}
                        src={conversation.other_user_avatar ? 
                          `/api/avatar?filename=${conversation.other_user_avatar}` : 
                          null
                        }
                        icon={!conversation.other_user_avatar && <UserOutlined />}
                        style={{ 
                          border: '2px solid #f0f0f0',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                        }}
                      />
                    </Badge>
                  }
                  title={
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      marginBottom: '4px'
                    }}>
                      <Text strong style={{ 
                        fontSize: '18px', 
                        color: '#262626',
                        fontWeight: '600'
                      }}>
                        {conversation.other_user_name}
                      </Text>
                      <Text type="secondary" style={{ 
                        fontSize: '13px',
                        color: '#8c8c8c'
                      }}>
                        {dayjs(conversation.created_at).format('DD/MM/YY HH:mm')}
                      </Text>
                    </div>
                  }
                  description={
                    <div style={{ marginTop: '8px' }}>
                      <Text 
                        type="secondary" 
                        style={{ 
                          fontSize: '15px',
                          lineHeight: '1.5',
                          display: 'block',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: '600px',
                          color: '#595959'
                        }}
                      >
                        {conversation.message}
                      </Text>
                    </div>
                  }
                />
                <div style={{ 
                  alignSelf: 'center',
                  marginLeft: '20px',
                  color: '#bfbfbf',
                  fontSize: '18px'
                }}>
                  <MessageOutlined />
                </div>
              </List.Item>
            )}
          />
        </div>
      )}
    </div>
  );

  // Render chat messages
  const renderChatMessages = () => (
    <div style={{ 
      height: isMobile ? 'calc(100vh - 8px)' : 'calc(100vh - 60px)', 
      minHeight: '400px',
      display: 'flex', 
      flexDirection: 'column' 
    }}>
      {/* Chat Header */}
      <Card 
        size="small" 
        style={{ 
          marginBottom: 8, 
          borderRadius: 8,
          flexShrink: 0
        }}
        styles={{ body: { padding: isMobile ? '6px 8px' : '8px 12px' } }}
      >
        <Space>
          <Button 
            type="text" 
            icon={<ArrowLeftOutlined />} 
            onClick={handleBackToList}
            size={isMobile ? "small" : "middle"}
          />
          <Avatar 
            size={isMobile ? 28 : 32}
            src={currentChat?.other_user_avatar ? 
              `/api/avatar?filename=${currentChat.other_user_avatar}` : 
              null
            }
            icon={!currentChat?.other_user_avatar && <UserOutlined />}
          />
          <div>
            <Text strong style={{ fontSize: isMobile ? '13px' : '14px' }}>
              {currentChat?.other_user_name}
            </Text>
          </div>
        </Space>
      </Card>

      {/* Messages Area */}
      <Card 
        style={{ 
          flex: 1, 
          marginBottom: 8,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0
        }}
        styles={{ body: {
          padding: isMobile ? '4px 8px' : '8px 12px', 
          flex: 1, 
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        } }}
      >
        {messagesLoading ? (
          <div style={{ textAlign: 'center', padding: '50px 0' }}>
            <Spin />
          </div>
        ) : messages.length === 0 ? (
          <Empty description="Belum ada pesan" />
        ) : (
          <div 
            ref={chatContainerRef}
            className="messages-container"
            style={{ 
              flex: 1, 
              overflow: 'auto',
              paddingRight: '4px',
              scrollbarWidth: 'thin',
              scrollBehavior: 'smooth'
            }}
          >
            {messages.map((msg, index) => {
              const isMyMessage = msg.from_user_id !== currentChat.other_user_id;
              const showAvatar = index === 0 || 
                messages[index - 1].from_user_id !== msg.from_user_id;
              
              return (
                <div
                  key={msg.id}
                  style={{
                    display: 'flex',
                    justifyContent: isMyMessage ? 'flex-end' : 'flex-start',
                    marginBottom: isMobile ? 6 : 8,
                    alignItems: 'flex-end'
                  }}
                >
                  {!isMyMessage && showAvatar && (
                    <Avatar 
                      size={isMobile ? 20 : 24}
                      src={currentChat?.other_user_avatar ? 
                        `/api/avatar?filename=${currentChat.other_user_avatar}` : 
                        null
                      }
                      icon={!currentChat?.other_user_avatar && <UserOutlined />}
                      style={{ marginRight: isMobile ? 4 : 6 }}
                    />
                  )}
                  
                  {!isMyMessage && !showAvatar && (
                    <div style={{ width: isMobile ? 24 : 28, marginRight: isMobile ? 4 : 6 }} />
                  )}
                  
                  <div
                    style={{
                      maxWidth: isMobile ? '85%' : '70%',
                      padding: isMobile ? '4px 8px' : '6px 10px',
                      borderRadius: isMobile ? 8 : 12,
                      backgroundColor: isMyMessage ? '#1890ff' : '#f5f5f5',
                      color: isMyMessage ? 'white' : 'black',
                      fontSize: isMobile ? '13px' : '14px',
                      wordBreak: 'break-word',
                      border: !isMyMessage ? '1px solid rgba(180,180,180,0.3)' : undefined
                    }}
                  >
                    <div style={{ marginBottom: 2 }}>
                      {msg.message}
                    </div>
                    <Text 
                      style={{ 
                        fontSize: isMobile ? '9px' : '10px', 
                        opacity: 0.7,
                        color: isMyMessage ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.45)'
                      }}
                    >
                      {dayjs(msg.created_at).format('HH:mm')}
                    </Text>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </Card>

      {/* Message Input - Fixed at bottom */}
      <Card 
        size="small" 
        style={{ 
          flexShrink: 0,
          position: 'sticky',
          bottom: 0,
          zIndex: 10,
          boxShadow: '0 -2px 8px rgba(0,0,0,0.1)',
          margin: isMobile ? '0' : undefined
        }}
        styles={{ body: { padding: isMobile ? '6px 8px' : '8px 12px' } }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: isMobile ? '6px' : '8px' }} className="w-full">
          <TextArea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            onFocus={handleInputFocus}
            placeholder="Ketik pesan..."
            autoSize={{ minRows: 1, maxRows: isMobile ? 2 : 3 }}
            className="flex-1"
            style={{ 
              resize: 'none',
              fontSize: isMobile ? '14px' : '14px'
            }}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={sendMessage}
            loading={sending}
            disabled={!newMessage.trim()}
            size={isMobile ? "small" : "middle"}
            style={{ 
              height: 'auto',
              minHeight: isMobile ? '28px' : '32px',
              alignSelf: 'flex-end',
              padding: isMobile ? '4px 8px' : undefined
            }}
          >
            {isMobile ? '' : 'Kirim'}
          </Button>
        </div>
      </Card>
    </div>
  );

  return (
    <>
  {notifyContext}
      <style jsx>{`
        @media (max-width: 767px) {
          .chat-container {
            height: 100vh;
            height: -webkit-fill-available;
          }
          
          .ant-input {
            font-size: 16px !important; /* Prevents zoom on iOS */
          }
          
          .messages-container {
            height: calc(100vh - 140px);
            height: calc(-webkit-fill-available - 140px);
          }
        }
        
        @media (min-width: 768px) {
          .conversation-list-item {
            box-shadow: 0 2px 4px rgba(0,0,0,0.02);
          }
          
          .conversation-list-item:hover {
            box-shadow: 0 4px 12px rgba(0,0,0,0.08);
            transform: translateY(-1px);
          }
        }
        
        .messages-container::-webkit-scrollbar {
          width: 4px;
        }
        
        .messages-container::-webkit-scrollbar-track {
          background: #f1f1f1;
        }
        
        .messages-container::-webkit-scrollbar-thumb {
          background: #888;
          border-radius: 2px;
        }
        
        .messages-container::-webkit-scrollbar-thumb:hover {
          background: #555;
        }
        
        .conversation-list::-webkit-scrollbar {
          width: 6px;
        }
        
        .conversation-list::-webkit-scrollbar-track {
          background: #f1f1f1;
        }
        
        .conversation-list::-webkit-scrollbar-thumb {
          background: #c1c1c1;
          border-radius: 3px;
        }
        
        .conversation-list::-webkit-scrollbar-thumb:hover {
          background: #a8a8a8;
        }
      `}</style>
      <div 
        className="chat-container w-full"
        style={{ 
          padding: isMobile ? '4px' : '16px', 
          margin: '0 auto',
          height: isMobile ? '100vh' : 'calc(100vh - 40px)',
          overflow: 'hidden'
        }}
      >
        {currentChat ? renderChatMessages() : renderConversationsList()}
      </div>
    </>
  );
};

export default Chating;