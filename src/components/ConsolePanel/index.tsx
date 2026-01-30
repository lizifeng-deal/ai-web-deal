import React, { useState, useEffect, useRef } from 'react';

interface ConsoleMessage {
  content: string;
  type: 'log' | 'error' | 'warn';
}

const ConsolePanel: React.FC = () => {
  const [messages, setMessages] = useState<ConsoleMessage[]>([]);
  const consoleRef = useRef<HTMLDivElement>(null);

  // 保存原生console方法，避免覆盖后丢失原有功能
  const originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
  };

  // 格式化输出内容（处理对象/数组等类型）
  const formatContent = (args: any[]): string => {
    return args.map(arg => {
      try {
        // 对象/数组转JSON字符串（带缩进），其他类型直接转字符串
        return typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg);
      } catch (e) {
        return `[无法序列化: ${e.message}]`;
      }
    }).join(' '); // 多个参数用空格分隔
  };

  // 添加消息到页面
  const addMessage = (args: any[], type: ConsoleMessage['type']) => {
    const content = formatContent(args);
    setMessages(prev => [...prev, { content, type }]);
    // 自动滚动到最新消息
    setTimeout(() => {
      consoleRef.current?.scrollTo({ top: consoleRef.current.scrollHeight, behavior: 'smooth' });
    }, 0);
  };

  useEffect(() => {
    // 重写console方法
    console.log = (...args) => {
      originalConsole.log(...args); // 保留原生输出
      addMessage(args, 'log');
    };
    console.error = (...args) => {
      originalConsole.error(...args);
      addMessage(args, 'error');
    };
    console.warn = (...args) => {
      originalConsole.warn(...args);
      addMessage(args, 'warn');
    };

    // 组件卸载时恢复原生console
    return () => {
      console.log = originalConsole.log;
      console.error = originalConsole.error;
      console.warn = originalConsole.warn;
    };
  }, []);

  // 清空消息
  const clearConsole = () => setMessages([]);

  return (
    <div style={{
      border: '1px solid #eee',
      borderRadius: '4px',
      padding: '10px',
      maxHeight: '700px',
      overflowY: 'auto',
      backgroundColor: '#f9f9f9'
    }} ref={consoleRef}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
        <h4>页面Console面板</h4>
        <button onClick={clearConsole} style={{ fontSize: '12px', padding: '2px 8px' }}>清空</button>
      </div>
      <div>
        {messages.map((msg, idx) => (
          <div
            key={idx}
            style={{
              margin: '5px 0',
              padding: '3px',
              color: msg.type === 'error' ? 'red' : msg.type === 'warn' ? 'orange' : '#333',
              fontSize: '13px'
            }}
          >
            <span>{msg.content}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ConsolePanel;
