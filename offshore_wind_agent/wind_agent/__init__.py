"""
海上风电智能体包 (Offshore Wind Agent Package)
===============================================
提供海上风电预测、风险控制、强化学习调度、智能问答等功能模块。

核心导出:
  - OffshoreWindAgentSystem: 系统编排类 (预测 + 调度 + 问答)
  - OllamaAgentClient: 本地 LLM 问答客户端

子模块:
  - data_utils:   数据加载、清洗、特征工程
  - forecasting:  功率预测 (HistGBR + LightGBM 对比)
  - rl_control:   调度策略 (Q-Learning + DQN 对比, 启发式搜索, 遗传算法)
  - ollama_client: Ollama LLM 集成
  - system:       系统编排层
"""

import os

# 限制 joblib 使用的 CPU 核心数, 避免在部分 Windows 环境下并行序列化出错
os.environ.setdefault("LOKY_MAX_CPU_COUNT", "1")

from .ollama_client import OllamaAgentClient
from .system import OffshoreWindAgentSystem

__all__ = ["OffshoreWindAgentSystem", "OllamaAgentClient"]
