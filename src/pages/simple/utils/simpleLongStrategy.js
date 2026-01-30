function calculateLongStrategy(
  currentPrice,
  stopLossPrice,
  totalInvestment,
  rewardToRiskRatio,
  entryCount,
  strategyType,
  takeProfitStrategy
) {
  // 验证输入参数
  if (currentPrice <= stopLossPrice) {
    throw new Error('做多时当前价格必须高于止损价格');
  }

  if (entryCount < 3 || entryCount > 4) {
    throw new Error('进仓次数必须是3或4');
  }
  const bufferRatio = 0.05; // 缓冲区比例（5%）
  // 计算建仓价格点（从当前价格向下到接近止损价格）
  // 计算总价格范围（加上缓冲区，确保最后进仓高于止损价）
  const stopLossBuffer = stopLossPrice * (1 + bufferRatio); // 添加缓冲区，确保最后进仓不触及止损
  const priceRange = currentPrice - stopLossBuffer;
  const priceStep = priceRange / (entryCount - 1);

  let entryPrices = [];
  for (let i = 0; i < entryCount; i++) {
    entryPrices.push(currentPrice - i * priceStep);
  }

  // 计算资金分配（改良版）
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
      // 不等资金分配 - 偏向低位加仓（权重递增）
      // 权重：例如4次进仓，权重为 [1, 2, 3, 4]
      weights = Array.from({ length: entryCount }, (_, i) => i + 1);
      const totalWeight = weights.reduce((a, b) => a + b, 0);
      allocations = weights.map((weight) => (weight / totalWeight) * totalInvestment);
      break;

    case 'pyramid':
      // 金字塔式分配 - 高价位仓位小，低价位仓位大
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

  // // 计算平均建仓价格
  // let totalWeightedPrice = 0;
  // let totalAllocated = 0;

  // for (let i = 0; i < entryCount; i++) {
  //   totalWeightedPrice += entryPrices[i] * allocations[i];
  //   totalAllocated += allocations[i];
  // }

  // const averageEntryPrice = totalWeightedPrice / totalAllocated;

  // 计算每个仓位的数量
  const quantities = entryPrices.map((price, index) => allocations[index] / price);

  // 计算加权平均建仓价格
  let totalWeightedPrice = 0;
  let totalAllocated = 0;

  for (let i = 0; i < entryCount; i++) {
    totalWeightedPrice += entryPrices[i] * allocations[i];
    totalAllocated += allocations[i];
  }

  const averageEntryPrice = totalAllocated > 0 ? totalWeightedPrice / totalAllocated : 0;

  // 计算盈利目标价格
  const stopLossDistance = averageEntryPrice - stopLossPrice;
  const takeProfitDistance = stopLossDistance * rewardToRiskRatio;
  const takeProfitPrice = averageEntryPrice + takeProfitDistance;

  // 计算整体止损和盈利金额
  const totalQuantity = quantities.reduce((a, b) => a + b, 0);
  const stopLossAmount = (averageEntryPrice - stopLossPrice) * totalQuantity;
  const takeProfitAmount = (takeProfitPrice - averageEntryPrice) * totalQuantity;

  // 计算实际盈亏比
  const actualRewardRiskRatio = stopLossAmount > 0 ? takeProfitAmount / stopLossAmount : 0;

  // 生成仓位详情
  const entryDetails = entryPrices.map((price, index) => {
    const positionStopLossAmount = (price - stopLossPrice) * quantities[index];
    const positionTakeProfitDistance = (price - stopLossPrice) * rewardToRiskRatio;
    const positionTakeProfitPrice = price + positionTakeProfitDistance;
    const positionTakeProfitAmount = (positionTakeProfitPrice - price) * quantities[index];

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
      distanceFromStopLoss: roundToDecimal(((price - stopLossPrice) / stopLossPrice) * 100, 2),
    };
  });
  
  // 生成止盈方案
  const takeProfitPlans = generateLongTakeProfitPlans(
    takeProfitStrategy,
    averageEntryPrice,
    takeProfitPrice,
    totalAllocated,
    stopLossPrice,
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
      direction: 'LONG',
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
      averageEntryPrice: averageEntryPrice,
      stopLossPrice: stopLossPrice,
      takeProfitPrice: takeProfitPrice,
      stopLossAmount: stopLossAmount,
      takeProfitAmount: takeProfitAmount,
      actualRewardRiskRatio: actualRewardRiskRatio,
    },
    takeProfitPlans: takeProfitPlans,
    summary: generateLongSummary(
      entryPrices,
      allocations,
      averageEntryPrice,
      stopLossPrice,
      takeProfitPrice,
      stopLossAmount,
      takeProfitAmount,
      takeProfitPlans,
    ),
  };
}

/**
 * 生成做多止盈方案
 */
function generateLongTakeProfitPlans(strategy, avgPrice, baseTakeProfit, totalAllocated, stopLoss) {
  const plans = {};  
  switch (strategy) {
    case 'conservative':
      // 保守型：50%在目标位止盈，50%长期持有
      plans.firstTakeProfit = {
        price: baseTakeProfit,
        percentage: 0.5,
        amount: totalAllocated * 0.5,
        profit: (totalAllocated * 0.5 * (baseTakeProfit - avgPrice)) / avgPrice,
      };
      plans.remaining = {
        percentage: 0.5,
        amount: totalAllocated * 0.5,
        stopLoss: avgPrice, // 移动止损到盈亏平衡点
        description: '移动止损至盈亏平衡点，零风险长期持有',
      };
      break;

    case 'aggressive':
      // 激进型：阶梯式止盈
      const secondTarget = baseTakeProfit + (baseTakeProfit - avgPrice) * 0.5;

      plans.firstTakeProfit = {
        price: baseTakeProfit,
        percentage: 0.3,
        amount: totalAllocated * 0.3,
        profit: (totalAllocated * 0.3 * (baseTakeProfit - avgPrice)) / avgPrice,
      };

      plans.secondTakeProfit = {
        price: secondTarget,
        percentage: 0.4,
        amount: totalAllocated * 0.4,
        profit: (totalAllocated * 0.4 * (secondTarget - avgPrice)) / avgPrice,
      };

      plans.remaining = {
        percentage: 0.3,
        amount: totalAllocated * 0.3,
        stopLoss: baseTakeProfit, // 移动止损到第一目标位
        description: '移动止损至第一目标位，继续持有剩余仓位',
      };
      break;

    case 'technical':
      // 技术指标导向型
      plans.firstTakeProfit = {
        price: baseTakeProfit,
        percentage: 0.5,
        amount: totalAllocated * 0.5,
        profit: (totalAllocated * 0.5 * (baseTakeProfit - avgPrice)) / avgPrice,
      };

      plans.remaining = {
        percentage: 0.5,
        amount: totalAllocated * 0.5,
        description: '使用技术指标（如移动平均线）动态管理剩余仓位',
        exitCondition: '价格跌破20日移动平均线时平仓',
      };
      break;

    default:
      plans.simple = {
        price: baseTakeProfit,
        percentage: 1.0,
        amount: totalAllocated,
        profit: (totalAllocated * (baseTakeProfit - avgPrice)) / avgPrice,
      };
  }

  return plans;
}

function roundToDecimal(value, decimals) {
  if (value === 0) return 0;
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/**
 * 生成做多策略摘要
 */
function generateLongSummary(
  entryPrices,
  allocations,
  avgPrice,
  stopLoss,
  takeProfit,
  stopLossAmount,
  takeProfitAmount,
  takeProfitPlans,
) {
  return {
    entrySummary: `分${entryPrices.length}次建仓，价格区间: ${entryPrices[
      entryPrices.length - 1
    ].toFixed(3)} - ${entryPrices[0].toFixed(3)}，平均建仓价: ${avgPrice.toFixed(3)}`,
    riskSummary: `止损价格: ${stopLoss.toFixed(3)}，最大亏损: ${stopLossAmount.toFixed(2)}`,
    rewardSummary: `目标价格: ${takeProfit.toFixed(3)}，预期盈利: ${takeProfitAmount.toFixed(2)}`,
    ratioSummary: `盈亏比: ${(takeProfitAmount / stopLossAmount).toFixed(2)}:1`,
    planSummary: `采用${
      Object.keys(takeProfitPlans).length > 1 ? '分步止盈' : '一次性止盈'
    }策略，包含长期持有仓位`,
  };
}

/**
 * 格式化输出做多策略详情
 */
function formatLongStrategyOutput(strategy) {
  console.log('=== 做多交易策略 ===');
  console.log(
    `策略类型: ${strategy.strategy.type}资金分配 - ${strategy.strategy.entryCount}次进仓`,
  );
  console.log('');

  console.log('--- 建仓计划 ---');
  strategy.entryPlan.prices.forEach((price, index) => {
    console.error(
      `第${index + 1}次: 价格 ${price.toFixed(3)}, 资金 ${strategy.entryPlan.allocations[
        index
      ].toFixed(2)}`,
    );
  });
  console.log(`总投入资金: ${strategy.entryPlan.totalAllocated.toFixed(2)}`);
  console.log('');

  console.log('--- 关键计算 ---');
  console.log(`平均建仓价格: ${strategy.calculations.averageEntryPrice.toFixed(3)}`);
  console.log(`止损价格: ${strategy.calculations.stopLossPrice.toFixed(3)}`);
  console.error(`止盈价格: ${strategy.calculations.takeProfitPrice.toFixed(3)}`);
  console.error(`预计亏损: ${strategy.calculations.stopLossAmount.toFixed(2)}`);
  console.error(`预计盈利: ${strategy.calculations.takeProfitAmount.toFixed(2)}`);
  console.log(`实际盈亏比: ${strategy.calculations.actualRewardRiskRatio.toFixed(2)}:1`);
  console.log('');

  console.log('--- 止盈方案 ---');
  Object.keys(strategy.takeProfitPlans).forEach((key) => {
    const plan = strategy.takeProfitPlans[key];
    if (plan.price) {
      console.error(
        `${key}: 在 ${plan.price.toFixed(3)} 平仓 ${(plan.percentage * 100).toFixed(
          0,
        )}% 仓位，盈利 ${plan.profit.toFixed(2)}`,
      );
    } else {
      console.log(`${key}: ${plan.description}`);
      if (plan.stopLoss) {
        console.log(`   移动止损至: ${plan.stopLoss.toFixed(3)}`);
      }
      if (plan.exitCondition) {
        console.log(`   退出条件: ${plan.exitCondition}`);
      }
    }
  });
  console.log('');

  // console.log('--- 策略摘要 ---');
  // Object.values(strategy.summary).forEach((line) => {
  //   console.log(line);
  // });

  return strategy;
}

/**
 * 计算做多交易的风险回报分析
 */
function calculateLongRiskAnalysis(strategy) {
  const {
    averageEntryPrice,
    stopLossPrice,
    takeProfitPrice,
    stopLossAmount,
    takeProfitAmount,
  } = strategy.calculations;

  // 计算风险百分比
  const riskPercentage = (stopLossAmount / strategy.entryPlan.totalAllocated) * 100;

  // 计算潜在回报百分比
  const rewardPercentage = (takeProfitAmount / strategy.entryPlan.totalAllocated) * 100;

  // 计算成功率要求（基于凯利公式简化版）
  const requiredWinRate = 1 / (1 + strategy.calculations.actualRewardRiskRatio);

  return {
    riskPercentage: riskPercentage,
    rewardPercentage: rewardPercentage,
    requiredWinRate: requiredWinRate * 100,
    analysis: `此策略单次交易风险为总资金的${riskPercentage.toFixed(
      2,
    )}%，潜在回报为${rewardPercentage.toFixed(2)}%。根据盈亏比，要达到盈亏平衡需要至少${(
      requiredWinRate * 100
    ).toFixed(1)}%的胜率。`,
  };
}

/**
 * 做多交易策略计算函数
 * @param {number} currentPrice - 当前价格
 * @param {number} stopLossPrice - 止损价格
 * @param {number} totalInvestment - 总投资金额
 * @param {number} rewardToRiskRatio - 盈亏比
 * @param {number} entryCount - 进仓次数 (3或4)
 * @param {string} strategyType - 策略类型 ('equal'等资金, 'weighted'不等资金)
 * @param {string} takeProfitStrategy - 止盈策略 ('conservative 保守', 'aggressive 挑衅', 'technical 技术')
 * @returns {Object} 交易策略详情
 */

function longStrategy(param) {
  const {
    currentPrice,
    stopLossPrice,
    totalInvestment,
    rewardToRiskRatio,
    entryCount,
    strategyType,
    takeProfitStrategy,
  } = param;
  try {
    // 185,      // 当前价格
    // 175,      // 止损价格
    // 2000,     // 总投资金额
    // 3,        // 盈亏比
    // 3,        // 进仓次数
    // 'equal',  // 资金分配策略
    // 'conservative' // 止盈策略
    // 示例：当前价格185，止损175，总资金2000，盈亏比3:1，分3次进仓
    const longStrategy = calculateLongStrategy(
      currentPrice, // 当前价格
      stopLossPrice, // 止损价格
      totalInvestment, // 总投资金额
      rewardToRiskRatio, // 盈亏比
      entryCount, // 进仓次数
      strategyType, // 资金分配策略
      takeProfitStrategy, // 止盈策略
    );


    formatLongStrategyOutput(longStrategy);

    // // 添加风险分析
    const riskAnalysis = calculateLongRiskAnalysis(longStrategy);
    console.log('\n--- 风险回报分析 ---');
    console.log(riskAnalysis.analysis);

    // // // 比较不同策略
    // console.log("\n\n=== 比较不同做多策略 ===");
    // const aggressiveLongStrategy = calculateLongStrategy(
    //   185,
    //   175,
    //   2000,
    //   3,
    //   4,
    //   "weighted",
    //   "aggressive"
    // );

    // formatLongStrategyOutput(aggressiveLongStrategy);
  } catch (error) {
    console.error('错误:', error.message);
  }
}
export { longStrategy };
