import { Button, Card, Col, Form, InputNumber, Row, Select, Space } from 'antd';
import { useState } from 'react';
import ConsolePanel from '@/components/ConsolePanel';
import { longStrategy } from '../utils/simpleLongStrategy';
const LOCAL_STORAGE_KEY = 'strategyFormHistory';

const Page = () => {
  useState(() => {});
  const [form] = Form.useForm();
  const handleSubmit = () => {
    form
      .validateFields()
      .then((values) => {
        /**
         * 做多交易策略计算函数
         * @param {number} currentPrice - 当前价格
         * @param {number} stopLossPrice - 止损价格
         * @param {number} totalInvestment - 总投资金额
         * @param {number} rewardToRiskRatio - 盈亏比
         * @param {number} entryCount - 进仓次数 (3或4)
         * @param {string} strategyType - 策略类型 ('equal'等资金, 'weighted'不等资金)
         * @param {string} takeProfitStrategy - 止盈策略 ('conservative', 'aggressive', 'technical')
         * @returns {Object} 交易策略详情
         */
        const param = values;
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(values));
        longStrategy(param);
      })
      .catch((err) => {
        console.error('表单校验失败:', err);
      });
  };

  const handleReset = () => {
    form.resetFields();
  };

  const getInitialValues = () => {
    try {
      const history: any = JSON.parse(
        localStorage.getItem(LOCAL_STORAGE_KEY) || '{}',
      );
      const values = {
        entryCount: 3,
        rewardToRiskRatio: 2,
        strategyType: 'equal',
        takeProfitStrategy: 'conservative',
        ...history,
      };
      return values;
    } catch (err) {
      console.log(err);
    }
  };

  return (
    <div>
      <Card>
        <Form
          form={form}
          labelCol={{ span: 6 }}
          wrapperCol={{ span: 18 }}
          initialValues={getInitialValues()}
        >
          <Row>
            <Col xs={{span:24}} xl={{span:6}}>
              {/* 当前价格 */}
              <Form.Item
                name="currentPrice"
                label="当前价格"
                rules={[
                  { required: true, message: '请输入当前价格' },
                  { type: 'number', message: '请输入有效数字' },
                ]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  step={0.01}
                  precision={2}
                  placeholder="例如: 100.50"
                />
              </Form.Item>
            </Col>
            <Col xs={{span:24}} sm={{span:6}}>
              {/* 止损价格 */}
              <Form.Item
                name="stopLossPrice"
                label="止损价格"
                rules={[
                  { required: true, message: '请输入止损价格' },
                  { type: 'number', message: '请输入有效数字' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      const currentPrice = getFieldValue('currentPrice');
                      if (!value || !currentPrice || value < currentPrice) {
                        return Promise.resolve();
                      }
                      return Promise.reject(
                        new Error('止损价格必须小于当前价格'),
                      );
                    },
                  }),
                ]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  step={0.01}
                  precision={2}
                  placeholder="例如: 95.00"
                />
              </Form.Item>
            </Col>
            <Col xs={{span:24}} sm={{span:6}}>
              {/* 总投资金额 */}
              <Form.Item
                name="totalInvestment"
                label="总投资金额"
                rules={[
                  { required: true, message: '请输入总投资金额' },
                  { type: 'number', message: '请输入有效数字' },
                ]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  step={100}
                  precision={0}
                  placeholder="例如: 10000"
                />
              </Form.Item>
            </Col>
            <Col xs={{span:24}} sm={{span:6}}>
              {/* 盈亏比 */}
              <Form.Item
                name="rewardToRiskRatio"
                label="盈亏比"
                rules={[
                  { required: true, message: '请输入盈亏比' },
                  { type: 'number', message: '请输入有效数字' },
                ]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  step={0.1}
                  min={1}
                  precision={1}
                  placeholder="例如: 2.0"
                />
              </Form.Item>
            </Col>
            <Col xs={{span:24}} sm={{span:6}}>
              {/* 进仓次数 */}
              <Form.Item
                name="entryCount"
                label="进仓次数"
                rules={[{ required: true, message: '请选择进仓次数' }]}
              >
                <Select style={{ width: '100%' }}>
                  <Select.Option value={3}>3次</Select.Option>
                  <Select.Option value={4}>4次</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={{span:24}} sm={{span:6}}>
              {/* 策略类型 */}
              <Form.Item
                name="strategyType"
                label="策略类型"
                rules={[{ required: true, message: '请选择策略类型' }]}
              >
                <Select style={{ width: '100%' }}>
                  <Select.Option value="equal">等资金</Select.Option>
                  <Select.Option value="weighted">
                    不等资金（权重为 1, 2, 3, 4）
                  </Select.Option>
                  <Select.Option value="pyramid">
                    不等资金（权重为 1, 2, 4, 8）
                  </Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={{span:24}} sm={{span:6}}>
              {/* 止盈策略 */}
              <Form.Item
                name="takeProfitStrategy"
                label="止盈策略"
                rules={[{ required: true, message: '请选择止盈策略' }]}
              >
                <Select style={{ width: '100%' }}>
                  <Select.Option value="conservative">保守型</Select.Option>
                  <Select.Option value="aggressive">激进型</Select.Option>
                  <Select.Option value="technical">技术型</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={{span:24}} sm={{span:6}}>
              {/* 操作按钮 */}
              <Form.Item wrapperCol={{ offset: 6, span: 18 }}>
                <Space>
                  <Button type="primary" onClick={handleSubmit}>
                    提交
                  </Button>
                  <Button onClick={handleReset}>重置</Button>
                </Space>
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>
      <Card>
        <ConsolePanel />
      </Card>
    </div>
  );
};
export default Page;
