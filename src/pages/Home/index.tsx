import { del, get, post } from '@/utils/request';
import { PageContainer } from '@ant-design/pro-components';
import {
  Button,
  Card,
  Col,
  Divider,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Statistic,
  Table,
  Tag,
} from 'antd';
import React, { useEffect, useMemo, useState } from 'react';
import styles from './index.less';

// 资金流水类型枚举：入金、出金、手续费、交割盈亏（已实现盈亏）
type LedgerType = 'deposit' | 'withdraw' | 'fee' | 'delivery_pnl';

// 资金流水记录结构
interface LedgerEntry {
  id: string;
  type: LedgerType;
  amount: number;
  timestamp: number;
  remark?: string;
  currency?: string;
}

// 持仓结构：用于计算市值、浮动盈亏与保证金占用
interface Position {
  id: string;
  name: string;
  side: 'long' | 'short';
  quantity: number;
  market_value: number;
  open_price: number;
  pnl: number;
  leverage: number;
  margin: number;
  currency: string;
}

const currency = 'CNY';

const HomePage: React.FC = () => {
  // 现金余额：受入金/出金/手续费/交割盈亏影响
  const [cashBalance, setCashBalance] = useState<number>(0);
  // 冻结资金：如挂单预占或风控冻结
  const [frozenFunds, setFrozenFunds] = useState<number>(0);
  // 示例持仓数据：实际可由后端或策略模块驱动
  const [positions, setPositions] = useState<Position[]>([]);
  // 资金流水：记录类账本
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [addForm] = Form.useForm();
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addPosForm] = Form.useForm();
  const [addPosModalOpen, setAddPosModalOpen] = useState(false);

  useEffect(() => {
    getDealLog();
    getPositions();
  }, []);

  // 持仓市值
  const positionMarketValue = useMemo(() => {
    return positions.reduce((sum, p) => sum + (p.market_value || 0), 0);
  }, [positions]);

  // 浮动盈亏
  const floatingPnL = useMemo(() => {
    return positions.reduce((sum, p) => sum + (p.pnl || 0), 0);
  }, [positions]);

  // 已实现盈亏：来源于账本中交割盈亏
  const realizedPnL = useMemo(() => {
    return ledger
      .filter((l) => l.type === 'delivery_pnl')
      .reduce((sum, l) => sum + l.amount, 0);
  }, [ledger]);

  // 可用资金
  const availableFunds = useMemo(() => {
    return cashBalance - frozenFunds;
  }, [cashBalance, frozenFunds]);

  // 总权益：现金余额 + 浮动盈亏 + 已实现盈亏 + 持仓市值
  const totalEquity = useMemo(() => {
    return cashBalance + floatingPnL + realizedPnL + positionMarketValue;
  }, [cashBalance, floatingPnL, realizedPnL, positionMarketValue]);

  // 风险监控相关已移除

  // 新增账本记录：规范金额正负，并同步影响现金余额
  const addDealLog = (log: Omit<LedgerEntry, 'id' | 'timestamp'>) => {
    post('/dealLog', log).then((res) => {
      getDealLog();
    });
  };

  const getDealLog = () => {
    get<any[]>('/dealLog').then((data) => {
      setLedger(data);
    });
  };

  const getPositions = () => {
    get<any[]>('/positions').then((data) => {
      setPositions(data);
    });
    get<any[]>('/binance/positions').then((data) => {
      console.log(data);
      
    });
  };

  const addPosition = (
    pos: Omit<Position, 'id' | 'market_value' | 'pnl' | 'margin'>,
  ) => {
    post('/positions', pos).then((res) => {
      console.log(res);
      getPositions();
      setAddPosModalOpen(false);
      addPosForm.resetFields();
    });
  };

  // 表格列定义：含类型、金额、时间、备注与删除操作
  const ledgerColumns = [
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (t: LedgerType) => {
        const color =
          t === 'deposit'
            ? 'green'
            : t === 'withdraw'
            ? 'volcano'
            : t === 'fee'
            ? 'orange'
            : 'blue';
        const textMap: Record<LedgerType, string> = {
          deposit: '入金',
          withdraw: '出金',
          fee: '手续费',
          delivery_pnl: '交割盈亏',
        };
        return <Tag color={color}>{textMap[t]}</Tag>;
      },
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      render: (v: number, record: LedgerEntry) => {
        return `${v.toFixed(2)} ${currency}`;
      },
    },
    {
      title: '时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      render: (t: number) => new Date(t).toLocaleString(),
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
    },
    {
      title: '操作',
      dataIndex: 'action',
      key: 'action',
      render: (_: any, record: LedgerEntry) => (
        <Popconfirm
          title="确认删除该流水？"
          onConfirm={() => {
            del(`/dealLog/${record.id}`).then((res) => {
              getDealLog();
            });
          }}
        >
          <Button type="link" danger>
            删除
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <PageContainer
      ghost
      header={{
        title: '资金管理',
      }}
    >
      <div className={styles.container}>
        <Card title="资产总览" style={{ marginBottom: 16 }}>
          <Row gutter={[16, 16]}>
            <Col xs={24} md={8}>
              <Statistic
                title="总权益"
                value={totalEquity}
                precision={2}
                suffix={currency}
              />
            </Col>
            <Col xs={24} md={8}>
              <Statistic
                title="可用资金"
                value={availableFunds}
                precision={2}
                suffix={currency}
              />
            </Col>
            <Col xs={24} md={8}>
              <Statistic
                title="冻结资金"
                value={frozenFunds}
                precision={2}
                suffix={currency}
              />
            </Col>
            <Col xs={24} md={8}>
              <Statistic
                title="持仓市值"
                value={positionMarketValue}
                precision={2}
                suffix={currency}
              />
            </Col>
            <Col xs={24} md={8}>
              <Statistic
                title="浮动盈亏"
                value={floatingPnL}
                precision={2}
                suffix={currency}
                valueStyle={{ color: floatingPnL >= 0 ? '#3f8600' : '#cf1322' }}
              />
            </Col>
            <Col xs={24} md={8}>
              <Statistic
                title="已实现盈亏"
                value={realizedPnL}
                precision={2}
                suffix={currency}
                valueStyle={{ color: realizedPnL >= 0 ? '#3f8600' : '#cf1322' }}
              />
            </Col>
          </Row>
        </Card>

        <Card title="资金流水" style={{ marginBottom: 16 }}>
          <Button
            type="primary"
            style={{ padding: '4px 12px' }}
            onClick={() => setAddModalOpen(true)}
          >
            新增流水
          </Button>
          <Divider />
          <Table
            rowKey="id"
            size="small"
            columns={ledgerColumns}
            dataSource={ledger}
            scroll={{ y: 500 }}
            pagination={{ pageSize: 20 }}
          />
          <Divider />
          <div style={{ marginBottom: 8 }}>
            <Button type="primary" onClick={() => setAddPosModalOpen(true)}>
              新增仓位
            </Button>
          </div>
          <Table
            rowKey="id"
            size="small"
            columns={[
              { title: '名称', dataIndex: 'name', key: 'name' },
              {
                title: '方向',
                dataIndex: 'side',
                key: 'side',
                render: (v: 'long' | 'short') => (
                  <Tag color={v === 'long' ? 'green' : 'red'}>
                    {v === 'long' ? '做多' : '做空'}
                  </Tag>
                ),
              },
              { title: '数量', dataIndex: 'quantity', key: 'quantity' },
              {
                title: '市值',
                dataIndex: 'market_value',
                key: 'market_value',
                render: (v: number, r: PositionEntry) =>
                  `${v.toFixed(2)} ${r.currency}`,
              },
              {
                title: '开仓价',
                dataIndex: 'open_price',
                key: 'open_price',
                render: (v: number, r: PositionEntry) =>
                  `${v.toFixed(2)} ${r.currency}`,
              },
              {
                title: '盈亏',
                dataIndex: 'pnl',
                key: 'pnl',
                render: (v: number, r: PositionEntry) => (
                  <span style={{ color: v >= 0 ? '#3f8600' : '#cf1322' }}>
                    {v.toFixed(2)} {r.currency}
                  </span>
                ),
              },
              { title: '杠杆', dataIndex: 'leverage', key: 'leverage' },
              {
                title: '保证金',
                dataIndex: 'margin',
                key: 'margin',
                render: (v: number, r: PositionEntry) =>
                  `${v.toFixed(2)} ${r.currency}`,
              },
              { title: '币种', dataIndex: 'currency', key: 'currency' },
              {
                title: '操作',
                dataIndex: 'action',
                key: 'action',
                render: (_: any, record: PositionEntry) => (
                  <Popconfirm title="确认删除该仓位？" onConfirm={() => {
                    del(`/positions/${record.id}`).then(() => {
                      getPositions();
                    });
                  }}>
                    <Button type="link" danger>
                      删除
                    </Button>
                  </Popconfirm>
                ),
              },
            ]}
            dataSource={positions}
            pagination={{ pageSize: 10 }}
          />
        </Card>

        <Modal
          title="新增资金流水"
          open={addModalOpen}
          onCancel={() => {
            setAddModalOpen(false);
            addForm.resetFields();
          }}
          onOk={() => {
            addForm.validateFields().then((values) => {
              const payload = {
                type: values.type,
                amount: Number(values.amount),
                remark: values.remark,
                currency: values.currency || currency,
              } as Omit<LedgerEntry, 'id'>;
              addDealLog(payload as any);
              setAddModalOpen(false);
              addForm.resetFields();
            });
          }}
          destroyOnHidden
        >
          <Form form={addForm} layout="vertical" initialValues={{ currency }}>
            <Form.Item
              name="type"
              label="类型"
              rules={[{ required: true, message: '请选择类型' }]}
            >
              <Select
                options={[
                  { value: 'deposit', label: '入金' },
                  { value: 'withdraw', label: '出金' },
                  { value: 'delivery_pnl', label: '交割盈亏' },
                ]}
              />
            </Form.Item>
            <Form.Item
              name="amount"
              label="金额"
              rules={[{ required: true, message: '请输入金额' }]}
            >
              <InputNumber style={{ width: '100%' }} step={0.01} />
            </Form.Item>
            <Form.Item name="currency" label="币种">
              <Select
                options={[
                  { value: 'USDT', label: 'USDT' },
                  { value: 'CNY', label: 'CNY' },
                ]}
              />
            </Form.Item>
            <Form.Item name="remark" label="备注">
              <Input />
            </Form.Item>
          </Form>
        </Modal>

        <Modal
          title="新增仓位"
          open={addPosModalOpen}
          onCancel={() => {
            setAddPosModalOpen(false);
            addPosForm.resetFields();
          }}
          onOk={() => {
            addPosForm.validateFields().then((values) => {
              const payload = {
                name: values.name,
                side: values.side,
                quantity: Number(values.quantity),
                market_value: Number(values.market_value),
                open_price: Number(values.open_price),
                pnl: Number(values.pnl),
                leverage: Number(values.leverage),
                margin: Number(values.margin),
                currency: values.currency || 'USD',
              } as Omit<PositionEntry, 'id'>;
              addPosition(payload as any);
            });
          }}
          destroyOnHidden
        >
          <Form
            form={addPosForm}
            layout="vertical"
            initialValues={{ side: 'long', currency: 'USD' }}
          >
            <Form.Item
              name="name"
              label="名称"
              rules={[{ required: true, message: '请输入名称' }]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              name="side"
              label="方向"
              rules={[{ required: true, message: '请选择方向' }]}
            >
              <Select
                options={[
                  { value: 'long', label: '做多' },
                  { value: 'short', label: '做空' },
                ]}
              />
            </Form.Item>
            <Form.Item
              name="quantity"
              label="数量"
              rules={[{ required: true, message: '请输入数量' }]}
            >
              <InputNumber style={{ width: '100%' }} step={1} />
            </Form.Item>
            <Form.Item
              name="market_value"
              label="市值"
              rules={[{ required: true, message: '请输入市值' }]}
            >
              <InputNumber style={{ width: '100%' }} step={0.01} />
            </Form.Item>
            <Form.Item
              name="open_price"
              label="开仓价"
              rules={[{ required: true, message: '请输入开仓价' }]}
            >
              <InputNumber style={{ width: '100%' }} step={0.01} />
            </Form.Item>
            <Form.Item
              name="leverage"
              label="杠杆"
              rules={[{ required: true, message: '请输入杠杆' }]}
            >
              <InputNumber style={{ width: '100%' }} step={1} min={1} />
            </Form.Item>
            <Form.Item
              name="margin"
              label="保证金"
              rules={[{ required: true, message: '请输入保证金' }]}
            >
              <InputNumber style={{ width: '100%' }} step={0.01} />
            </Form.Item>
            <Form.Item name="currency" label="币种">
              <Input />
            </Form.Item>
          </Form>
        </Modal>

        
      </div>
    </PageContainer>
  );
};

export default HomePage;
