import { PageContainer } from '@ant-design/pro-layout';
import { Card, Tabs } from 'antd';
import React from 'react';
import SimpleLongStrategy from './components/simpleLongStrategy';
import SimpleShortStrategy from './components/simpleShortStrategy';

// 函数组件（使用 Hooks）

const Page: React.FC = () => {
  return (
    <PageContainer ghost>
      <Card>
        <Tabs>
          <Tabs.TabPane tab="简单做多" key="item-1">
            <SimpleLongStrategy></SimpleLongStrategy>
          </Tabs.TabPane>
          <Tabs.TabPane tab="简单做空" key="item-2">
            <SimpleShortStrategy></SimpleShortStrategy>
          </Tabs.TabPane>
        </Tabs>
      </Card>
    </PageContainer>
  );
};

export default Page;
