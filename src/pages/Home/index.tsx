import { del, get, post, put } from '@/utils/request';
import { PageContainer } from '@ant-design/pro-components';
import { SyncOutlined } from '@ant-design/icons';
import {
  Button,
  Card,
  Col,
  Divider,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
} from 'antd';
import React, { useEffect, useMemo, useState } from 'react';

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

// 根据币种获取货币符号
const getCurrencySymbol = (currency: string = 'USDT') => {
  switch (currency.toUpperCase()) {
    case 'CNY':
      return '￥';
    case 'USDT':
    default:
      return '$';
  }
};

// 合约持仓接口
interface ContractPosition {
  /** 开仓均价 */
  entryPrice: string;
  /** 标记价格（交易所用于计算盈亏/强平的参考价格） */
  markPrice: string;
  /** 未实现盈亏（浮动盈亏，正数盈利/负数亏损） */
  unRealizedProfit: string;
  /** 强平价格（爆仓价，价格触及该值会被强制平仓） */
  liquidationPrice: string;
  /** 保本价格（盈亏平衡价，覆盖手续费/滑点等成本） */
  breakEvenPrice: string;
  /** 杠杆倍数（如"10"表示10倍杠杆） */
  leverage: string;
  /** 持仓数量（合约数量，如"0.019"） */
  positionAmt: string;
  /** 持仓方向（LONG=做多，SHORT=做空） */
  positionSide: 'LONG' | 'SHORT';
  /** 数据更新时间戳（毫秒级） */
  updateTime: number;
  // 为了兼容现有功能，保留一些额外字段
  id?: string;
  symbol?: string; // 合约名称
  currency?: string; // 结算货币
}

const currency = 'CNY';

const HomePage: React.FC = () => {
  // 示例持仓数据：实际可由后端或策略模块驱动
  const [positions, setPositions] = useState<ContractPosition[]>([]);
  // 资金流水：记录类账本
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [addForm] = Form.useForm();
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editForm] = Form.useForm();
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<LedgerEntry | null>(null);
  const [addPosForm] = Form.useForm();
  const [addPosModalOpen, setAddPosModalOpen] = useState(false);
  const [syncingBinance, setSyncingBinance] = useState(false);

  useEffect(() => {
    getDealLog();
    getPositions();
  }, []);

  // 持仓市值（基于标记价格和持仓数量计算）
  const positionMarketValue = useMemo(() => {
    return positions.reduce((sum, p) => {
      const markPrice = parseFloat(p.markPrice || '0');
      const positionAmt = parseFloat(p.positionAmt || '0');
      return sum + (markPrice * Math.abs(positionAmt));
    }, 0);
  }, [positions]);

  // 浮动盈亏：汇总持仓表里的所有未实现盈亏，统一转换为CNY显示
  const floatingPnL = useMemo(() => {
    return positions.reduce((sum, p) => {
      const pnl = parseFloat(p.unRealizedProfit || '0');
      const positionCurrency = p.currency || 'USDT';
      
      // 如果已经是CNY，直接相加
      if (positionCurrency.toUpperCase() === 'CNY') {
        return sum + pnl;
      }
      
      // 如果是USD类货币，简单按汇率转换（这里可以后续接入实时汇率API）
      // 假设1 USD = 7.2 CNY（实际项目中应该从API获取实时汇率）
      const exchangeRate = 7.2;
      return sum + (pnl * exchangeRate);
    }, 0);
  }, [positions]);

  // 已实现盈亏：来源于账本中交割盈亏
  const realizedPnL = useMemo(() => {
    return ledger
      .filter((l) => l.type === 'delivery_pnl')
      .reduce((sum, l) => sum + l.amount, 0);
  }, [ledger]);


  // 新增账本记录：规范金额正负，并同步影响现金余额
  const addDealLog = (log: Omit<LedgerEntry, 'id' | 'timestamp'>) => {
    post('/dealLog', log).then((res) => {
      getDealLog();
    });
  };

  // 编辑账本记录
  const editDealLog = (entryId: string, log: Omit<LedgerEntry, 'id' | 'timestamp'>) => {
    put(`/dealLog/${entryId}`, log).then((res) => {
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
  };

  // 同步币安仓位
  const syncBinancePositions = async () => {
    setSyncingBinance(true);
    try {
      await post('/positions/from-binance', {});
      // 同步成功后重新获取仓位数据
      getPositions();
      message.success('币安仓位同步成功');
    } catch (error: any) {
      console.error('同步币安仓位失败:', error);
      const errorMessage = error?.data?.message || error?.message || '同步币安仓位失败，请检查网络连接或稍后重试';
      message.error(errorMessage);
    } finally {
      setSyncingBinance(false);
    }
  };

  const addPosition = (pos: Omit<ContractPosition, 'id' | 'updateTime'>) => {
    post('/positions', pos).then((res) => {
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
      width: 120,
      render: (amount: number, record: LedgerEntry) => {
        const currency = record.currency || 'USDT';
        const symbol = getCurrencySymbol(currency);
        
        return (
          <span style={{ color: amount >= 0 ? '#3f8600' : '#cf1322' }}>
            {symbol}{amount.toFixed(2)}
          </span>
        );
      }
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
        <Space>
          <Button 
            type="link" 
            onClick={() => {
              setEditingRecord(record);
              editForm.setFieldsValue({
                type: record.type,
                amount: record.amount,
                currency: record.currency || 'USDT',
                remark: record.remark || ''
              });
              setEditModalOpen(true);
            }}
          >
            编辑
          </Button>
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
        </Space>
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
      <div>
        <Card title="资产总览" style={{ marginBottom: 16 }}>
          <Row gutter={[16, 16]}>
            <Col xs={24} md={8}>
              <Statistic
                title="持仓市值"
                value={positionMarketValue}
                precision={2}
                prefix={getCurrencySymbol(currency)}
              />
            </Col>
            <Col xs={24} md={8}>
              <Statistic
                title="浮动盈亏"
                value={floatingPnL}
                precision={2}
                prefix={getCurrencySymbol(currency)}
                valueStyle={{ color: floatingPnL >= 0 ? '#3f8600' : '#cf1322' }}
              />
            </Col>
            <Col xs={24} md={8}>
              <Statistic
                title="已实现盈亏"
                value={realizedPnL}
                precision={2}
                prefix={getCurrencySymbol(currency)}
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
            <Space>
              <Button type="primary" onClick={() => setAddPosModalOpen(true)}>
                新增仓位
              </Button>
              <Button 
                icon={<SyncOutlined />} 
                loading={syncingBinance}
                onClick={syncBinancePositions}
              >
                同步币安
              </Button>
            </Space>
          </div>
          <Table
            rowKey={(record, index) => record.id || `position_${index}`}
            size="small"
            columns={[
              { 
                title: '合约名称', 
                dataIndex: 'symbol', 
                key: 'symbol',
                width: 120,
                fixed: 'left',
                render: (symbol: string) => symbol || '--'
              },
              {
                title: '持仓方向',
                dataIndex: 'positionSide',
                key: 'positionSide',
                width: 90,
                render: (side: 'LONG' | 'SHORT') => (
                  <Tag color={side === 'LONG' ? 'green' : 'red'}>
                    {side === 'LONG' ? '做多' : '做空'}
                  </Tag>
                ),
              },
              { 
                title: '持仓数量', 
                dataIndex: 'positionAmt', 
                key: 'positionAmt',
                width: 120,
                render: (amt: string) => parseFloat(amt || '0').toFixed(6)
              },
              {
                title: '开仓均价',
                dataIndex: 'entryPrice',
                key: 'entryPrice',
                width: 100,
                render: (price: string) => parseFloat(price || '0').toFixed(2)
              },
              {
                title: '标记价格',
                dataIndex: 'markPrice',
                key: 'markPrice',
                width: 100,
                render: (price: string) => parseFloat(price || '0').toFixed(2)
              },
              {
                title: '未实现盈亏',
                dataIndex: 'unRealizedProfit',
                key: 'unRealizedProfit',
                width: 140,
                render: (pnl: string, record: ContractPosition) => {
                  const pnlNum = parseFloat(pnl || '0');
                  const currency = record.currency || 'USDT';
                  const symbol = getCurrencySymbol(currency);
                  
                  return (
                    <span style={{ color: pnlNum >= 0 ? '#3f8600' : '#cf1322' }}>
                      {symbol}{pnlNum.toFixed(2)}
                    </span>
                  );
                }
              },
              { 
                title: '杠杆倍数', 
                dataIndex: 'leverage', 
                key: 'leverage',
                width: 80,
                render: (leverage: string) => `${leverage}x`
              },
              {
                title: '强平价格',
                dataIndex: 'liquidationPrice',
                key: 'liquidationPrice',
                width: 100,
                render: (price: string) => parseFloat(price || '0').toFixed(2)
              },
              {
                title: '保本价格',
                dataIndex: 'breakEvenPrice',
                key: 'breakEvenPrice',
                width: 100,
                render: (price: string) => parseFloat(price || '0').toFixed(2)
              },
              {
                title: '更新时间',
                dataIndex: 'updateTime',
                key: 'updateTime',
                width: 160,
                render: (timestamp: number) => new Date(timestamp).toLocaleString()
              },
              {
                title: '操作',
                dataIndex: 'action',
                key: 'action',
                width: 80,
                fixed: 'right',
                render: (_: any, record: ContractPosition) => (
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
            scroll={{ x: 1500, y: 400 }}
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
          title="编辑资金流水"
          open={editModalOpen}
          onCancel={() => {
            setEditModalOpen(false);
            setEditingRecord(null);
            editForm.resetFields();
          }}
          onOk={() => {
            editForm.validateFields().then((values) => {
              if (!editingRecord?.id) return;
              
              const payload = {
                type: values.type,
                amount: Number(values.amount),
                remark: values.remark,
                currency: values.currency || currency,
              } as Omit<LedgerEntry, 'id' | 'timestamp'>;
              
              editDealLog(editingRecord.id, payload);
              setEditModalOpen(false);
              setEditingRecord(null);
              editForm.resetFields();
            });
          }}
          destroyOnHidden
        >
          <Form form={editForm} layout="vertical">
            <Form.Item
              name="type"
              label="类型"
              rules={[{ required: true, message: '请选择类型' }]}
            >
              <Select
                options={[
                  { value: 'deposit', label: '入金' },
                  { value: 'withdraw', label: '出金' },
                  { value: 'fee', label: '手续费' },
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
                symbol: values.symbol,
                entryPrice: values.entryPrice.toString(),
                markPrice: values.markPrice.toString(),
                liquidationPrice: values.liquidationPrice.toString(),
                breakEvenPrice: values.breakEvenPrice.toString(),
                leverage: values.leverage.toString(),
                positionAmt: values.positionAmt.toString(),
                positionSide: values.positionSide,
                currency: values.currency || 'USDT',
                updateTime: Date.now(),
              } as unknown as Omit<ContractPosition, 'id' | 'updateTime'>;
              addPosition(payload);
            });
          }}
          destroyOnHidden
        >
          <Form
            form={addPosForm}
            layout="vertical"
            initialValues={{ positionSide: 'LONG', currency: 'USDT' }}
          >
            <Form.Item
              name="symbol"
              label="合约名称"
              rules={[{ required: true, message: '请输入合约名称' }]}
            >
              <Input placeholder="如：BTCUSDT" />
            </Form.Item>
            <Form.Item
              name="positionSide"
              label="持仓方向"
              rules={[{ required: true, message: '请选择持仓方向' }]}
            >
              <Select
                options={[
                  { value: 'LONG', label: '做多 (LONG)' },
                  { value: 'SHORT', label: '做空 (SHORT)' },
                ]}
              />
            </Form.Item>
            <Form.Item
              name="positionAmt"
              label="持仓数量"
              rules={[{ required: true, message: '请输入持仓数量' }]}
            >
              <InputNumber 
                style={{ width: '100%' }} 
                step={0.001} 
                precision={6}
                placeholder="如：0.019"
              />
            </Form.Item>
            <Form.Item
              name="entryPrice"
              label="开仓均价"
              rules={[{ required: true, message: '请输入开仓均价' }]}
            >
              <InputNumber 
                style={{ width: '100%' }} 
                step={0.0001} 
                precision={4}
                placeholder="开仓时的平均价格"
              />
            </Form.Item>
            <Form.Item
              name="markPrice"
              label="标记价格"
              rules={[{ required: true, message: '请输入标记价格' }]}
            >
              <InputNumber 
                style={{ width: '100%' }} 
                step={0.0001} 
                precision={4}
                placeholder="交易所参考价格"
              />
            </Form.Item>
            <Form.Item
              name="leverage"
              label="杠杆倍数"
              rules={[{ required: true, message: '请输入杠杆倍数' }]}
            >
              <InputNumber 
                style={{ width: '100%' }} 
                step={1} 
                min={1} 
                max={125}
                placeholder="如：10"
              />
            </Form.Item>
            <Form.Item
              name="liquidationPrice"
              label="强平价格"
              rules={[{ required: true, message: '请输入强平价格' }]}
            >
              <InputNumber 
                style={{ width: '100%' }} 
                step={0.01} 
                precision={2}
                placeholder="爆仓价格"
              />
            </Form.Item>
            <Form.Item
              name="breakEvenPrice"
              label="保本价格"
              rules={[{ required: true, message: '请输入保本价格' }]}
            >
              <InputNumber 
                style={{ width: '100%' }} 
                step={0.01} 
                precision={2}
                placeholder="盈亏平衡价"
              />
            </Form.Item>
            <Form.Item name="currency" label="结算货币">
              <Select
                options={[
                  { value: 'USDT', label: 'USDT' },
                  { value: 'CNY', label: 'CNY' },
                ]}
              />
            </Form.Item>
          </Form>
        </Modal>

        
      </div>
    </PageContainer>
  );
};

export default HomePage;
