"""
训练脚本入口 (Training Script Entry Point)
===========================================
每次运行都会执行完整训练流程, 结果保存到独立的时间戳目录:
  artifacts/runs/run_YYYYMMDD_HHMMSS/

支持多次训练:
  - 每次训练产生一个新的 run_<timestamp>/ 目录
  - 自动比较新旧结果, 更新 artifacts/best_run.txt 指向最优
  - app.py 的 serve 模式只加载 best_run.txt 指向的最优结果

运行方式:
  python train_system.py

查看训练结果:
  - 终端输出: 运行本脚本后在终端查看关键指标
  - TensorBoard: tensorboard --logdir=artifacts/runs
  - Web 前端: 启动 app.py 后访问 http://127.0.0.1:5173
  - 历史记录: artifacts/runs/ 目录下每次训练的完整快照
"""

from __future__ import annotations

from pathlib import Path

from wind_agent import OffshoreWindAgentSystem


def main() -> None:
    """主入口: 训练并保存结果"""
    project_root = Path(__file__).resolve().parent

    runs_dir = project_root / "artifacts" / "runs"
    existing_runs = sorted(runs_dir.glob("run_*/")) if runs_dir.exists() else []
    print(f"[Info] 历史训练记录: {len(existing_runs)} 次")
    if existing_runs:
        latest = existing_runs[-1]
        print(f"[Info] 最近一次: {latest.name}")
    print("[Info] 开始完整训练 (mode=train)...\n")

    # mode="train" — 训练并保存到新的 run_<timestamp>/ 目录
    system = OffshoreWindAgentSystem(project_root, mode="train")
    payload = system.get_dashboard_payload()
    run_info = system.run_info

    print("\n" + "=" * 60)
    print("  海上风电历史数据分析系统 — 训练完成")
    print("=" * 60)
    print(f"  版本: {system.version}")
    print(f"  本次训练: {run_info.get('run_name', 'unknown')}")
    print(f"  站点数: {payload['meta']['site_count']}")
    print(f"  --- 验证集精度 (有真实功率对比) ---")
    print(f"  验证集 MAE (HistGBR): {payload['model_metrics']['overall']['mae']:.2f} MW")
    print(f"  验证集 RMSE (HistGBR): {payload['model_metrics']['overall']['rmse']:.2f} MW")
    print(f"  --- 模型推演期 (2023-05~07, 无真实功率) ---")
    print(f"  推演期预估电量: {payload['model_metrics']['test_energy_mwh']:.2f} MWh")

    # 模型对比
    if payload.get("model_comparison"):
        comp = payload["model_comparison"]
        print(f"  --- 模型对比 ---")
        print(f"  HistGBR MAE: {comp['histgb_mae']:.2f} MW")
        print(f"  LightGBM MAE: {comp['lgbm_mae']:.2f} MW")
        print(f"  胜出模型: {comp.get('winner', 'N/A')}")

    # RL 算法对比
    if payload.get("rl_algorithm_comparison", {}).get("comparison"):
        rl_comp = payload["rl_algorithm_comparison"]["comparison"]
        print(f"  --- RL 算法对比 ---")
        print(f"  Q-Learning 平均奖励: {rl_comp['q_learning_reward']:.2f}")
        print(f"  DQN 平均奖励: {rl_comp['dqn_reward']:.2f}")
        print(f"  胜出算法: {rl_comp.get('winner', 'N/A')}")

    # 设备信息
    if system.dqn_agent is not None:
        print(f"  DQN 设备: {system.dqn_agent.device}")

    print("=" * 60)
    print(f"\n训练结果已保存至: artifacts/runs/{run_info.get('run_name', 'unknown')}/")
    print(f"最优结果标记:     artifacts/best_run.txt")
    print(f"启动 Web 服务:    python app.py")


if __name__ == "__main__":
    main()
