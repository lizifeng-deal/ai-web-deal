/**
 * 做多策略函数集合
 * 包含多种技术指标和风险管理策略
 */
class LongStrategy {
    /**
     * 初始化策略
     * @param {Object} config - 策略配置
     */
    constructor(config = {}) {
        this.config = {
            initialCapital: config.initialCapital || 10000,     // 初始资金
            positionRatio: config.positionRatio || 0.1,         // 每次开仓比例
            stopLossRatio: config.stopLossRatio || 0.05,        // 止损比例
            takeProfitRatio: config.takeProfitRatio || 0.15,    // 止盈比例
            useTrailingStop: config.useTrailingStop || false,   // 是否使用移动止盈
            trailingStopRatio: config.trailingStopRatio || 0.03 // 移动止盈回撤比例
        };

        this.capital = this.config.initialCapital;
        this.position = 0;      // 持仓数量
        this.avgPrice = 0;      // 平均持仓价格
        this.trades = [];       // 交易记录
        this.positionHistory = []; // 持仓历史
    }

    /**
     * 简单移动平均线策略
     * @param {Array} prices - 价格数组
     * @param {Number} shortPeriod - 短期均线周期
     * @param {Number} longPeriod - 长期均线周期
     * @returns {Array} 交易信号数组
     */
    maCrossStrategy(prices, shortPeriod = 5, longPeriod = 20) {
        const signals = [];
        const smaShort = this.calculateSMA(prices, shortPeriod);
        const smaLong = this.calculateSMA(prices, longPeriod);

        for (let i = longPeriod; i < prices.length; i++) {
            if (smaShort[i - 1] <= smaLong[i - 1] && smaShort[i] > smaLong[i]) {
                // 金叉买入信号
                signals.push({
                    index: i,
                    type: 'BUY',
                    price: prices[i],
                    reason: `MA金叉 (${shortPeriod}/${longPeriod})`
                });
            } else if (smaShort[i - 1] >= smaLong[i - 1] && smaShort[i] < smaLong[i]) {
                // 死叉卖出信号
                signals.push({
                    index: i,
                    type: 'SELL',
                    price: prices[i],
                    reason: `MA死叉 (${shortPeriod}/${longPeriod})`
                });
            }
        }

        return signals;
    }

    /**
     * RSI超卖策略
     * @param {Array} prices - 价格数组
     * @param {Number} period - RSI周期
     * @param {Number} oversold - 超卖阈值
     * @returns {Array} 交易信号数组
     */
    rsiStrategy(prices, period = 14, oversold = 30) {
        const signals = [];
        const rsi = this.calculateRSI(prices, period);

        let isOversold = false;

        for (let i = period + 1; i < prices.length; i++) {
            if (rsi[i] < oversold && !isOversold) {
                // RSI进入超卖区，买入信号
                signals.push({
                    index: i,
                    type: 'BUY',
                    price: prices[i],
                    reason: `RSI超卖: ${rsi[i].toFixed(2)}`
                });
                isOversold = true;
            } else if (rsi[i] > 50 && isOversold) {
                // RSI回到50以上，卖出信号
                signals.push({
                    index: i,
                    type: 'SELL',
                    price: prices[i],
                    reason: `RSI回归: ${rsi[i].toFixed(2)}`
                });
                isOversold = false;
            }
        }

        return signals;
    }

    /**
     * 布林带策略
     * @param {Array} prices - 价格数组
     * @param {Number} period - 布林带周期
     * @param {Number} stdDev - 标准差倍数
     * @returns {Array} 交易信号数组
     */
    bollingerBandsStrategy(prices, period = 20, stdDev = 2) {
        const signals = [];
        const { upper, middle, lower } = this.calculateBollingerBands(prices, period, stdDev);

        for (let i = period; i < prices.length; i++) {
            // 价格触及下轨，买入信号
            if (prices[i] <= lower[i] && prices[i - 1] > lower[i - 1]) {
                signals.push({
                    index: i,
                    type: 'BUY',
                    price: prices[i],
                    reason: '触及布林带下轨'
                });
            }
            // 价格触及中轨或上轨，卖出信号
            else if ((prices[i] >= middle[i] && this.position > 0) ||
                     (prices[i] >= upper[i] && prices[i - 1] < upper[i - 1])) {
                signals.push({
                    index: i,
                    type: 'SELL',
                    price: prices[i],
                    reason: '触及布林带中轨/上轨'
                });
            }
        }

        return signals;
    }

    /**
     * 综合多因子策略
     * @param {Array} prices - 价格数组
     * @returns {Array} 交易信号数组
     */
    multiFactorStrategy(prices) {
        const signals = [];

        // 计算多个指标
        const sma20 = this.calculateSMA(prices, 20);
        const sma50 = this.calculateSMA(prices, 50);
        const rsi = this.calculateRSI(prices, 14);
        const { lower } = this.calculateBollingerBands(prices, 20, 2);

        for (let i = 50; i < prices.length; i++) {
            const conditions = {
                maCross: sma20[i] > sma50[i] && sma20[i - 1] <= sma50[i - 1],
                rsiOversold: rsi[i] < 35,
                bollingerOversold: prices[i] <= lower[i],
                trendUp: prices[i] > sma20[i] && sma20[i] > sma50[i]
            };

            // 买入条件：至少满足两个条件
            const buyConditions = [
                conditions.maCross,
                conditions.rsiOversold,
                conditions.bollingerOversold
            ].filter(Boolean).length >= 2;

            // 卖出条件：趋势逆转或达到止盈止损
            const sellConditions = prices[i] < sma20[i] ||
                                 (this.position > 0 && this.checkStopLoss(prices[i]));

            if (buyConditions && this.position === 0) {
                signals.push({
                    index: i,
                    type: 'BUY',
                    price: prices[i],
                    reason: '多因子共振买入'
                });
            } else if (sellConditions && this.position > 0) {
                signals.push({
                    index: i,
                    type: 'SELL',
                    price: prices[i],
                    reason: '趋势逆转或止盈止损'
                });
            }
        }

        return signals;
    }

    /**
     * 执行买入操作
     * @param {Number} price - 买入价格
     * @param {String} reason - 买入原因
     */
    buy(price, reason = '') {
        const maxPositionValue = this.capital * this.config.positionRatio;
        const quantity = Math.floor(maxPositionValue / price);

        if (quantity <= 0) return false;

        const cost = quantity * price;
        this.capital -= cost;
        this.position += quantity;
        this.avgPrice = price;

        const trade = {
            type: 'BUY',
            price: price,
            quantity: quantity,
            cost: cost,
            capital: this.capital,
            position: this.position,
            time: new Date().toISOString(),
            reason: reason
        };

        this.trades.push(trade);
        this.positionHistory.push({ ...trade });

        return trade;
    }

    /**
     * 执行卖出操作
     * @param {Number} price - 卖出价格
     * @param {String} reason - 卖出原因
     */
    sell(price, reason = '') {
        if (this.position <= 0) return false;

        const revenue = this.position * price;
        const profit = revenue - (this.position * this.avgPrice);
        const profitRate = profit / (this.position * this.avgPrice);

        this.capital += revenue;

        const trade = {
            type: 'SELL',
            price: price,
            quantity: this.position,
            revenue: revenue,
            profit: profit,
            profitRate: profitRate,
            capital: this.capital,
            time: new Date().toISOString(),
            reason: reason
        };

        this.trades.push(trade);
        this.position = 0;
        this.avgPrice = 0;

        return trade;
    }

    /**
     * 检查止损止盈
     * @param {Number} currentPrice - 当前价格
     * @returns {Boolean} 是否触发止盈止损
     */
    checkStopLoss(currentPrice) {
        if (this.position === 0) return false;

        const profitRate = (currentPrice - this.avgPrice) / this.avgPrice;

        // 止损检查
        if (profitRate <= -this.config.stopLossRatio) {
            return true;
        }

        // 固定止盈检查
        if (profitRate >= this.config.takeProfitRatio && !this.config.useTrailingStop) {
            return true;
        }

        // 移动止盈检查
        if (this.config.useTrailingStop) {
            const highestPrice = Math.max(...this.positionHistory.map(p => p.price));
            const drawdown = (highestPrice - currentPrice) / highestPrice;

            if (drawdown >= this.config.trailingStopRatio && currentPrice > this.avgPrice) {
                return true;
            }
        }

        return false;
    }

    /**
     * 计算简单移动平均线
     */
    calculateSMA(prices, period) {
        const sma = new Array(prices.length).fill(0);

        for (let i = period - 1; i < prices.length; i++) {
            const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
            sma[i] = sum / period;
        }

        return sma;
    }

    /**
     * 计算RSI指标
     */
    calculateRSI(prices, period = 14) {
        const rsi = new Array(prices.length).fill(50);
        const gains = [];
        const losses = [];

        // 计算价格变化
        for (let i = 1; i < prices.length; i++) {
            const change = prices[i] - prices[i - 1];
            gains.push(change > 0 ? change : 0);
            losses.push(change < 0 ? -change : 0);
        }

        // 计算RSI
        for (let i = period; i < prices.length; i++) {
            const avgGain = gains.slice(i - period, i).reduce((a, b) => a + b, 0) / period;
            const avgLoss = losses.slice(i - period, i).reduce((a, b) => a + b, 0) / period;

            if (avgLoss === 0) {
                rsi[i] = 100;
            } else {
                const rs = avgGain / avgLoss;
                rsi[i] = 100 - (100 / (1 + rs));
            }
        }

        return rsi;
    }

    /**
     * 计算布林带
     */
    calculateBollingerBands(prices, period = 20, stdDev = 2) {
        const upper = new Array(prices.length).fill(0);
        const middle = new Array(prices.length).fill(0);
        const lower = new Array(prices.length).fill(0);

        for (let i = period - 1; i < prices.length; i++) {
            const slice = prices.slice(i - period + 1, i + 1);
            const mean = slice.reduce((a, b) => a + b, 0) / period;
            const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period;
            const std = Math.sqrt(variance);

            middle[i] = mean;
            upper[i] = mean + stdDev * std;
            lower[i] = mean - stdDev * std;
        }

        return { upper, middle, lower };
    }

    /**
     * 回测策略
     * @param {Array} prices - 历史价格数据
     * @param {String} strategyType - 策略类型
     */
    backtest(prices, strategyType = 'ma') {
        let signals = [];

        switch (strategyType) {
            case 'rsi':
                signals = this.rsiStrategy(prices);
                break;
            case 'bollinger':
                signals = this.bollingerBandsStrategy(prices);
                break;
            case 'multi':
                signals = this.multiFactorStrategy(prices);
                break;
            default:
                signals = this.maCrossStrategy(prices);
        }

        // 执行回测
        let inPosition = false;

        signals.forEach(signal => {
            if (signal.type === 'BUY' && !inPosition) {
                this.buy(signal.price, signal.reason);
                inPosition = true;
            } else if (signal.type === 'SELL' && inPosition) {
                this.sell(signal.price, signal.reason);
                inPosition = false;
            }
        });

        // 如果最后还有持仓，强制平仓
        if (inPosition) {
            this.sell(prices[prices.length - 1], '回测结束强制平仓');
        }

        return this.generateReport();
    }

    /**
     * 生成回测报告
     */
    generateReport() {
        const totalTrades = this.trades.length;
        const buyTrades = this.trades.filter(t => t.type === 'BUY');
        const sellTrades = this.trades.filter(t => t.type === 'SELL');

        let totalProfit = 0;
        let winningTrades = 0;
        let losingTrades = 0;

        sellTrades.forEach(trade => {
            totalProfit += trade.profit;
            if (trade.profit > 0) winningTrades++;
            else losingTrades++;
        });

        const winRate = winningTrades / (winningTrades + losingTrades) * 100;
        const finalCapital = this.capital;
        const totalReturn = ((finalCapital - this.config.initialCapital) / this.config.initialCapital) * 100;

        return {
            initialCapital: this.config.initialCapital,
            finalCapital: finalCapital,
            totalReturn: totalReturn.toFixed(2) + '%',
            totalTrades: totalTrades,
            winningTrades: winningTrades,
            losingTrades: losingTrades,
            winRate: winRate.toFixed(2) + '%',
            totalProfit: totalProfit.toFixed(2),
            trades: this.trades,
            maxDrawdown: this.calculateMaxDrawdown(),
            sharpeRatio: this.calculateSharpeRatio()
        };
    }

    /**
     * 计算最大回撤
     */
    calculateMaxDrawdown() {
        let maxCapital = this.config.initialCapital;
        let maxDrawdown = 0;
        let currentCapital = this.config.initialCapital;

        // 这里简化处理，实际需要根据持仓市值计算
        return maxDrawdown.toFixed(2) + '%';
    }

    /**
     * 计算夏普比率（简化版）
     */
    calculateSharpeRatio() {
        // 简化计算，实际需要无风险利率和收益率标准差
        return 'N/A';
    }
}

// 使用示例
const strategy = new LongStrategy({
    initialCapital: 10000,
    positionRatio: 0.2,
    stopLossRatio: 0.05,
    takeProfitRatio: 0.1
});

// 模拟价格数据
const mockPrices = Array.from({ length: 100 }, (_, i) =>
    100 + Math.sin(i * 0.1) * 10 + Math.random() * 5
);

// 运行回测
const report = strategy.backtest(mockPrices, 'ma');
console.log('回测结果:', report);

// 实时交易信号示例
const signals = strategy.maCrossStrategy(mockPrices, 5, 20);
console.log('交易信号:', signals.slice(0, 5));

// 导出策略函数供其他模块使用
module.exports = { LongStrategy };
