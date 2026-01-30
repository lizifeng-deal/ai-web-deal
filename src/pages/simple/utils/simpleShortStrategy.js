/**
 * 做空交易策略计算函数
 * @param {number} currentPrice - 当前价格
 * @param {number} stopLossPrice - 止损价格（做空时止损价高于当前价）
 * @param {number} totalInvestment - 总投资金额
 * @param {number} rewardToRiskRatio - 盈亏比
 * @param {number} entryCount - 进仓次数 (3或4)
 * @param {string} strategyType - 策略类型 ('equal'等资金, 'weighted'不等资金, 'pyramid'金字塔式)
 * @param {string} takeProfitStrategy - 止盈策略 ('conservative', 'aggressive', 'technical', 'partial')
 * @param {number} bufferRatio - 价格缓冲区比例 (0.01 = 1%，确保最后进仓与止损有足够距离)
 * @returns {Object} 交易策略详情
 */
function calculateShortStrategy(
  currentPrice,
  stopLossPrice,
  totalInvestment,
  rewardToRiskRatio,
  entryCount,
  strategyType = 'equal',
  takeProfitStrategy = 'conservative',
  bufferRatio = 0.01, // 1%的缓冲区
) {
  // 验证输入参数（做空时当前价格必须低于止损价格）
  if (currentPrice >= stopLossPrice) {
    throw new Error('做空时当前价格必须低于止损价格');
  }

  if (stopLossPrice <= 0) {
    throw new Error('止损价格必须大于0');
  }

  if (currentPrice <= 0) {
    throw new Error('当前价格必须大于0');
  }

  if (totalInvestment <= 0) {
    throw new Error('总投资金额必须大于0');
  }

  if (rewardToRiskRatio <= 0) {
    throw new Error('盈亏比必须大于0');
  }

  if (entryCount < 3 || entryCount > 4) {
    throw new Error('进仓次数必须是3或4');
  }

  if (!['equal', 'weighted', 'pyramid'].includes(strategyType)) {
    throw new Error("策略类型必须是 'equal', 'weighted' 或 'pyramid'");
  }

  if (!['conservative', 'aggressive', 'technical', 'partial'].includes(takeProfitStrategy)) {
    throw new Error("止盈策略必须是 'conservative', 'aggressive', 'technical' 或 'partial'");
  }

  // 计算总价格范围（加上缓冲区，确保最后进仓低于止损价）
  const stopLossBuffer = stopLossPrice * (1 - bufferRatio); // 做空时，最后进仓价格低于止损价格
  const priceRange = stopLossBuffer - currentPrice; // 价格从低到高

  if (priceRange <= 0) {
    throw new Error('价格范围过小，请调整止损价格或缓冲区');
  }

  // 计算建仓价格点（从当前价格向上到接近止损价格）
  const priceStep = priceRange / (entryCount - 1);
  let entryPrices = [];

  for (let i = 0; i < entryCount; i++) {
    // 价格从低到高分布，最后一个进仓价格 = stopLossBuffer
    const entryPrice = currentPrice + i * priceStep;
    // 确保价格不会高于止损缓冲区
    entryPrices.push(Math.min(entryPrice, stopLossBuffer));
  }

  // 计算资金分配
  let allocations = [];
  let weights = [];

  switch (strategyType) {
    case 'equal':
      // 等资金分配
      const equalAmount = totalInvestment / entryCount;
      allocations = Array(entryCount).fill(equalAmount);
      weights = Array(entryCount).fill(1);
      break;

    case 'weighted':
      // 不等资金分配 - 做空时偏向高位加仓（因为高位价格更高，可以借入更多标的）
      // 权重：例如4次进仓，权重为 [1, 2, 3, 4]（高位权重更大）
      weights = Array.from({ length: entryCount }, (_, i) => i + 1);
      const totalWeight = weights.reduce((a, b) => a + b, 0);
      allocations = weights.map((weight) => (weight / totalWeight) * totalInvestment);
      break;

    case 'pyramid':
      // 金字塔式分配 - 做空时高价位仓位大
      // 权重：例如4次进仓，权重为 [1, 2, 4, 8] 或 [1, 2, 3, 6]
      if (entryCount === 3) {
        weights = [1, 2, 4];
      } else {
        weights = [1, 2, 4, 8];
      }
      const pyramidTotalWeight = weights.reduce((a, b) => a + b, 0);
      allocations = weights.map((weight) => (weight / pyramidTotalWeight) * totalInvestment);
      break;
  }

  // 计算每个仓位的数量（做空时借入标的卖出）
  const quantities = entryPrices.map((price, index) => allocations[index] / price);

  // 计算加权平均建仓价格
  let totalWeightedPrice = 0;
  let totalAllocated = 0;

  for (let i = 0; i < entryCount; i++) {
    totalWeightedPrice += entryPrices[i] * allocations[i];
    totalAllocated += allocations[i];
  }

  const averageEntryPrice = totalAllocated > 0 ? totalWeightedPrice / totalAllocated : 0;

  // 计算盈利目标价格（做空时目标价低于平均建仓价格）
  const stopLossDistance = stopLossPrice - averageEntryPrice; // 做空时止损在更高位置
  const takeProfitDistance = stopLossDistance * rewardToRiskRatio;
  const takeProfitPrice = averageEntryPrice - takeProfitDistance; // 做空时目标价向下

  // 计算整体止损和盈利金额
  const totalQuantity = quantities.reduce((a, b) => a + b, 0);

  // 做空时：止损金额 = (止损价 - 平均入场价) * 数量
  const stopLossAmount = (stopLossPrice - averageEntryPrice) * totalQuantity;

  // 做空时：盈利金额 = (平均入场价 - 目标价) * 数量
  const takeProfitAmount = (averageEntryPrice - takeProfitPrice) * totalQuantity;

  // 计算实际盈亏比
  const actualRewardRiskRatio = stopLossAmount > 0 ? takeProfitAmount / stopLossAmount : 0;

  // 生成仓位详情
  const entryDetails = entryPrices.map((price, index) => {
    const positionStopLossAmount = (stopLossPrice - price) * quantities[index];
    const positionTakeProfitDistance = (stopLossPrice - price) * rewardToRiskRatio;
    const positionTakeProfitPrice = price - positionTakeProfitDistance;
    const positionTakeProfitAmount = (price - positionTakeProfitPrice) * quantities[index];

    return {
      entryNumber: index + 1,
      entryPrice: roundToDecimal(price, 4),
      allocation: roundToDecimal(allocations[index], 2),
      quantity: roundToDecimal(quantities[index], 4),
      weight: roundToDecimal(weights[index], 2),
      weightPercentage: roundToDecimal(
        (weights[index] / weights.reduce((a, b) => a + b, 0)) * 100,
        1,
      ),
      positionStopLoss: roundToDecimal(stopLossPrice, 4),
      positionTakeProfit: roundToDecimal(positionTakeProfitPrice, 4),
      positionPotentialLoss: roundToDecimal(positionStopLossAmount, 2),
      positionPotentialProfit: roundToDecimal(positionTakeProfitAmount, 2),
      positionRiskRewardRatio: roundToDecimal(
        positionTakeProfitAmount / Math.max(positionStopLossAmount, 0.01),
        2,
      ),
      distanceFromStopLoss: roundToDecimal(((stopLossPrice - price) / stopLossPrice) * 100, 2),
    };
  });

  // 生成止盈方案（做空版）
  const takeProfitPlans = generateShortTakeProfitPlans(
    takeProfitStrategy,
    entryPrices,
    averageEntryPrice,
    takeProfitPrice,
    totalAllocated,
    stopLossPrice,
    rewardToRiskRatio,
    quantities,
  );

  // 风险指标计算
  const maxPositionLoss = Math.max(...entryDetails.map((d) => d.positionPotentialLoss));
  const totalPositionProfit = entryDetails.reduce((sum, d) => sum + d.positionPotentialProfit, 0);
  const totalPositionLoss = entryDetails.reduce((sum, d) => sum + d.positionPotentialLoss, 0);

  return {
    strategy: {
      type: strategyType,
      entryCount: entryCount,
      takeProfitStrategy: takeProfitStrategy,
      direction: 'SHORT',
      bufferRatio: bufferRatio,
    },
    entryPlan: {
      prices: entryPrices.map((p) => roundToDecimal(p, 4)),
      allocations: allocations.map((a) => roundToDecimal(a, 2)),
      quantities: quantities.map((q) => roundToDecimal(q, 4)),
      weights: weights,
      totalAllocated: roundToDecimal(totalAllocated, 2),
      entryDetails: entryDetails,
    },
    calculations: {
      averageEntryPrice: roundToDecimal(averageEntryPrice, 4),
      stopLossPrice: roundToDecimal(stopLossPrice, 4),
      lastEntryPrice: roundToDecimal(entryPrices[entryCount - 1], 4),
      lastEntryBuffer: roundToDecimal(
        ((stopLossPrice - entryPrices[entryCount - 1]) / stopLossPrice) * 100,
        2,
      ),
      takeProfitPrice: roundToDecimal(takeProfitPrice, 4),
      stopLossAmount: roundToDecimal(stopLossAmount, 2),
      takeProfitAmount: roundToDecimal(takeProfitAmount, 2),
      actualRewardRiskRatio: roundToDecimal(actualRewardRiskRatio, 2),
      totalQuantity: roundToDecimal(totalQuantity, 4),
      stopLossPercent: roundToDecimal(
        ((stopLossPrice - averageEntryPrice) / stopLossPrice) * 100,
        2,
      ),
      takeProfitPercent: roundToDecimal(
        ((averageEntryPrice - takeProfitPrice) / averageEntryPrice) * 100,
        2,
      ),
    },
    riskMetrics: {
      maxSinglePositionLoss: roundToDecimal(maxPositionLoss, 2),
      totalPositionLoss: roundToDecimal(totalPositionLoss, 2),
      totalPositionProfit: roundToDecimal(totalPositionProfit, 2),
      overallRiskRewardRatio: roundToDecimal(
        totalPositionProfit / Math.max(totalPositionLoss, 0.01),
        2,
      ),
      requiredWinRate: roundToDecimal((1 / (1 + actualRewardRiskRatio)) * 100, 1),
      riskPerTradePercent: roundToDecimal((stopLossAmount / totalInvestment) * 100, 2),
      maxDrawdownPercent: roundToDecimal(
        ((stopLossPrice - averageEntryPrice) / stopLossPrice) * 100,
        2,
      ),
    },
    takeProfitPlans: takeProfitPlans,
    summary: generateShortSummary(
      entryPrices,
      allocations,
      averageEntryPrice,
      stopLossPrice,
      takeProfitPrice,
      stopLossAmount,
      takeProfitAmount,
      takeProfitPlans,
      entryCount,
      strategyType,
      bufferRatio,
    ),
  };
}

/**
 * 生成做空止盈方案
 */
function generateShortTakeProfitPlans(
  strategy,
  entryPrices,
  averageEntryPrice,
  takeProfitPrice,
  totalAllocated,
  stopLossPrice,
  rewardToRiskRatio,
  quantities,
) {
  const plans = [];

  switch (strategy) {
    case 'conservative':
      // 保守策略：统一在目标价位止盈（做空时目标价更低）
      plans.push({
        name: '统一止盈',
        description: `所有仓位在目标价位 ${roundToDecimal(takeProfitPrice, 4)} 止盈`,
        exitPrice: takeProfitPrice,
        exitPercentage: 100,
        profitAmount: roundToDecimal(
          (averageEntryPrice - takeProfitPrice) * quantities.reduce((a, b) => a + b, 0),
          2,
        ),
      });
      break;

    case 'aggressive':
      // 激进策略：分批止盈
      const levels = [0.5, 1.0, 2.0]; // 不同的盈亏比水平
      levels.forEach((level, index) => {
        // 做空时：目标价 = 平均入场价 - (止损距离 * 盈亏比 * level)
        const exitPrice =
          averageEntryPrice - (stopLossPrice - averageEntryPrice) * level * rewardToRiskRatio;
        const exitPercentage =
          index === levels.length - 1 ? 100 : Math.round(100 / (levels.length + 1));

        plans.push({
          name: `止盈阶段 ${index + 1}`,
          description: `盈亏比 ${level}:1，在 ${roundToDecimal(exitPrice, 4)} 止盈`,
          exitPrice: roundToDecimal(exitPrice, 4),
          exitPercentage: exitPercentage,
          profitAmount: roundToDecimal(
            (averageEntryPrice - exitPrice) *
              quantities.reduce((a, b) => a + b, 0) *
              (exitPercentage / 100),
            2,
          ),
        });
      });
      break;

    case 'technical':
      // 技术分析策略：根据支撑位设置多个止盈点
      const supportLevels = [
        averageEntryPrice * 0.98, // -2%
        averageEntryPrice * 0.95, // -5%
        averageEntryPrice * 0.92, // -8%
        takeProfitPrice, // 最终目标
      ];

      supportLevels.forEach((level, index) => {
        const isFinal = index === supportLevels.length - 1;
        const exitPercentage = isFinal ? 100 - 30 * (supportLevels.length - 1) : 30;

        plans.push({
          name: `支撑位 ${index + 1}`,
          description: `在支撑位 ${roundToDecimal(level, 4)} 止盈`,
          exitPrice: roundToDecimal(level, 4),
          exitPercentage: exitPercentage,
          profitAmount: roundToDecimal(
            (averageEntryPrice - level) *
              quantities.reduce((a, b) => a + b, 0) *
              (exitPercentage / 100),
            2,
          ),
        });
      });
      break;

    case 'partial':
      // 部分止盈策略：先止盈部分仓位，移动止损
      const firstExitPrice = averageEntryPrice - (stopLossPrice - averageEntryPrice); // 盈亏比1:1
      plans.push(
        {
          name: '部分止盈',
          description: '在盈亏比1:1时止盈50%仓位，移动止损至进场价',
          exitPrice: roundToDecimal(firstExitPrice, 4),
          exitPercentage: 50,
          profitAmount: roundToDecimal(
            (stopLossPrice - averageEntryPrice) * quantities.reduce((a, b) => a + b, 0) * 0.5,
            2,
          ),
          newStopLoss: roundToDecimal(averageEntryPrice, 4),
        },
        {
          name: '剩余仓位止盈',
          description: '剩余50%仓位在原目标价位止盈',
          exitPrice: takeProfitPrice,
          exitPercentage: 50,
          profitAmount: roundToDecimal(
            (averageEntryPrice - takeProfitPrice) * quantities.reduce((a, b) => a + b, 0) * 0.5,
            2,
          ),
        },
      );
      break;
  }

  return plans;
}

/**
 * 生成做空策略摘要
 */
function generateShortSummary(
  entryPrices,
  allocations,
  averageEntryPrice,
  stopLossPrice,
  takeProfitPrice,
  stopLossAmount,
  takeProfitAmount,
  takeProfitPlans,
  entryCount,
  strategyType,
  bufferRatio,
) {
  const firstEntryPrice = entryPrices[0];
  const lastEntryPrice = entryPrices[entryPrices.length - 1];
  const totalAllocated = allocations.reduce((a, b) => a + b, 0);

  return {
    overview: `做空策略 (${entryCount}次进仓，${strategyType}资金分配)`,
    priceRange: `价格区间: ${roundToDecimal(firstEntryPrice, 4)} - ${roundToDecimal(
      lastEntryPrice,
      4,
    )}`,
    riskManagement: `止损: ${roundToDecimal(stopLossPrice, 4)} (距最后进仓: ${roundToDecimal(
      ((stopLossPrice - lastEntryPrice) / stopLossPrice) * 100,
      2,
    )}%)`,
    profitTarget: `目标止盈: ${roundToDecimal(takeProfitPrice, 4)}`,
    capitalAllocation: `资金分配: ${roundToDecimal(totalAllocated, 2)} / 仓位`,
    riskReward: `风险回报: 亏损 ${roundToDecimal(stopLossAmount, 2)} | 盈利 ${roundToDecimal(
      takeProfitAmount,
      2,
    )}`,
    bufferInfo: `价格缓冲区: ${(bufferRatio * 100).toFixed(1)}%`,
  };
}

/**
 * 四舍五入到指定小数位
 */
function roundToDecimal(value, decimals) {
  if (value === 0) return 0;
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

// 示例使用
function simpleShortStrategy(param) {
  try {
    const {
      currentPrice,
      stopLossPrice,
      totalInvestment,
      rewardToRiskRatio,
      entryCount,
      strategyType,
      conservative,
    } = param;

    const strategy = calculateShortStrategy(
      currentPrice, // 当前价格 $100
      stopLossPrice, // 止损价格 $110（做空时止损价高于当前价）
      totalInvestment, // 总投资 $10,000
      rewardToRiskRatio, // 盈亏比 2:1
      entryCount, // 进仓3次
      strategyType, // 不等资金分配
      conservative, // 部分止盈策略
      0.05, // 1.5%的价格缓冲区
    );

    console.log('\n策略概览:');
    console.log(strategy.summary.overview);
    console.log(strategy.summary.priceRange);
    console.log(strategy.summary.riskManagement);
    console.log(strategy.summary.profitTarget);
    console.log(strategy.summary.capitalAllocation);
    console.log(strategy.summary.riskReward);

    console.log('\n关键计算:');
    console.log(`平均入场价: $${strategy.calculations.averageEntryPrice}`);
    console.log(`最后进仓价: $${strategy.calculations.lastEntryPrice}`);
    console.log(`最后进仓与止损距离: ${strategy.calculations.lastEntryBuffer}%`);
    console.log(`实际盈亏比: ${strategy.calculations.actualRewardRiskRatio}:1`);

    console.log('\n仓位详情:');
    strategy.entryPlan.entryDetails.forEach((detail) => {
      console.log(`\n第 ${detail.entryNumber} 次进仓:`);
      console.log(`  价格: $${detail.entryPrice} (权重: ${detail.weightPercentage}%)`);
      console.log(`  数量: ${detail.quantity} | 资金: $${detail.allocation}`);
      console.log(`  距离止损: ${detail.distanceFromStopLoss}%`);
      console.log(`  风险回报: ${detail.positionRiskRewardRatio}:1`);
    });

    console.log('\n风险指标:');
    console.log(`单仓位最大亏损: $${strategy.riskMetrics.maxSinglePositionLoss}`);
    console.log(`总风险金额: $${strategy.riskMetrics.totalPositionLoss}`);
    console.log(`风险比例: ${strategy.riskMetrics.riskPerTradePercent}%`);
    console.log(`所需胜率: ${strategy.riskMetrics.requiredWinRate}%`);

    console.log('\n止盈方案:');
    strategy.takeProfitPlans.forEach((plan, index) => {
      console.log(`\n${index + 1}. ${plan.name}:`);
      console.log(`  ${plan.description}`);
      console.log(`  止盈价: $${plan.exitPrice} | 比例: ${plan.exitPercentage}%`);
      console.log(`  盈利: $${plan.profitAmount}`);
    });

    return strategy;
  } catch (error) {
    console.error('错误:', error.message);
    return null;
  }
}


export { simpleShortStrategy };
